import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildProviderPluginMethodChoice,
  resolveProviderModelPickerEntries,
  resolveProviderPluginChoice,
  resolveProviderWizardOptions,
} from "../../../src/plugins/provider-wizard.js";
import type { ProviderAuthMethod, ProviderPlugin } from "../../../src/plugins/types.js";

const resolvePluginProvidersMock = vi.fn();
const resolveManifestProviderAuthChoicesMock = vi.fn();
const resolvePluginSetupProviderMock = vi.fn();

vi.mock("../../../src/plugins/providers.runtime.js", () => ({
  isPluginProvidersLoadInFlight: () => false,
  resolvePluginProviders: (...args: unknown[]) => resolvePluginProvidersMock(...args),
}));
vi.mock("../../../src/plugins/provider-auth-choices.js", () => ({
  resolveManifestProviderAuthChoices: (...args: unknown[]) =>
    resolveManifestProviderAuthChoicesMock(...args),
}));
vi.mock("../../../src/plugins/setup-registry.js", () => ({
  resolvePluginSetupProvider: (...args: unknown[]) => resolvePluginSetupProviderMock(...args),
}));

function createAuthMethod(
  params: Pick<ProviderAuthMethod, "id" | "label"> &
    Partial<Pick<ProviderAuthMethod, "hint" | "wizard">>,
): ProviderAuthMethod {
  return {
    id: params.id,
    label: params.label,
    ...(params.hint ? { hint: params.hint } : {}),
    ...(params.wizard ? { wizard: params.wizard } : {}),
    kind: "api_key",
    run: async () => ({ profiles: [] }),
  };
}

const TEST_PROVIDERS: ProviderPlugin[] = [
  {
    id: "alpha",
    label: "Alpha",
    auth: [
      createAuthMethod({
        id: "api-key",
        label: "API key",
        wizard: {
          choiceLabel: "Alpha key",
          choiceHint: "Use an API key",
          groupId: "alpha",
          groupLabel: "Alpha",
          onboardingScopes: ["text-inference"],
        },
      }),
      createAuthMethod({
        id: "oauth",
        label: "OAuth",
        wizard: {
          choiceId: "alpha-oauth",
          choiceLabel: "Alpha OAuth",
          groupId: "alpha",
          groupLabel: "Alpha",
          groupHint: "Recommended",
        },
      }),
    ],
    wizard: {
      modelPicker: {
        label: "Alpha custom",
        hint: "Pick Alpha models",
        methodId: "oauth",
      },
    },
  },
  {
    id: "beta",
    label: "Beta",
    auth: [createAuthMethod({ id: "token", label: "Token" })],
    wizard: {
      setup: {
        choiceLabel: "Beta setup",
        groupId: "beta",
        groupLabel: "Beta",
      },
      modelPicker: {
        label: "Beta custom",
      },
    },
  },
  {
    id: "gamma",
    label: "Gamma",
    auth: [
      createAuthMethod({ id: "default", label: "Default auth" }),
      createAuthMethod({ id: "alt", label: "Alt auth" }),
    ],
    wizard: {
      setup: {
        methodId: "alt",
        choiceId: "gamma-alt",
        choiceLabel: "Gamma alt",
        groupId: "gamma",
        groupLabel: "Gamma",
      },
    },
  },
];

const TEST_PROVIDER_IDS = TEST_PROVIDERS.map((provider) => provider.id).toSorted((left, right) =>
  left.localeCompare(right),
);

function sortedValues(values: readonly string[]) {
  return [...values].toSorted((left, right) => left.localeCompare(right));
}

function expectUniqueValues(values: readonly string[]) {
  expect(values).toEqual([...new Set(values)]);
}

function resolveExpectedWizardChoiceValues(providers: ProviderPlugin[]) {
  return sortedValues(
    providers.flatMap((provider) => {
      const methodSetups = provider.auth.filter((method) => method.wizard);
      if (methodSetups.length > 0) {
        return methodSetups.map(
          (method) =>
            method.wizard?.choiceId?.trim() ||
            buildProviderPluginMethodChoice(provider.id, method.id),
        );
      }

      const setup = provider.wizard?.setup;
      if (!setup) {
        return [];
      }

      const explicitMethodId = setup.methodId?.trim();
      if (explicitMethodId && provider.auth.some((method) => method.id === explicitMethodId)) {
        return [
          setup.choiceId?.trim() || buildProviderPluginMethodChoice(provider.id, explicitMethodId),
        ];
      }

      if (provider.auth.length === 1) {
        return [setup.choiceId?.trim() || provider.id];
      }

      return provider.auth.map((method) => buildProviderPluginMethodChoice(provider.id, method.id));
    }),
  );
}

function buildExpectedWizardChoices(providers: ProviderPlugin[]) {
  return providers.flatMap((provider) => {
    const methodSetups = provider.auth.filter((method) => method.wizard);
    if (methodSetups.length > 0) {
      return methodSetups.map((method) => {
        const wizard = method.wizard!;
        return {
          pluginId: provider.id,
          providerId: provider.id,
          methodId: method.id,
          choiceId:
            wizard.choiceId?.trim() || buildProviderPluginMethodChoice(provider.id, method.id),
          choiceLabel: wizard.choiceLabel?.trim() || provider.label,
          ...(wizard.choiceHint ? { choiceHint: wizard.choiceHint } : {}),
          ...(wizard.groupId ? { groupId: wizard.groupId } : {}),
          ...(wizard.groupLabel ? { groupLabel: wizard.groupLabel } : {}),
          ...(wizard.groupHint ? { groupHint: wizard.groupHint } : {}),
          ...(wizard.onboardingScopes ? { onboardingScopes: wizard.onboardingScopes } : {}),
        };
      });
    }

    const setup = provider.wizard?.setup;
    if (!setup) {
      return [];
    }
    const explicitMethodId = setup.methodId?.trim();
    const methods =
      explicitMethodId && provider.auth.some((method) => method.id === explicitMethodId)
        ? provider.auth.filter((method) => method.id === explicitMethodId)
        : provider.auth;
    return methods.map((method) => ({
      pluginId: provider.id,
      providerId: provider.id,
      methodId: method.id,
      choiceId:
        setup.choiceId?.trim() ||
        (provider.auth.length === 1
          ? provider.id
          : buildProviderPluginMethodChoice(provider.id, method.id)),
      choiceLabel: setup.choiceLabel?.trim() || provider.label,
      ...(setup.choiceHint ? { choiceHint: setup.choiceHint } : {}),
      ...(setup.groupId ? { groupId: setup.groupId } : {}),
      ...(setup.groupLabel ? { groupLabel: setup.groupLabel } : {}),
      ...(setup.groupHint ? { groupHint: setup.groupHint } : {}),
      ...(setup.onboardingScopes ? { onboardingScopes: setup.onboardingScopes } : {}),
    }));
  });
}

function resolveExpectedModelPickerValues(providers: ProviderPlugin[]) {
  return sortedValues(
    providers.flatMap((provider) => {
      const modelPicker = provider.wizard?.modelPicker;
      if (!modelPicker) {
        return [];
      }
      const explicitMethodId = modelPicker.methodId?.trim();
      if (explicitMethodId) {
        return [buildProviderPluginMethodChoice(provider.id, explicitMethodId)];
      }
      if (provider.auth.length === 1) {
        return [provider.id];
      }
      return [buildProviderPluginMethodChoice(provider.id, provider.auth[0]?.id ?? "default")];
    }),
  );
}

function expectAllChoicesResolve(
  values: readonly string[],
  resolver: (choice: string) => ReturnType<typeof resolveProviderPluginChoice>,
) {
  expect(
    values.every((value) => Boolean(resolver(value))),
    values.join(", "),
  ).toBe(true);
}

beforeEach(() => {
  resolvePluginProvidersMock.mockReset();
  resolvePluginProvidersMock.mockReturnValue(TEST_PROVIDERS);
  resolveManifestProviderAuthChoicesMock.mockReset();
  resolveManifestProviderAuthChoicesMock.mockReturnValue(
    buildExpectedWizardChoices(TEST_PROVIDERS),
  );
  resolvePluginSetupProviderMock.mockReset();
  resolvePluginSetupProviderMock.mockImplementation((params: { provider?: string }) =>
    TEST_PROVIDERS.find((provider) => provider.id === params.provider),
  );
});

export function describeProviderWizardSetupOptionsContract() {
  describe("provider wizard setup options contract", () => {
    it("exposes every wizard setup choice through the shared wizard layer", () => {
      const options = resolveProviderWizardOptions({
        config: {
          plugins: {
            enabled: true,
            allow: TEST_PROVIDER_IDS,
            slots: {
              memory: "none",
            },
          },
        },
        env: process.env,
      });

      expect(sortedValues(options.map((option) => option.value))).toEqual(
        resolveExpectedWizardChoiceValues(TEST_PROVIDERS),
      );
      expectUniqueValues(options.map((option) => option.value));
    });
  });
}

export function describeProviderWizardChoiceResolutionContract() {
  describe("provider wizard choice resolution contract", () => {
    it("round-trips every shared wizard choice back to its provider and auth method", () => {
      const options = resolveProviderWizardOptions({ config: {}, env: process.env });

      expectAllChoicesResolve(
        options.map((option) => option.value),
        (choice) =>
          resolveProviderPluginChoice({
            providers: TEST_PROVIDERS,
            choice,
          }),
      );
    });
  });
}

export function describeProviderWizardModelPickerContract() {
  describe("provider wizard model picker contract", () => {
    it("exposes every model-picker entry through the shared wizard layer", () => {
      const entries = resolveProviderModelPickerEntries({
        config: {},
        env: process.env,
        providerRefs: TEST_PROVIDER_IDS,
      });

      expect(sortedValues(entries.map((entry) => entry.value))).toEqual(
        resolveExpectedModelPickerValues(TEST_PROVIDERS),
      );
      expectAllChoicesResolve(
        entries.map((entry) => entry.value),
        (choice) =>
          resolveProviderPluginChoice({
            providers: TEST_PROVIDERS,
            choice,
          }),
      );
    });
  });
}
