// --- components/DataSearchModule.tsx ---
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const RADAR_AXES = [
  { key: "pisteKms", label: "PISTE_KMS" },
  { key: "apres", label: "APRÈS-SKI" },
  { key: "offPiste", label: "OFF-PISTE" },
  { key: "snow", label: "SNOW_SURE" },
  { key: "family", label: "FAMILY" },
  { key: "quiet", label: "QUIET_SLOPES" }
] as const;

type RadarData = Record<typeof RADAR_AXES[number]["key"], number>;

interface DataSearchProps {
  defaultExpanded?: boolean;
}

export default function DataSearchModule({ defaultExpanded = false }: DataSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"SCOUT" | "DIRECT">("SCOUT");
  
  const [resortQuery, setResortQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [radarStats, setRadarStats] = useState<RadarData>({
    pisteKms: 3, apres: 3, offPiste: 3, snow: 4, family: 2, quiet: 3
  });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingAxis, setDraggingAxis] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleResortInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setResortQuery(query);
    if (query.length >= 2) {
      try {
        const res = await fetch(`http://localhost:8000/api/resorts/search?q=${query}`);
        if (res.ok) {
          const data = await res.json();
          setAutocompleteResults(data.results);
          setShowDropdown(true);
        }
      } catch (err) { console.error(err); }
    } else {
      setAutocompleteResults([]);
      setShowDropdown(false);
    }
  }

async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const currentParams = new URLSearchParams(window.location.search);
    const tripId = searchParams.get("trip_id"); // Extract tripId

    if (mode === "SCOUT") {
      currentParams.set("country", resortQuery || "Austria"); 
      currentParams.set("phase", "resorts");
      Object.entries(radarStats).forEach(([key, val]) => {
        currentParams.set(`pref_${key}`, val.toString());
      });
      currentParams.delete("target_resort");
      router.push(`/trip-planner?${currentParams.toString()}`);
    } else {
      // DIRECT OVERRIDE MODE:
      // 1. We must find the resort ID and create a Leg so BucketList works!
      if (tripId && resortQuery) {
        try {
          // Fetch all resorts to find the matching ID
          const resortsRes = await fetch("http://localhost:8000/api/resorts");
          const dbResorts = await resortsRes.json();
          const matchedResort = dbResorts.find((r: any) => r.name.toLowerCase() === resortQuery.toLowerCase());

          if (matchedResort) {
            // CREATE THE LEG!
            await fetch(`http://127.0.0.1:8000/api/trips/${tripId}/legs`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resort_id: matchedResort.id, order_index: 0 }) // Appends to the trip
            });
          }
        } catch (err) {
          console.error("Failed to create leg during Direct Override:", err);
        }
      }

      // 2. Route the user
      currentParams.set("country", "Known");
      currentParams.set("target_resort", resortQuery);
      currentParams.set("phase", "accommodation"); 
      router.push(`/trip-planner?${currentParams.toString()}`);
    }
  }

  // --- RADAR MATH (Unchanged) ---
  const centerX = 150; const centerY = 150; const maxRadius = 100;
  function getPointCoordinates(index: number, value: number) {
    const angle = (Math.PI * 2 * index) / RADAR_AXES.length - Math.PI / 2;
    const radius = (value / 5) * maxRadius;
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  }
  const polygonPoints = RADAR_AXES.map((axis, i) => `${getPointCoordinates(i, radarStats[axis.key]).x},${getPointCoordinates(i, radarStats[axis.key]).y}`).join(" ");

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draggingAxis || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    const dist = Math.sqrt(Math.pow(svgP.x - centerX, 2) + Math.pow(svgP.y - centerY, 2));
    let newValue = Math.round((dist / maxRadius) * 5);
    newValue = Math.max(1, Math.min(5, newValue));
    setRadarStats(prev => ({ ...prev, [draggingAxis]: newValue }));
  }
  function handlePointerUp() { setDraggingAxis(null); }

  return (
    <form onSubmit={handleSearch} className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-xl shadow-2xl relative z-50 overflow-visible">
      
      <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
        <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">PHASE_01 // TARGET_SELECTION</label>
      </div>
      
      {/* MODE TOGGLE - MADE VERY CLEAR */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <button type="button" onClick={() => setMode("SCOUT")} className={`flex-1 p-6 flex flex-col items-center justify-center gap-2 border-2 rounded-lg transition-all ${mode === "SCOUT" ? "bg-cyan-950/50 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]" : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-cyan-900"}`}>
          <span className="text-2xl">🤖</span>
          <span className="font-bold tracking-widest uppercase text-sm">AI SCOUT MODE</span>
          <span className="text-[10px] text-center px-4">Find me the perfect resort based on my vibe and preferences.</span>
        </button>
        <button type="button" onClick={() => setMode("DIRECT")} className={`flex-1 p-6 flex flex-col items-center justify-center gap-2 border-2 rounded-lg transition-all ${mode === "DIRECT" ? "bg-purple-950/50 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.2)]" : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-purple-900"}`}>
          <span className="text-2xl">🎯</span>
          <span className="font-bold tracking-widest uppercase text-sm">DIRECT OVERRIDE</span>
          <span className="text-[10px] text-center px-4">I already know exactly which resort I am going to.</span>
        </button>
      </div>

      <div className="space-y-6">
        <div className="relative" ref={dropdownRef}>
          <label className={`block text-xs font-bold mb-2 uppercase tracking-widest ${mode === "DIRECT" ? "text-purple-500" : "text-cyan-500"}`}>
            {mode === "SCOUT" ? "TARGET_COUNTRY / REGION" : "EXACT_RESORT_NAME"}
          </label>
          <input 
            name="search_query" 
            type="text" 
            value={resortQuery}
            onChange={mode === "DIRECT" ? handleResortInputChange : (e) => setResortQuery(e.target.value)}
            onFocus={() => { if (mode === "DIRECT" && autocompleteResults.length > 0) setShowDropdown(true); }}
            placeholder={mode === "SCOUT" ? "e.g. Austria, France, Rockies..." : "Start typing exact name..."} 
            className={`w-full bg-slate-950/50 border text-white placeholder-slate-600 p-4 rounded-md focus:outline-none transition-colors text-lg ${mode === "DIRECT" ? "border-purple-500/50 focus:border-purple-500" : "border-slate-700 focus:border-cyan-500"}`} 
            required 
            autoComplete="off"
          />
          {mode === "DIRECT" && showDropdown && autocompleteResults.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-slate-900 border border-purple-500/50 rounded-md shadow-2xl max-h-60 overflow-y-auto">
              {autocompleteResults.map((resort, idx) => (
                <li key={idx} className="p-3 text-sm text-slate-300 hover:bg-purple-900/50 hover:text-white cursor-pointer border-b border-slate-800 last:border-0" onClick={() => { setResortQuery(resort); setShowDropdown(false); }}>
                  {resort}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Radar chart only shows in SCOUT mode */}
        {mode === "SCOUT" && (
          <div className="flex flex-col items-center bg-slate-950 border border-slate-800 p-6 rounded-md">
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mb-4">DRAG_NODES_TO_CALIBRATE_VIBE</p>
            <svg 
              ref={svgRef} viewBox="0 0 300 300" className="w-full max-w-sm overflow-visible touch-none select-none"
              onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
            >
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {[1, 2, 3, 4, 5].map((level) => (
                <polygon key={level} points={RADAR_AXES.map((_, i) => `${getPointCoordinates(i, level).x},${getPointCoordinates(i, level).y}`).join(" ")} fill="none" stroke={level === 5 ? "#06b6d4" : "#334155"} strokeWidth={level === 5 ? 1.5 : 0.5} strokeDasharray={level < 5 ? "4 4" : "none"} />
              ))}
              {RADAR_AXES.map((_, i) => (
                <line key={`axis-${i}`} x1={centerX} y1={centerY} x2={getPointCoordinates(i, 5).x} y2={getPointCoordinates(i, 5).y} stroke="#334155" strokeWidth="1" />
              ))}
              <polygon points={polygonPoints} fill="rgba(6, 182, 212, 0.2)" stroke="#06b6d4" strokeWidth="2" filter="url(#glow)" className="transition-all duration-100 ease-out" />
              {RADAR_AXES.map((axis, i) => {
                const pt = getPointCoordinates(i, radarStats[axis.key]);
                const labelPt = getPointCoordinates(i, 6.2);
                const isDragging = draggingAxis === axis.key;
                return (
                  <g key={`node-${axis.key}`}>
                    <text x={labelPt.x} y={labelPt.y} fill={isDragging ? "#fff" : "#94a3b8"} fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" className="uppercase tracking-widest pointer-events-none">{axis.label}</text>
                    <text x={pt.x} y={pt.y - 12} fill="#06b6d4" fontSize="10" fontWeight="bold" textAnchor="middle" className={`pointer-events-none ${isDragging ? 'opacity-100' : 'opacity-0'}`}>{radarStats[axis.key]}</text>
                    <circle cx={pt.x} cy={pt.y} r={isDragging ? 8 : 6} fill={isDragging ? "#fff" : "#0f172a"} stroke="#06b6d4" strokeWidth={isDragging ? "3" : "2"} filter="url(#glow)" className="cursor-pointer hover:fill-cyan-500" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDraggingAxis(axis.key); }} />
                    <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" className="cursor-pointer" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDraggingAxis(axis.key); }} />
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <button type="submit" className={`w-full font-black tracking-widest uppercase text-lg py-4 rounded-md transition-all ${mode === "DIRECT" ? "bg-purple-600 hover:bg-purple-500 text-slate-950 shadow-[0_0_15px_rgba(147,51,234,0.4)]" : "bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"}`}>
          {mode === "SCOUT" ? "INITIATE_AI_SCOUT" : "LOCK_TARGET"}
        </button>
      </div>
    </form>
  );
}