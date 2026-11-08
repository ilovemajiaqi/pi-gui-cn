import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { MessageKey, TranslateParams } from "../../i18n/translate";
import { buildModelOptions } from "../conversation/composer-commands";

export type ModelOnboardingSettingsSection = "models" | "providers";

export interface ModelOnboardingNotice {
  readonly titleKey: MessageKey;
  readonly descriptionKey: MessageKey;
  /** Values substituted into the description's `{name}` placeholders. */
  readonly descriptionParams?: TranslateParams;
  readonly actionLabelKey: MessageKey;
  readonly actionSection: ModelOnboardingSettingsSection;
}

export interface ModelOnboardingState {
  readonly hasSelectableModels: boolean;
  readonly requiresModelSelection: boolean;
  readonly unselectedModelKey: MessageKey;
  readonly emptyModelTitleKey: MessageKey;
  readonly emptyModelDescriptionKey: MessageKey;
  readonly notice?: ModelOnboardingNotice;
}

interface ModelSelectionInput {
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
}

export function deriveModelOnboardingState(
  runtime: RuntimeSnapshot | undefined,
  currentSelection: ModelSelectionInput,
): ModelOnboardingState {
  const selectableModels = buildModelOptions(runtime);
  const selectableSet = new Set(
    selectableModels.map((model) => `${model.providerId}:${model.modelId}`),
  );
  const hasSelectableModels = selectableModels.length > 0;
  const connectedProviderCount =
    runtime?.providers.filter((provider) => provider.hasAuth).length ?? 0;
  const settingsDefault = {
    provider: runtime?.settings.defaultProvider,
    modelId: runtime?.settings.defaultModelId,
  };
  const hasDefaultModel = Boolean(settingsDefault.provider && settingsDefault.modelId);
  const defaultModelUsable = isUsableSelection(settingsDefault, selectableSet);
  const hasCurrentSelection = Boolean(currentSelection.provider && currentSelection.modelId);
  const currentSelectionUsable = isUsableSelection(currentSelection, selectableSet);

  if (!hasSelectableModels) {
    return {
      hasSelectableModels: false,
      requiresModelSelection: true,
      unselectedModelKey: "conversation.onboarding.noModels",
      emptyModelTitleKey: "conversation.onboarding.noModels",
      emptyModelDescriptionKey:
        connectedProviderCount > 0
          ? "conversation.onboarding.noticeNoModelsHint"
          : "conversation.onboarding.noticeNoProvidersDescription",
      notice:
        connectedProviderCount > 0
          ? {
              titleKey: "conversation.onboarding.noticeNoModelsTitle",
              descriptionKey: "conversation.onboarding.noticeNoModelsDescription",
              actionLabelKey: "conversation.onboarding.openSettingsModels",
              actionSection: "models",
            }
          : {
              titleKey: "conversation.onboarding.noticeNoProvidersTitle",
              descriptionKey: "conversation.onboarding.noticeNoProvidersDescription",
              actionLabelKey: "conversation.onboarding.openSettingsProviders",
              actionSection: "providers",
            },
    };
  }

  if (hasCurrentSelection && !currentSelectionUsable) {
    return {
      hasSelectableModels: true,
      requiresModelSelection: true,
      unselectedModelKey: "conversation.onboarding.pickModel",
      emptyModelTitleKey: "conversation.onboarding.noModels",
      emptyModelDescriptionKey: "conversation.onboarding.pickModelHint",
      notice: {
        titleKey: "conversation.onboarding.noticeUnavailableTitle",
        descriptionKey: hasDefaultModel
          ? "conversation.onboarding.noticeUnavailableDefaultDescription"
          : "conversation.onboarding.noticeUnavailableSessionDescription",
        actionLabelKey: "conversation.onboarding.openSettingsModels",
        actionSection: "models",
      },
    };
  }

  if (!hasDefaultModel) {
    return {
      hasSelectableModels: true,
      requiresModelSelection: !currentSelectionUsable,
      unselectedModelKey: "conversation.onboarding.pickModel",
      emptyModelTitleKey: "conversation.onboarding.noticeDefaultTitle",
      emptyModelDescriptionKey: "conversation.onboarding.pickModelHint",
      notice: currentSelectionUsable
        ? undefined
        : {
            titleKey: "conversation.onboarding.noticeNoDefaultTitle",
            descriptionKey: "conversation.onboarding.noticeNoDefaultDescription",
            actionLabelKey: "conversation.onboarding.openSettingsModels",
            actionSection: "models",
          },
    };
  }

  if (!defaultModelUsable) {
    const defaultLabel = `${settingsDefault.provider}:${settingsDefault.modelId}`;
    return {
      hasSelectableModels: true,
      requiresModelSelection: !currentSelectionUsable,
      unselectedModelKey: "conversation.onboarding.pickModel",
      emptyModelTitleKey: "conversation.onboarding.noticeStaleTitle",
      emptyModelDescriptionKey: "conversation.onboarding.pickModelHint",
      notice: {
        titleKey: "conversation.onboarding.noticeStaleTitle",
        descriptionKey: currentSelectionUsable
          ? "conversation.onboarding.noticeStaleDescription"
          : "conversation.onboarding.noticeStaleSessionDescription",
        descriptionParams: { default: defaultLabel },
        actionLabelKey: "conversation.onboarding.openSettingsModels",
        actionSection: "models",
      },
    };
  }

  return {
    hasSelectableModels: true,
    requiresModelSelection: false,
    unselectedModelKey: "conversation.onboarding.pickModel",
    emptyModelTitleKey: "conversation.onboarding.noModels",
    emptyModelDescriptionKey: "conversation.onboarding.pickModelHint",
  };
}

function isUsableSelection(
  selection: ModelSelectionInput,
  selectableSet: ReadonlySet<string>,
): boolean {
  return Boolean(
    selection.provider &&
    selection.modelId &&
    selectableSet.has(`${selection.provider}:${selection.modelId}`),
  );
}
