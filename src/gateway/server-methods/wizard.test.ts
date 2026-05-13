import { describe, expect, it, vi } from "vitest";
import { wizardHandlers } from "./wizard.js";

const mocks = vi.hoisted(() => ({
  runConfigureWizard: vi.fn(),
}));

vi.mock("../../commands/configure.wizard.js", () => ({
  runConfigureWizard: mocks.runConfigureWizard,
}));

function createContext() {
  const wizardSessions = new Map();
  return {
    wizardSessions,
    findRunningWizard: () => {
      for (const [id, session] of wizardSessions) {
        if (session.getStatus() === "running") {
          return id;
        }
      }
      return null;
    },
    purgeWizardSession: (id: string) => {
      wizardSessions.delete(id);
    },
    wizardRunner: vi.fn(),
  };
}

describe("wizardHandlers", () => {
  it("uses a non-exiting runtime for browser configure sections", async () => {
    mocks.runConfigureWizard.mockImplementationOnce(async (_opts, runtime) => {
      runtime.exit(1);
    });
    const respond = vi.fn();

    await wizardHandlers["wizard.start"]?.({
      params: { flow: "configure", section: "model" },
      respond,
      context: createContext(),
    } as never);

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        done: true,
        status: "error",
        error: expect.stringContaining("exit 1"),
      }),
      undefined,
    );
  });

  it("disables service actions for browser configure sections", async () => {
    mocks.runConfigureWizard.mockImplementationOnce(async () => {});
    const respond = vi.fn();

    await wizardHandlers["wizard.start"]?.({
      params: { flow: "configure", section: "daemon" },
      respond,
      context: createContext(),
    } as never);

    expect(mocks.runConfigureWizard).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "configure",
        sections: ["daemon"],
        deferConfigReload: true,
        allowServiceActions: false,
      }),
      expect.anything(),
      expect.any(Object),
    );
  });
});
