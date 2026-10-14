import { describe, expect, it } from "vitest";
import { plantAssets } from "./BotanicalViewer";
import { plantCatalog } from "@/pages/Home";

describe("detalhes botânicos localizados", () => {
  it("mantém nomes comuns e descrições de plantas em todos os idiomas do site", () => {
    expect(plantCatalog.pt[0].common).toBe("Gengibre");
    expect(plantCatalog.en[0].common).toBe("Ginger");
    expect(plantCatalog.es[0].common).toBe("Jengibre");
    expect(plantCatalog.en[2].caution).not.toContain("Pode");
    expect(plantCatalog.es[2].evidence).not.toContain("Converse");
  });

  it("usa fotografias externas estáveis e incorporados sem controles visuais", () => {
    for (const asset of Object.values(plantAssets)) {
      expect(asset.photoUrl).toContain("upload.wikimedia.org");
      expect(asset.modelUrl).toContain("ui_controls=0");
      expect(asset.modelUrl).toContain("ui_infos=0");
    }
  });
});
