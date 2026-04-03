import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Truly — Your platform, truly yours",
  description:
    "Truly is the platform that puts you first. Sign up today and experience a better way.",
  openGraph: {
    title: "Truly — Your platform, truly yours",
    description:
      "Truly is the platform that puts you first. Sign up today and experience a better way.",
    type: "website",
    url: "https://mytruly.app",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
