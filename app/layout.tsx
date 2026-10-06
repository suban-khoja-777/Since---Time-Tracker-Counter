import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#294e40" };

export const metadata: Metadata = {
  title: "Since — timers & counters",
  description: "Your moments, organized. Track time and count events across workspaces, folders and labels.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Since", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
