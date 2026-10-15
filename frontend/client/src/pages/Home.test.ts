import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: {} } }));

import { homePresentationVideoUrl, plantCatalog, searchGuideCopy, videoGuideCopy } from "./Home";

const acolhedoraTheme = readFileSync(resolve(process.cwd(), "client/src/styles/AcolhedoraTheme.css"), "utf8");
const indexCss = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const adminShortcutSource = readFileSync(resolve(process.cwd(), "client/src/components/AdminShortcut.tsx"), "utf8");

describe("plantCatalog", () => {
  it("mantém os detalhes botânicos localizados nos três idiomas globais", () => {
    expect(Object.keys(plantCatalog).sort()).toEqual(["en", "es", "pt"]);

    for (const catalog of Object.values(plantCatalog)) {
      expect(catalog).toHaveLength(3);
      expect(catalog.find((plant) => plant.key === "turmeric")?.focus).toBeTruthy();
      expect(catalog.find((plant) => plant.key === "turmeric")?.evidence).toBeTruthy();
      expect(catalog.find((plant) => plant.key === "turmeric")?.caution).toBeTruthy();
    }

    expect(plantCatalog.en[2].focus).toContain("rhizome");
    expect(plantCatalog.es[2].focus).toContain("Rizoma");
  });
});

describe("videoGuideCopy", () => {
  it("mantém o contexto e os avisos do vídeo localizados nos três idiomas", () => {
    expect(Object.keys(videoGuideCopy).sort()).toEqual(["en", "es", "pt"]);

    for (const copy of Object.values(videoGuideCopy)) {
      expect(copy.metadata).toContain("10 s");
      expect(copy.points).toHaveLength(3);
      expect(copy.notice).toBeTruthy();
      expect(copy.sourceItems).toHaveLength(4);
      expect(copy.fallback).toBeTruthy();
    }

    expect(videoGuideCopy.pt.audioNote).toContain("silenciar");
    expect(videoGuideCopy.en.audioNote).toContain("turn the audio on or off");
    expect(videoGuideCopy.es.audioNote).toContain("silenciar el audio");
    expect(videoGuideCopy.pt.points[0]).toContain("conteúdos informativos");
    expect(videoGuideCopy.en.points[0]).toContain("informational content");
    expect(videoGuideCopy.es.points[0]).toContain("contenido informativo");
    expect(homePresentationVideoUrl).toBe("/videos/endocare-apresentacao.mp4");
    expect(existsSync(resolve(process.cwd(), "client/public/videos/endocare-apresentacao.mp4"))).toBe(true);
  });
});

describe("ações da conta no mobile", () => {
  it("coloca Conta/Administração dentro do menu e preserva as ações desktop", () => {
    expect(homeSource).toContain("<MobileMenuActions");
    expect(homeSource).toContain("<DesktopMenuActions");
    expect(indexCss).toContain(".topnav .mobile-menu-actions");
    expect(indexCss).toContain(".topnav .mobile-menu-actions .mobile-account-cta");
    expect(acolhedoraTheme).toContain(".topbar-utility-controls .account-cta {");
    expect(acolhedoraTheme).toContain(".topnav .mobile-menu-actions .mobile-account-cta");
  });
});

describe("orientação educativa para buscas", () => {
  it("mantém termos de alta intenção nos três idiomas sem remover os limites de saúde", () => {
    expect(Object.keys(searchGuideCopy).sort()).toEqual(["en", "es", "pt"]);
    for (const copy of Object.values(searchGuideCopy)) {
      expect(copy.cards).toHaveLength(4);
      expect(copy.note).toMatch(/diagnos|diagnóst|diagnosi/i);
      expect(copy.faq).toBeTruthy();
      expect(copy.blog).toBeTruthy();
    }
    expect(homeSource).toContain('id="guia-endometriose"');
    expect(homeSource).toContain('navigateWithTransition("/faq")');
    expect(homeSource).toContain('navigateWithTransition("/blog")');
    expect(acolhedoraTheme).toContain(".search-guide-section");
  });
});

describe("atalho de Administração no mobile", () => {
  it("mantém a validação do cargo e a renderização dentro do menu", () => {
    expect(adminShortcutSource).toContain('className="nav-cta admin-shortcut"');
    expect(adminShortcutSource).toContain("if (!isAdministrator) return null;");
    expect(adminShortcutSource).toContain("admin-shortcut__label");
    expect(indexCss).toContain(".topnav .mobile-menu-actions .admin-shortcut");
    expect(acolhedoraTheme).toContain(".admin-shortcut__label {");
  });
});

describe("contenção do cabeçalho desktop", () => {
  it("compacta ações em larguras intermediárias sem perder seus rótulos acessíveis", () => {
    expect(acolhedoraTheme).toContain("@media (min-width: 901px) and (max-width: 1280px)");
    expect(acolhedoraTheme).toContain(".topbar .admin-shortcut__label");
    expect(acolhedoraTheme).toContain(".topbar .desktop-account-cta > span:not(.profile-avatar)");
    expect(acolhedoraTheme).toContain(".topnav .mobile-menu-actions .admin-shortcut__label");
    expect(acolhedoraTheme).toContain("max-width: 42px !important");
    expect(acolhedoraTheme).toContain("display: none !important");
    expect(adminShortcutSource).toContain("aria-label={labels[language]}");
    expect(adminShortcutSource).toContain("title={labels[language]}");
    expect(homeSource).toContain("accountLabel={t.account}");
  });
});

describe("adaptação da hero", () => {
  it("mantém o conteúdo centralizado sem limitar o fundo em desktops largos", () => {
    expect(acolhedoraTheme).toContain("padding-inline: max(56px, calc((100vw - 1120px) / 2)) !important");
    expect(acolhedoraTheme).toContain("max-width: none !important");
    expect(acolhedoraTheme).toContain("grid-template-columns: minmax(0, 1.08fr) minmax(390px, .92fr)");
  });
});
