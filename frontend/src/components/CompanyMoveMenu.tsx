import { IconButton, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { ICollection, moveCompaniesToCollections } from "../utils/jam-api";

interface CompanyMoveMenuProps {
  companyId: number;
  currentCollectionId: string;
  allCollections: ICollection[] | undefined;
  onMoveComplete: () => Promise<void>;
  anchorEl?: HTMLElement | null;
  onClose?: () => void;
}

const CompanyMoveMenu = ({
  companyId,
  currentCollectionId,
  allCollections,
  onMoveComplete,
  anchorEl,
  onClose,
}: CompanyMoveMenuProps) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [moving, setMoving] = useState(false);

  const effectiveAnchor = anchorEl || menuAnchor;
  const effectiveOnClose = onClose || (() => setMenuAnchor(null));

  const handleMenuItemClick = async (toCollectionId: string) => {
    effectiveOnClose();
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
      {!anchorEl && (
        <IconButton
          size="small"
          disabled={moving}
          onClick={(event) => setMenuAnchor(event.currentTarget)}
        >
          ⋮
        </IconButton>
      )}
      <Menu
        anchorEl={effectiveAnchor}
        open={Boolean(effectiveAnchor)}
        onClose={effectiveOnClose}
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