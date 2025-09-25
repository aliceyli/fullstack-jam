import { FormControl, Select, MenuItem } from "@mui/material";
import { useState } from "react";
import { ICollection, moveCompaniesToCollections } from "../utils/jam-api";

interface CollectionDropdownProps {
  companyId: number;
  currentCollectionId: string;
  currentCollectionName: string;
  allCollections: ICollection[] | undefined;
  onMoveComplete: () => Promise<void>;
}

const CollectionDropdown = ({
  companyId,
  currentCollectionId,
  currentCollectionName,
  allCollections,
  onMoveComplete,
}: CollectionDropdownProps) => {
  const [selectedCollection, setSelectedCollection] =
    useState(currentCollectionId);
  const [moving, setMoving] = useState(false);

  const handleCollectionChange = async (newCollectionId: string) => {
    if (newCollectionId === currentCollectionId) return;

    setMoving(true);
    try {
      await moveCompaniesToCollections({
        company_ids: [companyId],
        from_collection_id: currentCollectionId,
        to_collection_id: newCollectionId,
      });

      await onMoveComplete();
    } catch (err) {
      console.error("Failed to move company:", err);
      setSelectedCollection(currentCollectionId);
    } finally {
      setMoving(false);
    }
  };

  return (
    <FormControl size="small" disabled={moving}>
      <Select
        value={selectedCollection}
        onChange={(e) => {
          const newValue = e.target.value;
          setSelectedCollection(newValue);
          handleCollectionChange(newValue);
        }}
        displayEmpty
        variant="outlined"
        sx={{ minWidth: 150 }}
      >
        <MenuItem value={currentCollectionId} disabled>
          {moving ? "Moving..." : currentCollectionName}
        </MenuItem>
        {allCollections
          ?.filter((c) => c.id !== currentCollectionId)
          .map((collection) => (
            <MenuItem key={collection.id} value={collection.id}>
              {collection.collection_name}
            </MenuItem>
          ))}
      </Select>
    </FormControl>
  );
};

export default CollectionDropdown;
