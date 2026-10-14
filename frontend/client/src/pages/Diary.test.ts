import { describe, expect, it } from "vitest";
import { diaryPageCopy } from "./Diary";

describe("diaryPageCopy", () => {
  it("mantém a rota dedicada do diário disponível nos três idiomas globais", () => {
    expect(Object.keys(diaryPageCopy).sort()).toEqual(["en", "es", "pt"]);
    for (const copy of Object.values(diaryPageCopy)) {
      expect(copy.diary).toBeTruthy();
      expect(copy.safety).toBeTruthy();
      expect(copy.footer).toBeTruthy();
    }
  });
});
