"use client";

import Link from "next/link";
import MapOverlayModule from "../components/MapOverlayModule";
import MyResortsModule from "../components/MyResortsModule";
import ResortWeatherCard from "../components/ResortWeatherCard";
import NewsIntelWidget from "../components/NewsIntelWidget"; // <-- ADDED IMPORT
import { useSearch } from "../context/SearchContext";
import { useEffect, useState } from "react";

// --- HELPER: WMO WEATHER CODE TRANSLATOR ---
function getWeatherStatus(code: number) {
  if (code === 0) return { icon: "☀️", label: "CLEAR_SKY" };
  if (code === 1 || code === 2) return { icon: "⛅", label: "PARTLY_CLOUDY" };
  if (code === 3) return { icon: "☁️", label: "OVERCAST" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "FOG_DETECTED" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "🌧️", label: "PRECIP_RAIN" };
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { icon: "🌨️", label: "PRECIP_SNOW" };
  if (code >= 95) return { icon: "⛈️", label: "STORM_WARNING" };
  return { icon: "📡", label: "CALIBRATING..." };
}

// Define the interface based on what the AI returns + enriched fields
interface HotResort {
  name: string;
  metric: string;
  condition: string;
  color: string;
  border: string;
  temp?: number;
  isSnowing?: boolean;
  lastSnowDate?: string;
  lastSnowAmount?: number;
  weatherLabel?: string;
  weatherIcon?: string;
}

export default function GlobalTelemetryHub() {
  const { userId } = useSearch();
  
  const [hotResorts, setHotResorts] = useState<HotResort[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(true);

  const fetchTrendingResorts = async (force: boolean = false) => {
    setIsRefreshing(true);
    try {
      const endpoint = force 
        ? "http://localhost:8000/api/telemetry/trending?force=true" 
        : "http://localhost:8000/api/telemetry/trending";
        
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        // Just set the raw AI data. The Card component will handle the weather fetching!
        setHotResorts(data.resorts || []);
      }
    } catch (err) {
      console.error("Failed to load trending resorts", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrendingResorts(false);
  }, []);

  // Determine the primary target for our intelligence feed
  const primaryTarget = hotResorts.length > 0 ? hotResorts[0].name : "";

  return (
    <main className="min-h-screen relative bg-[url('/resort_background_img.png')] bg-cover bg-center bg-fixed text-slate-800 font-mono selection:bg-cyan-500 selection:text-white pb-20">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[3px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-cyan-950/20 pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8 pt-10 px-6 md:px-12 flex flex-col">

        {/* --- MAIN HERO GRID: Map (Left) + Target Lists (Right) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-down delay-100">
          
          {/* Global Map Module */}
          <div className="lg:col-span-2 w-full h-[60vh] lg:h-[80vh] min-h-[700px] flex flex-col relative group border border-slate-700 rounded-md overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-cyan-500/5 blur-xl group-hover:bg-cyan-500/10 transition-colors pointer-events-none -z-10"></div>
            <div className="flex-1 w-full h-full">
              <MapOverlayModule fullHeight={true} />
            </div>
          </div>

          {/* Right Sidebar: My Resorts & Hot Resorts */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-[60vh] lg:h-[80vh] min-h-[700px]">
            
            {/* MY RESORTS */}
            <div className="flex-[1.2] overflow-hidden flex flex-col">
              <MyResortsModule userId={userId} />
            </div>

            {/* HOT RESORTS */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 border-l-2 border-l-orange-500 p-6 rounded-md shadow-lg flex-1 flex flex-col overflow-hidden relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange-500/10 to-transparent pointer-events-none"></div>
              
              <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>[!] HIGH_PRIORITY</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fetchTrendingResorts(true)}  
                    disabled={isRefreshing}
                    className={`text-xs border border-orange-900 px-2 py-0.5 hover:bg-orange-500 hover:text-slate-950 transition-colors ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}`}
                    title="Run AI Web Scrape"
                  >
                    {isRefreshing ? "SCANNING..." : "↻ RESCAN"}
                  </button>
                  <span className="text-[10px] bg-orange-950/50 text-orange-400 px-2 py-0.5 border border-orange-900 rounded-sm animate-pulse">BOOMING</span>
                </div>
              </h3>
              
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                {isRefreshing && hotResorts.length === 0 ? (
                  <div className="text-center text-orange-500/50 text-xs py-8 animate-pulse">
                    DEPLOYING AGENTS...
                  </div>
                ) : (
                  hotResorts.map((resort, idx) => (
                    <ResortWeatherCard
                      key={idx}
                      name={resort.name}
                      href={`/resort-center/${encodeURIComponent(resort.name)}`}
                      aiData={{
                        metric: resort.metric,
                        condition: resort.condition,
                        color: resort.color,
                        border: resort.border
                      }}
                    />
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
        
        {/* --- LOWER INTELLIGENCE MODULES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-down delay-200">
          
          {/* --- DYNAMIC NEWS INTELLIGENCE (Replaces the static block) --- */}
          <div className="md:col-span-2 flex flex-col relative">
            {primaryTarget && (
              <div className="absolute -top-3 left-4 bg-yellow-500 text-slate-950 text-[10px] font-bold px-2 py-1 z-20 tracking-widest">
                TARGET_LOCK: {primaryTarget.toUpperCase()}
              </div>
            )}
            <NewsIntelWidget resortName={primaryTarget} />
          </div>
          
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-red-500 p-6 rounded-md shadow-lg space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest mb-4">EXPERT_TOOLS</h3>
              <ul className="text-slate-300 text-sm space-y-3">
                <li className="flex items-center justify-between group cursor-pointer border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> COULOIR_MAPS</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-red-400 transition-colors">ACCESS ↗</span>
                </li>
                <li className="flex items-center justify-between group cursor-pointer border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> EPIC_RUNS_LOG</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-red-400 transition-colors">ACCESS ↗</span>
                </li>
                <li className="flex items-center justify-between group cursor-pointer border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> LAWINE_GEFAHR_LIVE</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-red-400 transition-colors">ACCESS ↗</span>
                </li>
              </ul>
            </div>
            <button className="w-full bg-red-950/30 border border-red-900 text-red-500 hover:bg-red-900 hover:text-slate-950 transition-all font-bold tracking-widest text-[10px] uppercase py-2">
              INITIATE_DISTRESS_BEACON
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}