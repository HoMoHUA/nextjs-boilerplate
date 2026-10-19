import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arklyn Office",
  description: "A 3D virtual office for your hermes-agent team",
  applicationName: "Arklyn Office",
  appleWebApp: { capable: true, title: "Arklyn Office", statusBarStyle: "black-translucent" },
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#11161b" };
// Static bootstrap; user data is read locally, never interpolated into executable HTML.
const themeBootstrap = `(function(){try{var s=JSON.parse(localStorage.getItem('arklyn-office-v3')||'{}');var m=s.colorMode;document.documentElement.dataset.colorMode=m==='dark'||m==='light'?m:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.colorMode=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
