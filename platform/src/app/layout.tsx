import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter-tight",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "Celsius · Plataforma",
  description:
    "Plataforma de cotización y gestión inmobiliaria de Celsius. Brokers, clientes y administración sobre el mismo inventario.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${interTight.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
