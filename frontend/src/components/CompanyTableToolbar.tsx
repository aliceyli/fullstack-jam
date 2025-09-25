import {
  Button,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Tooltip,
} from "@mui/material";
import {
  IMoveCompaniesRequest,
  moveCompaniesToCollections,
  moveAllCompaniesToCollections,
} from "../utils/jam-api";
import { GridRowSelectionModel } from "@mui/x-data-grid";
import { ICollection } from "../utils/jam-api";
import { useState } from "react";

interface CompanyTableToolbarProps {
  collectionIdDest: string;
  setCollectionIdDest: (id: string) => void;
  selectedCollectionId: string;
  allCollections: ICollection[] | undefined;
  selectedCompanyIds: GridRowSelectionModel;
  loading: boolean;
  resetSelections: () => void;
  fetchCollections: () => Promise<void>;
}

const CompanyTableToolbar = ({
  collectionIdDest,
  setCollectionIdDest,
  selectedCollectionId,
  allCollections,
  selectedCompanyIds,
  loading,
  resetSelections,
  fetchCollections,
}: CompanyTableToolbarProps) => {
  const [moveLoading, setMoveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collectionOptions = allCollections?.filter(
    (c) => c.id != selectedCollectionId
  );

  const handleSelection = (e: SelectChangeEvent) => {
    setCollectionIdDest(e.target.value);
  };

  const handleSelectedMove = async () => {
    if (!collectionIdDest || selectedCompanyIds.length === 0) {
      return;
    }

    const moveData: IMoveCompaniesRequest = {
      company_ids: selectedCompanyIds.map((id) => Number(id)),
      from_collection_id: selectedCollectionId,
      to_collection_id: collectionIdDest,
    };

    setMoveLoading(true);
    setError(null);

    try {
      await moveCompaniesToCollections(moveData);
      resetSelections();
      await fetchCollections();
    } catch (err) {
      console.error("Failed to move companies:", err);
      setError(err instanceof Error ? err.message : "Failed to move companies");
    } finally {
      setMoveLoading(false);
    }
  };

  const handleMoveAll = async () => {
    if (!collectionIdDest) {
      return;
    }

    const moveData: IMoveCompaniesRequest = {
      company_ids: [],
      from_collection_id: selectedCollectionId,
      to_collection_id: collectionIdDest,
    };

    try {
      await moveAllCompaniesToCollections(moveData);
    } catch (err) {
      console.error("Failed to move all companies:", err);
      setError(err instanceof Error ? err.message : "Failed to move companies");
    }
  };

  // TODO: replace dropdown aand button with menu button https://mui.com/material-ui/react-menu/
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
        <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
          <InputLabel id="collection-select">Collection</InputLabel>
          <Select
            labelId="collection-select"
            id="collection-select"
            value={collectionIdDest}
            label="Collection"
            onChange={handleSelection}
            disabled={loading || moveLoading}
            style={{ minWidth: 200 }}
          >
            {collectionOptions?.map((c) => {
              return (
                <MenuItem key={c.id} value={c.id}>
                  {c.collection_name}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <Tooltip title="You must select a collection and companies to move">
          <span>
            <Button
              variant="contained"
              onClick={handleSelectedMove}
              disabled={
                loading ||
                moveLoading ||
                !collectionIdDest ||
                selectedCompanyIds.length === 0
              }
            >
              {moveLoading ? "Moving..." : "Move Selected"}
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Select a collection to move all companies to">
          <span>
            <Button
              variant="contained"
              onClick={handleMoveAll}
              disabled={!collectionIdDest}
            >
              Move All
            </Button>
          </span>
        </Tooltip>
      </div>
    </>
  );
};

export default CompanyTableToolbar;
