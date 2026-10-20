"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Heart, Compass, Film, BarChart, Search, Menu, X } from "lucide-react";
import LogoutButton from "./LogoutButton";

const tabs = [
  { href: "/discovery", label: "Discovery", icon: Compass },
  { href: "/matches", label: "Liked", icon: Heart },
  { href: "/stats", label: "Stats", icon: BarChart },
  { href: "/search", label: "Search", icon: Search },
];

export default function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const linkClass = "flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-purple-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white";

  const links = (
    <>
      {tabs.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={pathname === href ? "page" : undefined}
          className={`${linkClass} ${pathname === href ? "bg-purple-500/40" : ""}`}
        >
          <Icon size={22} aria-hidden="true" />
          {label}
        </Link>
      ))}
      <LogoutButton className={`${linkClass} cursor-pointer text-left`} />
    </>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-black">
      <div className="mx-auto flex h-20 max-w-[88rem] items-center justify-between px-4 sm:px-6">
        <Link href="/discovery" onClick={() => setOpen(false)} className="flex items-center gap-3">
          <Film className="h-8 w-8 shrink-0 text-purple-400" />
          <span className="text-xl font-semibold text-white">FilmFlicks</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-2 lg:flex">
          {links}
        </nav>
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          title={open ? "Close navigation" : "Open navigation"}
          className="grid h-11 w-11 place-items-center rounded-lg text-purple-300 hover:bg-white/10 lg:hidden"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        hidden={!open}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
        className="absolute inset-x-0 top-20 max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-white/15 bg-black p-3 lg:hidden"
      >
        <div className="flex flex-col gap-1">{links}</div>
      </nav>
    </header>
  );
}