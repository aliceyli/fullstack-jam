import { IconButton, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { ICollection, moveCompaniesToCollections } from "../utils/jam-api";

interface CompanyMoveMenuProps {
  companyId: number;
  currentCollectionId: string;
  allCollections: ICollection[] | undefined;
  onMoveComplete: () => Promise<void>;
}

const CompanyMoveMenu = ({
  companyId,
  currentCollectionId,
  allCollections,
  onMoveComplete,
}: CompanyMoveMenuProps) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [moving, setMoving] = useState(false);

  const handleMenuItemClick = async (toCollectionId: string) => {
    setMenuAnchor(null);
    setMoving(true);

    try {
      await moveCompaniesToCollections({
        company_ids: [companyId],
        from_collection_id: currentCollectionId,
        to_collection_id: toCollectionId,
      });

      await onMoveComplete();
    } catch (err) {
      console.error("Failed to move company:", err);
    } finally {
      setMoving(false);
    }
  };

  const otherCollections = allCollections?.filter(
    (c) => c.id !== currentCollectionId
  ) || [];

  return (
    <>
      <IconButton
        size="small"
        disabled={moving}
        onClick={(event) => setMenuAnchor(event.currentTarget)}
      >
        ⋮
      </IconButton>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {otherCollections.length > 0 ? (
          otherCollections.map((collection) => (
            <MenuItem
              key={collection.id}
              onClick={() => handleMenuItemClick(collection.id)}
              disabled={moving}
            >
              Move to {collection.collection_name}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>No other collections</MenuItem>
        )}
      </Menu>
    </>
  );
};

export default CompanyMoveMenu;