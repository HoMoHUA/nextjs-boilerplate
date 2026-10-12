import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arklyn Office",
  description: "A 3D virtual office for your hermes-agent team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
