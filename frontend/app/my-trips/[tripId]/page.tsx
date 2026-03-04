"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSearch } from "../../context/SearchContext";

import MapOverlayModule from "../../components/MapOverlayModule";
import CurrentConditions from "../../components/CurrentConditions";

export default function TripHub() {
  const { tripId } = useParams();
  const router = useRouter();
  const { userId } = useSearch();

  const [trip, setTrip] = useState<any>(null);
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [dbResorts, setDbResorts] = useState<any[]>([]);
  const [archiveChalets, setArchiveChalets] = useState<any[]>([]);

  // Modals State
  const [modalMode, setModalMode] = useState<"DATES" | "ACCO" | "ADD_LEG" | "TRIP_WINDOW" | null>(null);
  const [formDates, setFormDates] = useState({ start: "", end: "" }); 
  const [tripFormDates, setTripFormDates] = useState({ start: "", end: "" }); 
  const [dateError, setDateError] = useState("");
  const [customAccoUrl, setCustomAccoUrl] = useState("");
  const [legSearchQuery, setLegSearchQuery] = useState("");

  // Live Weather State
  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [weatherCode, setWeatherCode] = useState<number>(0);

  const fetchTrip = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/trips/${tripId}`);
      if (res.ok) setTrip(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrip();
    fetch("http://localhost:8000/api/resorts").then(r => r.json()).then(setDbResorts);
    if (userId) {
      fetch(`http://127.0.0.1:8000/api/user/${userId}/saved`).then(r => r.json()).then(d => setArchiveChalets(d.saved_chalets || []));
    }
  }, [tripId, userId]);

  const activeLeg = trip?.legs?.[activeLegIndex];

  // --- FETCH LIVE WEATHER WHEN ACTIVE LEG CHANGES ---
  useEffect(() => {
    async function fetchLegWeather() {
      if (!activeLeg || !activeLeg.resort) return;
      
      const targetLat = activeLeg.resort.latitude;
      const targetLon = activeLeg.resort.longitude;
      const baseAlt = activeLeg.resort.lowest_point || 1000;
      const peakAlt = activeLeg.resort.highest_point || 2500;

      try {
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat},${targetLat}&longitude=${targetLon},${targetLon}&elevation=${baseAlt},${peakAlt}&current=temperature_2m,wind_speed_10m,snow_depth,weather_code&hourly=freezing_level_height&timezone=auto`;
        
        const res = await fetch(meteoUrl);
        if (res.ok) {
          const dataArray = await res.json();
          const valleyData = dataArray[0];
          const peakData = dataArray[1];
          const currentFreeze = valleyData.hourly?.freezing_level_height?.[0] || 2000;

          setWeatherCode(valleyData.current?.weather_code || 0);
          setLiveWeather({
            valleyAlt: baseAlt,
            peakAlt: peakAlt,
            valleyTemp: Math.round(valleyData.current?.temperature_2m || 0),
            peakTemp: Math.round(peakData.current?.temperature_2m || 0),
            valleyWind: Math.round(valleyData.current?.wind_speed_10m || 0),
            peakWind: Math.round(peakData.current?.wind_speed_10m || 0),
            valleySnowDepth: Math.round((valleyData.current?.snow_depth || 0) * 100),
            peakSnowDepth: Math.round((peakData.current?.snow_depth || 0) * 100),
            freezingLevel: Math.round(currentFreeze),
            snowLevel: Math.round(currentFreeze - 300), 
          });
        }
      } catch (err) {
        console.error("SYS_ERR: Failed to load weather telemetry", err);
      }
    }
    fetchLegWeather();
  }, [activeLeg]);

  // --- ACTIONS: OVERALL TRIP WINDOW ---
  const handleUpdateTripWindow = async () => {
    setDateError("");
    const newStart = new Date(tripFormDates.start);
    const newEnd = new Date(tripFormDates.end);
    if (newStart > newEnd) {
      setDateError("CHRONO_ERROR: Mission End precedes Mission Start.");
      return;
    }
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: trip.name,
          start_date: tripFormDates.start, 
          end_date: tripFormDates.end 
        })
      });
      await fetchTrip();
      setModalMode(null);
    } finally { setIsProcessing(false); }
  };

  // --- ACTIONS: WAYPOINTS ---
  const handleAddLeg = async (resortId: number) => {
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trips/${tripId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resort_id: resortId, order_index: trip.legs.length })
      });
      await fetchTrip();
      setModalMode(null);
    } finally { setIsProcessing(false); }
  };

  const handleRemoveLeg = async (legId: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    if(!confirm("Erase this waypoint from mission data?")) return;
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trips/legs/${legId}`, { method: "DELETE" });
      setActiveLegIndex(0);
      await fetchTrip();
    } finally { setIsProcessing(false); }
  };

  // --- ACTIONS: LEG DATES (NON-OVERLAPPING LOGIC) ---
  const getAvailableDateWindow = () => {
    if (!trip || !activeLeg) return { min: "", max: "" };

    let minBound = trip.start_date || "";
    let maxBound = trip.end_date || "";

    trip.legs.forEach((leg: any) => {
      if (leg.id === activeLeg.id) return; 
      if (!leg.arrival_date || !leg.departure_date) return;

      if (leg.order_index < activeLeg.order_index) {
        if (leg.departure_date > minBound) minBound = leg.departure_date;
      } 
      else if (leg.order_index > activeLeg.order_index) {
        if (leg.arrival_date < maxBound || maxBound === "") maxBound = leg.arrival_date;
      }
    });

    return { min: minBound, max: maxBound };
  };

  const handleUpdateDates = async () => {
    setDateError("");
    const newStart = new Date(formDates.start);
    const newEnd = new Date(formDates.end);
    
    if (newStart > newEnd) {
      setDateError("CHRONO_ERROR: Departure precedes Arrival.");
      return;
    }

    if (trip.start_date && newStart < new Date(trip.start_date)) {
      setDateError("OUT_OF_BOUNDS: Arrival is before the main mission start date.");
      return;
    }
    if (trip.end_date && newEnd > new Date(trip.end_date)) {
      setDateError("OUT_OF_BOUNDS: Departure is after the main mission end date.");
      return;
    }

    const hasCollision = trip.legs.some((l: any) => {
      if (l.id === activeLeg.id || !l.arrival_date || !l.departure_date) return false;
      const lStart = new Date(l.arrival_date);
      const lEnd = new Date(l.departure_date);
      return (newStart <= lEnd && newEnd >= lStart); 
    });

    if (hasCollision) {
      setDateError("COLLISION_DETECTED: Dates overlap with another waypoint.");
      return;
    }

    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trips/legs/${activeLeg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arrival_date: formDates.start, departure_date: formDates.end })
      });
      await fetchTrip();
      setModalMode(null);
    } finally { setIsProcessing(false); }
  };

  const openDateModal = (leg: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormDates({ start: leg.arrival_date || "", end: leg.departure_date || "" });
    setModalMode("DATES");
  }

  // --- ACTIONS: ACCOMMODATION ---
  const handleAttachChalet = async (chaletId: number | null, isRemoval = false) => {
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trips/legs/${activeLeg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRemoval ? { remove_chalet: true } : { chalet_id: chaletId })
      });
      await fetchTrip();
      setModalMode(null);
    } finally { setIsProcessing(false); }
  };

  const handleAttachCustomUrl = async () => {
    if (!customAccoUrl) return;
    setIsProcessing(true);
    try {
      const saveRes = await fetch("http://127.0.0.1:8000/api/chalets/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          resort_name: activeLeg.resort.name,
          chalet: {
            name: "CUSTOM EXTERNAL BOOKING",
            url: customAccoUrl,
            village: "Custom Entry",
            reasoning: "Manually attached basecamp URL by user.", 
            hidden_gem_score: 5 
          }
        })
      });
      const data = await saveRes.json();
      if (data.chalet_id) {
        await handleAttachChalet(data.chalet_id);
      }
    } finally { setIsProcessing(false); }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-500 font-mono text-xl animate-pulse tracking-widest">LOADING_MISSION_DATA...</div>;
  if (!trip) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-500 font-mono tracking-widest">MISSION_NOT_FOUND.</div>;

  const validArchiveChalets = archiveChalets.filter(c => c.resort_name === activeLeg?.resort?.name);
  const dateWindow = getAvailableDateWindow();

  return (
    <main className="min-h-screen relative bg-[url('/background_img.png')] bg-cover bg-center bg-fixed text-slate-800 font-mono selection:bg-cyan-500 selection:text-white">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[4px] pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6 pt-24 pb-24 px-6 md:px-12">
        
        {/* HEADER WITH EDITABLE TRIP DATES */}
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 border-l-4 border-cyan-500 pl-4 bg-slate-900/50 p-4 rounded-r-lg shadow-lg">
          <div>
            <p className="text-xs text-cyan-500/80 font-bold uppercase tracking-widest mb-1">MISSION_CODENAME: {trip.name}</p>
            <h1 className="text-cyan-400 text-3xl font-bold tracking-widest uppercase">{activeLeg?.resort?.name || "NO_WAYPOINTS"}</h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-sm text-cyan-100/60 bg-slate-950/50 px-3 py-1 rounded-sm border border-slate-700 inline-block tracking-widest">
                MISSION_WINDOW: {trip.start_date || 'TBD'} &gt;&gt; {trip.end_date || 'TBD'}
              </p>
              <button 
                onClick={() => {
                  setTripFormDates({ start: trip.start_date || "", end: trip.end_date || "" });
                  setModalMode("TRIP_WINDOW");
                }}
                className="text-[10px] bg-slate-800 hover:bg-cyan-600 text-cyan-400 hover:text-white px-2 py-1 rounded transition-colors"
              >
                EDIT_WINDOW
              </button>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => router.push('/my-trips')} className="text-[10px] px-4 py-2 border border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 tracking-widest font-bold">&lt; ARCHIVE</button>
            <button onClick={() => setModalMode("ADD_LEG")} className="text-[10px] px-4 py-2 border border-cyan-500 text-slate-950 bg-cyan-500 hover:bg-cyan-400 tracking-widest font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]">+ ADD_WAYPOINT</button>
          </div>
        </div>

        {/* WAYPOINT TABS */}
        {trip.legs?.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar items-start">
            <span className="text-xs text-slate-500 tracking-widest py-3 pr-2">WAYPOINTS:</span>
            {trip.legs.map((leg: any, idx: number) => (
              <div 
                key={leg.id}
                onClick={() => setActiveLegIndex(idx)}
                className={`p-3 text-left transition-all border min-w-[200px] cursor-pointer relative group flex flex-col justify-between ${
                  activeLegIndex === idx 
                    ? "bg-cyan-950/40 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                    : "bg-slate-900 border-slate-700 hover:border-cyan-700"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-bold uppercase tracking-widest truncate ${activeLegIndex === idx ? 'text-cyan-400' : 'text-slate-500'}`}>
                    {idx + 1}. {leg.resort?.name}
                  </span>
                  <button onClick={(e) => handleRemoveLeg(leg.id, e)} className="text-slate-600 hover:text-red-500 ml-2" title="Remove Waypoint">X</button>
                </div>
                
                <div className="flex justify-between items-center bg-slate-950/50 p-1.5 border border-slate-800">
                  <span className={`text-[10px] tracking-wider ${leg.arrival_date ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                    {leg.arrival_date ? `${leg.arrival_date.slice(5)} > ${leg.departure_date?.slice(5)}` : 'UNSCHEDULED'}
                  </span>
                  <button onClick={(e) => openDateModal(leg, e)} className="text-[9px] bg-slate-800 hover:bg-green-600 text-green-500 hover:text-white px-2 py-1 transition-colors">EDIT</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- FIXED LAYOUT: TWO MAIN COLUMNS --- */}
        {activeLeg ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT COLUMN (8 Columns Wide) - Map & Telemetry Link */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* MAP WIDGET: Swapped fixed height for flexible min-h so it won't overflow */}
              <div className="flex-1 min-h-[450px] lg:min-h-[550px] flex flex-col relative w-full">
                <MapOverlayModule 
                  fullHeight={true} 
                  lat={activeLeg.resort.latitude} 
                  lon={activeLeg.resort.longitude}
                  resortName={activeLeg.resort.name}
                />
              </div>

              {/* AI TELEMETRY WIDGET (BRIDGE BACK TO DASHBOARD) */}
              <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500 p-6 rounded-md shadow-lg flex items-center justify-center shrink-0">
                <button 
                  onClick={() => router.push(`/dashboard/telemetry/${encodeURIComponent(activeLeg.resort.name)}`)} 
                  className="text-xl md:text-2xl font-black tracking-widest text-slate-700 hover:text-cyan-400 transition-colors uppercase flex items-center gap-4 group"
                >
                  OPEN_TELEMETRY_HUB <span className="text-cyan-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">↗</span>
                </button>
              </div>

            </div>

            {/* RIGHT COLUMN (4 Columns Wide) - Basecamp, Weather, Avalanche */}
            <div className="lg:col-span-4 flex flex-col gap-6">

              {/* BASECAMP WIDGET */}
              <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-pink-500 p-6 rounded-md shadow-lg space-y-4 flex flex-col shrink-0">
                <h3 className="text-sm font-bold text-pink-500 uppercase tracking-widest flex justify-between">
                  <span>MODULE: BASECAMP</span>
                  {activeLeg.chalet && (
                    <button onClick={() => handleAttachChalet(null, true)} className="text-[10px] text-red-400 hover:text-red-300">DETACH [X]</button>
                  )}
                </h3>
                
                {activeLeg.chalet ? (
                  <div className="bg-slate-950/50 border border-slate-800 p-4 rounded relative flex flex-col">
                    <div className="absolute top-0 right-0 bg-green-500/20 text-green-500 text-[8px] font-bold px-2 py-1 border-b border-l border-green-500/50">SECURED</div>
                    <h4 className="text-white font-bold text-lg mb-1 line-clamp-1" title={activeLeg.chalet.chalet_name}>{activeLeg.chalet.chalet_name}</h4>
                    <p className="text-xs text-pink-500 mb-3">&gt; {activeLeg.chalet.village}</p>
                    {activeLeg.chalet.url && (
                      <a href={activeLeg.chalet.url} target="_blank" rel="noreferrer" className="block text-center mt-2 bg-pink-900/30 text-pink-500 border border-pink-900 text-[10px] py-2 hover:bg-pink-500 hover:text-white font-bold tracking-widest">ACCESS_BOOKING ↗</a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border border-dashed border-slate-700 p-4 text-center gap-3">
                    <p className="text-[10px] text-slate-500 tracking-widest">NO_BASECAMP_ASSIGNED</p>
                    <button 
                      onClick={() => router.push(`/trip-planner?target_resort=${encodeURIComponent(activeLeg.resort.name)}&phase=chalets&country=Known`)}
                      className="w-full bg-slate-950 text-pink-500 border border-pink-500/50 px-4 py-2 text-[10px] font-bold hover:bg-pink-500 hover:text-slate-900 tracking-widest transition-colors"
                    >
                      DEPLOY_CHALET_HUNTERS
                    </button>
                    <button 
                      onClick={() => setModalMode("ACCO")} 
                      className="text-[9px] text-slate-400 hover:text-pink-400 underline tracking-widest"
                    >
                      OR_ASSIGN_MANUALLY
                    </button>
                  </div>
                )}
              </div>

              {/* CURRENT CONDITIONS WIDGET: Swapped h-64 to a natural flex setup */}
              <div className="flex flex-col min-h-[250px] shrink-0">
                {liveWeather ? (
                  <CurrentConditions data={liveWeather} weatherCode={weatherCode} />
                ) : (
                  <div className="bg-slate-900/80 border border-slate-800 p-6 flex items-center justify-center h-full rounded-md shadow-lg border-l-2 border-l-cyan-500">
                     <span className="text-cyan-500 text-xs animate-pulse tracking-widest">AWAITING_ATMOSPHERIC_DATA...</span>
                  </div>
                )}
              </div>

              {/* AVALANCHE RISK WIDGET */}
              <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-orange-500 p-6 rounded-md shadow-lg shrink-0">
                <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-4">
                  MODULE: AVALANCHE_RISK
                </h3>
                <div className="flex items-end gap-1 h-12 mb-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div 
                      key={level} 
                      className={`flex-1 transition-all duration-500 border-b-2 border-slate-950 ${level === 3 ? "bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : "bg-slate-800"}`}
                      style={{ height: `${level * 20}%`, opacity: 3 >= level ? 1 : 0.3 }}
                    ></div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 p-12 text-center text-slate-500 tracking-widest uppercase">
            NO_WAYPOINTS_DETECTED. CLICK [+ ADD_WAYPOINT] TO BEGIN DEPLOYMENT.
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {modalMode && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-cyan-500 p-6 rounded-lg shadow-2xl max-w-md w-full relative">
            <button onClick={() => setModalMode(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white">X</button>
            
            {/* TRIP WINDOW MODAL */}
            {modalMode === "TRIP_WINDOW" && (
              <div className="space-y-4">
                <h2 className="text-cyan-400 font-bold tracking-widest border-b border-cyan-500/30 pb-2">MISSION_WINDOW</h2>
                {dateError && <p className="text-[10px] text-red-500 font-bold bg-red-950/30 p-2">{dateError}</p>}
                
                <div>
                  <label className="text-xs text-slate-500 block mb-1">MISSION_START</label>
                  <input 
                    type="date" 
                    value={tripFormDates.start} 
                    onChange={e=>setTripFormDates({...tripFormDates, start: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white [color-scheme:dark]" 
                  />
                </div>
                
                <div>
                  <label className="text-xs text-slate-500 block mb-1">MISSION_END</label>
                  <input 
                    type="date" 
                    value={tripFormDates.end} 
                    onChange={e=>setTripFormDates({...tripFormDates, end: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white [color-scheme:dark]" 
                  />
                </div>
                
                <button onClick={handleUpdateTripWindow} disabled={isProcessing} className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 disabled:bg-slate-800 font-bold py-2 tracking-widest mt-2 uppercase">COMMIT_MISSION_DATES</button>
              </div>
            )}

            {/* LEG DATES MODAL */}
            {modalMode === "DATES" && (
              <div className="space-y-4">
                <h2 className="text-green-500 font-bold tracking-widest border-b border-green-500/30 pb-2">TIMELINE_SYNC</h2>
                {dateError && <p className="text-[10px] text-red-500 font-bold bg-red-950/30 p-2">{dateError}</p>}
                
                <p className="text-[10px] text-slate-400 italic mb-2">
                  Leg dates must fall within main mission window: [{trip.start_date || 'TBD'} - {trip.end_date || 'TBD'}]
                </p>

                <div>
                  <label className="text-xs text-slate-500 block mb-1 flex justify-between">
                    ARRIVAL 
                    {dateWindow.min && <span className="text-[9px] text-slate-600">AFTER: {dateWindow.min}</span>}
                  </label>
                  <input 
                    type="date" 
                    min={dateWindow.min}
                    max={formDates.end || dateWindow.max} 
                    value={formDates.start} 
                    onChange={e=>setFormDates({...formDates, start: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white [color-scheme:dark]" 
                  />
                </div>
                
                <div>
                  <label className="text-xs text-slate-500 block mb-1 flex justify-between">
                    DEPARTURE
                    {dateWindow.max && <span className="text-[9px] text-slate-600">BEFORE: {dateWindow.max}</span>}
                  </label>
                  <input 
                    type="date" 
                    min={formDates.start || dateWindow.min} 
                    max={dateWindow.max}
                    value={formDates.end} 
                    onChange={e=>setFormDates({...formDates, end: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-700 p-2 text-white [color-scheme:dark]" 
                  />
                </div>
                
                <button onClick={handleUpdateDates} disabled={isProcessing || !formDates.start || !formDates.end} className="w-full bg-green-600 hover:bg-green-500 text-slate-950 disabled:bg-slate-800 font-bold py-2 tracking-widest mt-2">COMMIT_TIMELINE</button>
              </div>
            )}

            {/* ADD ACCO MODAL */}
            {modalMode === "ACCO" && (
              <div className="space-y-6">
                <h2 className="text-pink-500 font-bold tracking-widest border-b border-pink-500/30 pb-2">ASSIGN_BASECAMP</h2>
                
                <div>
                  <p className="text-[10px] text-slate-500 mb-2">FROM_ARCHIVE ({validArchiveChalets.length} targets found)</p>
                  {validArchiveChalets.length === 0 ? (
                    <div className="text-xs text-slate-600 border border-slate-800 p-2 text-center">No chalets saved for this sector.</div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {validArchiveChalets.map(c => (
                        <button key={c.id} onClick={() => handleAttachChalet(c.id)} className="w-full text-left bg-slate-950 border border-slate-700 p-2 hover:border-pink-500 text-xs text-slate-300 truncate">
                          &gt; {c.chalet_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[10px] text-slate-500 mb-2">CUSTOM_EXTERNAL_URL</p>
                  <input type="url" value={customAccoUrl} onChange={e=>setCustomAccoUrl(e.target.value)} placeholder="https://booking.com/..." className="w-full bg-slate-950 border border-slate-700 p-2 text-xs text-white mb-2" />
                  <button onClick={handleAttachCustomUrl} disabled={!customAccoUrl || isProcessing} className="w-full bg-pink-600 hover:bg-pink-500 text-slate-950 disabled:bg-slate-800 font-bold py-2 tracking-widest text-xs">ATTACH_EXTERNAL</button>
                </div>
              </div>
            )}

            {/* ADD LEG MODAL */}
            {modalMode === "ADD_LEG" && (
              <div className="space-y-4">
                <h2 className="text-cyan-400 font-bold tracking-widest border-b border-cyan-500/30 pb-2">LOCATE_NEW_TARGET</h2>
                <input type="text" value={legSearchQuery} onChange={e=>setLegSearchQuery(e.target.value)} placeholder="Search DB..." className="w-full bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:outline-none focus:border-cyan-500" />
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 border border-slate-800">
                  {dbResorts.filter(r => r.name.toLowerCase().includes(legSearchQuery.toLowerCase())).map(r => (
                    <button key={r.id} onClick={() => handleAddLeg(r.id)} className="w-full text-left bg-slate-950 p-3 hover:bg-cyan-900/40 hover:text-cyan-400 text-xs text-slate-400 transition-colors border-b border-slate-800 last:border-0">
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </main>
  );
}