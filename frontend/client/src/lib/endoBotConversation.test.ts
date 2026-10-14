import { describe, expect, it, vi } from "vitest";
import { createEndoBotRequestHeaders, getInitialEndoBotHistoryMode, submitEndoBotQuestion } from "./endoBotConversation";

function questionFlow() {
  return {
    question: "Quais perguntas posso levar à consulta?",
    authenticated: true,
    humanTakeoverPaused: false,
    ensureConversation: vi.fn(async () => "conversation-1"),
    persistQuestion: vi.fn(async (_conversationId: string) => {}),
    requestAnswer: vi.fn(async (_conversationId: string | null) => ({ answer: "Anote suas dúvidas." })),
  };
}

describe("EndoBot text and transcribed-question flow", () => {
  it("creates history and persists the question before requesting an authenticated answer", async () => {
    const flow = questionFlow();
    const result = await submitEndoBotQuestion(flow);
    expect(flow.ensureConversation).toHaveBeenCalledWith(flow.question);
    expect(flow.persistQuestion).toHaveBeenCalledWith("conversation-1");
    expect(flow.requestAnswer).toHaveBeenCalledWith("conversation-1");
    expect(flow.persistQuestion.mock.invocationCallOrder[0]).toBeLessThan(flow.requestAnswer.mock.invocationCallOrder[0]);
    expect(result).toEqual({ kind: "assistant", conversationId: "conversation-1", result: { answer: "Anote suas dúvidas." } });
  });

  it("allows guest questions without creating private history", async () => {
    const flow = { ...questionFlow(), authenticated: false };
    await submitEndoBotQuestion(flow);
    expect(flow.ensureConversation).not.toHaveBeenCalled();
    expect(flow.persistQuestion).not.toHaveBeenCalled();
    expect(flow.requestAnswer).toHaveBeenCalledWith(null);
  });

  it("allows an explicitly temporary authenticated conversation without creating saved history", async () => {
    const flow = { ...questionFlow(), historyMode: "temporary" as const };
    const result = await submitEndoBotQuestion(flow);
    expect(flow.authenticated).toBe(true);
    expect(flow.ensureConversation).not.toHaveBeenCalled();
    expect(flow.persistQuestion).not.toHaveBeenCalled();
    expect(flow.requestAnswer).toHaveBeenCalledWith(null);
    expect(result).toEqual({ kind: "assistant", conversationId: null, result: { answer: "Anote suas dúvidas." } });
  });

  it("still saves authenticated questions when saved mode is explicitly selected", async () => {
    const flow = { ...questionFlow(), historyMode: "saved" as const };
    await submitEndoBotQuestion(flow);
    expect(flow.ensureConversation).toHaveBeenCalledWith(flow.question);
    expect(flow.persistQuestion).toHaveBeenCalledWith("conversation-1");
    expect(flow.requestAnswer).toHaveBeenCalledWith("conversation-1");
  });

  it("persists a question for the human team without invoking AI when paused", async () => {
    const flow = { ...questionFlow(), humanTakeoverPaused: true };
    await expect(submitEndoBotQuestion(flow)).resolves.toEqual({ kind: "human", conversationId: "conversation-1" });
    expect(flow.persistQuestion).toHaveBeenCalledWith("conversation-1");
    expect(flow.requestAnswer).not.toHaveBeenCalled();
  });

  it("never invokes AI for a paused conversation even if temporary mode is supplied", async () => {
    const flow = { ...questionFlow(), historyMode: "temporary" as const, humanTakeoverPaused: true };
    await expect(submitEndoBotQuestion(flow)).resolves.toEqual({ kind: "human", conversationId: null });
    expect(flow.ensureConversation).not.toHaveBeenCalled();
    expect(flow.persistQuestion).not.toHaveBeenCalled();
    expect(flow.requestAnswer).not.toHaveBeenCalled();
  });

  it("does not bypass a history failure", async () => {
    const flow = questionFlow();
    flow.persistQuestion.mockRejectedValue(new Error("history unavailable"));
    await expect(submitEndoBotQuestion(flow)).rejects.toThrow("history unavailable");
    expect(flow.requestAnswer).not.toHaveBeenCalled();
  });

  it("does not fall back to temporary mode when saved conversation creation fails", async () => {
    const flow = { ...questionFlow(), historyMode: "saved" as const };
    flow.ensureConversation.mockRejectedValue(new Error("history unavailable"));
    await expect(submitEndoBotQuestion(flow)).rejects.toThrow("history unavailable");
    expect(flow.persistQuestion).not.toHaveBeenCalled();
    expect(flow.requestAnswer).not.toHaveBeenCalled();
  });

  it("does not save or submit a cancelled question after conversation creation resolves", async () => {
    const controller = new AbortController();
    let finishCreation!: (conversationId: string) => void;
    const flow = {
      ...questionFlow(), signal: controller.signal,
      ensureConversation: vi.fn(() => new Promise<string>((resolve) => { finishCreation = resolve; })),
    };
    const assertion = expect(submitEndoBotQuestion(flow)).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    finishCreation("old-conversation");
    await assertion;
    expect(flow.persistQuestion).not.toHaveBeenCalled();
    expect(flow.requestAnswer).not.toHaveBeenCalled();
  });

  it("discards a late answer after the user cancels or changes conversation", async () => {
    const controller = new AbortController();
    let finishAnswer!: (answer: { answer: string }) => void;
    const flow = {
      ...questionFlow(), authenticated: false, signal: controller.signal,
      requestAnswer: vi.fn(() => new Promise<{ answer: string }>((resolve) => { finishAnswer = resolve; })),
    };
    const assertion = expect(submitEndoBotQuestion(flow)).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    finishAnswer({ answer: "Resposta antiga." });
    await assertion;
  });

  it("does not proceed when cancellation happens after transcription", async () => {
    const controller = new AbortController();
    controller.abort();
    const flow = { ...questionFlow(), signal: controller.signal };
    await expect(submitEndoBotQuestion(flow)).rejects.toMatchObject({ name: "AbortError" });
    expect(flow.ensureConversation).not.toHaveBeenCalled();
    expect(flow.persistQuestion).not.toHaveBeenCalled();
    expect(flow.requestAnswer).not.toHaveBeenCalled();
  });

  it("does not request chat or play audio after cancellation during persistence", async () => {
    const controller = new AbortController();
    let finishPersistence!: () => void;
    const playAudio = vi.fn();
    const flow = {
      ...questionFlow(), signal: controller.signal,
      persistQuestion: vi.fn(() => new Promise<void>((resolve) => { finishPersistence = resolve; })),
    };
    const result = submitEndoBotQuestion(flow).then((reply) => { if (reply.kind === "assistant") playAudio(reply.result); });
    const assertion = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    expect(flow.persistQuestion).toHaveBeenCalledWith("conversation-1");
    controller.abort();
    finishPersistence();
    await assertion;
    expect(flow.requestAnswer).not.toHaveBeenCalled();
    expect(playAudio).not.toHaveBeenCalled();
  });
});

describe("EndoBot authentication headers", () => {
  const sessionExpiredMessage = "Sua sessão expirou. Entre novamente na sua conta.";

  it("preserves the bearer token for authenticated temporary or saved conversations", () => {
    expect(createEndoBotRequestHeaders({ authenticated: true, accessToken: "user-token", sessionError: null, sessionExpiredMessage })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer user-token",
    });
  });

  it("rejects a failed session lookup instead of dropping to guest access", () => {
    expect(() => createEndoBotRequestHeaders({ authenticated: true, accessToken: "user-token", sessionError: new Error("Session unavailable"), sessionExpiredMessage })).toThrowError(expect.objectContaining({
      name: "EndoBotApiError", message: sessionExpiredMessage, status: 401, code: "session_expired", retryable: false,
    }));
  });

  it.each([undefined, null, "", "   "])("rejects authenticated requests with missing token %s", (accessToken) => {
    expect(() => createEndoBotRequestHeaders({ authenticated: true, accessToken, sessionExpiredMessage })).toThrowError(expect.objectContaining({
      message: sessionExpiredMessage, status: 401, code: "session_expired",
    }));
  });

  it("allows a guest request without a session", () => {
    expect(createEndoBotRequestHeaders({ authenticated: false, accessToken: null, sessionError: null, sessionExpiredMessage })).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("keeps a returned token even before authenticated UI state has updated", () => {
    expect(createEndoBotRequestHeaders({ authenticated: false, accessToken: "user-token", sessionExpiredMessage }).Authorization).toBe("Bearer user-token");
  });
});

describe("EndoBot initial history preference", () => {
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3000/",
    "http://[::1]:3000",
    "https://localhost/api",
    "http://LOCALHOST:3000",
  ])("starts a new local session as temporary for %s", (apiBase) => {
    expect(getInitialEndoBotHistoryMode(apiBase)).toBe("temporary");
  });

  it.each([
    "https://backendendoacolhe.vercel.app",
    "http://localhost.example.com:3000",
    "http://localhost-endo.example.com",
    "http://127.0.0.1.example.com",
    "http://127.0.0.2:3000",
    "http://[::2]:3000",
    "http://example.com/localhost",
    "http://localhost:3000@example.com",
    "http://127.1:3000",
    "http://2130706433:3000",
    "http://localhost.:3000",
    "file://localhost/api",
    "ftp://127.0.0.1/api",
    "localhost:3000",
    "/api",
    "",
  ])("keeps saved history as the default for a remote, ambiguous, or invalid base %s", (apiBase) => {
    expect(getInitialEndoBotHistoryMode(apiBase)).toBe("saved");
  });
});
