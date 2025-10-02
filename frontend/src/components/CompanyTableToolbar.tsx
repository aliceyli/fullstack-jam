import { LinearProgress, Box, Typography } from "@mui/material";
import {
  IBulkMoveRequest,
  moveAllCompaniesToCollections,
  getBulkMoveStatus,
} from "../utils/jam-api";
import { GridRowSelectionModel } from "@mui/x-data-grid";
import { ICollection } from "../utils/jam-api";
import { useState, useRef, useEffect } from "react";
import useInterval from "../hooks/useInterval";
import MoveDropdownButton from "./MoveDropdownButton";

interface CompanyTableToolbarProps {
  selectedCollectionId: string;
  allCollections: ICollection[] | undefined;
  selectedCompanyIds: GridRowSelectionModel;
  loading: boolean;
  resetSelections: () => void;
  totalTableCount: number;
  onMoveComplete: () => Promise<void>;
}

const CompanyTableToolbar = ({
  selectedCollectionId,
  allCollections,
  selectedCompanyIds,
  loading,
  resetSelections,
  totalTableCount,
  onMoveComplete,
}: CompanyTableToolbarProps) => {
  const [moveSelectedLoading, setMoveSelectedLoading] = useState(false);
  const [moveAllLoading, setMoveAllLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bulkMoveJobId, setBulkMoveJobId] = useState<string | null>(() => {
    return localStorage.getItem("bulkMoveJobId");
  });
  const [bulkMoveStatus, setBulkMoveStatus] = useState<string | null>();
  const [bulkMovePercent, setBulkMovePercent] = useState<number>(0);
  const [showCompletedStatus, setShowCompletedStatus] =
    useState<boolean>(false);

  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bulkMoveInProgress = !!bulkMoveJobId;

  const collectionOptions =
    allCollections?.filter((c) => c.id != selectedCollectionId) || [];

  const startBulkMove = async (
    toCollectionId: string,
    companyIds: number[] = [],
    setButtonLoading: (arg0: boolean) => void
  ) => {
    const moveData: IBulkMoveRequest = {
      from_collection_id: selectedCollectionId,
      to_collection_id: toCollectionId,
      company_ids: companyIds,
    };

    setError(null);
    setButtonLoading(true);

    try {
      const response = await moveAllCompaniesToCollections(moveData);
      setBulkMoveJobId(response.operation_id);
      localStorage.setItem("bulkMoveJobId", response.operation_id);
      if (selectedCollectionId.length > 0) resetSelections();

      return response;
    } catch (err) {
      console.error("Failed to move companies:", err);
      setError(err instanceof Error ? err.message : "Failed to move companies");
      throw err;
    } finally {
      setButtonLoading(false);
    }
  };

  const handleSelectedMove = async (toCollectionId: string) => {
    if (selectedCompanyIds.length === 0) return;

    await startBulkMove(
      toCollectionId,
      selectedCompanyIds.map((id) => Number(id)),
      setMoveSelectedLoading
    );
  };

  const handleMoveAll = async (toCollectionId: string) => {
    await startBulkMove(toCollectionId, [], setMoveAllLoading); // empty array means move all companies
  };

  const getMoveStatus = async (operation_id: string | null) => {
    if (!operation_id) {
      return;
    }
    const resetMoveStatus = () => {
      setBulkMoveJobId(null);
      localStorage.removeItem("bulkMoveJobId");
      setBulkMovePercent(0);
      setBulkMoveStatus(null);
    };

    try {
      const response = await getBulkMoveStatus(operation_id);
      setBulkMovePercent(response.progress_percentage);
      setBulkMoveStatus(response.status);

      if (
        response.status === "completed" ||
        response.status === "completed_with_errors" ||
        response.status === "failed"
      ) {
        setShowCompletedStatus(true);
        if (completionTimeoutRef.current) {
          clearTimeout(completionTimeoutRef.current);
        }
        completionTimeoutRef.current = setTimeout(() => {
          setShowCompletedStatus(false);
          resetMoveStatus();
          completionTimeoutRef.current = null;
        }, 3000);
      }
    } catch (error) {
      console.error("Error getting bulk move status:", error);
      resetMoveStatus();
    }
  };

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      bulkMoveStatus === "completed" ||
      bulkMoveStatus === "completed_with_errors"
    ) {
      onMoveComplete();
    }
  }, [bulkMoveStatus]);

  useInterval(
    () => getMoveStatus(bulkMoveJobId),
    bulkMoveInProgress && !showCompletedStatus ? 2000 : null
  );

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
          buttonText={`Move Selected (${selectedCompanyIds.length})`}
          tooltipText={
            selectedCompanyIds.length === 0
              ? "Select companies below to move to another collection"
              : ""
          }
          collections={collectionOptions}
          onMoveToCollection={handleSelectedMove}
          disabled={
            loading ||
            moveSelectedLoading ||
            selectedCompanyIds.length === 0 ||
            bulkMoveInProgress
          }
          menuItemPrefix="Move to"
          isLoading={moveSelectedLoading}
        />

        <MoveDropdownButton
          buttonText={`Move All (${totalTableCount})`}
          collections={collectionOptions}
          onMoveToCollection={handleMoveAll}
          disabled={loading || moveAllLoading || bulkMoveInProgress}
          menuItemPrefix="Move all to"
          isLoading={moveAllLoading}
        />

        {(bulkMoveInProgress || showCompletedStatus) && (
          <>
            <Box sx={{ width: "20%" }}>
              <LinearProgress variant="determinate" value={bulkMovePercent} />
            </Box>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {showCompletedStatus
                ? `${
                    bulkMoveStatus === "completed"
                      ? "✓"
                      : bulkMoveStatus === "failed"
                      ? "✗"
                      : "!"
                  } ${bulkMoveStatus}`
                : `${Math.round(bulkMovePercent)}% complete`}
            </Typography>
          </>
        )}
      </div>
    </>
  );
};

export default CompanyTableToolbar;
