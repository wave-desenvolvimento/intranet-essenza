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
