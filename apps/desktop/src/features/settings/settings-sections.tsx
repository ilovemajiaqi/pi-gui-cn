import type { ReactNode } from "react";
import { translate, type MessageKey, type Translate } from "../../i18n";
import {
  ArchiveIcon,
  BellIcon,
  ExtensionIcon,
  KeyboardIcon,
  ModelIcon,
  PlugIcon,
  SettingsIcon,
  SkillIcon,
  SunIcon,
} from "../../ui/icons";

export interface SettingsSectionDefinition {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly groupKey: MessageKey;
  readonly icon: ReactNode;
  /** Words people search for that are not in the title, such as the page's row titles. */
  readonly keywords: readonly string[];
  /** Copy under the page title; `{workspace}` is the selected workspace's name. */
  readonly descriptionKey: MessageKey;
  /** Pages that read or write one workspace's runtime. */
  readonly needsWorkspace: boolean;
}

/**
 * Nav order: grouped the way Codex groups its settings, one entry per page. Entries
 * hold message keys rather than copy, so the table stays static and typed while the
 * page renders in the chosen language.
 */
export const SETTINGS_SECTIONS = [
  {
    id: "general",
    titleKey: "settings.nav.general",
    groupKey: "settings.group.app",
    icon: <SettingsIcon />,
    keywords: ["model settings scope", "per repo", "skill slash commands", "terminal", "shell"],
    descriptionKey: "settings.section.general.description",
    needsWorkspace: false,
  },
  {
    id: "appearance",
    titleKey: "settings.nav.appearance",
    groupKey: "settings.group.app",
    icon: <SunIcon />,
    keywords: ["theme", "light", "dark", "system", "preset", "colors", "transparency", "language"],
    descriptionKey: "settings.section.appearance.description",
    needsWorkspace: false,
  },
  {
    id: "notifications",
    titleKey: "settings.nav.notifications",
    groupKey: "settings.group.app",
    icon: <BellIcon />,
    keywords: ["alerts", "background", "completion", "failures", "approval", "macos"],
    descriptionKey: "settings.section.notifications.description",
    needsWorkspace: false,
  },
  {
    id: "shortcuts",
    titleKey: "settings.nav.shortcuts",
    groupKey: "settings.group.app",
    icon: <KeyboardIcon />,
    keywords: ["keys", "hotkeys", "keybindings"],
    descriptionKey: "settings.section.shortcuts.description",
    needsWorkspace: false,
  },
  {
    id: "providers",
    titleKey: "settings.nav.providers",
    groupKey: "settings.group.agent",
    icon: <PlugIcon />,
    keywords: ["login", "logout", "oauth", "api key", "auth", "custom endpoint"],
    descriptionKey: "settings.section.providers.description",
    needsWorkspace: true,
  },
  {
    id: "models",
    titleKey: "settings.nav.models",
    groupKey: "settings.group.agent",
    icon: <ModelIcon />,
    keywords: ["default model", "reasoning", "thinking", "enabled models"],
    descriptionKey: "settings.section.models.description",
    needsWorkspace: true,
  },
  {
    id: "mcp",
    titleKey: "settings.nav.mcp",
    groupKey: "settings.group.agent",
    icon: <ExtensionIcon />,
    keywords: ["mcp", "mcp.json", "model context protocol", "servers", "code mode", "codemode"],
    descriptionKey: "settings.section.mcp.description",
    needsWorkspace: true,
  },
  {
    id: "archive",
    titleKey: "settings.nav.archive",
    groupKey: "settings.group.app",
    icon: <ArchiveIcon />,
    keywords: ["archived chats", "archived threads", "delete", "purge", "retention", "cleanup"],
    descriptionKey: "settings.section.archive.description",
    needsWorkspace: false,
  },
] as const satisfies readonly SettingsSectionDefinition[];

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

/**
 * Skills and Extensions are their own app views, not settings sections: each has its own page,
 * its own header and its own list. They still appear in the secondary nav so a reader can move
 * between the customization pages without going back, and each entry highlights its own page.
 */
export const CUSTOMIZE_NAV_ITEMS = [
  {
    id: "skills",
    titleKey: "settings.nav.skills",
    groupKey: "settings.group.customize",
    icon: <SkillIcon />,
    keywords: ["skills", "slash commands", "workflows", "prompts"],
  },
  {
    id: "extensions",
    titleKey: "settings.nav.extensions",
    groupKey: "settings.group.customize",
    icon: <ExtensionIcon />,
    keywords: ["extensions", "plugins", "add-ons", "tools", "hooks"],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly titleKey: MessageKey;
  readonly groupKey: MessageKey;
  readonly icon: ReactNode;
  readonly keywords: readonly string[];
}[];

export type CustomizeNavId = (typeof CUSTOMIZE_NAV_ITEMS)[number]["id"];

/** The secondary nav in one language: every settings section, then the customization pages. */
export function settingsNavItems(t: Translate) {
  return [
    ...SETTINGS_SECTIONS.map((section) => ({
      id: section.id,
      title: t(section.titleKey),
      group: t(section.groupKey),
      icon: section.icon,
      keywords: section.keywords,
    })),
    ...CUSTOMIZE_NAV_ITEMS.map((item) => ({
      id: item.id,
      title: t(item.titleKey),
      group: t(item.groupKey),
      icon: item.icon,
      keywords: item.keywords,
    })),
  ];
}

export function settingsSectionDefinition(section: SettingsSection): SettingsSectionDefinition {
  return SETTINGS_SECTIONS.find((definition) => definition.id === section) ?? SETTINGS_SECTIONS[0];
}

/** English unless a locale is passed; the command palette builds labels outside React. */
export function sectionTitle(section: SettingsSection, t: Translate = translate): string {
  return t(settingsSectionDefinition(section).titleKey);
}
