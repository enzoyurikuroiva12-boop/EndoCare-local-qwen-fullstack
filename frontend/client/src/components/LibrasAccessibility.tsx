import { useCallback, useEffect, useState } from "react";
import "./LibrasAccessibility.css";

declare module "react" {
  interface HTMLAttributes<T> {
    vw?: string;
    "vw-access-button"?: string;
    "vw-plugin-wrapper"?: string;
  }
}

declare global {
  interface Window {
    VLibras?: { Widget: new (baseUrl: string) => unknown };
  }
}

export const VLibrasBaseUrl = "https://vlibras.gov.br/app";
export const VLibrasScriptUrl = `${VLibrasBaseUrl}/vlibras-plugin.js`;

let scriptLoadPromise: Promise<void> | null = null;
let widgetInitializationPromise: Promise<void> | null = null;
let widgetInitialized = false;

export function shouldOfferVLibrasRetry(status: "loading" | "ready" | "failed") {
  return status === "failed";
}

function loadOfficialVLibrasScript() {
  if (window.VLibras?.Widget) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${VLibrasScriptUrl}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => window.VLibras?.Widget ? resolve() : reject(new Error("VLibras unavailable")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("VLibras script failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = VLibrasScriptUrl;
    script.async = true;
    script.dataset.endoacolheVlibras = "true";
    script.onload = () => window.VLibras?.Widget ? resolve() : reject(new Error("VLibras unavailable"));
    script.onerror = () => {
      script.remove();
      reject(new Error("VLibras script failed"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    scriptLoadPromise = null;
    throw error;
  });

  return scriptLoadPromise;
}

function initializeOfficialVLibras() {
  if (widgetInitialized) return Promise.resolve();
  if (widgetInitializationPromise) return widgetInitializationPromise;

  widgetInitializationPromise = loadOfficialVLibrasScript().then(() => {
    if (!window.VLibras?.Widget) throw new Error("VLibras widget unavailable");
    new window.VLibras.Widget(VLibrasBaseUrl);
    widgetInitialized = true;
  }).finally(() => { widgetInitializationPromise = null; });

  return widgetInitializationPromise;
}

/**
 * Mantém a marcação oficial do VLibras no DOM desde o primeiro render.
 * O script é inicializado depois que a árvore oficial existe, sem simular
 * eventos de carregamento nem substituir o painel por uma superfície própria.
 */
export function LibrasAccessibility() {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  const initialize = useCallback(() => {
    setStatus("loading");
    void initializeOfficialVLibras().then(() => setStatus("ready")).catch(() => setStatus("failed"));
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <div className="libras-accessibility" data-accessibility-widget="libras">
    <div vw="true" className="enabled" data-endoacolhe-vlibras-root="true">
      <div vw-access-button="true" className="active" />
      <div vw-plugin-wrapper="true"><div className="vw-plugin-top-wrapper" /></div>
    </div>
    {shouldOfferVLibrasRetry(status) ? <aside className="libras-accessibility__notice" role="status"><span>O painel de Libras não carregou agora.</span><button type="button" onClick={initialize}>Tentar novamente</button></aside> : null}
  </div>;
}
