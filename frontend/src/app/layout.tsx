import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpotMe | Find Yourself in Their VODs",
  description:
    "Search any streamer's VOD library and find the exact clip and timestamp of when you played against them.",
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
