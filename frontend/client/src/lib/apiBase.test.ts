import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl, resolveBrowserApiBaseUrl } from "./apiBase";

describe("resolveApiBaseUrl", () => {
  it("uses same-origin API routes behind an Ngrok tunnel", () => {
    expect(resolveApiBaseUrl("http://127.0.0.1:3000", "example.ngrok-free.app")).toBe("");
  });

  it("keeps the configured backend for local development", () => {
    expect(resolveApiBaseUrl("http://127.0.0.1:3000", "localhost")).toBe("http://127.0.0.1:3000");
  });

  it("uses the production backend only when no local override is defined", () => {
    expect(resolveApiBaseUrl(undefined, "endo-care.example.com")).toBe("https://backendendoacolhe.vercel.app");
  });

  it("preserves an explicit same-origin configuration", () => {
    expect(resolveApiBaseUrl("", "localhost")).toBe("");
  });

  it("can be imported by tests without a browser global", () => {
    expect(resolveBrowserApiBaseUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
  });
});
