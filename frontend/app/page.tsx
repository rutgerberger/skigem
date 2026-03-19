"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Michroma } from 'next/font/google';

// Component Imports
import DataSearchModule from "./components/DataSearchModule";
import MapOverlayModule from "./components/MapOverlayModule";
import MyResortsModule from "./components/MyResortsModule";

import { useSearch } from "./context/SearchContext";

const michroma = Michroma({ weight: '400', subsets: ['latin'] });

export default function Home() {
  const { userId } = useSearch();
  
  // --- Expeditions State ---
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTrip, setActiveTrip] = useState<any | null>(null);
  const [nextTrip, setNextTrip] = useState<any | null>(null); // NEW: Track upcoming trip

  // --- Fetch Trips & Determine Active/Next Status ---
  useEffect(() => {
    if (!userId) return;

    async function fetchExpeditions() {
      try {
        const res = await fetch(`http://localhost:8000/api/trips?user_id=${userId}`);
        if (res.ok) {
          const data = await res.json();
          setTrips(data);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0); 

          let current = null;
          const upcomingTrips: any[] = [];

          data.forEach((t: any) => {
            if (!t.start_date || !t.end_date) return;
            
            const startParts = t.start_date.split('-');
            const endParts = t.end_date.split('-');
            
            const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
            const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
            
            // Check if currently active
            if (today >= start && today <= end) {
              current = t;
            } 
            // Check if in the future
            else if (start > today) {
              upcomingTrips.push({ ...t, parsedStart: start });
            }
          });

          setActiveTrip(current || null);

          // Find the closest upcoming trip
          if (upcomingTrips.length > 0) {
            upcomingTrips.sort((a, b) => a.parsedStart.getTime() - b.parsedStart.getTime());
            setNextTrip(upcomingTrips[0]);
          }
        }
      } catch (err) {
        console.error("SYS_ERR: Failed to load expeditions", err);
      }
    }
    
    fetchExpeditions();
  }, [userId]);

  // Helper to get days until next trip
  const getDaysUntil = (startDate: string) => {
    const startParts = startDate.split('-');
    const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(start.getTime() - today.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper to extract target resorts from a trip
  const getTripTargets = (trip: any) => {
    if (!trip.legs || trip.legs.length === 0) return "PENDING WAYPOINTS";
    return trip.legs.map((l: any) => l.resort?.name).filter(Boolean).join(" ➔ ");
  };

  return (
    <main className="min-h-screen relative bg-[url('/background_img.png')] bg-cover bg-center bg-fixed text-slate-800 font-mono selection:bg-cyan-500 selection:text-white">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-orange-950/30 pointer-events-none"></div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-12 pt-24 pb-24 px-6 md:px-12">
        
        {/* --- SYSTEM HEADER --- */}
        <div className="relative bg-slate-950/80 backdrop-blur-xl border border-slate-800 p-6 md:p-10 rounded-sm shadow-2xl overflow-hidden mb-4 group animate-fade-in-down">
          {/* Decorative background effects */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 blur-[100px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors duration-700"></div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-8">
            
            {/* Left: Main Branding & Prompt */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-cyan-950/30 border border-cyan-900/50 rounded-sm shadow-inner">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.3em]">
                  Global_Uplink: Established
                </span>
              </div>
              
              {/* --- NEW: FLEX CONTAINER FOR LOGO AND TITLE --- */}
              <div className="flex items-center gap-4 md:gap-6">
                <img 
                  src="/logo.png" 
                  alt="SchiHub Diamond Logo" 
                  className="w-14 h-14 md:w-20 md:h-20 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                />
                {/* Inject the michroma.className right here at the start of the string */}
                <h1 className={`font-mono font-bold text-2xl md:text-7xl text-white tracking-widest drop-shadow-lg`}>
                  SCHIHUB<span className="text-cyan-400"></span>
                  <span className="text-cyan-500 animate-pulse opacity-100 font-light">.</span>
                </h1>
              </div>
              
              <p className="text-xs md:text-sm text-slate-400 tracking-[0.2em] max-w-xl uppercase leading-relaxed">
                Not your generic AI trip generator. Built for Ski Geeks <br className="hidden md:block" />
                <span className="text-slate-300">Status: <span className="text-green-400 font-bold">Awaiting Directives.</span></span>
              </p>
            </div>

            {/* Right: User & Session Stats (Stacks on mobile, aligns right on desktop) */}
            <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-8">
              <div className="text-[9px] text-slate-500 tracking-[0.3em] uppercase mb-1">Session_Data</div>
              
              <div className="text-xs text-white tracking-widest uppercase bg-slate-900 p-2.5 border border-slate-800 flex justify-between gap-6">
                <span className="text-slate-500">USER //</span> 
                <span className="font-bold text-cyan-50">GUEST_SKIGEEK</span>
              </div>
              
              <div className="text-xs text-white tracking-widest uppercase bg-slate-900 p-2.5 border border-slate-800 flex justify-between gap-6">
                <span className="text-slate-500">AUTH //</span> 
                <span className="font-bold text-purple-400">LEVEL_01</span>
              </div>
              
              <div className="text-xs text-white tracking-widest uppercase bg-slate-900 p-2.5 border border-slate-800 flex justify-between gap-6">
                <span className="text-slate-500">SYS_TIME //</span> 
                <span className="font-bold text-cyan-400">SYNCED_OK</span>
              </div>
            </div>

          </div>
        </div>

        {/* --- DYNAMIC TRIP BANNER --- */}
        {activeTrip || nextTrip ? (
          <div className={`p-6 md:p-8 rounded-md border-l-4 shadow-2xl relative overflow-hidden group transition-all animate-fade-in-down ${
            activeTrip ? 'bg-emerald-950/40 border-emerald-500' : 'bg-blue-950/40 border-blue-500'
          }`}>
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-64 h-64 blur-[80px] -z-10 ${
              activeTrip ? 'bg-emerald-500/20' : 'bg-blue-500/20'
            }`}></div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
              <div>
                {activeTrip ? (
                  <>
                    <p className="text-emerald-400 font-black tracking-widest text-xl md:text-2xl drop-shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse mb-1">
                      🚨 YOU ARE SKIING RIGHT NOW! 🚨
                    </p>
                    <p className="text-slate-200 font-bold uppercase tracking-widest text-sm">
                      MISSION: {activeTrip.name} // ENJOY THE POWDER
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-1">
                      ⏳ NEXT DEPLOYMENT SECURED
                    </p>
                    <p className="text-white font-black uppercase tracking-widest text-xl md:text-2xl">
                      {nextTrip.name}
                    </p>
                  </>
                )}
                
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className={`text-[10px] px-2 py-1 border uppercase tracking-widest font-bold ${
                    activeTrip ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' : 'bg-blue-900/50 border-blue-500 text-blue-400'
                  }`}>
                    {activeTrip ? `ACTIVE_UNTIL ${activeTrip.end_date}` : `GOING_IN ${getDaysUntil(nextTrip.start_date)} DAYS`}
                  </span>
                  <span className="text-xs text-slate-300 tracking-widest uppercase font-bold bg-slate-950/50 px-3 py-1 rounded-sm border border-slate-800">
                    📍 TARGETS: <span className="text-white">{getTripTargets(activeTrip || nextTrip)}</span>
                  </span>
                </div>
              </div>

              <Link 
                href={`/my-trips/${(activeTrip || nextTrip).id}`} 
                className={`shrink-0 px-6 py-4 font-black tracking-widest uppercase text-xs transition-all border text-center ${
                  activeTrip 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-500 shadow-[0_0_20px_rgba(52,211,153,0.5)]' 
                    : 'bg-blue-900/50 hover:bg-blue-500 hover:text-slate-950 text-blue-400 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                }`}
              >
                {activeTrip ? 'OPEN LIVE HUB ↗' : 'PREP MISSION ↗'}
              </Link>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-8 rounded-md border border-dashed border-slate-700 bg-slate-900/40 shadow-inner relative overflow-hidden group transition-all animate-fade-in-down">
            <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6">
              <div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-1">
                  ⚠️ SYSTEM ALERT
                </p>
                <p className="text-slate-300 font-black uppercase tracking-widest text-xl md:text-2xl">
                  ZERO MISSIONS PLANNED :[
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-[10px] px-2 py-1 border border-slate-700 uppercase tracking-widest font-bold bg-slate-950/50 text-slate-500">
                    STATUS: IDLE
                  </span>
                  <span className="text-xs text-slate-400 tracking-widest uppercase font-bold">
                    The mountains are calling. Awaiting winter sport parameters...
                  </span>
                </div>
              </div>

              <Link 
                href="/trip-planner" 
                className="shrink-0 px-6 py-4 font-black tracking-widest uppercase text-xs transition-all border text-center bg-cyan-900/20 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]"
              >
                INITIATE PLANNING ↗
              </Link>
            </div>
          </div>
        )}

        {/* Data Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Modularized Map System */}
          <MapOverlayModule />

          {/* Modularized Resorts Component */}
          <MyResortsModule userId={userId} /> 
          
          {/* MY_EXPEDITIONS MODULE */}
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500 p-6 rounded-md shadow-lg space-y-4 flex flex-col">
            <h3 className="text-lg font-bold text-cyan-500 uppercase tracking-widest mb-2 shrink-0">MODULE: MY_EXPEDITIONS</h3>
            
            <ul className="text-slate-300 text-sm space-y-4 flex-grow">
              
              <li className="group">
                <Link href="/trip-planner" className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                  <span className="text-cyan-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span> 
                  PLAN_NEW_MISSION
                </Link>
              </li>

              <li className="group">
                <Link href="/my-trips" className="flex items-center flex-wrap gap-2 hover:text-cyan-400 transition-colors">
                  <span className="text-cyan-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span> 
                  SAVED_ARCHIVES
                  <span className="text-[10px] bg-slate-950 border border-slate-700 px-2 py-0.5 text-cyan-500">
                    [{trips.length} LOGS]
                  </span>
                </Link>
              </li>

              <li className="flex flex-col gap-1 border-t border-slate-800 pt-4 mt-auto">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-500 font-bold">&gt;</span> 
                  ACTIVE_STATUS: 
                  {activeTrip ? (
                    <span className="text-emerald-400 font-bold animate-pulse text-xs tracking-widest bg-emerald-950/30 px-2 py-0.5 border border-emerald-900 rounded-sm">DEPLOYED</span>
                  ) : (
                    <span className="text-slate-500 text-xs tracking-widest">STANDBY</span>
                  )}
                </div>
                
                {activeTrip && (
                  <Link 
                    href={`/my-trips/${activeTrip.id}`} 
                    className="text-xs text-slate-400 hover:text-cyan-400 pl-4 truncate transition-colors uppercase tracking-widest mt-1 group block"
                  >
                    <span className="text-cyan-700 group-hover:text-cyan-400">↳</span> TARGET: {activeTrip.name}
                  </Link>
                )}
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-purple-500 p-6 rounded-md shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-purple-500 uppercase tracking-widest">MODULE: MY_TELEMETRY</h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-center gap-2"><span className="text-purple-500 font-bold">&gt;</span> AI_ROAST_LEVEL: LOW</li>
              <li className="flex items-center gap-2"><span className="text-purple-500 font-bold">&gt;</span> VERT_DROP: --- M</li>
              <li className="flex items-center gap-2"><span className="text-purple-500 font-bold">&gt;</span> MAX_VELOCITY: --- KM/H</li>
            </ul>
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-red-500 p-6 rounded-md shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest">MODULE: EXPERT_ZONE</h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> COULIORS</li>
              <li className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> EPIC_RUNS_LOG</li>
              <li className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> LAWINE_GEFAHR_LIVE</li>
            </ul>
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-purple-500 p-6 rounded-md shadow-lg space-y-4 col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold text-purple-500 uppercase tracking-widest">MODULE: SOCIAL_FEED</h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-center gap-2"><span className="text-purple-500 font-bold">&gt;</span> GUEST_JOHANNES &gt; JUST_LOGGED: 15k_VERTICAL (ST. ANTON)</li>
              <li className="flex items-center gap-2"><span className="text-purple-500 font-bold">&gt;</span> GUEST_ANNA &gt; PLAN_MISSION: ISCHGL</li>
              <li className="flex items-center gap-2"><span className="text-purple-500 font-bold">&gt;</span> LEADERBOARD &gt; VERTIKAL_DROP_PER_EURO: N/A</li>
            </ul>
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500 p-6 rounded-md shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-cyan-500 uppercase tracking-widest">MODULE: AI_SKI_CENTER</h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-center gap-2"><span className="text-cyan-500 font-bold">&gt;</span> ENHANCE_MY_TRIP</li>
              <li className="flex items-center gap-2"><span className="text-cyan-500 font-bold">&gt;</span> POWDER_PANIC_PREDICTOR</li>
              <li className="flex items-center gap-2"><span className="text-cyan-500 font-bold">&gt;</span> BYPASS_THE_QUEUE_SUGGESTION</li>
            </ul>
          </div>

        </div>

        <div className="text-center bg-slate-900/80 p-6 rounded-lg shadow-inner border border-purple-500/20 max-w-2xl mx-auto">
          <p className="text-xs text-purple-500 font-bold uppercase tracking-widest">ACCESS_LEVEL: GUEST_ACCESS</p>
          <p className="text-sm text-slate-400 mt-2">
            Try ACCO search once for FREE. UPGRADE for full telemetry access, powder alerts, and expert zone data.
          </p>
          <button className="bg-purple-600 hover:bg-purple-500 text-slate-950 font-black tracking-widest uppercase text-sm py-2 px-6 rounded-md mt-4 shadow-[0_0_15px_rgba(147,51,234,0.4)]">
            GET PRO ACCESS
          </button>
        </div>

      </div>
    </main>
  );
}