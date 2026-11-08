import type { ReactNode } from "react";
import { formatShortcut } from "../../../contracts/ipc";
import type { BuiltinToolKind } from "../../../contracts/workbench";
import { translate, type MessageKey, type Translate } from "../../i18n";
import type { ThreadAction } from "../threads/thread-actions";
import { BUILTIN_TOOL_ENTRIES } from "../workbench/builtin-tools";
import type { SettingsSection } from "../settings/settings-view";
import { sectionTitle } from "../settings/settings-sections";
import {
  ClockIcon,
  ExtensionIcon,
  FileIcon,
  FolderIcon,
  ModelIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SidebarToggleIcon,
  SidePanelIcon,
  SkillIcon,
} from "../../ui/icons";

/** Built-in tool ids to their catalog labels; the id is the contract's kind, not the label. */
const TOOL_LABEL_KEYS: Readonly<Record<BuiltinToolKind, MessageKey>> = {
  files: "workbench.tool.files",
  changes: "workbench.tool.review",
  terminal: "workbench.tool.terminal",
};

export type PaletteMode = "commands" | "files" | "models";

export interface PaletteAction {
  readonly id: string;
  readonly title: string;
  readonly icon: ReactNode;
  readonly hint?: string;
  /** Actions that open another palette list keep the palette open. */
  readonly keepsOpen?: boolean;
  readonly run: () => void;
}

/** "Settings" itself opens General. */
const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  "appearance",
  "notifications",
  "shortcuts",
  "providers",
  "models",
  "mcp",
];

/** What the app can do right now; an action is listed only when it would work. */
export interface PaletteActionContext {
  readonly platform: NodeJS.Platform;
  readonly hasWorkspace: boolean;
  /** A thread is open in the main pane, with the actions its menus show. */
  readonly thread?: {
    readonly canSwitchModel: boolean;
    readonly actions: readonly ThreadAction[];
  };
  readonly canToggleSidebar: boolean;
  readonly newThread: () => void;
  readonly openFolder: () => void;
  readonly openSettings: (section: SettingsSection) => void;
  readonly openSkills: () => void;
  readonly openExtensions: () => void;
  readonly openScheduledTasks: () => void;
  readonly toggleSidebar: () => void;
  /** Shows the tool in the side panel, or hides the panel when that tool is already showing. */
  readonly toggleTool: (kind: BuiltinToolKind) => void;
  readonly toggleSidePanel: () => void;
  /** Extension views the side panel can open for this thread. */
  readonly extensionViews: readonly {
    readonly id: string;
    readonly title: string;
    readonly open: () => void;
  }[];
  readonly findInThread: () => void;
  readonly openPaletteMode: (mode: PaletteMode) => void;
}

/**
 * What the app can do right now, as palette actions. `t` renders the fixed titles;
 * the caller's locale wins, and the default-locale translator keeps specs honest.
 */
export function buildPaletteActions(
  context: PaletteActionContext,
  t: Translate = translate,
): readonly PaletteAction[] {
  const { platform, thread } = context;
  const actions: PaletteAction[] = [];
  if (context.hasWorkspace) {
    actions.push({
      id: "new-thread",
      title: t("palette.action.newThread"),
      icon: <PlusIcon />,
      hint: formatShortcut(platform, "N"),
      run: context.newThread,
    });
  }
  actions.push({
    id: "open-folder",
    title: t("palette.action.openFolder"),
    icon: <FolderIcon />,
    run: context.openFolder,
  });
  if (thread) {
    actions.push(
      {
        id: "go-to-file",
        title: t("palette.action.goToFile"),
        icon: <FileIcon />,
        hint: formatShortcut(platform, "P"),
        keepsOpen: true,
        run: () => context.openPaletteMode("files"),
      },
      {
        id: "find-in-thread",
        title: t("palette.action.findInThread"),
        icon: <SearchIcon />,
        hint: formatShortcut(platform, "F"),
        run: context.findInThread,
      },
    );
    if (thread.canSwitchModel) {
      actions.push({
        id: "switch-model",
        title: t("palette.action.switchModel"),
        icon: <ModelIcon />,
        keepsOpen: true,
        run: () => context.openPaletteMode("models"),
      });
    }
    for (const { kind, Icon, shortcutKey } of BUILTIN_TOOL_ENTRIES) {
      actions.push({
        id: `toggle-${kind}`,
        title: t("palette.action.toggleTool", { tool: t(TOOL_LABEL_KEYS[kind]) }),
        icon: <Icon />,
        hint: shortcutKey ? formatShortcut(platform, shortcutKey) : undefined,
        run: () => context.toggleTool(kind),
      });
    }
    actions.push({
      id: "toggle-side-panel",
      title: t("palette.action.toggleSidePanel"),
      icon: <SidePanelIcon />,
      hint: formatShortcut(platform, "B", { alt: true }),
      run: context.toggleSidePanel,
    });
    for (const view of context.extensionViews) {
      actions.push({
        id: `extension-view:${view.id}`,
        title: t("palette.action.openNamed", { view: view.title }),
        icon: <ExtensionIcon />,
        run: view.open,
      });
    }
    actions.push(...thread.actions);
  }
  if (context.canToggleSidebar) {
    actions.push({
      id: "toggle-sidebar",
      title: t("palette.action.toggleSidebar"),
      icon: <SidebarToggleIcon />,
      hint: formatShortcut(platform, "B"),
      run: context.toggleSidebar,
    });
  }
  actions.push({
    id: "scheduled-tasks",
    title: t("palette.action.scheduledTasks"),
    icon: <ClockIcon />,
    run: context.openScheduledTasks,
  });
  if (context.hasWorkspace) {
    actions.push(
      {
        id: "skills",
        title: t("palette.action.skills"),
        icon: <SkillIcon />,
        run: context.openSkills,
      },
      {
        id: "extensions",
        title: t("palette.action.extensions"),
        icon: <ExtensionIcon />,
        run: context.openExtensions,
      },
    );
  }
  actions.push({
    id: "settings",
    title: t("palette.action.settings"),
    icon: <SettingsIcon />,
    hint: formatShortcut(platform, ","),
    run: () => context.openSettings("general"),
  });
  for (const section of SETTINGS_SECTIONS) {
    actions.push({
      id: `settings-${section}`,
      title: t("palette.action.settingsSection", { section: sectionTitle(section, t) }),
      icon: <SettingsIcon />,
      run: () => context.openSettings(section),
    });
  }
  return actions;
}
