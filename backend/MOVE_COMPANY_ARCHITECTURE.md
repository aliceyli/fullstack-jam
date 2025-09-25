# Move Company Features - Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Components"
        CT[CompanyTable]
        CTT[CompanyTableToolbar]
        MDB[MoveDropdownButton]
        CMM[CompanyMoveMenu]
        CT --> CTT
        CT --> CMM
        CTT --> MDB
    end

    subgraph "API Layer"
        API_MC["/move-companies<br/>(sync)"]
        API_BM["/bulk-move<br/>(async)"]
        API_BS["/bulk-move-status/{id}<br/>(polling)"]
    end

    subgraph "Celery Task Queue"
        REDIS[(Redis Broker)]
        CW[Celery Worker]
        T_BULK[start_bulk_move<br/>Task]
        T_BATCH[bulk_move_companies_batch<br/>Task]

        REDIS --> CW
        CW --> T_BULK
        T_BULK --> T_BATCH
    end

    subgraph "Database Operations"
        DB[(PostgreSQL)]
        HELPERS[Helper Functions]
        subgraph "Helper Functions"
            H_DEL[delete_company_association]
            H_EXIST[association_exists]
            H_CREATE[create_company_association]
            H_GET[get_all_company_ids]
        end
        HELPERS --> DB
    end

    subgraph "Data Models"
        M_COMP[Company]
        M_COLL[CompanyCollection]
        M_ASSOC[CompanyCollectionAssociation]
    end

    %% Frontend to API connections
    CTT -->|Move Selected/All| API_BM
    CTT -->|Poll Status| API_BS
    CMM -->|Individual Move| API_MC

    %% API to Celery connections
    API_BM -->|start_bulk_move.delay()| REDIS
    API_BS -->|AsyncResult()| REDIS

    %% Celery to Database connections
    T_BULK -->|Batching Logic| HELPERS
    T_BATCH -->|DB Operations| HELPERS

    %% Data relationships
    M_ASSOC -->|company_id| M_COMP
    M_ASSOC -->|collection_id| M_COLL

    %% Styling
    classDef frontend fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef celery fill:#fff3e0
    classDef database fill:#e8f5e8
    classDef models fill:#fce4ec

    class CT,CTT,MDB,CMM frontend
    class API_MC,API_BM,API_BS api
    class REDIS,CW,T_BULK,T_BATCH celery
    class DB,HELPERS,H_DEL,H_EXIST,H_CREATE,H_GET database
    class M_COMP,M_COLL,M_ASSOC models
```

## Component Details

### Frontend Components

#### CompanyTableToolbar
- **Move Selected Button**: Uses `MoveDropdownButton` with selected company IDs
- **Move All Button**: Uses `MoveDropdownButton` with empty company_ids array
- **Progress Tracking**: Shows `LinearProgress` and percentage during bulk operations
- **State Management**: Manages `bulkMoveJobId` in localStorage for persistence

#### MoveDropdownButton (Reusable)
- **Dropdown Menu**: Shows collections as menu items
- **Action Trigger**: Calls `onMoveToCollection` with selected collection ID
- **Conditional Tooltip**: Only shows tooltip when text is provided
- **Disabled State**: Prevents multiple concurrent operations

#### CompanyMoveMenu
- **Three-dot Menu**: Individual row action menu (⋮ icon)
- **Collection Options**: Shows other collections (excludes current)
- **Immediate Action**: Direct move operation without batching

### API Endpoints

#### `/collections/move-companies` (Synchronous)
```python
- Input: MoveCompaniesRequest (company_ids, from_collection_id, to_collection_id)
- Output: MoveCompaniesResponse (moved_count, message)
- Use Case: Small batches, individual company moves
- Processing: Direct database operations with transaction management
```

#### `/collections/bulk-move` (Asynchronous)
```python
- Input: BulkMoveRequest (from_collection_id, to_collection_id, company_ids?)
- Output: BulkMoveResponse (operation_id, batch_task_ids, total_batches, status)
- Use Case: Large operations, selected companies or all companies
- Processing: Queues Celery task, returns immediately with operation_id
```

#### `/collections/bulk-move-status/{operation_id}` (Polling)
```python
- Input: operation_id (string)
- Output: BulkMoveStatusResponse (progress_percentage, completed_batches, etc.)
- Use Case: Real-time progress tracking
- Processing: Checks main task + all batch task statuses
```

### Celery Tasks

#### `start_bulk_move` (Main Task)
```python
- Parameters: from_collection_id, to_collection_id, company_ids (optional)
- Logic:
  1. Get company IDs (specific list or all from collection)
  2. Split into batches of 100 companies
  3. Queue batch tasks with .delay()
  4. Return task metadata (batch_task_ids, total_batches)
```

#### `bulk_move_companies_batch` (Worker Task)
```python
- Parameters: company_ids (list), from_collection_id, to_collection_id
- Logic:
  1. Process each company in the batch
  2. Delete old association, create new association
  3. Skip if already in target collection
  4. Commit transaction, return moved_count
```

### Helper Functions (backend/helpers/collections.py)

```python
- delete_company_association(db, company_id, collection_id) -> bool
- association_exists(db, company_id, collection_id) -> bool
- create_company_association(db, company_id, collection_id)
- get_all_company_ids(db, collection_id) -> list[int]
- validate_collection_exists(db, collection_id, name) -> CompanyCollection
- validate_companies_in_collection(db, company_ids, collection_id)
```

## Data Flow Examples

### Bulk Move Selected Companies
```
1. User selects companies → clicks "Move Selected" → chooses target collection
2. Frontend calls /bulk-move with company_ids array
3. API queues start_bulk_move.delay() → returns operation_id
4. Frontend polls /bulk-move-status/{operation_id} every 2 seconds
5. Celery splits companies into batches → queues batch tasks
6. Workers process batches in parallel → update progress
7. Frontend shows progress bar → completion message
```

### Individual Company Move
```
1. User clicks ⋮ menu → selects target collection
2. Frontend calls /move-companies with single company_id
3. API processes immediately → returns result
4. Frontend refreshes table data
```

## Technology Stack
- **Frontend**: React + TypeScript + Material-UI + axios
- **Backend**: FastAPI + SQLAlchemy + Pydantic
- **Task Queue**: Celery + Redis
- **Database**: PostgreSQL
- **Containerization**: Docker + docker-compose