import { describe, expect, it } from "vitest";
import { canOpenPunishmentLog } from "./AdminPunishmentLog";

describe("acesso ao Log de punições separado", () => {
  it("mantém o registro acessível apenas a cargos autorizados após a senha adicional", () => {
    expect(canOpenPunishmentLog("owner", true)).toBe(true);
    expect(canOpenPunishmentLog("support", true)).toBe(true);
    expect(canOpenPunishmentLog("moderator", true)).toBe(true);
    expect(canOpenPunishmentLog("admin", true)).toBe(true);
    expect(canOpenPunishmentLog(null, true)).toBe(false);
    expect(canOpenPunishmentLog("support", false)).toBe(false);
  });
});
