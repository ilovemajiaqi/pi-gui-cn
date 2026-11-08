import { CheckIcon, ChevronDownIcon } from "../../ui/icons";
import { EditorIcon, hasEditorIcon } from "../../ui/editor-icons";
import { useTranslation } from "../../i18n";
import type { OpenInEditorState } from "./hooks/use-open-in-editor";

interface OpenInEditorButtonProps {
  readonly state: OpenInEditorState;
  readonly onOpenFolder: () => void;
}

export function OpenInEditorButton({ state, onOpenFolder }: OpenInEditorButtonProps) {
  const { t } = useTranslation();
  const displayLabel = state.loading ? "…" : (state.targetLabel ?? t("threads.editor.folder"));
  const label = state.loading
    ? t("threads.editor.looking")
    : state.targetLabel
      ? t("threads.editor.openIn", { label: state.targetLabel })
      : t("threads.editor.openInManager");

  return (
    <div className="open-in-editor" ref={state.wrapRef}>
      <button
        aria-label={label}
        className="open-in-editor__main"
        data-testid="open-in-editor"
        disabled={state.busy || state.loading}
        title={label}
        type="button"
        onClick={() => state.openIn()}
      >
        {hasEditorIcon(state.targetEditorId) ? (
          <EditorIcon editorId={state.targetEditorId} />
        ) : (
          <span className="open-in-editor__label" data-testid="open-in-editor-label">
            {displayLabel}
          </span>
        )}
      </button>
      <button
        aria-expanded={state.menuOpen}
        aria-haspopup="menu"
        aria-label={t("threads.editor.choose")}
        className="open-in-editor__trigger"
        data-testid="open-in-editor-menu-trigger"
        title={t("threads.editor.choose")}
        type="button"
        onClick={state.toggleMenu}
      >
        <ChevronDownIcon />
      </button>
      {state.menuOpen ? (
        <div className="open-in-editor__menu" data-testid="open-in-editor-menu" role="menu">
          {state.loading ? (
            <p className="open-in-editor__empty" data-testid="open-in-editor-loading">
              {t("threads.editor.looking")}
            </p>
          ) : state.editors.length === 0 ? (
            <p className="open-in-editor__empty" data-testid="open-in-editor-empty">
              {t("threads.editor.none")}
            </p>
          ) : (
            state.editors.map((editor) => (
              <button
                key={editor.id}
                className="open-in-editor__item"
                data-testid={`open-in-editor-${editor.id}`}
                role="menuitem"
                type="button"
                onClick={() => state.selectEditor(editor.id)}
              >
                <span className="open-in-editor__item-main">
                  <span className="open-in-editor__item-icon">
                    <EditorIcon editorId={editor.id} />
                  </span>
                  <span className="open-in-editor__item-label">{editor.label}</span>
                </span>
                {editor.id === state.preferredEditorId ? (
                  <span className="open-in-editor__item-check">
                    <CheckIcon />
                  </span>
                ) : null}
              </button>
            ))
          )}
          {!state.loading && state.editors.length > 0 ? (
            <div className="open-in-editor__separator" role="separator" />
          ) : null}
          {/* The OS file manager stays one click away even when editors exist. */}
          {!state.loading ? (
            <button
              className="open-in-editor__item"
              data-testid="open-in-editor-folder"
              role="menuitem"
              type="button"
              onClick={() => {
                state.toggleMenu();
                onOpenFolder();
              }}
            >
              <span className="open-in-editor__item-label">{t("threads.openFolder")}</span>
            </button>
          ) : null}
          {state.error ? <p className="open-in-editor__error">{state.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
