// --- components/MissionLaunchpad.tsx ---
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "../context/SearchContext";

export default function MissionLaunchpad() {
  const router = useRouter();
  const { userId } = useSearch();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // States for the epic animation sequence
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStage, setLaunchStage] = useState(0);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    // Trigger visual launch sequence
    setIsLaunching(true);
    setLaunchStage(1); // "Uplink established"

    try {
      // 1. Create the Trip in the database
      const tripRes = await fetch("http://localhost:8000/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: name, 
          start_date: startDate || null, 
          end_date: endDate || null,
          user_id: userId 
        })
      });
      
      const newTrip = await tripRes.json();

      // 2. Advance animation
      setTimeout(() => setLaunchStage(2), 800); // "Coordinates locked"
      
      // 3. Hyper-jump to the orchestrator (passing the new trip_id)
      setTimeout(() => {
        router.push(`/trip-planner?trip_id=${newTrip.id}`);
      }, 2000);

    } catch (err) {
      console.error("Launch failed:", err);
      setIsLaunching(false);
      setLaunchStage(0);
      alert("SYSTEM FAILURE: Could not initialize mission in database.");
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-mono selection:bg-cyan-500 selection:text-white">
      
      {/* BACKGROUND VIDEO */}
      <video 
        autoPlay 
        loop 
        muted 
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ${isLaunching ? 'scale-110 blur-sm' : 'scale-100 blur-none'}`}
      >
        {/* Public domain epic freeride skiing video placeholder */}
        <source src="https://www.pexels.com/download/video/4185213/" type="video/mp4" />
      </video>

      {/* OVERLAY TINT */}
      <div className={`absolute inset-0 transition-colors duration-1000 ${isLaunching ? 'bg-cyan-950/80' : 'bg-slate-950/70'}`}></div>

      {/* MATRIX GRID / SCANLINES OVERLAY */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay pointer-events-none"></div>

      {/* LAUNCH UI */}
      {/* LAUNCH UI BOX */}
      <div className={`relative z-10 w-full max-w-lg p-1 transition-all duration-700 ${isLaunching ? 'scale-150 opacity-0 blur-xl' : 'scale-100 opacity-100'}`}>
        
        {/* CORNER BRACKET WRAPPER */}
        <div className="relative p-8 bg-slate-900/60 backdrop-blur-xl border border-white/5">
          {/* Brackets */}
          <div className="absolute -top-[2px] -left-[2px] w-8 h-8 border-t-2 border-l-2 border-cyan-500"></div>
          <div className="absolute -top-[2px] -right-[2px] w-8 h-8 border-t-2 border-r-2 border-cyan-500"></div>
          <div className="absolute -bottom-[2px] -left-[2px] w-8 h-8 border-b-2 border-l-2 border-cyan-500"></div>
          <div className="absolute -bottom-[2px] -right-[2px] w-8 h-8 border-b-2 border-r-2 border-cyan-500"></div>

          <form onSubmit={handleLaunch} className="space-y-8">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-[10px] text-cyan-400 tracking-[0.2em] uppercase font-bold">Mission_Codename</label>
                <span className="text-[8px] text-slate-500 uppercase">Required_Field</span>
              </div>
              <input 
                type="text" 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="MISSION_NAME //"
                className="w-full bg-slate-950/50 border-b border-slate-700 text-white p-3 focus:border-cyan-400 outline-none transition-all text-lg tracking-widest placeholder:text-slate-800 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">Start_Window</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-transparent border-b border-slate-800 text-slate-300 p-2 focus:border-cyan-500/50 outline-none transition-all text-xs [color-scheme:dark]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">End_Window</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-transparent border-b border-slate-800 text-slate-300 p-2 focus:border-cyan-500/50 outline-none transition-all text-xs [color-scheme:dark]"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={!name}
              className="w-full relative overflow-hidden group py-5 border border-cyan-500/50 transition-all duration-300 hover:border-cyan-400"
            >
              {/* Fill Animation */}
              <div className="absolute inset-0 bg-cyan-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              
              {/* Text: Color flips on hover */}
              <span className="relative z-10 font-black tracking-[0.4em] uppercase text-cyan-500 group-hover:text-slate-950 transition-colors duration-300">
                Launch Mission
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* LAUNCH SEQUENCE TYPING TEXT (Only visible during animation) */}
      {isLaunching && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
          <div className="w-64 h-64 border-4 border-cyan-500 rounded-full animate-ping flex items-center justify-center bg-cyan-900/20 backdrop-blur-sm">
             <div className="w-32 h-32 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
          </div>
          <div className="mt-8 text-2xl font-black text-white tracking-[0.5em] drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] text-center">
            {launchStage === 1 && "SECURING UPLINK..."}
            {launchStage === 2 && "MISSION LOCKED."}
          </div>
        </div>
      )}
    </div>
  );
}