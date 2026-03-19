// --- app/trip-planner/page.tsx ---
"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Modules
import MissionLaunchpad from "../components/MissionLaunchpad";
import DataSearchModule from "../components/DataSearchModule";
import ResortsBriefing from "./ResortsBriefing"; 
import ChaletHunters from "./ChaletHunters";
import MissionTargets from "./MissionTargets";
import MissionReview from "./MissionReview"; // <--- NEW IMPORT

function TripPlannerOrchestrator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-driven state logic
  const tripId = searchParams.get("trip_id");
  const targetResort = searchParams.get("target_resort");
  const phaseParam = searchParams.get("phase");

  // Determine current phase based on URL
  let currentPhase = "LAUNCH";
  if (tripId) {
    if (phaseParam === "review") currentPhase = "REVIEW"; // <--- NEW PHASE
    else if (phaseParam === "accommodation" && targetResort) currentPhase = "ACCOMMODATION";
    else if (phaseParam === "bucketlist" && targetResort) currentPhase = "BUCKETLIST";
    else if (phaseParam === "resorts") currentPhase = "SCOUT_RESULTS";
    else currentPhase = "SEARCH_FORM"; 
  }

  // --- NAVIGATION HANDLERS ---
  const changePhase = (newPhase: string, dropResort: boolean = false) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("phase", newPhase);
    if (dropResort) {
      params.delete("target_resort");
      if (newPhase === "search") params.delete("country");
    }
    router.push(`/trip-planner?${params.toString()}`);
  };

  // --- RENDER PHASE 0: THE LAUNCHPAD ---
  if (currentPhase === "LAUNCH") {
    return <MissionLaunchpad />;
  }

  // --- RENDER PHASES 1-3: THE ORCHESTRATOR ---
  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row bg-[url('/resort_background_img.png')] bg-cover bg-center bg-fixed font-mono selection:bg-cyan-500 selection:text-white overflow-hidden">
      
      {/* LEFT SIDEBAR: MISSION CONTROL NAV */}
      <div className="w-full md:w-72 bg-slate-900/95 backdrop-blur-xl border-b md:border-b-0 md:border-r border-slate-800 flex flex-col z-40 shrink-0 shadow-2xl">
        <div className="p-6 border-b border-slate-800 bg-slate-950/50">
          <h2 className="text-cyan-500 font-black tracking-widest text-lg drop-shadow-md">TRIP_PLANNER</h2>
          <p className="text-[10px] text-slate-500 uppercase mt-1">Mission ID: {tripId}</p>
        </div>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar flex flex-col">
          {/* STAGE 01: SELECT RESORT */}
          <div className="mb-6">
            <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 px-2">PHASE_01 //</h3>
            <button 
              onClick={() => changePhase("search")}
              className={`w-full text-left px-4 py-3 border transition-all ${
                currentPhase === "SEARCH_FORM" || currentPhase === "SCOUT_RESULTS"
                  ? "border-cyan-500 text-cyan-400 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]" 
                  : "border-slate-800 text-slate-400 hover:border-cyan-900 hover:text-cyan-500 bg-slate-950/50"
              }`}
            >
              <span className="block text-xs font-bold uppercase tracking-widest">Target Selection</span>
              {targetResort ? (
                <span className="block text-[10px] text-cyan-500 mt-1 truncate">Locked: {targetResort}</span>
              ) : currentPhase === "SCOUT_RESULTS" ? (
                <span className="block text-[10px] text-cyan-400 mt-1 animate-pulse">Reviewing Intel...</span>
              ) : (
                <span className="block text-[10px] text-slate-600 mt-1">Pending search...</span>
              )}
            </button>
            
            {currentPhase === "SCOUT_RESULTS" && !targetResort && (
              <button 
                onClick={() => changePhase("search")}
                className="text-[9px] text-cyan-500/70 hover:text-cyan-400 uppercase tracking-widest mt-2 px-2 flex items-center gap-1"
              >
                [←] RECALIBRATE_SEARCH
              </button>
            )}

            {targetResort && (
              <button 
                onClick={() => changePhase("search", true)}
                className="text-[9px] text-red-500/70 hover:text-red-400 uppercase tracking-widest mt-2 px-2 flex items-center gap-1"
              >
                [X] ABORT_TARGET
              </button>
            )}
          </div>

          {/* STAGE 02: A/B BRANCHES */}
          <div className="relative mb-6">
            <div className="absolute left-6 -top-4 bottom-8 w-px bg-slate-800 z-0 hidden md:block"></div>
            <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 px-2 relative z-10">PHASE_02 //</h3>
            <div className="space-y-3 relative z-10">
              <button 
                onClick={() => targetResort && changePhase("accommodation")}
                disabled={!targetResort}
                className={`w-full text-left px-4 py-3 border transition-all ${
                  !targetResort 
                    ? "border-slate-800/50 text-slate-700 bg-slate-950/20 cursor-not-allowed" 
                    : currentPhase === "ACCOMMODATION"
                      ? "border-purple-500 text-purple-400 bg-purple-950/30 shadow-[0_0_10px_rgba(147,51,234,0.2)]"
                      : "border-slate-800 text-slate-400 hover:border-purple-900 hover:text-purple-500 bg-slate-950/50"
                }`}
              >
                <span className="block text-xs font-bold uppercase tracking-widest">2A. Basecamp Hunt</span>
              </button>

              <button 
                onClick={() => targetResort && changePhase("bucketlist")}
                disabled={!targetResort}
                className={`w-full text-left px-4 py-3 border transition-all ${
                  !targetResort 
                    ? "border-slate-800/50 text-slate-700 bg-slate-950/20 cursor-not-allowed" 
                    : currentPhase === "BUCKETLIST"
                      ? "border-emerald-500 text-emerald-400 bg-emerald-950/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      : "border-slate-800 text-slate-400 hover:border-emerald-900 hover:text-emerald-500 bg-slate-950/50"
                }`}
              >
                <span className="block text-xs font-bold uppercase tracking-widest">2B. Mission Targets</span>
              </button>
            </div>
          </div>

          {/* NEW: STAGE 03: FINAL REVIEW */}
          {targetResort && ( 
            <div className="mb-6">
               <h3 className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-2 px-2">PHASE_03 //</h3>
               <button 
                  onClick={() => changePhase("review")}
                  className={`w-full text-left px-4 py-4 border transition-all shadow-lg ${
                    currentPhase === "REVIEW"
                      ? "border-blue-500 text-blue-400 bg-blue-950/40 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                      : "border-slate-700 text-white hover:border-blue-500 hover:text-blue-400 bg-slate-900"
                  }`}
                >
                  <span className="block text-sm font-black uppercase tracking-widest">Final Review &gt;&gt;</span>
                </button>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT CONTENT AREA */}
      <div className="flex-1 relative h-full flex flex-col bg-slate-950/50">
        
        {currentPhase === "SEARCH_FORM" && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar p-4 md:p-10">
            <div className="max-w-4xl mx-auto animate-fade-in-down mt-10">
              <DataSearchModule defaultExpanded={true} />
            </div>
          </div>
        )}
        
        {currentPhase === "SCOUT_RESULTS" && (
          <div className="w-full h-full overflow-hidden animate-fade-in-down">
            <ResortsBriefing />
          </div>
        )}

        {currentPhase === "ACCOMMODATION" && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar">
            <ChaletHunters />
          </div>
        )}
        
        {currentPhase === "BUCKETLIST" && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar p-4 md:p-10">
            <MissionTargets />
          </div>
        )}

        {/* NEW: REVIEW PHASE */}
        {currentPhase === "REVIEW" && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar p-4 md:p-10">
            <MissionReview />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TripPlanner() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-500 font-mono text-sm tracking-widest animate-pulse">
        INITIALIZING_TRIP_PLANNER_ORCHESTRATOR...
      </div>
    }>
      <TripPlannerOrchestrator />
    </Suspense>
  );
}