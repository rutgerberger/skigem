"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Import your existing modules
import DataSearchModule from "../components/DataSearchModule";
import ResortsBriefing from "./ResortsBriefing"; 
import ChaletHunters from "./ChaletHunters";

// --- NEW IMPORT ---
import MissionLaunchpad from "../components/MissionLaunchpad";

function TripPlannerOrchestrator() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL-driven state logic
  const tripId = searchParams.get("trip_id");
  const targetResort = searchParams.get("target_resort");
  const phaseParam = searchParams.get("phase");

  // Determine current phase based on trip_id existence
  let currentPhase = "LAUNCH";
  if (tripId) {
    if (phaseParam === "chalets" || targetResort) currentPhase = "CHALETS";
    else if (phaseParam === "resorts") currentPhase = "RESORTS";
    else currentPhase = "INIT";
  }

  // Navigation Handlers (Preserving the trip_id when jumping around)
  const jumpToInit = () => router.push(`/trip-planner?trip_id=${tripId}`);
  const jumpToResorts = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("target_resort"); // Drop the exact resort
    params.set("phase", "resorts"); // Reset phase
    router.push(`/trip-planner?${params.toString()}`);
  };

  // --- RENDER PHASE 0: THE LAUNCHPAD ---
  if (currentPhase === "LAUNCH") {
    return <MissionLaunchpad />;
  }

  // --- RENDER PHASES 1-3: THE ORCHESTRATOR ---
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col bg-[url('/resort_background_img.png')] bg-cover bg-center bg-fixed font-mono selection:bg-cyan-500 selection:text-white">
      
      {/* MISSION STEPPER NAV */}
      <div className="w-full bg-slate-900/80 border-b border-slate-800 pt-10 p-4 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center gap-2 md:gap-4 text-[10px] md:text-xs font-mono font-bold uppercase tracking-widest overflow-x-auto whitespace-nowrap custom-scrollbar pb-1">
          
          <button onClick={jumpToInit} className={`px-4 py-2 border transition-all ${currentPhase === "INIT" ? "border-cyan-500 text-cyan-400 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]" : "border-slate-800 text-slate-500 hover:text-cyan-500 hover:border-cyan-900"}`}>
            01 // SEARCH_PARAMETERS
          </button>
          <span className="text-slate-700">&gt;&gt;</span>
          
          <button onClick={currentPhase === "CHALETS" || currentPhase === "RESORTS" ? jumpToResorts : undefined} className={`px-4 py-2 border transition-all ${currentPhase === "RESORTS" ? "border-cyan-500 text-cyan-400 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]" : currentPhase === "CHALETS" ? "border-slate-800 text-slate-400 hover:text-cyan-500 hover:border-cyan-900 cursor-pointer" : "border-slate-800/50 text-slate-700 cursor-not-allowed"}`}>
            02 // TARGET_RESORTS
          </button>
          <span className="text-slate-700">&gt;&gt;</span>
          
          <div className={`px-4 py-2 border transition-all ${currentPhase === "CHALETS" ? "border-purple-500 text-purple-400 bg-purple-950/30 shadow-[0_0_10px_rgba(147,51,234,0.2)]" : "border-slate-800/50 text-slate-700"}`}>
            03 // BASECAMP_HUNT
          </div>
        </div>
      </div>

      {/* RENDER THE CORRECT MODULE */}
      <div className="flex-1 relative">
        {currentPhase === "INIT" && (
          <div className="max-w-4xl mx-auto px-6 py-12 animate-fade-in-down">
            {/* The tripId can now be read by DataSearchModule if you need it to attach things! */}
            <DataSearchModule defaultExpanded={true} />
          </div>
        )}
        {currentPhase === "RESORTS" && <ResortsBriefing />}
        {currentPhase === "CHALETS" && <ChaletHunters />}
      </div>
    </div>
  );
}

// Next.js requires useSearchParams to be wrapped in Suspense
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