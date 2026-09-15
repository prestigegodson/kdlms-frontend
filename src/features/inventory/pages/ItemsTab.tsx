import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  deleteItem,
  type InventoryItemTypeView,
  type InventoryItemView,
  listItemTypes,
  listItems,
} from "@/api/inventory";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ItemFormModal } from "@/features/inventory/components/ItemFormModal";
import { useAuthStore } from "@/stores/authStore";

/** The item catalogue - SCHOOL_ADMIN writes; BRANCH_ADMIN reads only. Requires at least one item type to exist before an item can be created. */
export function ItemsTab() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageInventoryCatalogue(role);

  const [items, setItems] = useState<InventoryItemView[] | null>(null);
  const [itemTypes, setItemTypes] = useState<InventoryItemTypeView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItemView | "new" | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItemView | null>(null);

  function load() {
    Promise.all([listItems(), listItemTypes()])
      .then(([itemsResult, itemTypesResult]) => {
        setItems(itemsResult);
        setItemTypes(itemTypesResult);
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load items"));
  }

  useEffect(load, []);

  async function confirmDelete(item: InventoryItemView) {
    await deleteItem(item.id);
    setDeletingItem(null);
    load();
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  if (items === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="accent" disabled={itemTypes.length === 0} onClick={() => setEditingItem("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add item
          </Button>
        </div>
      )}
      {canManage && itemTypes.length === 0 && (
        <Alert variant="info">Add an item type first, on the Item Types tab.</Alert>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No items yet"
          description={
            canManage ? "Add your school's first inventory item." : "Your school hasn't defined any items yet."
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Unit</TableHeaderCell>
              <TableHeaderCell numeric>Reorder level</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell label="Name">{item.name}</TableCell>
                <TableCell label="Type">{item.itemTypeName}</TableCell>
                <TableCell label="Code">{item.code ?? "—"}</TableCell>
                <TableCell label="Unit">{item.unit}</TableCell>
                <TableCell label="Reorder level" numeric>
                  {item.reorderLevel}
                </TableCell>
                <TableCell label="Status">
                  <Badge variant={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
                {canManage && (
                  <TableCell label="Actions">
                    <div className="flex gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingItem(item)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editingItem && (
        <ItemFormModal
          item={editingItem === "new" ? undefined : editingItem}
          itemTypes={itemTypes}
          onClose={() => setEditingItem(null)}
          onSaved={load}
        />
      )}

      {deletingItem && (
        <ConfirmDialog
          title="Delete item"
          message={`Delete "${deletingItem.name}"? This can't be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => confirmDelete(deletingItem)}
          onClose={() => setDeletingItem(null)}
        />
      )}
    </div>
  );
}
