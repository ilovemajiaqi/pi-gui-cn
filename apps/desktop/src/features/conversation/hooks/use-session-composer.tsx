import {
  type ClipboardEvent,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
  useRef,
  useState,
} from "react";
import {
  type ComposerImageAttachment,
  type DesktopAppState,
  type SessionRecord,
} from "../../../../contracts/desktop-state";
import type { ClipboardImageRead } from "../../../../contracts/composer-attachments";
import { updateSnapshot } from "../../../app/desktop-app-state";
import {
  extractFilesFromDataTransfer,
  extractImageFilesFromClipboardData,
  handleClipboardImageShortcut,
  readComposerAttachmentsFromFiles,
} from "../composer-attachments";
import {
  parseCopyComposerCommand,
  parseDiffComposerCommand,
  parseExportComposerCommand,
  parseInitComposerCommand,
  parseTreeComposerCommand,
} from "../composer-commands";
import { AGENTS_MD_INIT_PROMPT } from "../../../../contracts/agent-instructions";
import { forgetSentPrompt, recordSentPrompt, sentPromptsForSession } from "../prompt-history";
import { copyTranscriptToClipboard, exportTranscriptViaDialog } from "../export-transcript";
import { formatAnnotatedPrompt } from "../annotations/annotation-prompt";
import type { TranscriptAnnotations } from "../annotations/use-transcript-annotations";
import type { PiDesktopApi } from "../../../../contracts/ipc";
import { useTranslation } from "../../../i18n";

interface UseSessionComposerParams {
  readonly api: PiDesktopApi | undefined;
  readonly snapshot: DesktopAppState | null;
  readonly setSnapshot: Dispatch<SetStateAction<DesktopAppState | null>>;
  readonly selectedSession: SessionRecord | undefined;
  readonly composerDraft: string;
  readonly setComposerDraft: Dispatch<SetStateAction<string>>;
  readonly composerDraftRef: MutableRefObject<string>;
  /** Sends a debounced draft write now, so it cannot land after a host action that replaces the draft. */
  readonly flushComposerDraft: () => void;
  readonly composerRef: MutableRefObject<HTMLTextAreaElement | null>;
  readonly requiresModelSelection: boolean;
  readonly openTreeModal: () => void;
  /** Opens the workbench review panel for a typed `/diff`. */
  readonly openReviewPanel: () => void;
  readonly handleMentionKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  readonly handleSlashKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  readonly newThreadComposerRef: MutableRefObject<HTMLTextAreaElement | null>;
  readonly appendNewThreadAttachment: (attachment: ComposerImageAttachment) => void;
  readonly onNewThreadComposerError: (message: string) => void;
  readonly annotations: TranscriptAnnotations;
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set();
/** Two Escapes on an empty composer within this window open the session tree. */
const DOUBLE_ESCAPE_MS = 600;

export function useSessionComposer(params: UseSessionComposerParams) {
  const {
    api,
    snapshot,
    setSnapshot,
    selectedSession,
    composerDraft,
    setComposerDraft,
    composerDraftRef,
    flushComposerDraft,
    composerRef,
    requiresModelSelection,
    openTreeModal,
    openReviewPanel,
    handleMentionKeyDown,
    handleSlashKeyDown,
    newThreadComposerRef,
    appendNewThreadAttachment,
    onNewThreadComposerError,
    annotations,
  } = params;
  const { t } = useTranslation();

  // Attachments optimistically hidden while their submit is in flight. Scoped to the
  // submitted ids (not a blanket flag) because the submit IPC resolves only after the
  // whole agent turn finishes; a blanket flag hid every attachment added mid-run.
  const [submittedAttachmentIds, setSubmittedAttachmentIds] =
    useState<ReadonlySet<string>>(EMPTY_ID_SET);
  /**
   * Where ArrowUp/ArrowDown recall sits. `cursor === null` means not recalling; while a
   * recalled prompt is still untouched in the composer, the arrows keep walking the list.
   * A stale cursor is harmless: recall re-attaches only when the draft still matches the
   * entry the cursor points at.
   */
  const promptRecallRef = useRef<{ sessionId: string; cursor: number | null }>({
    sessionId: "",
    cursor: null,
  });
  const lastEmptyEscapeAtRef = useRef(0);
  const snapshotAttachments = snapshot?.composerAttachments ?? [];
  const composerAttachments =
    submittedAttachmentIds.size === 0
      ? snapshotAttachments
      : snapshotAttachments.filter((attachment) => !submittedAttachmentIds.has(attachment.id));

  const clearSubmittedAttachmentIds = (submittedIds: ReadonlySet<string>) => {
    // Only clear this submit's ids; a newer overlapping submit may own the state now.
    setSubmittedAttachmentIds((current) => (current === submittedIds ? EMPTY_ID_SET : current));
  };

  const stopCurrentRun = () => {
    if (!api || selectedSession?.status !== "running") return;
    void updateSnapshot(setSnapshot, () => api.cancelCurrentRun()).catch((error: unknown) => {
      console.error("[renderer] cancelCurrentRun failed", error);
    });
  };

  const submitComposerDraft = (options: { readonly deliverAs?: "steer" | "followUp" } = {}) => {
    if (!api || !selectedSession) {
      return;
    }

    const hasComposerInput =
      composerDraft.trim().length > 0 ||
      composerAttachments.length > 0 ||
      annotations.list.length > 0;
    if (selectedSession.status === "running" && !hasComposerInput) {
      stopCurrentRun();
      return;
    }

    if (!hasComposerInput) {
      return;
    }
    if (requiresModelSelection) {
      return;
    }

    const treeCommand = parseTreeComposerCommand(composerDraft, t);
    if (treeCommand?.type === "error") {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              lastError: treeCommand.message,
            }
          : current,
      );
      return;
    }
    if (treeCommand?.type === "tree") {
      openTreeModal();
      return;
    }

    const exportCommand = parseExportComposerCommand(composerDraft, t);
    if (exportCommand?.type === "error") {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              lastError: exportCommand.message,
            }
          : current,
      );
      return;
    }
    if (exportCommand?.type === "export") {
      setComposerDraft("");
      promptRecallRef.current.cursor = null;
      if (api) {
        exportTranscriptViaDialog(api, setSnapshot);
      }
      return;
    }

    const copyCommand = parseCopyComposerCommand(composerDraft, t);
    if (copyCommand?.type === "error") {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              lastError: copyCommand.message,
            }
          : current,
      );
      return;
    }
    if (copyCommand?.type === "copy") {
      setComposerDraft("");
      promptRecallRef.current.cursor = null;
      if (api) {
        copyTranscriptToClipboard(api, setSnapshot);
      }
      return;
    }

    const initCommand = parseInitComposerCommand(composerDraft, t);
    if (initCommand?.type === "error") {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              lastError: initCommand.message,
            }
          : current,
      );
      return;
    }
    if (initCommand?.type === "init") {
      setComposerDraft("");
      promptRecallRef.current.cursor = null;
      if (api) {
        void updateSnapshot(setSnapshot, () => api.submitComposer(AGENTS_MD_INIT_PROMPT))
          .then((state) => {
            if (composerDraftRef.current === "") {
              setComposerDraft(state.composerDraft);
            }
          })
          .catch((error: unknown) => {
            setComposerLimitError(error);
          });
      }
      return;
    }

    const diffCommand = parseDiffComposerCommand(composerDraft, t);
    if (diffCommand?.type === "error") {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              lastError: diffCommand.message,
            }
          : current,
      );
      return;
    }
    if (diffCommand?.type === "diff") {
      setComposerDraft("");
      promptRecallRef.current.cursor = null;
      openReviewPanel();
      return;
    }

    const previousDraft = composerDraft;
    // A slash command keeps its annotations for the next message rather than breaking the command.
    const sentAnnotations = composerDraft.trimStart().startsWith("/") ? null : annotations.take();
    const text = sentAnnotations?.taken.length
      ? formatAnnotatedPrompt(sentAnnotations.taken, previousDraft)
      : previousDraft;
    setComposerDraft("");
    promptRecallRef.current.cursor = null;
    // Recorded at submit time, not resolution time: a long runtime command resolves after its
    // output has already streamed, and a later prompt must still be the newest entry.
    recordSentPrompt(selectedSession.id, text);
    const submittedIds = new Set(composerAttachments.map((attachment) => attachment.id));
    if (submittedIds.size > 0) {
      setSubmittedAttachmentIds(submittedIds);
    }
    void (async () => {
      const nextState = await updateSnapshot(setSnapshot, () =>
        api.submitComposer(
          text,
          selectedSession.status === "running"
            ? { deliverAs: options.deliverAs ?? "followUp" }
            : undefined,
        ),
      );
      // A failed send hands the text back as the draft; give back the annotations and the
      // typed text rather than their formatted blocks.
      const returnedToComposer = sentAnnotations?.taken.length && nextState.composerDraft === text;
      if (returnedToComposer) {
        sentAnnotations.undo();
        forgetSentPrompt(selectedSession.id, text);
      }
      // Only apply the resolved draft if the user hasn't typed into the composer during the
      // in-flight submit; otherwise their new input would be clobbered.
      if (composerDraftRef.current === "") {
        setComposerDraft(returnedToComposer ? previousDraft : nextState.composerDraft);
      }
      clearSubmittedAttachmentIds(submittedIds);
    })().catch(() => {
      forgetSentPrompt(selectedSession.id, text);
      if (composerDraftRef.current === "") {
        setComposerDraft(previousDraft);
      }
      sentAnnotations?.undo();
      clearSubmittedAttachmentIds(submittedIds);
    });
  };

  const handlePickAttachments = () => {
    if (!api) {
      return;
    }
    void updateSnapshot(setSnapshot, () => api.pickComposerAttachments()).catch(
      (error: unknown) => {
        console.error("[renderer] pickComposerAttachments failed", error);
      },
    );
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    if (!api) {
      return;
    }
    void updateSnapshot(setSnapshot, () => api.removeComposerAttachment(attachmentId)).catch(
      (error: unknown) => {
        console.error("[renderer] removeComposerAttachment failed", error);
      },
    );
  };

  const handleEditQueuedMessage = (messageId: string) => {
    if (!api) {
      return;
    }
    flushComposerDraft();
    void updateSnapshot(setSnapshot, () => api.editQueuedComposerMessage(messageId, composerDraft))
      .then(() => {
        composerRef.current?.focus();
      })
      .catch((error: unknown) => {
        console.error("[renderer] editQueuedComposerMessage failed", error);
      });
  };

  const handleCancelQueuedEdit = () => {
    if (!api) {
      return;
    }
    flushComposerDraft();
    void updateSnapshot(setSnapshot, () => api.cancelQueuedComposerEdit())
      .then(() => {
        composerRef.current?.focus();
      })
      .catch((error: unknown) => {
        console.error("[renderer] cancelQueuedComposerEdit failed", error);
      });
  };

  const handleRemoveQueuedMessage = (messageId: string) => {
    if (!api) {
      return;
    }
    flushComposerDraft();
    void updateSnapshot(setSnapshot, () => api.removeQueuedComposerMessage(messageId)).catch(
      (error: unknown) => {
        console.error("[renderer] removeQueuedComposerMessage failed", error);
      },
    );
  };

  const handleSteerQueuedMessage = (messageId: string) => {
    if (!api) {
      return;
    }
    void updateSnapshot(setSnapshot, () => api.steerQueuedComposerMessage(messageId)).catch(
      (error: unknown) => {
        console.error("[renderer] steerQueuedComposerMessage failed", error);
      },
    );
  };

  const handleImagePaste = (
    event: ClipboardEvent<HTMLDivElement>,
    onFiles: (files: File[]) => void,
  ) => {
    const files = extractImageFilesFromClipboardData(event.clipboardData);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    onFiles(files);
  };

  const handleAttachmentDrop = (
    event: DragEvent<HTMLDivElement>,
    onFiles: (files: File[]) => void,
  ) => {
    event.preventDefault();
    const files = extractFilesFromDataTransfer(event.dataTransfer);
    if (files.length === 0) {
      return;
    }
    onFiles(files);
  };

  async function addAttachmentsToSessionComposer(files: File[]) {
    if (!api) {
      return;
    }
    const valid = await readComposerAttachmentsFromFiles(
      files,
      snapshot?.composerAttachments ?? [],
    );
    if (valid.length === 0) {
      return;
    }
    void updateSnapshot(setSnapshot, () => api.addComposerAttachments(valid)).catch(
      (error: unknown) => {
        console.error("[renderer] addComposerAttachments failed", error);
      },
    );
  }

  const handleComposerPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    handleImagePaste(event, (files) => {
      void addAttachmentsToSessionComposer(files).catch((error: unknown) => {
        setComposerLimitError(error);
        console.error("[renderer] addAttachmentsToSessionComposer failed", error);
      });
    });
  };

  const handleComposerDrop = (event: DragEvent<HTMLDivElement>) => {
    handleAttachmentDrop(event, (files) => {
      void addAttachmentsToSessionComposer(files).catch((error: unknown) => {
        setComposerLimitError(error);
        console.error("[renderer] addAttachmentsToSessionComposer failed", error);
      });
    });
  };

  function setComposerLimitError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    setSnapshot((current) => (current ? { ...current, lastError: message } : current));
  }

  function handlePastedClipboardImage(clipboardImage: ClipboardImageRead) {
    if (!clipboardImage.ok) {
      if (!clipboardImage.message) {
        return;
      }
      if (document.activeElement === newThreadComposerRef.current) {
        onNewThreadComposerError(clipboardImage.message);
        return;
      }
      setComposerLimitError(clipboardImage.message);
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement === composerRef.current) {
      if (!api) {
        return;
      }
      void updateSnapshot(setSnapshot, () =>
        api.addComposerAttachments([clipboardImage.attachment]),
      ).catch((error: unknown) => {
        console.error("[renderer] addComposerAttachments failed", error);
      });
      return;
    }

    if (activeElement === newThreadComposerRef.current) {
      appendNewThreadAttachment(clipboardImage.attachment);
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      handleClipboardImageShortcut(
        event,
        api?.readClipboardImage,
        (clipboardImage) => {
          if (!api) {
            return;
          }
          void updateSnapshot(setSnapshot, () =>
            api.addComposerAttachments([clipboardImage]),
          ).catch((error: unknown) => {
            console.error("[renderer] addComposerAttachments failed", error);
          });
        },
        setComposerLimitError,
      )
    ) {
      return;
    }

    // Codex-style prompt recall: on an empty composer, ArrowUp walks back through this
    // session's sent prompts and ArrowDown returns toward the empty draft. Recall stays
    // attached only while the composer still holds the recalled text, so editing detaches.
    // It runs before the mention and slash menus: a recalled draft can start with "/" and
    // open the slash menu, whose arrow handling must not swallow recall navigation.
    const sessionId = selectedSession?.id ?? "";
    const recall = promptRecallRef.current;
    if (recall.sessionId !== sessionId) {
      recall.sessionId = sessionId;
      recall.cursor = null;
    }
    const historyEntries = sentPromptsForSession(sessionId);
    const recallCursor = recall.cursor;
    const recalling =
      recallCursor !== null &&
      recallCursor < historyEntries.length &&
      historyEntries[recallCursor] === composerDraft;
    const plainArrow = !event.shiftKey && !event.altKey && !event.nativeEvent.isComposing;
    if (
      event.key === "ArrowUp" &&
      plainArrow &&
      (composerDraft.length === 0 || recalling) &&
      historyEntries.length > 0
    ) {
      const nextCursor =
        (recalling && recallCursor !== null ? recallCursor : historyEntries.length) - 1;
      const nextText = nextCursor >= 0 ? historyEntries[nextCursor] : undefined;
      if (nextText !== undefined) {
        event.preventDefault();
        recall.cursor = nextCursor;
        setComposerDraft(nextText);
        return;
      }
    }
    if (event.key === "ArrowDown" && plainArrow && recalling && recallCursor !== null) {
      event.preventDefault();
      const nextCursor = recallCursor + 1;
      const nextText = historyEntries[nextCursor];
      if (nextText !== undefined) {
        recall.cursor = nextCursor;
        setComposerDraft(nextText);
      } else {
        recall.cursor = null;
        setComposerDraft("");
      }
      return;
    }

    if (handleMentionKeyDown(event)) {
      return;
    }

    if (handleSlashKeyDown(event)) {
      return;
    }

    // Codex parity: two Escapes on an empty composer open the session tree, the entry point
    // for editing an earlier user prompt and branching from it. A single Escape does nothing.
    if (
      event.key === "Escape" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      composerDraft.length === 0
    ) {
      const now = Date.now();
      if (now - lastEmptyEscapeAtRef.current <= DOUBLE_ESCAPE_MS) {
        lastEmptyEscapeAtRef.current = 0;
        event.preventDefault();
        openTreeModal();
        return;
      }
      lastEmptyEscapeAtRef.current = now;
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      selectedSession?.status === "running"
    ) {
      event.preventDefault();
      submitComposerDraft({ deliverAs: event.metaKey || event.ctrlKey ? "steer" : "followUp" });
      return;
    }

    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (
      !composerDraft.trim() &&
      composerAttachments.length === 0 &&
      annotations.list.length === 0
    ) {
      return;
    }
    if (requiresModelSelection) {
      return;
    }

    submitComposerDraft();
  };

  return {
    composerAttachments,
    submitComposerDraft,
    stopCurrentRun,
    handlePickAttachments,
    handleRemoveAttachment,
    handleEditQueuedMessage,
    handleCancelQueuedEdit,
    handleRemoveQueuedMessage,
    handleSteerQueuedMessage,
    handleComposerPaste,
    handleComposerDrop,
    handlePastedClipboardImage,
    handleComposerKeyDown,
  };
}
