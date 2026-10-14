import { describe, expect, it } from "vitest";
import { blogPageCopy, formatRelativePublishedTime } from "./Blog";

describe("blogPageCopy", () => {
  it("oferece a interface pública de leitura nos três idiomas do site", () => {
    expect(Object.keys(blogPageCopy).sort()).toEqual(["en", "es", "pt"]);
    for (const copy of Object.values(blogPageCopy)) {
      expect(copy.title).toBeTruthy();
      expect(copy.emptyTitle).toBeTruthy();
      expect(copy.published).toBeTruthy();
      expect(copy.pinned).toBeTruthy();
    }
  });

  it("mostra há quanto tempo uma publicação foi enviada no idioma da pessoa", () => {
    const now = new Date("2026-08-21T15:00:00.000Z");
    expect(formatRelativePublishedTime("2026-08-21T13:00:00.000Z", "pt-BR", now)).toContain("2");
    expect(formatRelativePublishedTime("2026-08-21T14:59:00.000Z", "en-US", now)).toContain("1");
    expect(formatRelativePublishedTime("2026-08-20T15:00:00.000Z", "es-ES", now)).toBe("ayer");
  });
});
