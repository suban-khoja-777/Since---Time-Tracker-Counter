import type { Metadata, Viewport } from "next";
import "./globals.css";
import {PwaRuntime} from "./pwa-controls";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export const metadata: Metadata = {
  title: "Since — timers & counters",
  description: "Your moments, organized. Track time and count events across workspaces, folders and labels.",
  manifest: "/manifest.webmanifest",
  other: {"since-app-shell":"1"},
  appleWebApp: { capable: true, title: "Since", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon.svg?v=2", type: "image/svg+xml" }, { url: "/favicon.png?v=2", sizes: "32x32", type: "image/png" }],
    shortcut: "/favicon.png?v=2",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}<PwaRuntime/></body>
    </html>
  );
}
