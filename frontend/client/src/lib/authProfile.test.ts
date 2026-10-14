import { describe, expect, it } from "vitest";
import { getProfileName } from "./authProfile";

describe("nome de perfil", () => {
  it("prioriza o nome escolhido no cadastro", () => {
    expect(getProfileName({ email: "ana@exemplo.com", user_metadata: { name: "Ana" } })).toBe("Ana");
  });

  it("usa o nome retornado pelo Google antes do endereço de e-mail", () => {
    expect(getProfileName({ email: "ana.silva@gmail.com", user_metadata: { full_name: "Ana Silva" } })).toBe("Ana Silva");
  });

  it("usa fallback seguro quando o provedor não informa um nome", () => {
    expect(getProfileName({ email: "ana.silva@gmail.com" })).toBe("ana.silva");
  });
});
