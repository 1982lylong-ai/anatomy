import type { Metadata, Viewport } from "next";
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

const OG_IMAGE = {
  url: "/og.jpg",
  width: 1200,
  height: 675,
  alt: "An anatomical heart specimen floating above a plinth, beside the Anatomy Atelier wordmark",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://anatomy-atelier.openai.site"),
  title: "Anatomy Atelier — Learn anatomy like an artist",
  description:
    "Explore medically detailed 3D organs — heart, brain, lungs, liver, kidneys, eye, intestine, pancreas, and skin — through an elegant, interactive anatomy atelier.",
  applicationName: "Anatomy Atelier",
  keywords: ["anatomy", "3D anatomy", "human body", "medical education", "interactive learning", "organs"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    siteName: "Anatomy Atelier",
    title: "Anatomy Atelier — Learn anatomy like an artist",
    description: "Learn anatomy like an artist through immersive, medically detailed 3D specimens.",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anatomy Atelier — Learn anatomy like an artist",
    description: "Learn anatomy like an artist through immersive, medically detailed 3D specimens.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f0e7",
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
