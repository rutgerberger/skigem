// --- app/trip-planner/MissionReview.tsx ---
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function MissionReview() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const tripId = searchParams.get("trip_id");
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Editable fields
  const [missionName, setMissionName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!tripId) return;
    fetch(`http://127.0.0.1:8000/api/trips/${tripId}`)
      .then(res => res.json())
      .then(data => {
        setTrip(data);
        // Pre-fill editable fields. If it's a dummy name, maybe clear it or leave it as a suggestion.
        setMissionName(data.name.includes("CLASSIFIED_OP_") ? "" : data.name);
        setStartDate(data.start_date || "");
        setEndDate(data.end_date || "");
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [tripId]);

  const handleCommit = async () => {
    if (!missionName) {
      alert("Please provide a Mission Codename before committing.");
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. Update the database with the finalized name and dates
      await fetch(`http://127.0.0.1:8000/api/trips/${tripId}`, {
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: missionName,
          start_date: startDate || null,
          end_date: endDate || null
        })
      });

      // 2. Redirect to the actual trip hub page
      router.push(`/my-trips/${tripId}`);
    } catch (err) {
      console.error("Failed to commit final details:", err);
      setIsProcessing(false);
    }
  };

  const handleAbort = async () => {
    if (!confirm("CRITICAL WARNING: This will permanently erase the mission and all gathered intel. Proceed?")) return;
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trips/${tripId}`, { method: "DELETE" });
      router.push("/trip-planner"); 
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  const handleInvite = () => {
    const dummyUrl = `https://skigem.com/invite/msn-${tripId}-${Math.random().toString(36).substring(2, 8)}`;
    navigator.clipboard.writeText(dummyUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center pt-32 gap-4 animate-fade-in-down">
        <div className="text-5xl animate-pulse drop-shadow-sm">📋</div>
        <div className="text-cyan-500 text-xl font-bold text-center px-4 tracking-widest uppercase">
          COMPILING_MISSION_DOSSIER...
        </div>
      </div>
    );
  }

  if (!trip) {
    return <div className="text-red-500 text-center mt-20 uppercase tracking-widest font-bold">ERROR: MISSION_DOSSIER_NOT_FOUND</div>;
  }

  return (
    <div className="max-w-4xl mx-auto w-full mt-10 animate-fade-in-down pb-20">
      
      <p className="text-slate-500 text-xs uppercase tracking-[0.3em] mb-4">PHASE_03 // FINALIZE_INTEL</p>
      
      {/* HEADER / EDITABLE FORMS */}
      <div className="bg-slate-900/80 border border-slate-700 p-6 rounded-lg mb-8 shadow-xl">
        <div className="space-y-6">
          
          <div className="space-y-2">
            <label className="text-[10px] text-blue-400 tracking-[0.2em] uppercase font-bold">Mission_Codename</label>
            <input 
              type="text" 
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              placeholder="e.g., OPERATION_POWDER_HOUND"
              className="w-full bg-slate-950 border border-slate-700 text-white p-4 focus:border-blue-500 outline-none transition-all text-xl tracking-widest uppercase placeholder:text-slate-700 font-black"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 tracking-[0.2em] uppercase font-bold">Start_Window</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-3 focus:border-blue-500 outline-none transition-all text-sm uppercase [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 tracking-[0.2em] uppercase font-bold">End_Window</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-300 p-3 focus:border-blue-500 outline-none transition-all text-sm uppercase [color-scheme:dark]"
              />
            </div>
          </div>

        </div>
      </div>

      {/* WAYPOINTS OVERVIEW */}
      <div className="space-y-4 mb-10">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2">LOCKED_WAYPOINTS ({trip.legs?.length || 0})</h3>
        
        {trip.legs?.length === 0 ? (
          <div className="bg-slate-900/50 border border-dashed border-slate-700 p-8 text-center text-slate-500 tracking-widest text-xs uppercase">
            NO_WAYPOINTS_ASSIGNED. MISSION_IS_EMPTY.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trip.legs.map((leg: any, idx: number) => (
              <div key={leg.id} className="bg-slate-900/80 border border-slate-700 p-5 rounded-md relative flex flex-col hover:border-blue-500/30 transition-colors">
                <div className="absolute top-0 right-0 bg-slate-950 text-slate-500 text-[10px] px-2 py-1 border-b border-l border-slate-700 font-bold">
                  LEG_0{idx + 1}
                </div>
                <h4 className="text-cyan-400 font-bold text-lg uppercase tracking-widest mb-1 pr-12">{leg.resort?.name}</h4>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                    <span className="text-slate-500">BASECAMP:</span>
                    <span className={`font-bold uppercase tracking-widest max-w-[150px] truncate ${leg.chalet ? 'text-purple-400' : 'text-red-500/70'}`}>
                      {leg.chalet ? leg.chalet.chalet_name : 'UNASSIGNED'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                    <span className="text-slate-500">TARGETS:</span>
                    <span className="font-bold text-emerald-400 tracking-widest">{leg.bucket_items?.length || 0} SECURED</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="bg-slate-900/90 border border-blue-500/30 p-6 md:p-8 rounded-lg shadow-2xl">
        <h3 className="text-center text-blue-500 font-bold tracking-widest mb-6 uppercase border-b border-blue-500/20 pb-4">
          AWAITING_FINAL_AUTHORIZATION
        </h3>
        
        <div className="flex flex-col md:flex-row gap-4">
          
          <button 
            onClick={handleAbort}
            disabled={isProcessing}
            className="flex-1 py-4 border border-red-900/50 text-red-500 hover:bg-red-950/50 hover:border-red-500 transition-all font-black tracking-widest text-sm uppercase disabled:opacity-50"
          >
            [X] ABORT_&_ERASE
          </button>

          <button 
            onClick={handleInvite}
            disabled={isProcessing}
            className={`flex-1 py-4 border transition-all font-black tracking-widest text-sm uppercase disabled:opacity-50 ${
              inviteCopied 
                ? "bg-green-900/50 border-green-500 text-green-400" 
                : "border-slate-700 text-slate-300 hover:border-slate-400 hover:bg-slate-800"
            }`}
          >
            {inviteCopied ? "LINK_COPIED!" : "+ INVITE_OPERATIVES"}
          </button>

          <button 
            onClick={handleCommit}
            disabled={isProcessing || !missionName}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-slate-950 shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all font-black tracking-widest text-sm uppercase disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
          >
            {isProcessing ? "ENCRYPTING..." : "COMMIT_MISSION >>"}
          </button>

        </div>
      </div>

    </div>
  );
}