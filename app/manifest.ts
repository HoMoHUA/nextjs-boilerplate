import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Arklyn Office", short_name: "Arklyn", description: "Your team’s interactive office and conversations",
    start_url: "/", scope: "/", display: "standalone", background_color: "#11161b", theme_color: "#11161b",
    lang: "en", dir: "ltr", categories: ["productivity"],
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
