import { useEffect, useState } from "react";
import { useTranslation } from "../../../i18n";
import type { Translate } from "../../../i18n/translate";

export function useRunningLabel(startedAt: string | undefined) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(() => formatRunningLabel(startedAt, t));

  useEffect(() => {
    setLabel(formatRunningLabel(startedAt, t));
    if (!startedAt) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setLabel(formatRunningLabel(startedAt, t));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [startedAt, t]);

  return label;
}

function formatRunningLabel(startedAt: string | undefined, t: Translate): string {
  if (!startedAt) {
    return t("conversation.running.idle");
  }

  const diffMs = Math.max(0, Date.now() - Date.parse(startedAt));
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  if (seconds < 60) {
    return t("conversation.running.secs", { seconds });
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0
    ? t("conversation.running.mins", { minutes })
    : t("conversation.running.minsSecs", { minutes, seconds: remaining });
}
