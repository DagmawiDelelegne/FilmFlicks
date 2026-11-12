import type { Metadata } from "next";
import { GeistSans as geistSans } from "geist/font/sans";
import { GeistMono as geistMono } from "geist/font/mono";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "FilmFlicks",
  description: "Discover movies, shows, and anime.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "FilmFlicks",
    description: "Discover movies, TV Shows and anime through personalized recommendations.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProviderWrapper>
          {children}
        </SessionProviderWrapper>
        
      </body>
    </html>
  );
}
