import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db import database
from backend.tasks import start_bulk_move as start_bulk_move_task
from celery_app import celery_app
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
)
from backend.helpers.collections import (
    validate_collection_exists,
    validate_companies_in_collection,
    delete_company_association,
    association_exists,
    create_company_association
)

router = APIRouter(
    prefix="/collections",
    tags=["collections"],
)


class CompanyCollectionMetadata(BaseModel):
    id: uuid.UUID
    collection_name: str


class CompanyCollectionOutput(CompanyBatchOutput, CompanyCollectionMetadata):
    pass


class MoveCompaniesRequest(BaseModel):
    company_ids: list[int]
    from_collection_id: uuid.UUID
    to_collection_id: uuid.UUID


class MoveCompaniesResponse(BaseModel):
    moved_count: int
    message: str


class BulkMoveRequest(BaseModel):
    from_collection_id: uuid.UUID
    to_collection_id: uuid.UUID
    company_ids: list[int] = []


class BulkMoveResponse(BaseModel):
    operation_id: str
    batch_task_ids: list[str]
    total_batches: int
    status: str


class BulkMoveStatusResponse(BaseModel):
    operation_id: str
    total_batches: int
    completed_batches: int
    failed_batches: int
    progress_percentage: float
    status: str


@router.get("", response_model=list[CompanyCollectionMetadata])
def get_all_collection_metadata(
    db: Session = Depends(database.get_db),
):
    collections = db.query(database.CompanyCollection).all()

    return [
        CompanyCollectionMetadata(
            id=collection.id,
            collection_name=collection.collection_name,
        )
        for collection in collections
    ]


@router.get("/{collection_id}", response_model=CompanyCollectionOutput)
def get_company_collection_by_id(
    collection_id: uuid.UUID,
    offset: int = Query(
        0, description="The number of items to skip from the beginning"
    ),
    limit: int = Query(10, description="The number of items to fetch"),
    db: Session = Depends(database.get_db),
):
    query = (
        db.query(database.CompanyCollectionAssociation, database.Company)
        .join(database.Company)
        .filter(database.CompanyCollectionAssociation.collection_id == collection_id)
    )

    total_count = query.with_entities(func.count()).scalar()

    results = query.offset(offset).limit(limit).all()
    companies = fetch_companies_with_liked(db, [company.id for _, company in results])

    return CompanyCollectionOutput(
        id=collection_id,
        collection_name=db.query(database.CompanyCollection)
        .get(collection_id)
        .collection_name,
        companies=companies,
        total=total_count,
    )


@router.post("/move-companies", response_model=MoveCompaniesResponse)
def move_companies(
    request: MoveCompaniesRequest,
    db: Session = Depends(database.get_db),
):
    """
    Move companies from one collection to another synchronously
    (Meant for a small batch of moves. Use /bulk-move-all for larger amounts)

    """
    from_collection = validate_collection_exists(db, request.from_collection_id, "Source")
    to_collection = validate_collection_exists(db, request.to_collection_id, "Destination")
    validate_companies_in_collection(db, request.company_ids, request.from_collection_id)

    try:
        moved_count = 0

        for company_id in request.company_ids:
            if delete_company_association(db, company_id, request.from_collection_id):
                if not association_exists(db, company_id, request.to_collection_id):
                    create_company_association(db, company_id, request.to_collection_id)
                    moved_count += 1

        db.commit()

        return MoveCompaniesResponse(
            moved_count=moved_count,
            message=f"Successfully moved {moved_count} companies from {from_collection.collection_name} to {to_collection.collection_name}"
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to move companies: {str(e)}")


@router.post("/bulk-move", response_model=BulkMoveResponse)
def start_bulk_move(
    request: BulkMoveRequest,
    db: Session = Depends(database.get_db),
):
    """
    Start async job to move companies from one collection to another.
    If company_ids is provided, only move those companies. Otherwise move all.
    """
    company_ids = request.company_ids if request.company_ids else None
    result = start_bulk_move_task.delay(request.from_collection_id, request.to_collection_id, company_ids)

    return BulkMoveResponse(
        operation_id=result.id,
        batch_task_ids=[], 
        total_batches=0, 
        status="started"
    )

def _create_status_response(operation_id: str, status: str, **kwargs):
    """Helper to create BulkMoveStatusResponse with defaults"""
    defaults = {
        "operation_id": operation_id,
        "total_batches": 0,
        "completed_batches": 0,
        "failed_batches": 0,
        "progress_percentage": 0.0,
        "status": status
    }
    defaults.update(kwargs)
    return BulkMoveStatusResponse(**defaults)

@router.get("/bulk-move-status/{operation_id}", response_model=BulkMoveStatusResponse)
def get_bulk_move_status(operation_id: str):
    """Get the status of a bulk move operation (coordinator task only)"""
    main_task = celery_app.AsyncResult(operation_id)

    # Verify this is a coordinator task by checking the task name
    if main_task.name and main_task.name != "backend.tasks.start_bulk_move":
        raise HTTPException(status_code=400, detail="Invalid operation_id: not a coordinator task")

    if main_task.state == 'PENDING':
        return _create_status_response(operation_id, "pending")
    if main_task.state == 'FAILURE':
        return _create_status_response(operation_id, "failed")

    if main_task.state == 'SUCCESS':
        result = main_task.result

        batch_task_ids = result.get("batch_task_ids", [])
        total_batches = result.get("total_batches", 0)

        if total_batches == 0:
            return _create_status_response(operation_id, "completed", progress_percentage=100.0)

        completed = sum(1 for tid in batch_task_ids if celery_app.AsyncResult(tid).state == 'SUCCESS')
        failed = sum(1 for tid in batch_task_ids if celery_app.AsyncResult(tid).state == 'FAILURE')

        progress = (completed / total_batches) * 100 if total_batches > 0 else 100.0
        if completed + failed == total_batches:
            status = "completed" if failed == 0 else "completed_with_errors"
        else:
            status = "processing"

        return _create_status_response(
            operation_id, 
            status,
            total_batches=total_batches,
            completed_batches=completed,
            failed_batches=failed,
            progress_percentage=progress
        )

    return _create_status_response(operation_id, "initializing")

