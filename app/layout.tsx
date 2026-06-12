import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Harness Remix Studio",
  description:
    "Sponsor-powered remix production line: source trend to prompt, image, video, analytics, and publish handoff.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
