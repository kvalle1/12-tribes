import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, Cinzel, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/session-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  weight: ["600", "700"],
  subsets: ["latin"],
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-frank",
  weight: ["300", "400", "500", "700"],
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: "Tribe Index",
  description:
    "An identity you did not choose and cannot earn — only step into. Twelve ancient archetypes mapping your strengths, your shadow, and the calling written into your name.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${cinzel.variable} ${frankRuhl.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
