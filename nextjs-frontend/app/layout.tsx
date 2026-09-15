import type { Metadata } from "next";
import { Roboto, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-roboto",
});

const outfit = Outfit({
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Hypersphere Control Plane · Amrita Vishwa Vidyapeetham",
  description: "Biometric AI System Dashboard & Spatial Geofence Verification",
  icons: {
    icon: [
      { url: "/amrita-favicon.png", type: "image/png" },
      { url: "/favicon.ico" }
    ],
    apple: "/amrita-favicon.png",
    shortcut: "/amrita-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${roboto.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
