import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0B0D10",
};

export const metadata: Metadata = {
  title: "Oportunidad de Negocio Global — Sistema Comprobado",
  description:
    "Descubre cómo personas sin experiencia están generando ingresos en dólares con un sistema comprobado que los guía paso a paso.",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable} ${inter.variable} ${instrumentSerif.variable} antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        {/* Satoshi vía Fontshare (pesos 400, 500, 700, 900 + itálicas) */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900,1,2&display=swap"
        />
      </head>
      <body className="bg-nexfy-bg text-nexfy-text" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
