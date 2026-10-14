import { describe, expect, it } from "vitest";
import { DEFAULT_OPENROUTER_MODEL, getOpenRouterAnswer, getOpenRouterModel, OPENROUTER_CHAT_ENDPOINT, OPENROUTER_CHAT_OPTIONS } from "./openrouter.js";

describe("configuração do OpenRouter", () => {
  it("usa o endpoint oficial e um modelo padrão configurável", () => {
    expect(OPENROUTER_CHAT_ENDPOINT).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(getOpenRouterModel()).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(getOpenRouterModel("mistralai/mistral-small-3.1")).toBe("mistralai/mistral-small-3.1");
  });

  it("desativa raciocínio exposto e rejeita respostas sem conteúdo", () => {
    expect(OPENROUTER_CHAT_OPTIONS).toEqual({ reasoning: { enabled: false }, max_tokens: 420 });
    expect(getOpenRouterAnswer({ choices: [{ message: { content: null } }] })).toBeNull();
    expect(getOpenRouterAnswer({ choices: [{ message: { content: " resposta válida " } }] })).toBe("resposta válida");
  });
});
