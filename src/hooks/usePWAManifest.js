import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

let blobUrl = null;

export function usePWAManifest(uid) {
  useEffect(() => {
    if (!uid) return;

    async function aplicarManifest() {
      try {
        const snap = await getDoc(doc(db, "users", uid, "config", "geral"));
        if (!snap.exists()) return;

        const data    = snap.data() || {};
        // Suporta formato novo (data.empresa) e legado (data.nomeEmpresa / data.logo)
        const empresa = data.empresa ?? data;
        const nome    = empresa.nomeEmpresa || data.nomeEmpresa || "Assent Gestão";
        const logo    = empresa.logo        || data.logo        || null;

        const icons = logo
          ? [
              { src: logo, sizes: "192x192", type: "image/png", purpose: "any" },
              { src: logo, sizes: "512x512", type: "image/png", purpose: "any" },
            ]
          : [
              { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
              { src: "/icons/icon-512x512.png",  sizes: "512x512",  type: "image/png", purpose: "any" },
            ];

        const manifest = {
          name:             nome,
          short_name:       nome.split(" ")[0],
          description:      `Sistema de gestão — ${nome}`,
          start_url:        "/",
          display:          "standalone",
          background_color: "#000000",
          theme_color:      "#000000",
          orientation:      "portrait-primary",
          icons,
        };

        // Substitui o <link rel="manifest"> por uma URL de blob dinâmica
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(
          new Blob([JSON.stringify(manifest)], { type: "application/json" })
        );

        let link = document.querySelector("link[rel='manifest']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "manifest";
          document.head.appendChild(link);
        }
        link.href = blobUrl;

        // Atualiza <title> e meta theme-color
        document.title = nome;

        let metaTheme = document.querySelector("meta[name='theme-color']");
        if (!metaTheme) {
          metaTheme = document.createElement("meta");
          metaTheme.name = "theme-color";
          document.head.appendChild(metaTheme);
        }
        metaTheme.content = "#000000";

        // Apple PWA tags
        let appleTitle = document.querySelector("meta[name='apple-mobile-web-app-title']");
        if (!appleTitle) {
          appleTitle = document.createElement("meta");
          appleTitle.name = "apple-mobile-web-app-title";
          document.head.appendChild(appleTitle);
        }
        appleTitle.content = nome;

        if (logo) {
          let appleIcon = document.querySelector("link[rel='apple-touch-icon']");
          if (!appleIcon) {
            appleIcon = document.createElement("link");
            appleIcon.rel = "apple-touch-icon";
            document.head.appendChild(appleIcon);
          }
          appleIcon.href = logo;
        }
      } catch {
        // falha silenciosa — manifest padrão continua ativo
      }
    }

    aplicarManifest();
  }, [uid]);
}
