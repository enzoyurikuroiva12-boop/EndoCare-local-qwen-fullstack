import { describe, expect, it } from "vitest";
import { shouldSubmitMessageOnEnter } from "./messageComposer";

describe("atalho de envio de mensagens", () => {
  it("envia com Enter simples", () => {
    expect(shouldSubmitMessageOnEnter("Enter", false, false)).toBe(true);
  });

  it("preserva quebra de linha com Shift+Enter e composição de texto", () => {
    expect(shouldSubmitMessageOnEnter("Enter", true, false)).toBe(false);
    expect(shouldSubmitMessageOnEnter("Enter", false, true)).toBe(false);
    expect(shouldSubmitMessageOnEnter("a", false, false)).toBe(false);
  });
});
