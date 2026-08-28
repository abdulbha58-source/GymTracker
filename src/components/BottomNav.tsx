"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getQueueLength } from "@/lib/offline";

type Item = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  match: (path: string) => boolean;
};

const items: Item[] = [
  {
    href: "/",
    label: "Home",
    match: (p) => p === "/",
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.69-8.69a2.25 2.25 0 00-3.18 0l-8.69 8.69a.75.75 0 001.06 1.06l8.69-8.69zM12 5.43l7.5 7.5V19.5a2.25 2.25 0 01-2.25 2.25h-3v-6h-4.5v6h-3A2.25 2.25 0 015 19.5v-6.57l7-7z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/progress",
    label: "Progress",
    match: (p) => p.startsWith("/progress") || p.includes("/progress"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M3 3h2v18H3V3zm16 0h2v18h-2V3zM7 17l4-6 3 4 5-8v13H7V17z" />
      </svg>
    ),
  },
  {
    href: "/workout",
    label: "Workout",
    match: (p) => p.startsWith("/workout"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path d="M6 4h2v3h8V4h2v16h-2v-3H8v3H6V4zm2 5v4h8V9H8z" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    match: (p) => p.startsWith("/history") || p.startsWith("/sessions"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M12 3a9 9 0 100 18 9 9 0 000-18zm.75 4.5a.75.75 0 00-1.5 0v4.5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06l-2.78-2.78V7.5z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "More",
    match: (p) => p.startsWith("/more"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M5 12a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0zm5 0a2 2 0 114 0 2 2 0 01-4 0z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [queue, setQueue] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    setQueue(getQueueLength());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(() => setQueue(getQueueLength()), 1000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-40 mx-auto max-w-2xl bg-amber-500/95 px-4 py-1.5 text-center text-xs font-semibold text-black">
          Offline — saves are queued and will sync when you reconnect
          {queue > 0 ? ` (${queue} pending)` : ""}
        </div>
      )}
      {queue > 0 && online && (
        <div className="fixed top-0 left-0 right-0 z-40 mx-auto max-w-2xl bg-emerald-500/95 px-4 py-1.5 text-center text-xs font-semibold text-black">
          Syncing {queue} pending save{queue === 1 ? "" : "s"}…
        </div>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-900 bg-[#0a0a0a]/95 backdrop-blur">
        <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
          {items.map((it) => {
            const active = it.match(pathname ?? "");
            return (
              <li key={it.href} className="flex-1">
                <Link
                  href={it.href}
                  className={`tap flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? "text-emerald-400" : "text-neutral-500 hover:text-neutral-200"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {it.icon(active)}
                  <span>{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
