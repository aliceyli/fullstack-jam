import { Button, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState } from "react";
import { ICollection } from "../utils/jam-api";

interface MoveDropdownButtonProps {
  buttonText: string;
  tooltipText?: string;
  collections: ICollection[];
  onMoveToCollection: (collectionId: string) => Promise<void>;
  disabled?: boolean;
  menuItemPrefix: string;
  isLoading: boolean;
}

const MoveDropdownButton = ({
  buttonText,
  tooltipText,
  collections,
  onMoveToCollection,
  disabled = false,
  menuItemPrefix,
  isLoading,
}: MoveDropdownButtonProps) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuItemClick = async (collectionId: string) => {
    await onMoveToCollection(collectionId);
    setMenuAnchor(null);
  };

  const ButtonComponent = (
    <Button
      variant="contained"
      disabled={disabled}
      onClick={(event) => setMenuAnchor(event.currentTarget)}
    >
      {isLoading ? "Moving..." : buttonText} ▼
    </Button>
  );

  return (
    <>
      {tooltipText ? (
        <Tooltip title={tooltipText}>
          <span>{ButtonComponent}</span>
        </Tooltip>
      ) : (
        ButtonComponent
      )}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {collections.map((collection) => (
          <MenuItem
            key={collection.id}
            onClick={() => handleMenuItemClick(collection.id)}
          >
            {menuItemPrefix} {collection.collection_name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default MoveDropdownButton;
