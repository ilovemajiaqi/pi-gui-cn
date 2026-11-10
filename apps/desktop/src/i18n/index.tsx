import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { defaultLocale, textDirectionFor, type AppLocale } from "./catalog";
import {
  LOCALE_STORAGE_KEY,
  detectSystemLanguages,
  isLocalePreference,
  readStoredLocale,
  readStoredLocaleOrNull,
  resolveLocale,
  writeStoredLocale,
  type LocalePreference,
} from "./preference";
import { translate, translatorFor, type Translate } from "./translate";

export {
  LOCALES,
  appLocaleIds,
  defaultLocale,
  languageTagParts,
  localeDefinition,
  matchSystemLocale,
  textDirectionFor,
  type AppLocale,
  type LocaleDefinition,
  type MessageKey,
  type Messages,
} from "./catalog";
export {
  LOCALE_STORAGE_KEY,
  localePreferences,
  resolveLocale,
  type LocalePreference,
} from "./preference";
export {
  catalogs,
  interpolate,
  isMessageKey,
  translate,
  translateError,
  translatorFor,
  type Translate,
  type TranslateParams,
} from "./translate";
export { interpolateNodes, type TranslateNodes } from "./rich-text";

interface I18nContextValue {
  readonly locale: AppLocale;
  /** What the user chose: a concrete locale, or "system". */
  readonly preference: LocalePreference;
  readonly setPreference: (preference: LocalePreference) => void;
  readonly t: Translate;
}

const fallbackValue: I18nContextValue = {
  locale: defaultLocale,
  preference: "system",
  setPreference: () => {},
  t: translate,
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  children,
  initialPreference,
}: {
  readonly children: ReactNode;
  /** Test seam: skip reading the profile so a spec can pin the locale. */
  readonly initialPreference?: LocalePreference;
}) {
  const [preference, setPreferenceState] = useState<LocalePreference>(
    () => initialPreference ?? readStoredLocale(),
  );
  const [systemLanguages, setSystemLanguages] = useState(detectSystemLanguages);
  const locale = useMemo(
    () => resolveLocale(preference, systemLanguages),
    [preference, systemLanguages],
  );

  useEffect(() => {
    // Hydrate from main when this profile has no recorded choice — a cleared,
    // restored or migrated profile would otherwise reopen in the OS language
    // while main's native menus stayed on the persisted one. An explicit
    // "system" is a choice and keeps following the OS, so it is never replaced.
    if (initialPreference !== undefined || readStoredLocaleOrNull() !== null) return;
    let cancelled = false;
    window.piApp
      ?.getLocale?.()
      .then((persisted) => {
        if (cancelled || !isLocalePreference(persisted)) return;
        // A choice made while the read was in flight wins.
        if (readStoredLocaleOrNull() !== null) return;
        writeStoredLocale(persisted);
        setPreferenceState(persisted);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initialPreference]);

  useEffect(() => {
    // Every window keeps its own copy of the preference, so follow a choice made in
    // another window, and an OS language change while the preference is "system".
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY) setPreferenceState(readStoredLocale());
    };
    const onLanguageChange = () => setSystemLanguages(detectSystemLanguages());
    window.addEventListener("storage", onStorage);
    window.addEventListener("languagechange", onLanguageChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("languagechange", onLanguageChange);
    };
  }, []);

  // Main cannot read this profile's localStorage, so the resolved locale is
  // pushed over IPC whenever it changes: on mount, on a preference change, and
  // on an OS language change. Main uses it for native menus, dialogs and
  // notifications, and persists it for the next launch.
  useEffect(() => {
    window.piApp?.setLocale(locale)?.catch(() => {});
  }, [locale]);

  useEffect(() => {
    // Main broadcasts every accepted change to all windows; adopting an equal
    // value would loop, so a pushed locale that matches what this window
    // already resolved is ignored.
    const unsubscribe = window.piApp?.onLocaleChanged?.((next) => {
      setPreferenceState((current) =>
        resolveLocale(current, systemLanguages) === next ? current : next,
      );
    });
    return () => unsubscribe?.();
  }, [systemLanguages]);

  const setPreference = useCallback((next: LocalePreference) => {
    writeStoredLocale(next);
    setPreferenceState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    // RTL locales set `dir` in the registry; everything else stays left-to-right.
    document.documentElement.dir = textDirectionFor(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, preference, setPreference, t: translatorFor(locale) }),
    [locale, preference, setPreference],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Falls back to the default locale so components stay renderable outside the provider. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext) ?? fallbackValue;
}

export function useTranslation(): { readonly t: Translate; readonly locale: AppLocale } {
  const { t, locale } = useI18n();
  return { t, locale };
}
