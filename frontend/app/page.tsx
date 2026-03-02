"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Michroma } from 'next/font/google';

// Component Imports
import DataSearchModule from "./components/DataSearchModule";
import MapOverlayModule from "./components/MapOverlayModule";

const michroma = Michroma({ weight: '400', subsets: ['latin'] });

// Define the shape of our database response
interface ResortData {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
}

export default function Home() {
  const router = useRouter();

  // State for our database resorts
  const [allResorts, setAllResorts] = useState<ResortData[]>([]);

  // My Resorts Module Autocomplete State
  const [myResortsQuery, setMyResortsQuery] = useState("");
  const [myResortsResults, setMyResortsResults] = useState<ResortData[]>([]);
  const [showMyResortsDropdown, setShowMyResortsDropdown] = useState(false);
  const myResortsDropdownRef = useRef<HTMLDivElement>(null);

  // --- NEW: FETCH RESORTS FROM DB ON MOUNT ---
  useEffect(() => {
    async function loadDatabaseResorts() {
      try {
        const res = await fetch("http://localhost:8000/api/resorts");
        if (res.ok) {
          const data = await res.json();
          setAllResorts(data);
        }
      } catch (err) {
        console.error("SYS_ERR: Failed to load resort database", err);
      }
    }
    loadDatabaseResorts();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (myResortsDropdownRef.current && !myResortsDropdownRef.current.contains(event.target as Node)) {
        setShowMyResortsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMyResortsSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setMyResortsQuery(query);
    if (query.length > 0) {
      const filtered = allResorts.filter((resort) => 
        resort.name.toLowerCase().includes(query.toLowerCase())
      );
      setMyResortsResults(filtered);
      setShowMyResortsDropdown(true);
    } else {
      setMyResortsResults([]);
      setShowMyResortsDropdown(false);
    }
  }

  function handleSelectMyResort(resort: ResortData) {
    setMyResortsQuery(""); 
    setShowMyResortsDropdown(false);
    router.push(`/resort-center/${encodeURIComponent(resort.name)}`);
  }

  return (
    <main className="min-h-screen relative bg-[url('/background_img.png')] bg-cover bg-center bg-fixed text-slate-800 font-mono selection:bg-cyan-500 selection:text-white">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-orange-950/30 pointer-events-none"></div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-12 pt-24 pb-24 px-6 md:px-12">
        
        {/* System Header */}
        <div className="space-y-2 animate-fade-in-down drop-shadow-xl border-l-4 border-cyan-500 pl-4">
          <p className="text-xs text-cyan-500/80 font-bold uppercase tracking-widest">
            SYSTEM_STATUS: ONLINE_OK // USER: GUEST_SKIGEEK
          </p>
          <h1 className={`text-slate-500 text-cyan-400 text-4xl text-white tracking-widest`}>
            SCHIHUB<span className="text-cyan-500">.</span>
          </h1>
          <p className="text-lg md:text-xl text-cyan-100/80 font-medium max-w-2xl drop-shadow-md">
            PLAN_MISSION. STATUS: READY.
          </p>
        </div>

        {/* Modularized Unified Data Search */}
        <DataSearchModule />

        {/* Data Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500 p-6 rounded-md shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-cyan-500 uppercase tracking-widest">MODULE: MY_EXPEDITIONS</h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-center gap-2"><span className="text-cyan-500 font-bold">&gt;</span> PLAN_NEW</li>
              <li className="flex items-center gap-2"><span className="text-cyan-500 font-bold">&gt;</span> SAVED_TRIPS</li>
              <li className="flex items-center gap-2"><span className="text-cyan-500 font-bold">&gt;</span> ACTIVE_STATUS: N/A</li>
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

          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-pink-500 p-6 rounded-md shadow-lg space-y-4 flex flex-col relative z-40">
            <h3 className="text-lg font-bold text-pink-500 uppercase tracking-widest">MODULE: MY_RESORTS</h3>
            <div className="relative z-20 flex-grow" ref={myResortsDropdownRef}>
              <div className="flex bg-slate-950/50 border border-slate-700 focus-within:border-pink-500 rounded-sm p-1 items-center shadow-inner">
                <span className="text-pink-500/50 pl-2 font-bold select-none">&gt;</span>
                <input 
                  type="text"
                  value={myResortsQuery}
                  onChange={handleMyResortsSearchChange}
                  onFocus={() => { if (myResortsResults.length > 0) setShowMyResortsDropdown(true); }}
                  placeholder={allResorts.length === 0 ? "AWAITING_DB_SYNC..." : "Find resort to open Hub..."}
                  disabled={allResorts.length === 0}
                  className="w-full bg-transparent text-xs text-pink-300 placeholder-slate-600 p-2 focus:outline-none tracking-wider disabled:opacity-50"
                />
              </div>
              {showMyResortsDropdown && myResortsResults.length > 0 && (
                <ul className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-pink-500/50 rounded-sm shadow-2xl max-h-48 overflow-y-auto z-50">
                  {myResortsResults.map((resort) => (
                    <li 
                      key={resort.id} 
                      className="p-2 text-xs text-slate-300 hover:bg-pink-900/50 hover:text-pink-300 cursor-pointer transition-colors border-b border-slate-800 last:border-0 flex items-center gap-2" 
                      onClick={() => handleSelectMyResort(resort)}
                    >
                      <span className="text-pink-500 font-bold">&gt;</span>
                      {resort.name}
                    </li>
                  ))}
                </ul>
              )}
              {!myResortsQuery && (
                <p className="text-xs text-slate-500 italic mt-3 border-l-2 border-slate-700 pl-2">
                  AWAITING_INPUT: Type to link resort telemetry hub.
                </p>
              )}
            </div>
          </div>

          {/* Modularized Map System */}
          <MapOverlayModule />
          
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-red-500 p-6 rounded-md shadow-lg space-y-4">
            <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest">MODULE: EXPERT_ZONE</h3>
            <ul className="text-slate-300 text-sm space-y-2">
              <li className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> TO_COULIORS</li>
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
            <h3 className="text-lg font-bold text-cyan-500 uppercase tracking-widest">MODULE: AI_CENTER</h3>
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