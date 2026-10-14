import { describe, expect, it } from "vitest";
import { hasAdministrativeRole, moderationLabel, moderationStatus } from "./adminAccess";

describe("controles de moderação", () => {
  it("mapeia ações administrativas para estados permitidos", () => {
    expect(moderationStatus("approve")).toBe("approved");
    expect(moderationStatus("reject")).toBe("rejected");
  });

  it("mantém os rótulos de moderação no idioma escolhido", () => {
    expect(moderationLabel("approve", "en")).toBe("Approve");
    expect(moderationLabel("reject", "es")).toBe("Rechazar");
  });

  it("reconhece todos os cargos administrativos sem liberar contas comuns", () => {
    expect(hasAdministrativeRole("owner")).toBe(true);
    expect(hasAdministrativeRole("admin")).toBe(true);
    expect(hasAdministrativeRole("moderator")).toBe(true);
    expect(hasAdministrativeRole("support")).toBe(true);
    expect(hasAdministrativeRole(" ADMIN ")).toBe(true);
    expect(hasAdministrativeRole("user")).toBe(false);
    expect(hasAdministrativeRole(null)).toBe(false);
  });
});
