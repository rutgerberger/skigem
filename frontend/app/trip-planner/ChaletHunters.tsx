"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSearch } from "../context/SearchContext";
import { Chalet } from "../../types";

export default function ChaletHunters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const { userId, chalets, setChalets, lastChaletCriteria, setLastChaletCriteria } = useSearch();
  const [loading, setLoading] = useState(true);

  // FIX 1: Decoupled State
  const [savedToArchive, setSavedToArchive] = useState<Set<string>>(new Set());
  const [savedToMission, setSavedToMission] = useState<Set<string>>(new Set());
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "up" | "down">>({});

  const hasFetched = useRef<string | null>(null);
  const targetResort = searchParams.get("target_resort");
  const country = searchParams.get("country");
  const isDirectOverride = country === "Known";

  // Modal & Trip State
  const [dbResorts, setDbResorts] = useState<any[]>([]);
  const [userTrips, setUserTrips] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedChalet, setSelectedChalet] = useState<Chalet | null>(null);
  
  // FIX 2: 2-Step Modal State
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [newTripName, setNewTripName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/api/resorts")
      .then(res => res.json())
      .then(data => setDbResorts(data))
      .catch(err => console.error("Failed to load DB resorts", err));
  }, []);

  useEffect(() => {
    if (!targetResort) return;

    const payload = {
      target_resort: targetResort,
      user_id: userId,
      criteria: {
        country: country || "Unknown",
        min_slope_length_km: parseInt(searchParams.get("min_slope") || "0"),
        max_budget_per_night: parseFloat(searchParams.get("budget") || "0"),
        lift_proximity_m: parseInt(searchParams.get("proximity") || "0"),
        number_of_guests: parseInt(searchParams.get("guests") || "1"),
        additional_requirements: searchParams.get("requirements") || null,
      }
    };
    
    const currentCriteria = JSON.stringify(payload);

    if (lastChaletCriteria === currentCriteria && chalets.length > 0) {
      setLoading(false);
      return;
    }

    if (hasFetched.current === currentCriteria) return;
    hasFetched.current = currentCriteria;

    async function huntChalets() {
      setLoading(true);
      try {
        const endpoint = isDirectOverride 
          ? "http://127.0.0.1:8000/api/hunt_direct" 
          : "http://127.0.0.1:8000/api/search/chalets";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          setChalets([]);
          return;
        }

        setChalets(data.chalets || []);
        setLastChaletCriteria(currentCriteria);

      } catch (err) {
        setChalets([]);
        hasFetched.current = null;
      } finally {
        setLoading(false);
      }
    }

    huntChalets();
  }, [searchParams, targetResort, country, isDirectOverride, setChalets, setLastChaletCriteria, lastChaletCriteria, chalets.length, userId]);

  const generateMockId = (name: string) => Math.abs(name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));

  async function handleSaveToArchive(chalet: Chalet) {
    if (!userId || !targetResort) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/chalets/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, resort_name: targetResort, chalet: chalet }),
      });
      if (res.ok) setSavedToArchive(prev => new Set(prev).add(chalet.name));
    } catch (err) {
      console.error("Failed to save chalet:", err);
    }
  }

  async function handleFeedback(chalet: Chalet, status: "up" | "down") {
    if (!userId) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          chalet_id: generateMockId(chalet.name), 
          thumb_status: status,
          reason: `User clicked thumbs ${status} on UI based on chalet attributes.`
        }),
      });
      if (res.ok) setFeedbackGiven(prev => ({ ...prev, [chalet.name]: status }));
    } catch (err) {}
  }

  // --- TRIP PLANNER ACTIONS ---
  const openMissionModal = async (chalet: Chalet) => {
    setSelectedChalet(chalet);
    setIsModalOpen(true);
    setModalStep(1); // Reset to step 1
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/trips?user_id=${userId}`);
      if (res.ok) setUserTrips(await res.json());
    } catch (err) { console.error(err); }
  };

  const closeMissionModal = () => {
    setIsModalOpen(false);
    setSelectedChalet(null);
    setNewTripName("");
    setModalStep(1);
    setSelectedTrip(null);
  };

  // Helper function to pre-save the chalet and get DB IDs before attaching to trip
  const getChaletAndResortIds = async () => {
    const matchedResort = dbResorts.find(r => r.name.toLowerCase() === targetResort?.toLowerCase());
    if (!matchedResort) throw new Error("Resort not found in DB");

    const saveRes = await fetch("http://127.0.0.1:8000/api/chalets/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, resort_name: targetResort, chalet: selectedChalet }),
    });
    if (!saveRes.ok) throw new Error("Failed to save chalet to DB");
    
    const saveData = await saveRes.json();
    return { resortId: matchedResort.id, chaletId: saveData.chalet_id };
  };

  const finalizeMissionAdd = () => {
    if (selectedChalet) {
      setSavedToMission(prev => new Set(prev).add(selectedChalet.name));
      setSavedToArchive(prev => new Set(prev).add(selectedChalet.name)); // Saving to trip implies saving to archive
    }
    closeMissionModal();
  };

  const createNewTripAndLeg = async () => {
    setIsProcessing(true);
    try {
      const ids = await getChaletAndResortIds();
      
      const tripRes = await fetch("http://127.0.0.1:8000/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTripName, user_id: userId }),
      });
      const tripData = await tripRes.json();
      
      await fetch(`http://127.0.0.1:8000/api/trips/${tripData.id}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resort_id: ids.resortId, chalet_id: ids.chaletId, order_index: 0 }),
      });
      
      finalizeMissionAdd();
    } catch (err) { console.error(err); } 
    finally { setIsProcessing(false); }
  };

  const createNewLegOnExistingTrip = async (tripId: number) => {
    setIsProcessing(true);
    try {
      const ids = await getChaletAndResortIds();
      await fetch(`http://127.0.0.1:8000/api/trips/${tripId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resort_id: ids.resortId, chalet_id: ids.chaletId, order_index: selectedTrip.legs.length }),
      });
      finalizeMissionAdd();
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  };

  const updateExistingLeg = async (legId: number) => {
    setIsProcessing(true);
    try {
      const ids = await getChaletAndResortIds();
      await fetch(`http://127.0.0.1:8000/api/trips/legs/${legId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chalet_id: ids.chaletId }),
      });
      finalizeMissionAdd();
    } catch (err) { console.error(err); }
    finally { setIsProcessing(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-mono gap-4">
      <div className="text-5xl animate-pulse drop-shadow-sm">🕸️</div>
      <div className="text-cyan-500 text-xl font-bold text-center px-4 tracking-widest uppercase">
        INITIATING_DEEP_WEB_SCRAPE...<br />
        <span className="text-slate-600 text-sm font-normal">[ TARGET: {targetResort} | MODE: {isDirectOverride ? "DIRECT" : "SCOUT"} ]</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 relative font-mono selection:bg-cyan-500 selection:text-white pb-20">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1495619744764-2cc11fcbe5f0?q=80&w=1732&auto=format&fit=crop')] bg-cover bg-center bg-fixed"></div>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[3px]"></div>

      <div className="relative z-10 max-w-5xl mx-auto p-6 md:p-10 text-white">
        <div className="border-b border-slate-700 pb-6 mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest drop-shadow-md flex flex-wrap items-center gap-4">
              <span className="text-cyan-500">_</span> {targetResort}
            </h1>
            <p className="text-slate-400 mt-4 text-sm uppercase tracking-widest">
              STRICT_EVALUATION_APPLIED. USER_ID: [{userId}]
            </p>
          </div>
        </div>

        {chalets.length === 0 ? (
          <div className="bg-slate-900 border border-red-900/50 p-8 rounded text-center">
            <p className="text-red-400 tracking-widest uppercase">ERROR: ZERO_TARGETS_SURVIVED_EVALUATION.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {chalets.map((chalet, idx) => {
              const isArchived = savedToArchive.has(chalet.name);
              const isInMission = savedToMission.has(chalet.name);
              const thumbStatus = feedbackGiven[chalet.name];

              return (
                <div key={idx} className="group bg-slate-900/80 backdrop-blur-md border border-slate-700 p-6 md:p-8 rounded-sm flex flex-col md:flex-row gap-8 hover:border-cyan-500 transition-all duration-300">
                  
                  {chalet.image_url && (
                    <div className="w-full md:w-64 h-48 md:h-auto shrink-0 relative bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                      <img 
                        src={chalet.image_url} 
                        alt={chalet.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                    </div>
                  )}

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-slate-800 pb-4 gap-4">
                      <div>
                        <h3 className="text-2xl font-bold text-white uppercase tracking-wider group-hover:text-cyan-400 transition-colors">
                          {chalet.name}
                        </h3>
                        <p className="text-cyan-600 text-xs font-bold tracking-widest uppercase mt-1">
                          📍 SITE_LOC: {chalet.village}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950 border border-cyan-900 px-3 py-1 rounded-sm text-cyan-400 text-xs tracking-widest shrink-0">
                        [ GEM_SCORE: {chalet.hidden_gem_score}/10 ]
                      </div>
                    </div>

                    <div className="bg-slate-950/50 border-l-2 border-cyan-600 p-4">
                      <p className="text-slate-300 text-sm leading-relaxed">{chalet.reasoning}</p>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4">
                      {chalet.price_per_night && (
                        <span className="bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 tracking-widest uppercase rounded-sm">
                          [ PRICE: <span className="text-cyan-400 font-bold">€{chalet.price_per_night}</span>/NIGHT ]
                        </span>
                      )}
                      {chalet.distance_to_lift_m && (
                        <span className="bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 tracking-widest uppercase rounded-sm">
                          [ LIFT_DIST: <span className="text-cyan-400 font-bold">{chalet.distance_to_lift_m}m</span> ]
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 shrink-0 md:w-48 justify-end">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleFeedback(chalet, "up")}
                        disabled={!!thumbStatus}
                        className={`flex-1 py-2 border text-sm transition-colors flex items-center justify-center ${thumbStatus === "up" ? "bg-green-900/50 border-green-500 text-green-400" : "bg-slate-950 border-slate-700 text-slate-400 hover:border-green-500 hover:text-green-500 disabled:opacity-50"}`}
                        title="Good Match"
                      >👍</button>
                      <button 
                        onClick={() => handleFeedback(chalet, "down")}
                        disabled={!!thumbStatus}
                        className={`flex-1 py-2 border text-sm transition-colors flex items-center justify-center ${thumbStatus === "down" ? "bg-red-900/50 border-red-500 text-red-400" : "bg-slate-950 border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-500 disabled:opacity-50"}`}
                        title="Bad Match"
                      >👎</button>
                    </div>

                    <button 
                      onClick={() => openMissionModal(chalet)}
                      disabled={isInMission}
                      className={`w-full py-3 text-xs tracking-widest font-bold uppercase border transition-all ${isInMission ? "bg-purple-900/50 border-purple-500 text-purple-400" : "bg-purple-900/20 border-purple-500/50 text-purple-400 hover:bg-purple-600 hover:text-white"}`}
                    >
                      {isInMission ? "IN_MISSION" : "+ ADD_TO_MISSION"}
                    </button>

                    <button 
                      onClick={() => handleSaveToArchive(chalet)}
                      disabled={isArchived}
                      className={`w-full py-3 text-xs tracking-widest font-bold uppercase border transition-all ${isArchived ? "bg-cyan-900/50 border-cyan-500 text-cyan-400" : "bg-slate-950 border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400"}`}
                    >
                      {isArchived ? "💾 ARCHIVED" : "💾 SAVE_TO_ARCHIVE"}
                    </button>

                    {chalet.url && (
                      <a
                        href={chalet.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center bg-cyan-900/30 border border-cyan-700 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 px-4 py-3 transition-all duration-300 font-bold tracking-widest uppercase text-xs rounded-sm mt-auto"
                      >
                        BOOK_NOW
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- 2-STEP MODAL OVERLAY --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-purple-500 p-8 rounded-lg shadow-[0_0_30px_rgba(147,51,234,0.3)] max-w-md w-full relative">
            <button onClick={closeMissionModal} className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold">X</button>
            <h2 className="text-xl font-bold text-purple-400 uppercase tracking-widest mb-2 border-b border-purple-500/30 pb-2">ADD TO MISSION</h2>
            
            {modalStep === 1 && (
              <>
                <p className="text-sm text-slate-300 mb-6">Select an active trip or create a new deployment parameters file for: <br/><span className="text-cyan-400 font-bold">{selectedChalet?.name}</span></p>
                
                <div className="space-y-4">
                  {userTrips.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">ACTIVE_TRIPS:</p>
                      {userTrips.map(trip => (
                        <button 
                          key={trip.id}
                          onClick={() => { setSelectedTrip(trip); setModalStep(2); }}
                          className="w-full text-left bg-slate-950 border border-slate-700 p-3 hover:border-purple-500 hover:text-purple-400 transition-colors uppercase tracking-widest text-sm text-slate-300"
                        >
                          &gt; {trip.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">CREATE_NEW_TRIP:</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newTripName}
                        onChange={e => setNewTripName(e.target.value)}
                        placeholder="ENTER_TRIP_CODENAME..."
                        className="flex-1 bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                      />
                      <button 
                        onClick={createNewTripAndLeg}
                        disabled={!newTripName || isProcessing}
                        className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-4 py-2 uppercase tracking-widest text-xs transition-colors"
                      >
                        {isProcessing ? "..." : "CREATE"}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {modalStep === 2 && selectedTrip && (
              <>
                <p className="text-sm text-slate-300 mb-6">Target Mission: <span className="text-purple-400 font-bold uppercase">{selectedTrip.name}</span></p>
                
                <div className="space-y-4">
                  <button onClick={() => setModalStep(1)} className="text-[10px] text-slate-500 hover:text-purple-400 mb-2">&lt; BACK</button>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">SELECT WAYPOINT TO UPDATE OR CREATE NEW:</p>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {selectedTrip.legs.map((leg: any, idx: number) => (
                      <button 
                        key={leg.id}
                        onClick={() => updateExistingLeg(leg.id)}
                        disabled={isProcessing}
                        className="w-full text-left bg-slate-950 border border-slate-700 p-3 hover:border-purple-500 hover:text-purple-400 transition-colors text-sm text-slate-300"
                      >
                        <div className="font-bold uppercase tracking-widest text-cyan-400">Leg {idx + 1}: {leg.resort?.name || 'Unknown Resort'}</div>
                        <div className="text-[10px] text-slate-500 mt-1">Current Basecamp: {leg.chalet?.chalet_name || 'NONE'}</div>
                      </button>
                    ))}
                    
                    <button 
                      onClick={() => createNewLegOnExistingTrip(selectedTrip.id)}
                      disabled={isProcessing}
                      className="w-full text-left bg-purple-900/20 border border-purple-500/50 p-3 hover:bg-purple-900/50 hover:text-white transition-colors text-sm text-purple-400 font-bold tracking-widest uppercase mt-2"
                    >
                      + ADD AS NEW WAYPOINT
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}