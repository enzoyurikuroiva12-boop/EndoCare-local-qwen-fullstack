import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { useSiteLanguage, type SiteLanguage } from "@/contexts/SiteLanguageContext";
import "./BotanicalViewer.css";

export type PlantKey = "ginger" | "chamomile" | "turmeric";
export const plantAssets: Record<PlantKey, { modelUrl: string; modelName: string; creator: string; sourceUrl: string; photoUrl: string; photoAlt: Record<SiteLanguage, string>; photoCredit: string }> = {
  ginger: {
    modelUrl: "https://sketchfab.com/models/206c458052cc40a29c169733ce887d62/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0&ui_help=0&ui_annotations=0",
    modelName: "Ginger Root — Zingiber officinale",
    creator: "The Whz",
    sourceUrl: "https://sketchfab.com/3d-models/ginger-root-zingiber-officinale-206c458052cc40a29c169733ce887d62",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Ginger_Plant_vs.jpg",
    photoAlt: { pt: "Fotografia botânica de gengibre com folhas e rizomas", en: "Botanical photograph of ginger with leaves and rhizomes", es: "Fotografía botánica de jengibre con hojas y rizomas" },
    photoCredit: "imagem botânica de referência",
  },
  chamomile: {
    modelUrl: "https://sketchfab.com/models/31df46bbac484e3aa549032d8f321b6d/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0&ui_help=0&ui_annotations=0",
    modelName: "Chamomile",
    creator: "Cosmic_dust",
    sourceUrl: "https://sketchfab.com/3d-models/chamomile-31df46bbac484e3aa549032d8f321b6d",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Chamomile%40original_size.jpg",
    photoAlt: { pt: "Fotografia botânica de flores de camomila", en: "Botanical photograph of chamomile flowers", es: "Fotografía botánica de flores de manzanilla" },
    photoCredit: "imagem botânica de referência",
  },
  turmeric: {
    modelUrl: "https://sketchfab.com/models/f6e3a8a56a3a47a78712a48ad25d1c95/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_controls=0&ui_watermark=0&ui_help=0&ui_annotations=0",
    modelName: "Curcuma longa",
    creator: "panithi",
    sourceUrl: "https://sketchfab.com/3d-models/curcuma-longa-f6e3a8a56a3a47a78712a48ad25d1c95",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Curcuma_longa_%28Haldi%29_W_IMG_2440.jpg",
    photoAlt: { pt: "Fotografia de cúrcuma com raízes e pó amarelo", en: "Photograph of turmeric with roots and yellow powder", es: "Fotografía de cúrcuma con raíces y polvo amarillo" },
    photoCredit: "imagem botânica de referência",
  },
};

export function BotanicalViewer({ plant }: { plant: PlantKey }) {
  const asset = plantAssets[plant];
  const [interactive, setInteractive] = useState(false);
  const { language } = useSiteLanguage();
  const copy = language === "en" ? { open: "Explore interactive model", credit: "Model credit", photoCredit: "Botanical photo", interactive: "Interactive botanical model" } : language === "es" ? { open: "Explorar modelo interactivo", credit: "Crédito del modelo", photoCredit: "Foto botánica", interactive: "Modelo botánico interactivo" } : { open: "Explorar modelo interativo", credit: "Créditos do modelo", photoCredit: "Foto botânica", interactive: "Modelo botânico interativo" };
  useEffect(() => { setInteractive(false); }, [plant]);
  return (
    <div className="botanical-viewer">
      <figure className="botanical-photo-frame"><img src={asset.photoUrl} alt={asset.photoAlt[language]} /><figcaption>{copy.photoCredit}: {asset.photoCredit}</figcaption></figure>
      <div className="botanical-model-column">
      <div className="model-frame">
        {interactive ? <iframe key={asset.modelUrl} title={`${copy.interactive}: ${asset.modelName}`} src={asset.modelUrl} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> : <button className="model-poster" type="button" onClick={() => setInteractive(true)} aria-label={`${copy.open}: ${asset.modelName}`}><img src={asset.photoUrl} alt="" aria-hidden="true" /><span className="model-poster__veil" /><span className="model-poster__button"><Play size={16} fill="currentColor" />{copy.open}</span></button>}
      </div>
        <a className="model-credit" href={asset.sourceUrl} target="_blank" rel="noreferrer">{copy.credit}: {asset.modelName} · {asset.creator} <ExternalLink size={11} /></a>
      </div>
    </div>
  );
}
