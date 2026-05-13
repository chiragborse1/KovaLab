import { describe, expect, test } from "vitest";
import { WizardSession } from "./session.js";

function noteRunner() {
  return new WizardSession(async (prompter) => {
    await prompter.note("Welcome");
    const name = await prompter.text({ message: "Name" });
    await prompter.note(`Hello ${name}`);
  });
}

describe("WizardSession", () => {
  test("steps progress in order", async () => {
    const session = noteRunner();

    const first = await session.next();
    expect(first.done).toBe(false);
    expect(first.step?.type).toBe("note");

    const secondPeek = await session.next();
    expect(secondPeek.step?.id).toBe(first.step?.id);

    if (!first.step) {
      throw new Error("expected first step");
    }
    await session.answer(first.step.id, null);

    const second = await session.next();
    expect(second.done).toBe(false);
    expect(second.step?.type).toBe("text");

    if (!second.step) {
      throw new Error("expected second step");
    }
    await session.answer(second.step.id, "Peter");

    const third = await session.next();
    expect(third.step?.type).toBe("note");

    if (!third.step) {
      throw new Error("expected third step");
    }
    await session.answer(third.step.id, null);

    const done = await session.next();
    expect(done.done).toBe(true);
    expect(done.status).toBe("done");
  });

  test("invalid answers throw", async () => {
    const session = noteRunner();
    const first = await session.next();
    await expect(session.answer("bad-id", null)).rejects.toThrow(/wizard: no pending step/i);
    if (!first.step) {
      throw new Error("expected first step");
    }
    await session.answer(first.step.id, null);
  });

  test("cancel marks session and unblocks", async () => {
    const session = new WizardSession(async (prompter) => {
      await prompter.text({ message: "Name" });
    });

    const step = await session.next();
    expect(step.step?.type).toBe("text");

    session.cancel();

    const done = await session.next();
    expect(done.done).toBe(true);
    expect(done.status).toBe("cancelled");
  });

  test("does not lose terminal completion when the last answer finishes the runner immediately", async () => {
    const session = new WizardSession(async (prompter) => {
      await prompter.text({ message: "Token" });
    });

    const first = await session.next();
    expect(first.step?.type).toBe("text");
    if (!first.step) {
      throw new Error("expected first step");
    }

    await session.answer(first.step.id, "ok");
    await Promise.resolve();

    const done = await session.next();
    expect(done.done).toBe(true);
    expect(done.status).toBe("done");
  });

  test("marks API key text prompts as sensitive for client renderers", async () => {
    const session = new WizardSession(async (prompter) => {
      await prompter.text({ message: "Enter OpenRouter API key", placeholder: "API key" });
    });

    const first = await session.next();

    expect(first.step?.type).toBe("text");
    expect(first.step?.sensitive).toBe(true);
  });

  test("emits progress steps without requiring an answer", async () => {
    const session = new WizardSession(async (prompter) => {
      const progress = prompter.progress("Installing WhatsApp plugin...");
      await Promise.resolve();
      progress.update("Downloading @kovaai/whatsapp@beta...");
      await Promise.resolve();
      progress.stop("Installed WhatsApp plugin");
      await prompter.note("Install complete");
    });

    const first = await session.next();
    expect(first.done).toBe(false);
    expect(first.step?.type).toBe("progress");
    expect(first.step?.message).toContain("Installing");

    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await session.next();
    expect(second.done).toBe(false);
    expect(second.step?.type).toBe("note");
    expect(second.step?.message).toBe("Install complete");
    if (!second.step) {
      throw new Error("expected second step");
    }
    await session.answer(second.step.id, null);
    expect((await session.next()).status).toBe("done");
  });

  test("emits client action steps with image data", async () => {
    const session = new WizardSession(async (prompter) => {
      const choice = await prompter.action?.({
        title: "WhatsApp linking",
        message: "Scan this QR",
        imageDataUrl: "data:image/png;base64,qr",
        primaryLabel: "Check scan",
        secondaryLabel: "Refresh QR",
        dangerLabel: "Skip linking",
      });
      await prompter.note(`choice=${choice}`);
    });

    const first = await session.next();
    expect(first.done).toBe(false);
    expect(first.step?.type).toBe("action");
    expect(first.step?.imageDataUrl).toBe("data:image/png;base64,qr");
    expect(first.step?.primaryLabel).toBe("Check scan");

    if (!first.step) {
      throw new Error("expected action step");
    }
    await session.answer(first.step.id, "primary");
    const second = await session.next();
    expect(second.step?.type).toBe("note");
    expect(second.step?.message).toBe("choice=primary");
  });

  test("does not report done while a stopped progress step is followed by delayed work", async () => {
    let releaseNextStep!: () => void;
    const waitForNextStep = new Promise<void>((resolve) => {
      releaseNextStep = resolve;
    });
    const session = new WizardSession(async (prompter) => {
      const progress = prompter.progress("Installing plugin...");
      await Promise.resolve();
      progress.stop("Installed plugin");
      await waitForNextStep;
      await prompter.note("Next setup step");
    });

    const progressStep = await session.next();
    expect(progressStep.step?.type).toBe("progress");

    await new Promise((resolve) => setTimeout(resolve, 0));
    const pendingNext = session.next();
    let settled = false;
    void pendingNext.then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    releaseNextStep();
    const next = await pendingNext;
    expect(next.done).toBe(false);
    expect(next.step?.type).toBe("note");
    expect(next.step?.message).toBe("Next setup step");
    if (!next.step) {
      throw new Error("expected next step");
    }
    await session.answer(next.step.id, null);
    expect((await session.next()).status).toBe("done");
  });
});
