import { DataGrid, GridRowSelectionModel } from "@mui/x-data-grid";
import { useCallback, useEffect, useState } from "react";
import { getCollectionsById, ICompany, ICollection } from "../utils/jam-api";
import CompanyTableToolbar from "./CompanyTableToolbar";
import CompanyMoveMenu from "./CompanyMoveMenu";
import { IconButton } from "@mui/material";

const CompanyTable = ({
  selectedCollectionId,
  allCollections,
}: {
  selectedCollectionId: string;
  allCollections: ICollection[] | undefined;
}) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);

  const [selectedCompanyIds, setSelectedCompanyIds] =
    useState<GridRowSelectionModel>([]);

  const [activeMenuCompanyId, setActiveMenuCompanyId] = useState<number | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  const fetchCollections = useCallback(async () => {
    if (!selectedCollectionId) return;

    setLoading(true);
    setError(null);

    try {
      const newResponse = await getCollectionsById(
        selectedCollectionId,
        offset,
        pageSize
      );
      setResponse(newResponse.companies);
      setTotal(newResponse.total);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while getting this collection"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCollectionId, offset, pageSize]);

  const resetSelections = () => {
    setOffset(0);
    setSelectedCompanyIds([]);
  };

  const handleActionMenuClick = (companyId: number, anchorEl: HTMLElement) => {
    setActiveMenuCompanyId(companyId);
    setMenuAnchorEl(anchorEl);
  };

  const handleMenuClose = () => {
    setActiveMenuCompanyId(null);
    setMenuAnchorEl(null);
  };

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    resetSelections();
  }, [selectedCollectionId]);

  return (
    <div style={{ height: 600, width: "100%" }}>
      <CompanyTableToolbar
        selectedCollectionId={selectedCollectionId}
        allCollections={allCollections}
        selectedCompanyIds={selectedCompanyIds}
        loading={loading}
        resetSelections={resetSelections}
        totalTableCount={total ?? 0}
      />
      <DataGrid
        rows={response}
        loading={loading}
        slotProps={{
          loadingOverlay: {
            variant: "linear-progress",
            noRowsVariant: "skeleton",
          },
        }}
        rowHeight={30}
        columns={[
          { field: "liked", headerName: "Liked", width: 90 },
          { field: "id", headerName: "ID", width: 90 },
          { field: "company_name", headerName: "Company Name", width: 200 },
          {
            field: "actions",
            type: "actions",
            headerName: "Move",
            getActions: (params) => [
              <IconButton
                key={params.id}
                size="small"
                onClick={(event) => handleActionMenuClick(params.id as number, event.currentTarget)}
              >
                ⋮
              </IconButton>,
            ],
            width: 80,
          },
        ]}
        rowCount={total || 0}
        checkboxSelection
        onRowSelectionModelChange={(ids) => {
          setSelectedCompanyIds(ids);
        }}
        rowSelectionModel={selectedCompanyIds}
        pagination
        paginationMode="server"
        paginationModel={{
          page: Math.floor(offset / pageSize),
          pageSize: pageSize,
        }}
        onPaginationModelChange={(newMeta) => {
          setPageSize(newMeta.pageSize);
          setOffset(newMeta.page * newMeta.pageSize);
        }}
        keepNonExistentRowsSelected
      />
      {activeMenuCompanyId && menuAnchorEl && (
        <CompanyMoveMenu
          companyId={activeMenuCompanyId}
          currentCollectionId={selectedCollectionId}
          allCollections={allCollections}
          onMoveComplete={async () => {
            handleMenuClose();
            await fetchCollections();
          }}
          anchorEl={menuAnchorEl}
          onClose={handleMenuClose}
        />
      )}
    </div>
  );
};

export default CompanyTable;
