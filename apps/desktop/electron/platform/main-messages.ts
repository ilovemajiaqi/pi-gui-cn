import type { DesktopLocale } from "../../contracts/ipc";

/**
 * Main-process copy for native menus, dialogs and OS notifications.
 *
 * Zero-dependency by design: host code must not import renderer i18n
 * (src/i18n), so this is a plain lookup table keyed by DesktopLocale. English
 * is the source of truth; the `Record<MainMessageKey, string>` shape makes
 * missing translations a compile error in either catalog. Interpolation uses
 * the same `{name}` placeholders as the renderer catalogs.
 */
export type MainMessageKey =
  | "main.mcpSignInTitle"
  | "main.mcpSignInOnlyHttps"
  | "main.mcpSignInCouldNotOpenBrowser"
  | "main.mcpSignInCheckLink"
  | "main.common.copyLink"
  | "main.common.close"
  | "main.common.ok"
  | "main.common.cancel"
  | "main.openWorkspaceFolder"
  | "main.attachFiles"
  | "main.menu.checkForUpdates"
  | "main.menu.file"
  | "main.menu.newThread"
  | "main.menu.newWindow"
  | "main.menu.openFolder"
  | "main.menu.view"
  | "main.menu.reload"
  | "main.menu.forceReload"
  | "main.update.availableTitle"
  | "main.update.availableBody"
  | "main.update.availableMessage"
  | "main.update.youHave"
  | "main.update.download"
  | "main.update.later"
  | "main.update.upToDate"
  | "main.update.checkFailed"
  | "main.update.timeout"
  | "main.update.unreachable"
  | "main.update.noStableRelease"
  | "main.update.httpStatus"
  | "main.update.unreadableResponse"
  | "main.update.noVersions"
  | "main.notify.agentFinished"
  | "main.notify.sessionFallback"
  | "main.notify.errorPrefix"
  | "main.notify.warningPrefix"
  | "main.notify.needsInput";

const EN_MESSAGES: Record<MainMessageKey, string> = {
  "main.mcpSignInTitle": "Open this MCP sign-in link yourself",
  "main.mcpSignInOnlyHttps": "pi-gui opens only https links, or http links on this computer.",
  "main.mcpSignInCouldNotOpenBrowser": "pi-gui could not open your browser.",
  "main.mcpSignInCheckLink": "Check the link before you open it:",
  "main.common.copyLink": "Copy link",
  "main.common.close": "Close",
  "main.common.ok": "OK",
  "main.common.cancel": "Cancel",
  "main.openWorkspaceFolder": "Open workspace folder",
  "main.attachFiles": "Attach files",
  "main.menu.checkForUpdates": "Check for Updates…",
  "main.menu.file": "File",
  "main.menu.newThread": "New Thread",
  "main.menu.newWindow": "New Window",
  "main.menu.openFolder": "Open Folder…",
  "main.menu.view": "View",
  "main.menu.reload": "Reload",
  "main.menu.forceReload": "Force Reload",
  "main.update.availableTitle": "pi-gui Release Available",
  "main.update.availableBody":
    "Version {latest} is available (you have {current}). Click to view the release.",
  "main.update.availableMessage": "Version {latest} is available.",
  "main.update.youHave": "You have {version}.",
  "main.update.download": "Download",
  "main.update.later": "Later",
  "main.update.upToDate": "You're up to date on version {version}.",
  "main.update.checkFailed": "Could not check for updates right now.",
  "main.update.timeout": "The update check timed out.",
  "main.update.unreachable": "The update check could not reach GitHub.",
  "main.update.noStableRelease": "No stable pi-gui release has been published yet.",
  "main.update.httpStatus": "GitHub Releases returned {status}.",
  "main.update.unreadableResponse": "GitHub Releases returned an unreadable response.",
  "main.update.noVersions": "GitHub Releases did not return any published versions.",
  "main.notify.agentFinished": "Agent finished responding",
  "main.notify.sessionFallback": "pi session",
  "main.notify.errorPrefix": "Error:",
  "main.notify.warningPrefix": "Warning:",
  "main.notify.needsInput": "Needs your input",
};

const ZH_CN_MESSAGES: Record<MainMessageKey, string> = {
  "main.mcpSignInTitle": "请自行打开此 MCP 登录链接",
  "main.mcpSignInOnlyHttps": "pi-gui 只会打开 https 链接，或本机上的 http 链接。",
  "main.mcpSignInCouldNotOpenBrowser": "pi-gui 无法打开你的浏览器。",
  "main.mcpSignInCheckLink": "打开前请先核对链接：",
  "main.common.copyLink": "复制链接",
  "main.common.close": "关闭",
  "main.common.ok": "确定",
  "main.common.cancel": "取消",
  "main.openWorkspaceFolder": "打开工作区文件夹",
  "main.attachFiles": "附加文件",
  "main.menu.checkForUpdates": "检查更新…",
  "main.menu.file": "文件",
  "main.menu.newThread": "新会话",
  "main.menu.newWindow": "新窗口",
  "main.menu.openFolder": "打开文件夹…",
  "main.menu.view": "视图",
  "main.menu.reload": "重新加载",
  "main.menu.forceReload": "强制重新加载",
  "main.update.availableTitle": "pi-gui 新版本可用",
  "main.update.availableBody": "新版本 {latest} 已发布(当前 {current})。点击查看发布页。",
  "main.update.availableMessage": "新版本 {latest} 已发布。",
  "main.update.youHave": "当前为 {version}。",
  "main.update.download": "下载",
  "main.update.later": "稍后",
  "main.update.upToDate": "已是最新版本 {version}。",
  "main.update.checkFailed": "暂时无法检查更新。",
  "main.update.timeout": "检查更新超时。",
  "main.update.unreachable": "检查更新时无法连接 GitHub。",
  "main.update.noStableRelease": "尚未发布稳定的 pi-gui 版本。",
  "main.update.httpStatus": "GitHub Releases 返回了 {status}。",
  "main.update.unreadableResponse": "GitHub Releases 返回了无法解析的响应。",
  "main.update.noVersions": "GitHub Releases 未返回任何已发布版本。",
  "main.notify.agentFinished": "agent 已完成回复",
  "main.notify.sessionFallback": "pi 会话",
  "main.notify.errorPrefix": "错误:",
  "main.notify.warningPrefix": "警告:",
  "main.notify.needsInput": "需要你的输入",
};

export const MAIN_MESSAGES: Record<DesktopLocale, Record<MainMessageKey, string>> = {
  en: EN_MESSAGES,
  "zh-CN": ZH_CN_MESSAGES,
};

export type MainTranslator = (
  key: MainMessageKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

/**
 * A `t()` over the main-process tables. Unknown locales fall back to English,
 * so a typo in a locale id degrades copy rather than crashing main.
 */
export function createMainTranslator(locale: DesktopLocale): MainTranslator {
  const messages = MAIN_MESSAGES[locale] ?? MAIN_MESSAGES.en;
  return (key, params) => {
    const template = messages[key] ?? MAIN_MESSAGES.en[key];
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : match,
    );
  };
}
