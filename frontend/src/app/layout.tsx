import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from "next/font/google";

import { AppProviders } from "@/app/providers";

import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  applicationName: "Lattes CNPq",
  title: {
    template: "%s | Lattes CNPq",
    default: "Lattes CNPq — Extrator de Currículos",
  },
  description:
    "Busca e extração automática de currículos Lattes do CNPq, com geração opcional de resumos via IA.",
  keywords: [
    "Lattes",
    "CNPq",
    "currículo lattes",
    "pesquisador",
    "resumo acadêmico",
    "FAI",
    "UFSCar",
    "IA",
  ],
  authors: [{ name: "FAI UFSCar" }],
  creator: "FAI UFSCar",
  publisher: "FAI UFSCar",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "Lattes CNPq — Extrator de Currículos",
    description:
      "Busca e extração automática de currículos Lattes do CNPq, com geração opcional de resumos via IA.",
    siteName: "Lattes CNPq",
  },
  twitter: {
    card: "summary",
    title: "Lattes CNPq — Extrator de Currículos",
    description:
      "Busca e extração automática de currículos Lattes do CNPq, com geração opcional de resumos via IA.",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${bodyFont.variable} ${headingFont.variable} ${monoFont.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)]`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
