import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Due Process — Your tasks have retained counsel",
  description:
    "The Court of Extremely Small Claims. Put your neglected tasks on trial, hear a pigeon’s verdict, and make one tiny start.",
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
