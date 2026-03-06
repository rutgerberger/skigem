"use client";
import { useState, useEffect } from "react";

export default function ResortProfileWidget({ resortId, resortName }: { resortId: number, resortName: string }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // NEW: State to control the expansion of the dossier
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchProfile = async (force = false) => {
    if (force) setIsRefreshing(true);
    try {
      const url = `http://127.0.0.1:8000/api/resorts/${resortId}/profile${force ? "?force=true" : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch (err) {
      console.error("Failed to load profile", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (resortId) fetchProfile();
  }, [resortId]);

  if (loading) return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col min-h-[250px] justify-center items-center">
       <span className="text-cyan-500 text-xs animate-pulse tracking-widest">COMPILING_TARGET_BRIEFING...</span>
    </div>
  );

  if (!profile) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col relative">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-8">
        <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
          <span>MOD_08 // TARGET_BRIEFING</span>
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => fetchProfile(true)}
            disabled={isRefreshing}
            className={`text-[9px] bg-slate-950 border border-slate-700 text-slate-500 px-3 py-1.5 hover:text-cyan-400 hover:border-cyan-900 font-bold tracking-widest transition-colors ${isRefreshing ? 'animate-pulse' : ''}`}
          >
            {isRefreshing ? "REWRITING..." : "↻ REGEN_INTEL"}
          </button>
          {profile.official_url && (
            <a 
              href={profile.official_url} 
              target="_blank" 
              rel="noreferrer"
              className="text-[9px] bg-cyan-950/30 border border-cyan-900 text-cyan-400 font-bold px-3 py-1.5 tracking-widest hover:bg-cyan-600 hover:text-white transition-colors"
            >
              OFFICIAL_SITE ↗
            </a>
          )}
        </div>
      </div>

      {/* INTELLIGENCE BLOCKS */}
      <div className="space-y-6">
        
        {/* BLOCK 1: OVERVIEW (Always Visible) */}
        <div className="relative bg-slate-950/50 border border-slate-800 border-l-2 border-l-cyan-500 p-5 rounded-r-sm group hover:bg-slate-950/80 transition-colors">
          <h3 className="absolute -top-3 left-4 bg-slate-900 text-[10px] text-cyan-400 font-bold tracking-widest uppercase px-3 py-1 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.15)] flex items-center gap-2">
            <span className="opacity-50">01 //</span> SECTOR_OVERVIEW
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed mt-1 font-sans">
            {profile.overview}
          </p>
        </div>

        {/* --- EXPAND / COLLAPSE TOGGLE --- */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-slate-700 bg-slate-950/30 hover:bg-slate-800 hover:border-cyan-900 text-slate-500 hover:text-cyan-400 transition-all text-[10px] font-bold tracking-widest uppercase"
        >
          {isExpanded ? "[-] COLLAPSE_DOSSIER" : "[+] DECRYPT_FULL_DOSSIER"}
        </button>

        {/* HIDDEN BLOCKS (Revealed when Expanded) */}
        {isExpanded && (
          <div className="space-y-8 animate-fade-in-down">
            
            {/* BLOCK 2: TERRAIN & SNOW */}
            <div className="relative bg-slate-950/50 border border-slate-800 border-l-2 border-l-blue-500 p-5 rounded-r-sm group hover:bg-slate-950/80 transition-colors mt-2">
              <h3 className="absolute -top-3 left-4 bg-slate-900 text-[10px] text-blue-400 font-bold tracking-widest uppercase px-3 py-1 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.15)] flex items-center gap-2">
                <span className="opacity-50">02 //</span> TERRAIN_ANALYSIS
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mt-1 font-sans">
                {profile.slopes}
              </p>
            </div>

            {/* BLOCK 3: ATMOSPHERE & VIBE */}
            <div className="relative bg-slate-950/50 border border-slate-800 border-l-2 border-l-purple-500 p-5 rounded-r-sm group hover:bg-slate-950/80 transition-colors">
              <h3 className="absolute -top-3 left-4 bg-slate-900 text-[10px] text-purple-400 font-bold tracking-widest uppercase px-3 py-1 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.15)] flex items-center gap-2">
                <span className="opacity-50">03 //</span> SOCIAL_ATMOSPHERE
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mt-1 font-sans">
                {profile.atmosphere}
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}