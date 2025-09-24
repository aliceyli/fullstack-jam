import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db import database
from backend.routes.companies import (
    CompanyBatchOutput,
    fetch_companies_with_liked,
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


def _validate_collection_exists(db: Session, collection_id: uuid.UUID, collection_type: str):
    """Helper function to validate a collection exists"""
    collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == collection_id
    ).first()

    if not collection:
        raise HTTPException(
            status_code=404,
            detail=f"{collection_type} collection {collection_id} not found"
        )

    return collection


def _validate_companies_in_collection(db: Session, company_ids: list[int], collection_id: uuid.UUID):
    """Helper function to validate companies exist in the specified collection"""
    existing_associations = db.query(database.CompanyCollectionAssociation).filter(
        database.CompanyCollectionAssociation.company_id.in_(company_ids),
        database.CompanyCollectionAssociation.collection_id == collection_id
    ).all()

    found_company_ids = {assoc.company_id for assoc in existing_associations}
    missing_company_ids = set(company_ids) - found_company_ids

    if missing_company_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Companies {list(missing_company_ids)} not found in source collection"
        )


@router.post("/move-companies", response_model=MoveCompaniesResponse)
def move_companies(
    request: MoveCompaniesRequest,
    db: Session = Depends(database.get_db),
):
    """
    Move a small number of companies from one collection to another

    This endpoint:
    1. Removes companies from the source collection
    2. Adds companies to the destination collection
    3. Handles cases where companies might already exist in the destination
    """
    from_collection = _validate_collection_exists(db, request.from_collection_id, "Source")
    to_collection = _validate_collection_exists(db, request.to_collection_id, "Destination")
    _validate_companies_in_collection(db, request.company_ids, request.from_collection_id)

    try:
        db.query(database.CompanyCollectionAssociation).filter(
            database.CompanyCollectionAssociation.company_id.in_(request.company_ids),
            database.CompanyCollectionAssociation.collection_id == request.from_collection_id
        ).delete(synchronize_session=False)

        moved_count = 0
        for company_id in request.company_ids:
            existing = db.query(database.CompanyCollectionAssociation).filter(
                database.CompanyCollectionAssociation.company_id == company_id,
                database.CompanyCollectionAssociation.collection_id == request.to_collection_id
            ).first()

            if not existing:
                new_association = database.CompanyCollectionAssociation(
                    company_id=company_id,
                    collection_id=request.to_collection_id
                )
                db.add(new_association)
                moved_count += 1

        db.commit()

        return MoveCompaniesResponse(
            moved_count=moved_count,
            message=f"Successfully moved {moved_count} companies from {from_collection.collection_name} to {to_collection.collection_name}"
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to move companies: {str(e)}")
