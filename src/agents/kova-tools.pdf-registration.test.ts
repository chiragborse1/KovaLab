import { describe, expect, it } from "vitest";
import { collectPresentKovaTools } from "./kova-tools.registration.js";
import { createPdfTool } from "./tools/pdf-tool.js";

describe("createKovaTools PDF registration", () => {
  it("includes the pdf tool when the pdf factory returns a tool", () => {
    const pdfTool = createPdfTool({
      agentDir: "/tmp/kova-agent-main",
      config: {
        agents: {
          defaults: {
            pdfModel: { primary: "openai/gpt-5.4-mini" },
          },
        },
      },
    });

    expect(pdfTool?.name).toBe("pdf");
    expect(collectPresentKovaTools([pdfTool]).map((tool) => tool.name)).toContain("pdf");
  });
});
