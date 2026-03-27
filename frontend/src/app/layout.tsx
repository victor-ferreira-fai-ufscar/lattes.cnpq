import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lattes CNPq",
  description: "Interface simples para acionar o backend de scraping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
