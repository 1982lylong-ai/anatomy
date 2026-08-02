import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://anatomy-atelier.openai.site"),
  title: "Anatomy Atelier — Learn anatomy like an artist",
  description: "Explore medically detailed 3D organs through an elegant, interactive anatomy atelier.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Anatomy Atelier",
    description: "Learn anatomy like an artist through immersive 3D specimens.",
    images: [{ url: "/og.png", width: 1680, height: 945, alt: "Anatomy Atelier heart specimen" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${serif.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
