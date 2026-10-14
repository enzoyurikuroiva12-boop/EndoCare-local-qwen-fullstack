import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn(), channel: vi.fn() } }));

import Admin, { adminSectionOrder, deletableContentKinds, postWriteOperation, shouldRedirectFromAdmin } from "./Admin";

describe("admin workspace navigation", () => {
  it("keeps every protected work area discoverable in the operational navigation", () => {
    expect(adminSectionOrder).toEqual(["admin-monitoring", "admin-questionnaire", "admin-users", "admin-punishments", "admin-endobot-supervision", "admin-endobot-security", "admin-chat", "admin-support", "admin-stories", "admin-posts"]);
  });

  it("exposes only the two administratively deletable content kinds", () => {
    expect(deletableContentKinds).toEqual(["story", "post"]);
  });

  it("keeps the administrative workspace as a page component", () => {
    expect(typeof Admin).toBe("function");
  });

  it("uses an update operation only when an existing article is being edited", () => {
    expect(postWriteOperation(null)).toBe("insert");
    expect(postWriteOperation("article-1")).toBe("update");
  });

  it("redirects only after auth and authorization checks finish", () => {
    expect(shouldRedirectFromAdmin(true, false, false, false)).toBe(false);
    expect(shouldRedirectFromAdmin(false, true, false, false)).toBe(false);
    expect(shouldRedirectFromAdmin(false, false, false, false)).toBe(true);
    expect(shouldRedirectFromAdmin(false, false, true, false)).toBe(true);
    expect(shouldRedirectFromAdmin(false, false, true, true)).toBe(false);
    expect(shouldRedirectFromAdmin(false, false, true, false, true)).toBe(false);
  });

  it("não transforma erro temporário da consulta de cargo em redirecionamento", () => {
    expect(shouldRedirectFromAdmin(false, false, true, false, true)).toBe(false);
  });

  it("aguarda a restauração da sessão antes de iniciar a autorização do Admin", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    expect(source).toContain("if (authLoading) return;");
    expect(source).toContain("[authLoading, user?.id]");
  });

  it("mantém o reset semanal protegido no fluxo administrativo", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    expect(source).toContain("reset_endoacolhe_questionnaire_limit");
    expect(source).toContain("canManageQuestionnaire ? <button className=\"admin-questionnaire-reset\"");
    expect(source).toContain("questionnaireResetDescription");
  });

  it("keeps the mobile navigation contained instead of relying on horizontal overflow", () => {
    expect(readFileSync(resolve(process.cwd(), "client/src/pages/Admin.css"), "utf8")).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(readFileSync(resolve(process.cwd(), "client/src/pages/Admin.css"), "utf8")).toContain("overflow-x: clip;");
    expect(readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8")).toContain("normalizeAdministrativeRole(roleData)");
    expect(readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8")).toContain("accessErrorCopy.retry");
  });

  it("renders human EndoBot supervision only inside the Owner's unlocked workspace", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    expect(source).toContain("isOwner && adminGateUnlocked ? <EndoBotOwnerSupervision");
    expect(source).toContain('href="#admin-endobot-supervision"');
  });
});
