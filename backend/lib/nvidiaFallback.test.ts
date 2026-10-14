import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("EndoBot NVIDIA fallback", () => {
  it("keeps the fallback server-side and ordered after OpenRouter", async () => {
    const source = await readFile(resolve(process.cwd(), "api/endobot.ts"), "utf8");
    expect(source).toContain("process.env.NVIDIA_API_KEY");
    expect(source).toContain("process.env.NVIDIA_MODEL");
    expect(source).toContain("getNvidiaEndpoint");
    expect(source).toContain("if (!answer && nvidiaKey");
    expect(source.indexOf("getOpenRouterEndpoint")).toBeLessThan(source.indexOf("getNvidiaEndpoint"));
    expect(source).not.toContain("VITE_NVIDIA_API_KEY");
  });
});
