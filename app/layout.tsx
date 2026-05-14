import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "もぐクマDiet | AIダイエットコーチ",
  description: "かわいいAIコーチ『もぐクマ』と続けるスマホファーストなダイエットMVP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFF8EC",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
