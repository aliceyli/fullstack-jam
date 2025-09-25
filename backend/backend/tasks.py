from celery_app import celery_app
import uuid
from backend.helpers.collections import (
    delete_company_association,
    association_exists,
    create_company_association,
    get_all_company_ids
)
import logging

logger = logging.getLogger(__name__)


@celery_app.task
def bulk_move_companies_batch(company_ids: list[int], from_collection_id: uuid.UUID, to_collection_id: uuid.UUID):
    '''
    Moves a batch of companies from one collection to another
    '''
    from backend.db import database

    db = database.SessionLocal()
    moved_count = 0

    logger.info(f"Starting batch move of {len(company_ids)} companies")

    try:
        for company_id in company_ids:
            if delete_company_association(db, company_id, from_collection_id):
                if not association_exists(db, company_id, to_collection_id):
                    create_company_association(db, company_id, to_collection_id)
                    moved_count += 1

        db.commit()
        logger.info(f"Successfully moved {moved_count} companies")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to move companies: {e}")
        raise e
    finally:
        db.close()

    print(f"Completed moving {moved_count} companies")
    return moved_count



@celery_app.task
def start_bulk_move(from_collection_id: uuid.UUID, to_collection_id: uuid.UUID, company_ids: list[int] = None):
    '''
    Splits collection companies into batches for workers to move from one collection to another.
    If company_ids is provided, only move those companies. Otherwise, move all companies.
    '''
    from backend.db import database

    db = database.SessionLocal()

    if company_ids:
        all_company_ids = company_ids
    else:
        all_company_ids = get_all_company_ids(db, from_collection_id)

    batches = [all_company_ids[i:i+100] for i in range(0, len(all_company_ids), 100)]

    task_ids = []
    for batch in batches:
        result = bulk_move_companies_batch.delay(batch, from_collection_id, to_collection_id)
        task_ids.append(result.id)

    db.close()

    return {"batch_task_ids": task_ids, "total_batches": len(batches), "from_collection_id": from_collection_id,"to_collection_id": to_collection_id}