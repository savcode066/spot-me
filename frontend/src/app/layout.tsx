import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpotMe | Tactical Recognition",
  description:
    "Find yourself in TenZ's videos. Our tactical engine cross-references match history and kill-feeds across 4,000+ hours of footage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body text-on-background bg-background overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
