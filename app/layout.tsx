import type { Metadata } from "next";
import { Cinzel, Crimson_Text } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const crimson = Crimson_Text({
  variable: "--font-crimson",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "AllCodex — Lore Chronicle",
  description: "The worldbuilding grimoire for All Reach",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${cinzel.variable} ${crimson.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
