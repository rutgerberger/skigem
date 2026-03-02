"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Map, Marker } from "pigeon-maps";
import { Resort } from "../../types";
import { useSearch } from "../context/SearchContext";

export default function ResortsBriefing() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resorts, setResorts, lastResortCriteria, setLastResortCriteria } = useSearch();
  const [loading, setLoading] = useState(true);
  
  const hasFetched = useRef(false);
  const [activeResort, setActiveResort] = useState<Resort | null>(null);

  // --- State for global database resorts ---
  const [dbResorts, setDbResorts] = useState<any[]>([]);

  // Fetch the master DB list on mount so we have coordinates for the map
  useEffect(() => {
    fetch("http://localhost:8000/api/resorts")
      .then(res => res.json())
      .then(data => setDbResorts(data))
      .catch(err => console.error("Failed to load DB resorts", err));
  }, []);

  useEffect(() => {
    const payload = {
        country: searchParams.get("country") || "Austria",
        max_budget_per_night: Number(searchParams.get("budget")) || 150,
        lift_proximity_m: Number(searchParams.get("proximity")) || 500,
        number_of_guests: Number(searchParams.get("guests")) || 4,
        additional_requirements: searchParams.get("requirements") || null,
        // --- RADAR STATS EXTRACTION ---
        pref_pisteKms: Number(searchParams.get("pref_pisteKms")) || 3,
        pref_apres: Number(searchParams.get("pref_apres")) || 3,
        pref_offPiste: Number(searchParams.get("pref_offPiste")) || 3,
        pref_snow: Number(searchParams.get("pref_snow")) || 3,
        pref_family: Number(searchParams.get("pref_family")) || 3,
        pref_quiet: Number(searchParams.get("pref_quiet")) || 3,
    };
    
    const currentCriteria = JSON.stringify(payload);

    if (resorts.length > 0 && lastResortCriteria === currentCriteria) {
      setLoading(false);
      if (!activeResort) setActiveResort(resorts[0]);
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    async function scoutResorts() {
      setLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:8000/api/search/resorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          console.error("The Orchestra hit a wrong note:", data);
          setResorts([]);
          return;
        }

        const fetchedResorts = data.resorts || [];
        setResorts(fetchedResorts);
        setLastResortCriteria(currentCriteria);
        
        if (fetchedResorts.length > 0) {
          setActiveResort(fetchedResorts[0]);
        }
        
      } catch (err) {
        console.error("Network error:", err);
        setResorts([]);
      } finally {
        setLoading(false);
      }
    }
    scoutResorts();
  }, [searchParams, lastResortCriteria, setResorts, setLastResortCriteria, activeResort, resorts]);

  const selectResort = (resortName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("target_resort", resortName);
    params.set("phase", "chalets");
    router.push(`/trip-planner?${params.toString()}`);
  };

  // --- NEW: Function to navigate to the Telemetry Hub ---
  const openTelemetryHub = (resortName: string) => {
    router.push(`/resort-center/${encodeURIComponent(resortName)}`);
  };

  // Map the scouted resorts to their coordinates
  const resortsWithCoords = useMemo(() => {
    return resorts.map(r => {
      const matchedDb = dbResorts.find(dbR => dbR.name === r.name);
      return {
        ...r,
        lat: matchedDb?.latitude || 47.2, 
        lon: matchedDb?.longitude || 11.4
      };
    });
  }, [resorts, dbResorts]);

  const activeResortWithCoords = resortsWithCoords.find(r => r.name === activeResort?.name);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-mono gap-4">
      <div className="text-5xl animate-pulse drop-shadow-sm">⛷️</div>
      <div className="text-cyan-500 text-xl font-bold text-center px-4 tracking-widest">
        SCOUTING_MOUNTAINS...<br/>
        <span className="text-slate-600 text-sm font-normal">[ COMPILING_INTELLIGENCE: ~15s ]</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-mono selection:bg-cyan-500 selection:text-white">
      <header className="px-10 py-5 border-b border-slate-800 bg-slate-950 z-20 shadow-md flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-widest flex items-center gap-3">
            <span className="text-cyan-500">_</span> PHASE_A: RESORT_BRIEFING
          </h1>
          <p className="text-slate-500 text-xs mt-1 uppercase">
            {resorts.length > 0 
              ? `[ ${resorts.length} TARGETS ACQUIRED ]` 
              : "[ NO TARGETS MATCH CRITERIA ]"}
          </p>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* LEFT PANEL: The List */}
        <div className="w-full lg:w-5/12 xl:w-1/3 overflow-y-auto p-6 space-y-6 bg-slate-900 custom-scrollbar border-r border-slate-800 z-10">
          {resorts.map((resort, idx) => (
            <div 
              key={idx} 
              onMouseEnter={() => setActiveResort(resort)}
              className={`group cursor-pointer rounded-lg p-6 transition-all duration-200 border bg-slate-950 ${
                activeResort?.name === resort.name 
                  ? "border-cyan-500 ring-1 ring-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)] scale-[1.01]" 
                  : "border-slate-800 hover:border-cyan-800"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className={`text-xl font-bold uppercase tracking-wider transition-colors pr-2 ${
                  activeResort?.name === resort.name ? "text-cyan-400" : "text-white group-hover:text-slate-300"
                }`}>
                  {resort.name}
                </h2>
                {/* SMALL TELEMETRY HUB BUTTON */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    openTelemetryHub(resort.name);
                  }}
                  className="text-[10px] shrink-0 text-cyan-500 border border-cyan-500/50 px-2 py-1 rounded hover:bg-cyan-500 hover:text-slate-950 transition-colors font-bold tracking-widest"
                >
                  HUB ↗
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-900 rounded p-3 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Slopes</p>
                  <p className="text-slate-200">{resort.slope_length_km} km</p>
                </div>
                <div className="bg-slate-900 rounded p-3 border border-slate-800">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Pass_Price</p>
                  <p className="text-slate-200">{resort.avg_pass_price_eur ? `€${resort.avg_pass_price_eur}/day` : 'N/A'}</p>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  selectResort(resort.name);
                }}
                className={`w-full py-3 rounded uppercase tracking-widest text-sm font-bold transition-all duration-300 flex justify-center items-center gap-2 ${
                  activeResort?.name === resort.name
                    ? "bg-cyan-600 text-slate-950 hover:bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                DEPLOY_HUNTERS
              </button>
            </div>
          ))}
        </div>

        {/* RIGHT PANEL: Map & Overlay */}
        <div className="hidden lg:flex flex-1 relative bg-slate-950 overflow-hidden">
          
          {/* Pigeon Map Layer */}
          <div className="absolute inset-0 w-full h-full invert-[.95] hue-rotate-[180deg] brightness-75 contrast-125 grayscale-[20%] transition-all duration-1000">
            <Map 
              center={activeResortWithCoords ? [activeResortWithCoords.lat, activeResortWithCoords.lon] : [47.2, 11.4]} 
              zoom={9} 
              zoomSnap={false}
            >
              {resortsWithCoords.map((r, i) => (
                <Marker 
                  key={i} 
                  width={activeResort?.name === r.name ? 55 : 35} 
                  anchor={[r.lat, r.lon]} 
                  color={activeResort?.name === r.name ? "#06b6d4" : "#475569"} 
                  onClick={() => setActiveResort(r)}
                  style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                />
              ))}
            </Map>
          </div>
          
          {/* Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none"></div>

          {activeResort ? (
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-end p-12 text-center pb-16 pointer-events-none">
              
              <div className="w-12 h-12 bg-slate-950/80 backdrop-blur-md rounded-full flex items-center justify-center mb-4 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.5)] text-cyan-400 animate-bounce">
                <div className="text-xl">📍</div>
              </div>

              <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">
                {activeResort.name}
              </h2>
              
              <div className="max-w-2xl w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-lg p-8 mt-4 shadow-2xl text-left space-y-6 pointer-events-auto transition-all">
                <div>
                  <h3 className="text-cyan-500 text-xs uppercase tracking-widest font-bold mb-2">[ PROFILE_VIBE ]</h3>
                  <p className="text-base text-slate-300 leading-relaxed">{activeResort.vibe}</p>
                </div>
                <div className="h-px w-full bg-slate-800"></div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-cyan-500 text-xs uppercase tracking-widest font-bold mb-2">[ ALTITUDE_DATA ]</h3>
                    <p className="text-slate-200 text-base">{activeResort.altitude_info}</p>
                  </div>
                  <div>
                    <h3 className="text-cyan-500 text-xs uppercase tracking-widest font-bold mb-2">[ LOGISTICS_VECTOR ]</h3>
                    <p className="text-slate-200 text-base">{activeResort.logistics}</p>
                  </div>
                </div>

                {/* LARGE TELEMETRY HUB BUTTON IN OVERLAY */}
                <button 
                  onClick={() => openTelemetryHub(activeResort.name)}
                  className="w-full mt-4 py-3 bg-slate-950 border border-cyan-500/50 hover:bg-cyan-500 text-cyan-500 hover:text-slate-950 font-bold tracking-widest text-sm uppercase transition-all duration-300"
                >
                  OPEN TELEMETRY HUB ↗
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 w-full h-full flex items-center justify-center text-slate-600 uppercase tracking-widest text-sm pointer-events-none">
              <span className="bg-slate-950/80 px-4 py-2 rounded-sm border border-slate-800">AWAITING_TARGET_SELECTION...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}