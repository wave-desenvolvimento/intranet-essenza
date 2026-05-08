import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import "./globals.css";

const comfortaa = Comfortaa({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-comfortaa",
  display: "swap",
});

import type { Viewport } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Essenza Hub — Gestão de Marca para Franqueados",
  description:
    "Plataforma centralizada da rede Empório Essenza Serra Gaúcha. Campanhas, materiais, treinamentos e assets organizados para fortalecer a marca em cada franquia.",
  icons: {
    icon: "/assets/favicon.png",
    apple: "/assets/icon-192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Essenza Hub",
  },
  openGraph: {
    title: "Essenza Hub — Gestão de Marca para Franqueados",
    description:
      "Plataforma centralizada da rede Empório Essenza Serra Gaúcha. Campanhas, materiais, treinamentos e assets organizados para fortalecer a marca em cada franquia.",
    url: "https://intranet-essenza.vercel.app",
    siteName: "Essenza Hub",
    images: [{ url: "/assets/og-image.png", width: 1200, height: 630 }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Essenza Hub — Gestão de Marca para Franqueados",
    description:
      "Plataforma centralizada da rede Empório Essenza Serra Gaúcha. Campanhas, materiais, treinamentos e assets organizados para fortalecer a marca em cada franquia.",
    images: ["/assets/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#878a62",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${comfortaa.variable} h-full`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;600;700&family=Roboto:wght@400;700&family=Lato:wght@400;700&family=Oswald:wght@400;600;700&family=Bebas+Neue&family=Dancing+Script:wght@400;700&family=Pacifico&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
