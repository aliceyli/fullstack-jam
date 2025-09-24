import { DataGrid, GridRowSelectionModel } from "@mui/x-data-grid";
import { useCallback, useEffect, useState } from "react";
import { getCollectionsById, ICompany, ICollection } from "../utils/jam-api";
import CompanyTableToolbar from "./CompanyTableToolbar";

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
  const [error, setError] = useState<string | null>(null); // TODO: handle and display errors

  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);

  const [collectionIdDest, setCollectionIdDest] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] =
    useState<GridRowSelectionModel>([]);

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
    setCollectionIdDest("");
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
        collectionIdDest={collectionIdDest}
        setCollectionIdDest={setCollectionIdDest}
        selectedCollectionId={selectedCollectionId}
        allCollections={allCollections}
        selectedCompanyIds={selectedCompanyIds}
        loading={loading}
        resetSelections={resetSelections}
        fetchCollections={fetchCollections}
      />
      <DataGrid
        rows={response}
        loading={loading}
        rowHeight={30}
        columns={[
          { field: "liked", headerName: "Liked", width: 90 },
          { field: "id", headerName: "ID", width: 90 },
          { field: "company_name", headerName: "Company Name", width: 200 },
        ]}
        rowCount={total}
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
    </div>
  );
};

export default CompanyTable;
