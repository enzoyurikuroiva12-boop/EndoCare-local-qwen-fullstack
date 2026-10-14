import { describe, expect, it } from "vitest";
import { loginButtonCopy } from "./loginButtonCopy";

describe("loginButtonCopy", () => {
  it("mantém um rótulo curto e localizado para o botão de acesso", () => {
    expect(loginButtonCopy).toEqual({ pt: "Logar", en: "Log in", es: "Iniciar sesión" });
  });
});
