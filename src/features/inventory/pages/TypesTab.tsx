import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteItemType, type InventoryItemTypeView, listItemTypes } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ItemTypeFormModal } from "@/features/inventory/components/ItemTypeFormModal";
import { useAuthStore } from "@/stores/authStore";

/** The item-type catalogue - a definition list, no stock. SCHOOL_ADMIN writes; BRANCH_ADMIN reads only. */
export function TypesTab() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = can.manageInventoryCatalogue(role);

  const [itemTypes, setItemTypes] = useState<InventoryItemTypeView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] = useState<InventoryItemTypeView | "new" | null>(null);
  const [deletingItemType, setDeletingItemType] = useState<InventoryItemTypeView | null>(null);

  function load() {
    listItemTypes()
      .then(setItemTypes)
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load item types"));
  }

  useEffect(load, []);

  async function confirmDelete(itemType: InventoryItemTypeView) {
    await deleteItemType(itemType.id);
    setDeletingItemType(null);
    load();
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }

  if (itemTypes === null) {
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
          <Button variant="accent" onClick={() => setEditingItemType("new")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add item type
          </Button>
        </div>
      )}

      {itemTypes.length === 0 ? (
        <EmptyState
          title="No item types yet"
          description={
            canManage
              ? "Add your school's first item type - School Uniform, Sport Wear, Pouches..."
              : "Your school hasn't defined any item types yet."
          }
        />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              {canManage && <TableHeaderCell>Actions</TableHeaderCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {itemTypes.map((itemType) => (
              <TableRow key={itemType.id}>
                <TableCell label="Name">{itemType.name}</TableCell>
                <TableCell label="Description">{itemType.description ?? "—"}</TableCell>
                <TableCell label="Status">
                  <Badge variant={itemType.active ? "success" : "neutral"}>
                    {itemType.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell label="Actions">
                    <div className="flex gap-3">
                      <Button variant="ghost" size="sm" onClick={() => setEditingItemType(itemType)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeletingItemType(itemType)}>
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

      {editingItemType && (
        <ItemTypeFormModal
          itemType={editingItemType === "new" ? undefined : editingItemType}
          nextPosition={itemTypes.length}
          onClose={() => setEditingItemType(null)}
          onSaved={load}
        />
      )}

      {deletingItemType && (
        <ConfirmDialog
          title="Delete item type"
          message={`Delete "${deletingItemType.name}"? This can't be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={() => confirmDelete(deletingItemType)}
          onClose={() => setDeletingItemType(null)}
        />
      )}
    </div>
  );
}
