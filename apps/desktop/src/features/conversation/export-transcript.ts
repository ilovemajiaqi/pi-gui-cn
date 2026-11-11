import type { Dispatch, SetStateAction } from "react";
import type { DesktopAppState } from "../../../contracts/desktop-state";
import type { PiDesktopApi } from "../../../contracts/ipc";

type SnapshotSetter = Dispatch<SetStateAction<DesktopAppState | null>>;

/** Failures of host actions surface as the last error; success stays quiet. */
function reportHostActionError(setSnapshot: SnapshotSetter, error: unknown): void {
  setSnapshot((current) =>
    current
      ? {
          ...current,
          lastError: error instanceof Error ? error.message : String(error),
        }
      : current,
  );
}

/**
 * Saves the selected thread's transcript as Markdown through the native save dialog.
 * The dialog is the export's feedback; only failures surface as the last error.
 */
export function exportTranscriptViaDialog(api: PiDesktopApi, setSnapshot: SnapshotSetter): void {
  void api.exportTranscript().catch((error: unknown) => {
    reportHostActionError(setSnapshot, error);
  });
}

/** Copies the selected thread's transcript Markdown to the clipboard. */
export function copyTranscriptToClipboard(api: PiDesktopApi, setSnapshot: SnapshotSetter): void {
  void api.copyTranscript().catch((error: unknown) => {
    reportHostActionError(setSnapshot, error);
  });
}
