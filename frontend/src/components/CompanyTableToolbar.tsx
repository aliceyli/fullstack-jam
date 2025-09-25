import { LinearProgress, Box, Typography } from "@mui/material";
import {
  IBulkMoveRequest,
  moveAllCompaniesToCollections,
  getBulkMoveStatus,
} from "../utils/jam-api";
import { GridRowSelectionModel } from "@mui/x-data-grid";
import { ICollection } from "../utils/jam-api";
import { useState } from "react";
import useInterval from "../hooks/useInterval";
import MoveDropdownButton from "./MoveDropdownButton";

interface CompanyTableToolbarProps {
  selectedCollectionId: string;
  allCollections: ICollection[] | undefined;
  selectedCompanyIds: GridRowSelectionModel;
  loading: boolean;
  resetSelections: () => void;
  totalTableCount: number;
}

const CompanyTableToolbar = ({
  selectedCollectionId,
  allCollections,
  selectedCompanyIds,
  loading,
  resetSelections,
  totalTableCount,
}: CompanyTableToolbarProps) => {
  const [moveLoading, setMoveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bulkMoveJobId, setBulkMoveJobId] = useState<string | null>(() => {
    return localStorage.getItem("bulkMoveJobId");
  });
  const [bulkMovePercent, setBulkMovePercent] = useState<number>(0);

  const bulkMoveStarted = !!bulkMoveJobId;

  const collectionOptions =
    allCollections?.filter((c) => c.id != selectedCollectionId) || [];

  const startBulkMove = async (
    toCollectionId: string,
    companyIds: number[] = []
  ) => {
    const moveData: IBulkMoveRequest = {
      from_collection_id: selectedCollectionId,
      to_collection_id: toCollectionId,
      company_ids: companyIds,
    };

    setError(null);

    try {
      const response = await moveAllCompaniesToCollections(moveData);
      setBulkMoveJobId(response.operation_id);
      localStorage.setItem("bulkMoveJobId", response.operation_id);
      return response;
    } catch (err) {
      console.error("Failed to move companies:", err);
      setError(err instanceof Error ? err.message : "Failed to move companies");
      throw err;
    }
  };

  const handleSelectedMove = async (toCollectionId: string) => {
    if (selectedCompanyIds.length === 0) return;

    setMoveLoading(true);
    try {
      await startBulkMove(
        toCollectionId,
        selectedCompanyIds.map((id) => Number(id))
      );
      resetSelections();
    } finally {
      setMoveLoading(false);
    }
  };

  const handleMoveAll = async (toCollectionId: string) => {
    await startBulkMove(toCollectionId); // Empty array means move all companies
  };

  const getMoveStatus = async (operation_id: string | null) => {
    if (!operation_id) {
      return;
    }
    const response = await getBulkMoveStatus(operation_id);
    setBulkMovePercent(response.progress_percentage);
    console.log("progress:", response.progress_percentage);

    if (
      response.status === "completed" ||
      response.status === "completed_with_errors" ||
      response.status === "failed"
    ) {
      setBulkMoveJobId(null);
      localStorage.removeItem("bulkMoveJobId");
    }
  };

  useInterval(() => getMoveStatus(bulkMoveJobId), 2000);

  return (
    <>
      {error && (
        <div
          style={{
            color: "red",
            marginBottom: 16,
            padding: 8,
            backgroundColor: "#fddadfff",
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <MoveDropdownButton
          buttonText={
            moveLoading
              ? "Moving..."
              : `Move Selected (${selectedCompanyIds.length})`
          }
          tooltipText={
            selectedCompanyIds.length === 0
              ? "Select companies below to move to another collection"
              : ""
          }
          collections={collectionOptions}
          onMoveToCollection={handleSelectedMove}
          disabled={
            loading ||
            moveLoading ||
            selectedCompanyIds.length === 0 ||
            bulkMoveStarted
          }
          menuItemPrefix="Move to"
        />

        <MoveDropdownButton
          buttonText={`Move All (${totalTableCount})`}
          collections={collectionOptions}
          onMoveToCollection={handleMoveAll}
          disabled={loading || bulkMoveStarted}
          menuItemPrefix="Move all to"
        />

        {bulkMoveStarted && (
          <>
            <Box sx={{ width: "20%" }}>
              <LinearProgress variant="determinate" value={bulkMovePercent} />
            </Box>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary" }}
            >{`${Math.round(bulkMovePercent)}% Complete`}</Typography>
          </>
        )}
      </div>
    </>
  );
};

export default CompanyTableToolbar;
