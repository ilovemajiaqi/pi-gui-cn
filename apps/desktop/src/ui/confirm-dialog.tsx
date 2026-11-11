import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { trapDialogFocus } from "./dialog-focus";

interface ConfirmDialogProps {
  /** Short eyebrow above the heading, such as the kind of thing being confirmed. */
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  /** Renders the confirm button as destructive and focuses cancel first. */
  readonly danger?: boolean;
  readonly submitting?: boolean;
  readonly error?: string;
  readonly testId: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/**
 * One destructive-action dialog for the whole renderer. Archive, delete, and remove flows should
 * route through this instead of `window.confirm`, which cannot be styled, localized, or tested.
 */
export function ConfirmDialog({
  eyebrow,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  submitting = false,
  error,
  testId,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const selector = danger ? "[data-confirm-cancel='true']" : "[data-confirm-accept='true']";
    dialogRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  }, [danger]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      trapDialogFocus(event, dialogRef.current);
      return;
    }
    if (event.key === "Escape" && !submitting) {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="tree-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || submitting) {
          return;
        }
        onCancel();
      }}
    >
      <div
        aria-modal="true"
        className="tree-modal tree-modal--compact"
        data-testid={testId}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="tree-modal__header">
          <div>
            <div className="tree-modal__eyebrow">{eyebrow}</div>
            <h2 className="tree-modal__title">{title}</h2>
          </div>
          <button
            aria-label={cancelLabel}
            className="tree-modal__close"
            disabled={submitting}
            type="button"
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="tree-modal__error error-banner" data-testid={`${testId}-error`}>
            {error}
          </div>
        ) : null}

        <div className="tree-modal__summary-step">
          <div className="tree-modal__summary-copy">{description}</div>
          <div className="tree-modal__footer">
            <div className="tree-modal__actions">
              <button
                className="button button--secondary"
                data-confirm-cancel="true"
                data-testid={`${testId}-cancel`}
                disabled={submitting}
                type="button"
                onClick={onCancel}
              >
                {cancelLabel}
              </button>
              <button
                className={`button ${danger ? "button--danger" : "button--primary"}`}
                data-confirm-accept="true"
                data-testid={`${testId}-confirm`}
                disabled={submitting}
                type="button"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
