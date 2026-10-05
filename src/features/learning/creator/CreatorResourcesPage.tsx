import { Archive, ArrowDown, ArrowUp, BookOpen, CircleCheck, Eye, Pencil, Trash2, Undo2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { getErrorMessage } from "@/api/client";
import {
  archiveClassResource,
  type ClassLearningResourceView,
  type ClassResourceListView,
  createClassResource,
  deleteClassResource,
  getClassResource,
  getClassResourceCompletions,
  listClassGalleryFiles,
  listClassResources,
  publishClassResource,
  reorderClassResources,
  unpublishClassResource,
  updateClassResource,
} from "@/api/classLearningResources";
import type { LearningResourceSummaryView, ResourceCompletionsView } from "@/api/learning";
import { listVirtualClasses, type VirtualClass } from "@/api/virtualClasses";
import { can } from "@/auth/permissions";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { CompletionsModal } from "@/features/learning/components/CompletionsModal";
import type { GalleryLoader } from "@/features/learning/components/GalleryPickerModal";
import { ResourceEditorModal, type ResourceEditorPayload } from "@/features/learning/components/ResourceEditorModal";
import {
  LEARNING_RESOURCE_STATUS_VARIANT,
  learningResourceAvailabilityBadge,
} from "@/features/learning/learningResourceStatus";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";
import { formatInstant } from "@/utils/date";

const TYPE_LABEL: Record<string, string> = {
  PDF: "PDF",
  RICH_TEXT: "Rich text",
  YOUTUBE: "YouTube",
  AUDIO: "Audio",
  VIDEO: "Video",
};

type Confirming = { kind: "archive" | "delete"; resource: LearningResourceSummaryView };

/** Adapts a class roster to the school `CompletionsPanel`'s row shape - learners have no admission number. */
function toPanelCompletions(classId: string, resourceId: string): Promise<ResourceCompletionsView> {
  return getClassResourceCompletions(classId, resourceId).then((view) => ({
    resourceId: view.resourceId,
    title: view.title,
    totalStudents: view.totalLearners,
    completedCount: view.completedCount,
    students: view.learners.map((row) => ({
      studentId: row.learnerId,
      studentName: row.learnerName,
      admissionNumber: "",
      completed: row.completed,
      completedAt: row.completedAt,
      positionSeconds: row.positionSeconds,
      lastOpenedAt: row.lastOpenedAt,
    })),
  }));
}

/**
 * A creator's learning resources (creators Phase C14): pick a class, see its resources in the order
 * learners see them, and add, edit, publish, reorder or archive them - the school Learning resources
 * page's authoring, keyed on a virtual class instead of class+subject+term. The class lives in the URL
 * (`?classId=`), so a class page's "Resources" link lands straight on it. Without on-demand learning
 * in the plan, an upgrade notice replaces the page - the C12/C13 pattern; audio/video additionally
 * needs the plan's learning media.
 */
export function CreatorResourcesPage() {
  const fetchPlan = useCreatorPlanStore((state) => state.fetchIfNeeded);
  const plan = useCreatorPlanStore((state) => state.plan);
  const planStatus = useCreatorPlanStore((state) => state.status);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("classId");

  const [classes, setClasses] = useState<VirtualClass[] | null>(null);
  const [loadedList, setList] = useState<ClassResourceListView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ resourceId: string | null } | null>(null);
  const [completionsFor, setCompletionsFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  // Shown only while it still matches the URL - a class switch shows a skeleton until its own list arrives.
  const list = loadedList?.classId === classId ? loadedList : null;

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Unknown while the plan loads; if it can't be loaded, carry on and let the server's own answer show.
  const entitled =
    planStatus === "loaded"
      ? can.viewClassResources("CREATOR", plan?.onDemandLearning ?? false)
      : planStatus === "error"
        ? true
        : null;

  useEffect(() => {
    if (entitled !== true) {
      return;
    }
    listVirtualClasses()
      .then((loaded) =>
        setClasses(
          [...loaded.classes].sort((a, b) =>
            a.status === b.status ? a.name.localeCompare(b.name) : a.status === "ACTIVE" ? -1 : 1,
          ),
        ),
      )
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load your classes.")));
  }, [entitled]);

  // Land on the first class when none is chosen yet.
  useEffect(() => {
    if (!classId && classes && classes.length > 0) {
      setSearchParams({ classId: classes[0].id }, { replace: true });
    }
  }, [classId, classes, setSearchParams]);

  const loadResources = useCallback(() => {
    if (!classId) {
      return;
    }
    listClassResources(classId)
      .then((loaded) => {
        setList(loaded);
        setError(null);
      })
      .catch((err: unknown) => setError(getErrorMessage(err, "We couldn't load this class's resources.")));
  }, [classId]);

  useEffect(() => {
    if (entitled === true) {
      loadResources();
    }
  }, [entitled, loadResources]);

  const loadGallery = useCallback<GalleryLoader>(
    (params) => listClassGalleryFiles({ classId: classId ?? "", ...params }),
    [classId],
  );

  if (entitled === false) {
    return (
      <div className="space-y-6">
        <PageHeader title="Resources" />
        <EmptyState
          icon={BookOpen}
          title="Resources aren't in your plan"
          description="Upgrade to a plan with on-demand learning to share notes, PDFs and videos with your classes."
          action={
            <Link
              to="/creator/billing"
              className="inline-flex min-h-11 items-center rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
            >
              See plans
            </Link>
          }
        />
      </div>
    );
  }

  const writable = !!list?.writable && can.authorClassResources("CREATOR", true);
  const canAuthorMedia = can.authorClassMedia("CREATOR", list?.mediaIncluded ?? plan?.learningMedia ?? false);

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      loadResources();
    } catch (err) {
      setActionError(getErrorMessage(err, "That didn't work. Please try again."));
    }
  }

  function move(resources: LearningResourceSummaryView[], index: number, offset: -1 | 1) {
    const ids = resources.map((resource) => resource.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + offset, 0, moved);
    return runAction(() => reorderClassResources(classId ?? "", ids));
  }

  function resourceActions(resources: LearningResourceSummaryView[], index: number) {
    const resource = resources[index];
    const preview = { label: "Preview", icon: Eye, onSelect: () => navigate(`/creator/resources/${classId}/${resource.id}`) };
    const completions = {
      label: "Completions",
      icon: CircleCheck,
      onSelect: () => setCompletionsFor(resource.id),
    };
    if (!writable) {
      return [preview, completions];
    }
    return [
      preview,
      ...(resource.status !== "ARCHIVED"
        ? [{ label: "Edit", icon: Pencil, onSelect: () => setEditing({ resourceId: resource.id }) }]
        : []),
      completions,
      ...(index > 0 ? [{ label: "Move up", icon: ArrowUp, onSelect: () => move(resources, index, -1) }] : []),
      ...(index < resources.length - 1
        ? [{ label: "Move down", icon: ArrowDown, onSelect: () => move(resources, index, 1) }]
        : []),
      ...(resource.status === "DRAFT"
        ? [
            {
              label: "Publish",
              icon: Upload,
              separated: true,
              onSelect: () => runAction(() => publishClassResource(classId ?? "", resource.id)),
            },
          ]
        : []),
      ...(resource.status === "PUBLISHED"
        ? [
            {
              label: "Unpublish",
              icon: Undo2,
              separated: true,
              onSelect: () => runAction(() => unpublishClassResource(classId ?? "", resource.id)),
            },
          ]
        : []),
      ...(resource.status !== "ARCHIVED"
        ? [{ label: "Archive", icon: Archive, onSelect: () => setConfirming({ kind: "archive", resource }) }]
        : []),
      ...(resource.status === "DRAFT"
        ? [
            {
              label: "Delete",
              icon: Trash2,
              variant: "danger" as const,
              separated: true,
              onSelect: () => setConfirming({ kind: "delete", resource }),
            },
          ]
        : []),
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        description="Share notes, PDFs, audio and videos with a class. Learners see them once published."
        actions={
          writable && classId ? (
            <Button variant="accent" onClick={() => setEditing({ resourceId: null })}>
              Add resource
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={loadResources} />
      ) : classes === null ? (
        <Skeleton className="h-40" />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description="Create a class to start sharing resources with it."
        />
      ) : (
        <>
          <FormField label="Class" htmlFor="resources-class">
            <Select
              id="resources-class"
              value={classId ?? ""}
              onChange={(event) => setSearchParams({ classId: event.target.value })}
            >
              {classes.map((virtualClass) => (
                <option key={virtualClass.id} value={virtualClass.id}>
                  {virtualClass.name}
                  {virtualClass.status === "ARCHIVED" ? " (archived)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          {list && !list.writable && (
            <Alert variant="info">
              This class is archived or beyond your plan's class limit, so its resources are read-only.
            </Alert>
          )}
          {actionError && <Alert variant="error">{actionError}</Alert>}

          {list === null ? (
            <Skeleton className="h-40" />
          ) : list.resources.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No resources yet"
              description={list.writable ? "Add your first resource for this class." : "This class has no resources."}
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Title</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="max-sm:hidden">Updated</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.resources.map((resource, index) => {
                  const availability = learningResourceAvailabilityBadge(
                    resource.status,
                    resource.availableFrom,
                    resource.availableUntil,
                  );
                  return (
                    <TableRow key={resource.id} to={`/creator/resources/${list.classId}/${resource.id}`}>
                      <TableCell label="Title">
                        <span className="font-medium text-slate-900">{resource.title}</span>
                      </TableCell>
                      <TableCell label="Type">{TYPE_LABEL[resource.resourceType] ?? resource.resourceType}</TableCell>
                      <TableCell label="Status">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={LEARNING_RESOURCE_STATUS_VARIANT[resource.status]}>{resource.status}</Badge>
                          {availability && <Badge variant={availability.variant}>{availability.label}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell label="Updated" className="max-sm:hidden">
                        {formatInstant(resource.updatedAt)}
                      </TableCell>
                      {/* Stops the click from also following the row's own link. */}
                      <TableCell label="Actions" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end md:justify-start">
                          <ActionMenu
                            items={resourceActions(list.resources, index)}
                            ariaLabel={`Actions for ${resource.title}`}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {editing && classId && (
        <ClassResourceEditorEntry
          classId={classId}
          resourceId={editing.resourceId}
          canAuthorMedia={canAuthorMedia}
          loadGallery={loadGallery}
          onClose={() => setEditing(null)}
          onSaved={loadResources}
        />
      )}

      {completionsFor && classId && (
        <CompletionsModal
          resourceId={completionsFor}
          load={() => toPanelCompletions(classId, completionsFor)}
          personLabel="Learner"
          onClose={() => setCompletionsFor(null)}
        />
      )}

      {confirming && classId && (
        <ConfirmDialog
          title={confirming.kind === "archive" ? "Archive this resource?" : "Delete this draft?"}
          message={
            confirming.kind === "archive" ? (
              <>
                <strong>{confirming.resource.title}</strong> will be archived and hidden from learners. This can't be
                undone.
              </>
            ) : (
              <>
                <strong>{confirming.resource.title}</strong> will be permanently deleted.
              </>
            )
          }
          confirmLabel={confirming.kind === "archive" ? "Archive" : "Delete"}
          variant="danger"
          onConfirm={async () => {
            const action = confirming.kind === "archive" ? archiveClassResource : deleteClassResource;
            await action(classId, confirming.resource.id);
            setConfirming(null);
            loadResources();
          }}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

/** Loads an existing resource's full detail before opening the editor, so it never edits a summary row's shape. */
function ClassResourceEditorEntry({
  classId,
  resourceId,
  canAuthorMedia,
  loadGallery,
  onClose,
  onSaved,
}: {
  classId: string;
  resourceId: string | null;
  canAuthorMedia: boolean;
  loadGallery: GalleryLoader;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<{ resource?: ClassLearningResourceView } | null>(resourceId ? null : {});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    getClassResource(classId, resourceId)
      .then((resource) => setLoaded({ resource }))
      .catch((err: unknown) => setLoadError(getErrorMessage(err, "We couldn't load this resource.")));
  }, [classId, resourceId]);

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }
  if (!loaded) {
    return null;
  }

  const resource = loaded.resource;
  function save(payload: ResourceEditorPayload) {
    return resource
      ? updateClassResource(classId, resource.id, payload)
      : createClassResource(classId, payload);
  }

  return (
    <ResourceEditorModal
      classId={classId}
      resource={resource}
      canAuthorMedia={canAuthorMedia}
      save={save}
      loadGallery={loadGallery}
      audienceLabel="Learners"
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
