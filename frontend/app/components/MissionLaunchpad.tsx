// --- components/MissionLaunchpad.tsx ---
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "../context/SearchContext";

const MISSION_VIDEOS = [
  "https://www.pexels.com/download/video/16449101/",
  "https://www.pexels.com/download/video/36021159/",
  "https://www.pexels.com/download/video/20117272/"
];

export default function MissionLaunchpad() {
  const router = useRouter();
  const { userId } = useSearch();

  const [mode, setMode] = useState<"NEW" | "EXISTING">("NEW");
  const [existingTrips, setExistingTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  
  const [bgVideo, setBgVideo] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStage, setLaunchStage] = useState(0);
  
  // Snow particle data
  const [snowflakes, setSnowflakes] = useState<{left: string, size: string, duration: string, delay: string, drift: string}[]>([]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * MISSION_VIDEOS.length);
    setBgVideo(MISSION_VIDEOS[randomIndex]);

    if (userId) {
      fetch(`http://localhost:8000/api/trips?user_id=${userId}`)
        .then(res => res.json())
        .then(data => setExistingTrips(data || []))
        .catch(err => console.error("Failed to fetch trips", err));
    }

    // Pre-generate random CSS properties for a heavy snowfall
    const newSnowflakes = Array.from({ length: 200 }).map(() => ({
      left: `${Math.random() * 100}vw`,
      size: `${Math.random() * 8 + 3}px`, // Range: 3px to 11px
      duration: `${Math.random() * 1.5 + 0.8}s`, // Fast dropping
      delay: `${Math.random() * 1.5}s`, // Staggered starts
      drift: `${(Math.random() - 0.5) * 40}vw` // Random sideways blowing
    }));
    setSnowflakes(newSnowflakes);
  }, [userId]);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "EXISTING" && !selectedTripId) return;

    setIsLaunching(true);
    setLaunchStage(1); // Stage 1: UI Fades, Goggles boot

    try {
      let finalTripId = selectedTripId;
      let objectiveName = "UNKNOWN_TARGET";

      if (mode === "NEW") {
        objectiveName = `CLASSIFIED_OP_${Math.floor(Math.random() * 9000) + 1000}`;
        const tripRes = await fetch("http://localhost:8000/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: objectiveName, 
            user_id: userId 
          })
        });
        const newTrip = await tripRes.json();
        finalTripId = newTrip.id;
      } else {
        objectiveName = existingTrips.find(t => t.id === selectedTripId)?.name || "UNKNOWN_TARGET";
      }

      // Stage 2: HUD Data Populates
      setTimeout(() => setLaunchStage(2), 600);
      
      // Stage 3: Reticle locks, MASSIVE and SLOW zoom starts
      setTimeout(() => setLaunchStage(3), 1500);

      // Stage 4: Snow particles drop heavily, smooth whiteout fades in over 2.5s
      setTimeout(() => setLaunchStage(4), 3000);

      // Stage 5: Whiteout is complete, "DROPPING IN..." text appears
      setTimeout(() => setLaunchStage(5), 4500);
      
      // Final: Route to planner exactly as the text locks in
      setTimeout(() => {
        router.push(`/trip-planner?trip_id=${finalTripId}`);
      }, 7000);

    } catch (err) {
      console.error("Launch failed:", err);
      setIsLaunching(false);
      setLaunchStage(0);
      alert("SYSTEM FAILURE: Could not initialize mission.");
    }
  };

  const textColor = mode === "NEW" ? "text-cyan-400" : "text-purple-400";
  const borderColor = mode === "NEW" ? "border-cyan-500" : "border-purple-500";

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-mono selection:bg-cyan-500 selection:text-white bg-slate-950">
      
      {/* BACKGROUND VIDEO */}
      {bgVideo && (
        <video 
          key={bgVideo} 
          autoPlay 
          loop 
          muted 
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-transform origin-center ${
            launchStage === 0 ? 'scale-100 duration-1000' : 
            launchStage === 1 || launchStage === 2 ? 'scale-110 duration-[2000ms] ease-out' : 
            'scale-[5.0] duration-[4000ms] ease-in' // Slower, deeper zoom
          }`}
        >
          <source src={bgVideo} type="video/mp4" />
        </video>
      )}

      {/* OVERLAY TINT */}
      <div className={`absolute inset-0 transition-colors duration-700 ${
        isLaunching ? 'bg-transparent' : 'bg-slate-950/70'
      }`}></div>

      {/* MATRIX GRID OVERLAY */}
      <div className={`absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay pointer-events-none transition-opacity duration-500 ${isLaunching ? 'opacity-10' : 'opacity-30'}`}></div>

      {/* LAUNCH UI BOX */}
      <div className={`relative z-10 w-full max-w-md p-1 transition-all duration-500 ${
        isLaunching ? 'scale-50 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
      }`}>
        <form onSubmit={handleLaunch} className="flex flex-col items-center gap-6 relative z-10">
          
          {/* THE GIANT MYSTERIOUS BUTTON */}
          <button 
            type="submit"
            disabled={mode === "EXISTING" && !selectedTripId}
            className="w-full relative overflow-hidden group py-8 bg-slate-950/80 backdrop-blur-md transition-all duration-500 shadow-[0_0_30px_rgba(0,0,0,0.8)] hover:shadow-[0_0_40px_rgba(153,27,27,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out bg-red-950/20"></div>
            <span className="relative z-10 text-xl font-black tracking-[0.2em] uppercase transition-all duration-500 text-red-800 drop-shadow-[0_0_8px_rgba(153,27,27,0.8)] group-hover:text-red-500 group-hover:drop-shadow-[0_0_20px_rgba(220,38,38,1)]">
              {mode === "NEW" ? "LAUNCH_NEW_MISSION" : "EXPAND_MISSION"}
            </span>
          </button>

          {/* SUBTLE TOGGLE FOR EXISTING TRIPS */}
          {mode === "NEW" ? (
            <button 
              type="button" 
              onClick={() => setMode("EXISTING")}
              className="text-[10px] text-slate-500 hover:text-cyan-400 tracking-[0.2em] uppercase transition-colors cursor-pointer border-b border-transparent hover:border-cyan-400 pb-1"
            >
              [+] Access Existing Mission Data
            </button>
          ) : (
            <div className="w-full flex flex-col items-center gap-4 animate-fade-in-down">
              <select 
                required
                value={selectedTripId}
                onChange={e => setSelectedTripId(e.target.value)}
                className="w-full bg-slate-900/80 backdrop-blur-md border border-purple-500/50 text-purple-300 p-4 focus:border-purple-400 outline-none transition-all text-xs tracking-widest uppercase text-center"
              >
                <option value="" disabled>-- SELECT_ACTIVE_MISSION --</option>
                {existingTrips.map(trip => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name} {trip.legs?.length > 0 ? `[${trip.legs.length} WAYPOINTS]` : ""}
                  </option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={() => { setMode("NEW"); setSelectedTripId(""); }}
                className="text-[10px] text-slate-500 hover:text-purple-400 tracking-[0.2em] uppercase transition-colors cursor-pointer border-b border-transparent hover:border-purple-400 pb-1"
              >
                [←] Return to New Mission
              </button>
            </div>
          )}

        </form>
      </div>

      {/* --- GOGGLE HUD OVERLAY --- */}
      {isLaunching && (
        <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 shadow-[inset_0_0_150px_100px_rgba(0,0,0,0.95)] sm:shadow-[inset_0_0_250px_150px_rgba(0,0,0,0.95)] transition-opacity duration-500"></div>

          <div className={`absolute top-10 left-10 flex flex-col gap-1 text-[10px] tracking-[0.3em] font-bold ${textColor} transition-all duration-300 ${launchStage >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
            <span className="animate-pulse">SYS.OPTICS // ONLINE</span>
            <span>ALTITUDE: 2,450M</span>
            <span>TEMP: -8°C</span>
          </div>

          <div className={`absolute top-10 right-10 flex flex-col gap-1 text-[10px] tracking-[0.3em] font-bold text-right ${textColor} transition-all duration-300 ${launchStage >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
            <span>WIND: 15KM/H NNW</span>
            <span>PITCH: -32°</span>
            <span className="text-white mt-2">OBJ: {mode === "NEW" ? "CLASSIFIED" : existingTrips.find(t => t.id === selectedTripId)?.name}</span>
          </div>

          <div className={`relative flex items-center justify-center transition-all duration-500 ${launchStage >= 3 ? 'scale-150 opacity-100' : 'scale-50 opacity-0'} ${launchStage >= 4 ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`absolute w-32 h-32 border-2 rounded-full ${borderColor} opacity-50`}></div>
            <div className={`absolute w-4 h-4 border-2 ${borderColor}`}></div>
            <div className={`absolute w-40 h-[1px] ${mode === "NEW" ? 'bg-cyan-500' : 'bg-purple-500'} opacity-40`}></div>
            <div className={`absolute h-40 w-[1px] ${mode === "NEW" ? 'bg-cyan-500' : 'bg-purple-500'} opacity-40`}></div>
            <div className={`absolute mt-24 text-[10px] tracking-[0.4em] font-black ${launchStage >= 3 ? 'text-red-500 animate-pulse' : textColor}`}>
              {launchStage >= 3 ? "LOCKED" : "ACQUIRING..."}
            </div>
          </div>
        </div>
      )}

      {/* --- BLIZZARD WHITEOUT SEQUENCE --- */}
      {launchStage >= 4 && (
        <div className="absolute inset-0 z-50 overflow-hidden pointer-events-none">
          {/* Dense, chaotic dropping snow particles */}
          {snowflakes.map((s, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]"
              style={{
                left: s.left,
                width: s.size,
                height: s.size,
                animation: `snow-drop ${s.duration} linear infinite`,
                animationDelay: s.delay,
                '--drift': s.drift
              } as any} // Casting to any to allow CSS variable insertion cleanly
            />
          ))}

          {/* The smooth, blooming whiteout wall */}
          <div className={`absolute inset-0 bg-white transition-opacity ease-in pointer-events-none ${
            launchStage >= 4 ? 'opacity-100 duration-[2500ms]' : 'opacity-0 duration-0'
          }`}></div>
        </div>
      )}

      {/* --- DROPPING IN TEXT --- */}
      <div className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-700 delay-300 ${
        launchStage >= 5 ? 'opacity-100' : 'opacity-0'
      }`}>
        <span className="text-4xl md:text-6xl font-black text-slate-900 tracking-[0.5em] uppercase drop-shadow-xl">
          DROPPING IN...
        </span>
      </div>

      {/* Inline styles for the dropping snow animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes snow-drop {
          0% { transform: translate(0, -10vh); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(var(--drift), 110vh); opacity: 0; }
        }
      `}} />

    </div>
  );
}