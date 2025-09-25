import uuid
from fastapi import HTTPException
from sqlalchemy.orm import Session
from backend.db import database

def get_all_company_ids(db: Session, collection_id):
    """
    return 
    """
    all_company_associations = db.query(database.CompanyCollectionAssociation).filter(
    database.CompanyCollectionAssociation.collection_id == collection_id
    ).all()
    
    return [assoc.company_id for assoc in all_company_associations]

def validate_collection_exists(db: Session, collection_id: uuid.UUID, collection_type: str):
    """
    Validate a collection exists
    """
    collection = db.query(database.CompanyCollection).filter(
        database.CompanyCollection.id == collection_id
    ).first()

    if not collection:
        raise HTTPException(
            status_code=404,
            detail=f"{collection_type} collection {collection_id} not found"
        )

    return collection


def validate_companies_in_collection(db: Session, company_ids: list[int], collection_id: uuid.UUID):
    """
    Validate companies exist in the specified collection
    """
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



def association_exists(db: Session, company_id: int, collection_id: uuid.UUID) -> bool:
    """
    Check if a company-collection association already exists
    """
    existing = db.query(database.CompanyCollectionAssociation).filter(
        database.CompanyCollectionAssociation.company_id == company_id,
        database.CompanyCollectionAssociation.collection_id == collection_id
    ).first()

    return existing is not None

def delete_company_association(db: Session, company_id: int, collection_id: uuid.UUID) -> bool:
    """
    Delete a company-collection association
    """
    deleted_count = db.query(database.CompanyCollectionAssociation).filter(
        database.CompanyCollectionAssociation.company_id == company_id,
        database.CompanyCollectionAssociation.collection_id == collection_id
    ).delete()

    return deleted_count > 0


def create_company_association(db: Session, company_id: int, collection_id: uuid.UUID) -> database.CompanyCollectionAssociation:
    """
    Create a new company collection association
    """
    new_association = database.CompanyCollectionAssociation(
        company_id=company_id,
        collection_id=collection_id
    )
    db.add(new_association)
    return new_association