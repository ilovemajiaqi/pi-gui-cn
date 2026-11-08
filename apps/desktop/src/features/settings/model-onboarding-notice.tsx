import { useTranslation } from "../../i18n";
import type { ModelOnboardingNotice } from "./model-onboarding";

interface ModelOnboardingNoticeBannerProps {
  readonly notice: ModelOnboardingNotice | undefined;
  readonly onOpenSettings: (section: ModelOnboardingNotice["actionSection"]) => void;
}

export function ModelOnboardingNoticeBanner({
  notice,
  onOpenSettings,
}: ModelOnboardingNoticeBannerProps) {
  const { t } = useTranslation();
  if (!notice) {
    return null;
  }

  return (
    <div className="model-onboarding-notice" data-testid="model-onboarding-notice">
      <div className="model-onboarding-notice__body">
        <span className="model-onboarding-notice__title">{t(notice.titleKey)}</span>
        <span className="model-onboarding-notice__description">
          {t(notice.descriptionKey, notice.descriptionParams)}
        </span>
      </div>
      <button
        className="model-onboarding-notice__action"
        type="button"
        onClick={() => onOpenSettings(notice.actionSection)}
      >
        {t(notice.actionLabelKey)}
      </button>
    </div>
  );
}
