import type {
  CreateScheduledTaskInput,
  ScheduledTaskRecord,
  WorkspaceRecord,
} from "../../contracts/desktop-state";
import {
  ScheduledTaskEditor,
  type ScheduledEditorState,
} from "../features/scheduled-tasks/scheduled-task-editor";
import type { ThreadMenuState } from "../features/threads/hooks/use-thread-actions";
import type { WorkspaceMenuState } from "../features/threads/hooks/use-workspace-menu";
import { ThreadDeleteDialog } from "../features/threads/thread-delete-dialog";
import { WorkspaceRemoveDialog } from "../features/threads/workspace-remove-dialog";

interface AppOverlaysProps {
  readonly threadMenu: ThreadMenuState;
  readonly workspaceMenu: WorkspaceMenuState;
  readonly scheduledEditor: ScheduledEditorState | null;
  readonly scheduledTasks: readonly ScheduledTaskRecord[];
  readonly workspaces: readonly WorkspaceRecord[];
  readonly selectedWorkspaceId: string;
  readonly error?: string;
  readonly onCloseScheduledEditor: () => void;
  readonly onSubmitScheduledTask: (input: CreateScheduledTaskInput) => void;
  readonly onOpenScheduledChat: (target: { workspaceId: string; sessionId: string }) => void;
}

/**
 * Floating surfaces that sit above the shell: the delete and remove confirmations plus the
 * scheduled-task editor. App.tsx keeps the shell composition; this only takes its hook state.
 */
export function AppOverlays({
  threadMenu,
  workspaceMenu,
  scheduledEditor,
  scheduledTasks,
  workspaces,
  selectedWorkspaceId,
  error,
  onCloseScheduledEditor,
  onSubmitScheduledTask,
  onOpenScheduledChat,
}: AppOverlaysProps) {
  return (
    <>
      <ThreadDeleteDialog
        deleting={threadMenu.deleting}
        error={threadMenu.deleteError}
        target={threadMenu.pendingDelete}
        onCancel={threadMenu.cancelDelete}
        onConfirm={threadMenu.confirmDelete}
      />
      <WorkspaceRemoveDialog menu={workspaceMenu} />
      {scheduledEditor ? (
        <ScheduledTaskEditor
          editor={scheduledEditor}
          task={
            scheduledEditor.mode === "edit"
              ? scheduledTasks.find((task) => task.id === scheduledEditor.taskId)
              : undefined
          }
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          busy={false}
          error={error}
          onClose={onCloseScheduledEditor}
          onSubmit={onSubmitScheduledTask}
          onOpenChat={onOpenScheduledChat}
        />
      ) : null}
    </>
  );
}
