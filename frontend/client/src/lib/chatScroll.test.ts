import { describe, expect, it } from "vitest";
import { isNearChatBottom } from "./chatScroll";

describe("chat scroll position", () => {
  it("identifica quando a pessoa está próxima da mensagem mais recente", () => {
    expect(isNearChatBottom({ scrollHeight: 800, scrollTop: 540, clientHeight: 200 })).toBe(true);
    expect(isNearChatBottom({ scrollHeight: 800, scrollTop: 420, clientHeight: 200 })).toBe(false);
  });
});
