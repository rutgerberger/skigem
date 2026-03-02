"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

// The 6 axes of our radar chart
const RADAR_AXES = [
  { key: "pisteKms", label: "PISTE_KMS" },
  { key: "apres", label: "APRÈS-SKI" },
  { key: "offPiste", label: "OFF-PISTE" },
  { key: "snow", label: "SNOW_SURE" },
  { key: "family", label: "FAMILY" },
  { key: "quiet", label: "QUIET_SLOPES" }
] as const;

type RadarData = Record<typeof RADAR_AXES[number]["key"], number>;

// --- ADD THE PROP INTERFACE HERE ---
interface DataSearchProps {
  defaultExpanded?: boolean;
}

export default function DataSearchModule({ defaultExpanded = false }: DataSearchProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"SCOUT" | "DIRECT">("SCOUT");
  
  // Standard Search State
  const [resortQuery, setResortQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // --- SET INITIAL STATE USING THE PROP ---
  const [showAdvanced, setShowAdvanced] = useState(defaultExpanded);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- RADAR CHART STATE ---
  const [radarStats, setRadarStats] = useState<RadarData>({
    pisteKms: 3,
    apres: 3,
    offPiste: 3,
    snow: 4,
    family: 2,
    quiet: 3
  });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingAxis, setDraggingAxis] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
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
      } catch (err) {
        console.error("Uplink failed:", err);
      }
    } else {
      setAutocompleteResults([]);
      setShowDropdown(false);
    }
  }

  function handleSelectResort(resortName: string) {
    setResortQuery(resortName);
    setShowDropdown(false);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams({
      budget: (formData.get("budget") as string) || "150",
      guests: (formData.get("guests") as string) || "4",
      requirements: (formData.get("requirements") as string) || "",
    });

    if (mode === "SCOUT") {
      params.append("country", resortQuery || "Austria"); 
      params.append("phase", "resorts");
      // Append the radar stats to the search query!
      Object.entries(radarStats).forEach(([key, val]) => {
        params.append(`pref_${key}`, val.toString());
      });
      router.push(`/trip-planner?${params.toString()}`);
    } else {
      params.append("country", "Known");
      params.append("target_resort", resortQuery);
      params.append("phase", "chalets");
      router.push(`/trip-planner?${params.toString()}`);
    }
  }

  // --- RADAR CHART MATH & LOGIC ---
  const centerX = 150;
  const centerY = 150;
  const maxRadius = 100;

  function getPointCoordinates(index: number, value: number) {
    const angle = (Math.PI * 2 * index) / RADAR_AXES.length - Math.PI / 2;
    const radius = (value / 5) * maxRadius;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  }

  // Generate the path for the filled area
  const polygonPoints = RADAR_AXES.map((axis, i) => {
    const pt = getPointCoordinates(i, radarStats[axis.key]);
    return `${pt.x},${pt.y}`;
  }).join(" ");

  // Handle Dragging
  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draggingAxis || !svgRef.current) return;

    // Translate screen coords to SVG internal coords
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());

    // Calculate distance from center
    const dist = Math.sqrt(Math.pow(svgP.x - centerX, 2) + Math.pow(svgP.y - centerY, 2));
    
    // Map distance (0 to maxRadius) to our 1-5 scale
    let newValue = Math.round((dist / maxRadius) * 5);
    newValue = Math.max(1, Math.min(5, newValue)); // Clamp between 1 and 5

    setRadarStats(prev => ({ ...prev, [draggingAxis]: newValue }));
  }

  function handlePointerUp() {
    setDraggingAxis(null);
  }

  return (
    <form onSubmit={handleSearch} className="bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-10 rounded-xl shadow-2xl relative z-50 overflow-visible">
      <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        <div className="md:col-span-2 flex justify-between items-end">
          <label className="block text-xs font-bold text-cyan-500 uppercase tracking-widest">MODULE: DATA_SEARCH</label>
        </div>
        
        <div className="flex gap-4 md:col-span-2">
          <button type="button" onClick={() => setMode("SCOUT")} className={`flex-1 py-2 text-sm font-bold tracking-widest uppercase transition-all border ${mode === "SCOUT" ? "bg-cyan-500 text-slate-950 border-cyan-500" : "bg-transparent text-cyan-500/50 border-cyan-500/30 hover:bg-cyan-900/30"}`}>
            AI_SCOUT_MODE
          </button>
          <button type="button" onClick={() => setMode("DIRECT")} className={`flex-1 py-2 text-sm font-bold tracking-widest uppercase transition-all border ${mode === "DIRECT" ? "bg-purple-500 text-slate-950 border-purple-500" : "bg-transparent text-purple-500/50 border-purple-500/30 hover:bg-purple-900/30"}`}>
            DIRECT_OVERRIDE
          </button>
        </div>

        <div className="relative md:col-span-2" ref={dropdownRef}>
          <label className={`block text-xs font-bold mb-2 uppercase tracking-widest ${mode === "DIRECT" ? "text-purple-500" : "text-cyan-500"}`}>
            {mode === "SCOUT" ? "TARGET_COUNTRY" : "EXACT_RESORT"}
          </label>
          <input 
            name="search_query" 
            type="text" 
            value={resortQuery}
            onChange={mode === "DIRECT" ? handleResortInputChange : (e) => setResortQuery(e.target.value)}
            onFocus={() => { if (mode === "DIRECT" && autocompleteResults.length > 0) setShowDropdown(true); }}
            placeholder={mode === "SCOUT" ? "e.g. Austria" : "Type for exact match..."} 
            className={`w-full bg-slate-950/50 border text-slate-200 placeholder-slate-600 p-4 rounded-md focus:ring-1 focus:outline-none transition-colors shadow-inner ${mode === "DIRECT" ? "border-purple-500/50 focus:ring-purple-500 focus:border-purple-500" : "border-slate-700 focus:ring-cyan-500 focus:border-cyan-500"}`} 
            required 
            autoComplete="off"
          />
          {mode === "DIRECT" && showDropdown && autocompleteResults.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-slate-900 border border-purple-500/50 rounded-md shadow-2xl max-h-60 overflow-y-auto">
              {autocompleteResults.map((resort, idx) => (
                <li key={idx} className="p-3 text-sm text-slate-300 hover:bg-purple-900/50 hover:text-white cursor-pointer transition-colors border-b border-slate-800 last:border-0" onClick={() => handleSelectResort(resort)}>
                  {resort}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2 flex justify-end mt-2">
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors">
            {showAdvanced ? "[-] HIDE_AUX_PARAMS" : "[+] EXPAND_AUX_PARAMS"}
          </button>
        </div>

        {/* --- ADVANCED SETTINGS & RADAR CHART --- */}
        {showAdvanced && (
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 animate-fade-in-down border-t border-slate-800 pt-6">
            
            {/* Radar chart only shows in SCOUT mode, but now lives INSIDE the advanced dropdown */}
            {mode === "SCOUT" && (
              <div className="md:col-span-2 flex flex-col items-center bg-slate-950/50 border border-cyan-500/20 p-6 rounded-md shadow-inner mb-2">
                <p className="text-xs text-cyan-500 font-bold tracking-widest uppercase mb-4 text-center w-full border-b border-cyan-500/20 pb-2">
                  EXPEDITION_FINGERPRINT // DRAG_NODES_TO_CALIBRATE
                </p>
                
                <svg 
                  ref={svgRef}
                  viewBox="0 0 300 300" 
                  className="w-full max-w-sm overflow-visible touch-none select-none"
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <defs>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Background Web (Grid lines 1 to 5) */}
                  {[1, 2, 3, 4, 5].map((level) => (
                    <polygon
                      key={level}
                      points={RADAR_AXES.map((_, i) => {
                        const pt = getPointCoordinates(i, level);
                        return `${pt.x},${pt.y}`;
                      }).join(" ")}
                      fill="none"
                      stroke={level === 5 ? "#06b6d4" : "#334155"}
                      strokeWidth={level === 5 ? 1.5 : 0.5}
                      strokeDasharray={level < 5 ? "4 4" : "none"}
                    />
                  ))}

                  {/* Axis Lines from Center */}
                  {RADAR_AXES.map((_, i) => {
                    const pt = getPointCoordinates(i, 5);
                    return (
                      <line 
                        key={`axis-${i}`} 
                        x1={centerX} y1={centerY} x2={pt.x} y2={pt.y} 
                        stroke="#334155" strokeWidth="1" 
                      />
                    );
                  })}

                  {/* The Data Polygon */}
                  <polygon
                    points={polygonPoints}
                    fill="rgba(6, 182, 212, 0.2)"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    filter="url(#glow)"
                    className="transition-all duration-100 ease-out"
                  />

                  {/* Draggable Nodes & Labels */}
                  {RADAR_AXES.map((axis, i) => {
                    const pt = getPointCoordinates(i, radarStats[axis.key]);
                    const labelPt = getPointCoordinates(i, 6.2); // Push label slightly outside the 5 ring
                    const isDragging = draggingAxis === axis.key;

                    return (
                      <g key={`node-${axis.key}`}>
                        {/* Axis Label */}
                        <text
                          x={labelPt.x}
                          y={labelPt.y}
                          fill={isDragging ? "#fff" : "#94a3b8"}
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="uppercase tracking-widest transition-colors select-none pointer-events-none"
                        >
                          {axis.label}
                        </text>
                        
                        {/* Value Indicator (pops up when dragging) */}
                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          fill="#06b6d4"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                          className={`transition-opacity pointer-events-none ${isDragging ? 'opacity-100' : 'opacity-0'}`}
                        >
                          {radarStats[axis.key]}
                        </text>

                        {/* Interactive Node */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isDragging ? 8 : 6}
                          fill={isDragging ? "#fff" : "#0f172a"}
                          stroke="#06b6d4"
                          strokeWidth={isDragging ? "3" : "2"}
                          filter="url(#glow)"
                          className="cursor-pointer transition-all duration-75 hover:fill-cyan-500"
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId); // Keep tracking if mouse leaves circle slightly
                            setDraggingAxis(axis.key);
                          }}
                        />
                        
                        {/* Invisible larger hit-target for easier grabbing */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="16"
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            setDraggingAxis(axis.key);
                          }}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}

            <div>
              <label className={`block text-xs font-bold mb-2 uppercase tracking-widest ${mode === "DIRECT" ? "text-purple-500" : "text-cyan-500"}`}>MAX_BUDGET_EUR</label>
              <input name="budget" type="number" defaultValue={150} className={`w-full bg-slate-950/50 border border-slate-700 text-slate-200 placeholder-slate-600 p-4 rounded-md focus:ring-1 focus:outline-none transition-colors shadow-inner ${mode === "DIRECT" ? "focus:ring-purple-500 focus:border-purple-500" : "focus:ring-cyan-500 focus:border-cyan-500"}`} />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-2 uppercase tracking-widest ${mode === "DIRECT" ? "text-purple-500" : "text-cyan-500"}`}>GUEST_COUNT</label>
              <input name="guests" type="number" defaultValue={4} min={1} className={`w-full bg-slate-950/50 border border-slate-700 text-slate-200 placeholder-slate-600 p-4 rounded-md focus:ring-1 focus:outline-none transition-colors shadow-inner ${mode === "DIRECT" ? "focus:ring-purple-500 focus:border-purple-500" : "focus:ring-cyan-500 focus:border-cyan-500"}`} />
            </div>
            <div className="md:col-span-2">
              <label className={`block text-xs font-bold mb-2 uppercase tracking-widest ${mode === "DIRECT" ? "text-purple-500" : "text-cyan-500"}`}>SPECIAL_REQUIREMENTS</label>
              <input name="requirements" type="text" placeholder="e.g. sauna, fireplace, ski-in/ski-out..." className={`w-full bg-slate-950/50 border border-slate-700 text-slate-200 placeholder-slate-600 p-4 rounded-md focus:ring-1 focus:outline-none transition-colors shadow-inner ${mode === "DIRECT" ? "focus:ring-purple-500 focus:border-purple-500" : "focus:ring-cyan-500 focus:border-cyan-500"}`} />
            </div>
          </div>
        )}
        
        <div className="md:col-span-2 pt-4">
          <button type="submit" className={`w-full font-black tracking-widest uppercase text-lg py-4 rounded-md transition-all flex justify-center items-center gap-2 ${mode === "DIRECT" ? "bg-purple-600 hover:bg-purple-500 text-slate-950 shadow-[0_0_15px_rgba(147,51,234,0.4)]" : "bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"}`}>
            {mode === "SCOUT" ? "EXECUTE_SCOUT" : "BYPASS_&_HUNT"}
          </button>
        </div>
      </div>
    </form>
  );
}