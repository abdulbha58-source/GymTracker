import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Gym Progress Tracker",
  description: "A fast, private gym workout tracker.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-100 antialiased">
        <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
          <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
