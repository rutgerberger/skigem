"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Michroma } from 'next/font/google';

const michroma = Michroma({ weight: '400', subsets: ['latin'] });

const navLinks = [
  { name: "CORE_HUB", path: "/" },
  { name: "TRIP_PLANNER", path: "/trip-planner" }, // Assuming resorts is the entry point
  { name: "TELEMETRY_HUB", path: "/resort-center" }, // Dynamic base
  { name: "ARCHIVE", path: "/favorites" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 w-full z-[100] bg-white-500/80 backdrop-blur-md border-b border-blue-500/30">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Logo / System ID */}
        <Link href="/" className={`font-bold text-slate-500 text-cyan-400 text-xl text-red tracking-widest`}>
          SCHIHUB<span className="text-cyan-500">.</span>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                className={`text-[10px] font-bold tracking-[0.2em] transition-all duration-300 uppercase px-2 py-1 border-b-2 ${
                  isActive 
                    ? "text-cyan-400 border-cyan-500 shadow-[0_5px_10px_-5px_rgba(6,182,212,0.5)]" 
                    : "text-slate-500 border-transparent hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_cyan]"></div>
          <span className="text-[10px] text-cyan-500/70 font-mono hidden sm:inline">
            SYS_CONNECTION: STABLE
          </span>
        </div>
      </div>
    </nav>
  );
}