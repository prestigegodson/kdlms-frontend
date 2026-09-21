import { Archive, BookOpen, CircleCheck, Eye, MessageSquare, Pencil, Trash2, Undo2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import {
  type AuthorableSubjectView,
  archiveLearningResource,
  deleteLearningResource,
  getAuthorableSubjects,
  type LearningResourceStatus,
  type LearningResourceSummaryView,
  getLearningResource,
  listLearningResources,
  publishLearningResource,
  unpublishLearningResource,
} from "@/api/learning";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import type { Page } from "@/api/types";
import { can } from "@/auth/permissions";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { CommentsModal } from "@/features/learning/components/CommentsModal";
import { CompletionsModal } from "@/features/learning/components/CompletionsModal";
import { ResourceEditorModal } from "@/features/learning/components/ResourceEditorModal";
import { LEARNING_RESOURCE_STATUS_VARIANT } from "@/features/learning/learningResourceStatus";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatInstant } from "@/utils/date";

const TYPE_LABEL: Record<string, string> = {
  PDF: "PDF",
  RICH_TEXT: "Rich text",
  YOUTUBE: "YouTube",
  AUDIO: "Audio",
  VIDEO: "Video",
};

/**
 * The teacher/admin-facing learning-resource list (Phase 35E). One page for every staff role -
 * the `TakeHomeQuizzesPage` shape: a class+term(+subject) picker, then the resource table for that
 * selection. Reorder (backend-supported) has no drag-and-drop UI yet - out of this phase's scope.
 * An optional `?classId=&subjectId=` (from SubjectsPage's "Learning resources" row action) seeds
 * the initial class + subject selection.
 */
export function LearningResourcesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.onDemandLearning);
  const learningMedia = useFeatureStore((state) => state.learningMedia);
  const canAuthor = can.authorLearningResources(role, entitled);
  const canAuthorMedia = can.authorLearningMedia(role, entitled, learningMedia);
  const canViewCompletions = can.viewLearningCompletions(role, entitled);
  const isTeacher = role === "TEACHER";
  const { ready: branchReady, branchId } = useBranchScope();

  const [adminClasses, setAdminClasses] = useState<SchoolClassView[] | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState(searchParams.get("subjectId") ?? "");
  const [status, setStatus] = useState<LearningResourceStatus | "">("");
  const [subjects, setSubjects] = useState<AuthorableSubjectView[] | null>(null);

  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<Page<LearningResourceSummaryView> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ resourceId: string | null } | null>(null);
  const [moderatingResourceId, setModeratingResourceId] = useState<string | null>(null);
  const [viewingCompletionsResourceId, setViewingCompletionsResourceId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{
    kind: "archive" | "delete";
    resource: LearningResourceSummaryView;
  } | null>(null);

  useEffect(() => {
    if (isTeacher) {
      listMyClasses()
        .then(setTeacherClasses)
        .catch(() => setTeacherClasses([]));
      return;
    }
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((result) => setAdminClasses(result.content))
      .catch(() => setAdminClasses([]));
  }, [isTeacher, branchReady, branchId]);

  const [lastClassId, setLastClassId] = useState(classId);
  if (classId !== lastClassId) {
    setLastClassId(classId);
    setSubjectId("");
    setSubjects(null);
  }

  const selectionKey = `${classId}|${termId}|${subjectId}|${status}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setPage(null);
    setLoadError(null);
    setPageIndex(0);
  }

  useEffect(() => {
    if (!classId) return;
    getAuthorableSubjects(classId)
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [classId]);

  function refresh() {
    if (!classId || !termId) return;
    listLearningResources(classId, termId, subjectId || undefined, status || undefined, pageIndex, 20)
      .then(setPage)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load learning resources"),
      );
  }

  useEffect(refresh, [classId, termId, subjectId, status, pageIndex]);

  const classes = isTeacher ? teacherClasses : adminClasses;
  const classesLoaded = classes !== null;
  const classOptions = isTeacher
    ? (teacherClasses ?? []).map((c) => ({ id: c.classId, name: c.className }))
    : (adminClasses ?? []).map((c) => ({ id: c.id, name: c.name }));
  const showsBranchFilter = can.selectBranch(role);

  async function runAction(resourceId: string, action: (id: string) => Promise<unknown>) {
    setActionError(null);
    try {
      await action(resourceId);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  function resourceActions(resource: LearningResourceSummaryView) {
    return [
      { label: "Preview", icon: Eye, onSelect: () => navigate(`/school/learning-resources/${resource.id}`) },
      { label: "Edit", icon: Pencil, onSelect: () => setEditing({ resourceId: resource.id }) },
      { label: "Comments", icon: MessageSquare, onSelect: () => setModeratingResourceId(resource.id) },
      ...(canViewCompletions
        ? [
            {
              label: "Completions",
              icon: CircleCheck,
              onSelect: () => setViewingCompletionsResourceId(resource.id),
            },
          ]
        : []),
      ...(resource.status === "DRAFT"
        ? [
            {
              label: "Publish",
              icon: Upload,
              separated: true,
              onSelect: () => runAction(resource.id, publishLearningResource),
            },
          ]
        : []),
      ...(resource.status === "PUBLISHED"
        ? [
            {
              label: "Unpublish",
              icon: Undo2,
              separated: true,
              onSelect: () => runAction(resource.id, unpublishLearningResource),
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
        title="Learning resources"
        description="Publish PDFs, rich-text notes, audio, video, and YouTube videos for your students."
        actions={
          canAuthor &&
          classId &&
          termId &&
          subjectId && <Button variant="accent" onClick={() => setEditing({ resourceId: null })}>Add resource</Button>
        }
      />

      {!classesLoaded && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your classes…
        </div>
      )}

      {classesLoaded && classes.length === 0 && !showsBranchFilter && (
        <EmptyState
          icon={BookOpen}
          title="No classes assigned yet"
          description="You'll see this page once you're assigned as a class or subject teacher."
        />
      )}

      {classesLoaded && (classes.length > 0 || showsBranchFilter) && (
        <StickySubHeader collapsible>
          <BranchFilter id="learning-resources-branch" />
          {classes.length > 0 && (
            <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId}>
              {classId && (
                <FormField label="Subject" htmlFor="learning-resource-subject">
                  <Select
                    id="learning-resource-subject"
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                  >
                    <option value="">Select a subject…</option>
                    {(subjects ?? []).map((subject) => (
                      <option key={subject.subjectId} value={subject.subjectId}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}
              <FormField label="Status" htmlFor="learning-resource-status">
                <Select
                  id="learning-resource-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as LearningResourceStatus | "")}
                >
                  <option value="">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </FormField>
            </ClassTermPicker>
          )}
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      {classId && termId && page === null && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading resources…
        </div>
      )}

      {page !== null && page.content.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="No learning resources yet"
          description={canAuthor ? "Add one to get started." : "Nothing has been published for this selection yet."}
        />
      )}

      {page !== null && page.content.length > 0 && (
        <>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Title</TableHeaderCell>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Updated</TableHeaderCell>
                {canAuthor && <TableHeaderCell>Actions</TableHeaderCell>}
              </tr>
            </TableHead>
            <TableBody>
              {page.content.map((resource) => (
                <TableRow key={resource.id} to={`/school/learning-resources/${resource.id}`}>
                  <TableCell label="Title">{resource.title}</TableCell>
                  <TableCell label="Subject">{resource.subjectName}</TableCell>
                  <TableCell label="Type">{TYPE_LABEL[resource.resourceType] ?? resource.resourceType}</TableCell>
                  <TableCell label="Status">
                    <Badge variant={LEARNING_RESOURCE_STATUS_VARIANT[resource.status]}>{resource.status}</Badge>
                  </TableCell>
                  <TableCell label="Updated">{formatInstant(resource.updatedAt)}</TableCell>
                  {canAuthor && (
                    // Stops the click from bubbling to the row's own `to` navigation - the
                    // ActionMenu trigger/items don't stopPropagation themselves (only their
                    // keyboard handling does), so without this, opening the menu or choosing an
                    // item would also navigate to the preview page.
                    <TableCell label="Actions" onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end md:justify-start">
                        <ActionMenu
                          items={resourceActions(resource)}
                          ariaLabel={`Actions for ${resource.title}`}
                        />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} onPageChange={setPageIndex} />
        </>
      )}

      {editing && classId && subjectId && termId && (
        <ResourceEditorEntry
          classId={classId}
          subjectId={subjectId}
          termId={termId}
          subjects={subjects ?? []}
          resourceId={editing.resourceId}
          canAuthorMedia={canAuthorMedia}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}

      {moderatingResourceId && (
        <CommentsModal resourceId={moderatingResourceId} onClose={() => setModeratingResourceId(null)} />
      )}

      {viewingCompletionsResourceId && (
        <CompletionsModal
          resourceId={viewingCompletionsResourceId}
          onClose={() => setViewingCompletionsResourceId(null)}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.kind === "archive" ? "Archive this resource?" : "Delete this draft?"}
          message={
            confirming.kind === "archive" ? (
              <>
                <strong>{confirming.resource.title}</strong> will be archived and hidden from students. This can't be
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
            const action = confirming.kind === "archive" ? archiveLearningResource : deleteLearningResource;
            await action(confirming.resource.id);
            setConfirming(null);
            refresh();
          }}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

/** Resolves the full detail before opening the edit modal, so the modal is never rendered with a stale summary row's shape. */
function ResourceEditorEntry({
  classId,
  subjectId,
  termId,
  subjects,
  resourceId,
  canAuthorMedia,
  onClose,
  onSaved,
}: {
  classId: string;
  subjectId: string;
  termId: string;
  subjects: AuthorableSubjectView[];
  resourceId: string | null;
  canAuthorMedia: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<{ resource?: Awaited<ReturnType<typeof getLearningResource>> } | null>(
    resourceId ? null : {},
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    getLearningResource(resourceId)
      .then((resource) => setLoaded({ resource }))
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load resource"));
  }, [resourceId]);

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
  return (
    <ResourceEditorModal
      classId={classId}
      subjectId={subjectId}
      termId={termId}
      subjects={subjects}
      resource={loaded.resource}
      canAuthorMedia={canAuthorMedia}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
