"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSearch } from "../../context/SearchContext";
import MapOverlayModule from "../../components/MapOverlayModule"; 
import CurrentConditions from "../../components/CurrentConditions";
import Forecast72h from "../../components/Forecast72h";
import PrecipitationArchive from "../../components/PrecipitationArchive";
import ResortProfileWidget from "../../components/ResortProfileWidget";

// --- MAIN PAGE COMPONENT ---
export default function TelemetryDashboard() {
  const router = useRouter();
  const params = useParams(); 
  
  const rawResortParam = params?.resort_name ? decodeURIComponent(params.resort_name as string) : "";
  const { userId } = useSearch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mapCoords, setMapCoords] = useState<{lat: number, lon: number}>({ lat: 47.1296, lon: 10.2681 });

  // --- NEW: MISSION DEPLOYMENT STATE ---
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [userTrips, setUserTrips] = useState<any[]>([]);
  const [newMissionName, setNewMissionName] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    if (!rawResortParam || rawResortParam === "undefined") {
      setError("INVALID_TARGET_COORDINATES");
      setLoading(false);
      return;
    }

    async function fetchPublicTelemetry() {
      try {
        const dbRes = await fetch("http://localhost:8000/api/resorts");
        if (!dbRes.ok) throw new Error("INTERNAL_UPLINK_FAILED: Database did not respond.");
        
        const allResorts = await dbRes.json();
        const matchedResort = allResorts.find((r: any) => 
          r.name.toLowerCase().includes(rawResortParam.toLowerCase())
        );

        if (!matchedResort) throw new Error("TARGET_NOT_FOUND_IN_DATABASE");

        const targetLat = matchedResort.latitude;
        const targetLon = matchedResort.longitude;
        setMapCoords({ lat: targetLat, lon: targetLon });

        if (userId) {
          const savedRes = await fetch(`http://localhost:8000/api/user/${userId}/saved_resorts`);
          if (savedRes.ok) {
            const savedData = await savedRes.json();
            setIsSaved(savedData.saved_resorts.some((r: any) => r.id === matchedResort.id));
          }
        }

        const baseAlt = matchedResort.lowest_point || 1000;
        const peakAlt = matchedResort.highest_point || 2500;

        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat},${targetLat}&longitude=${targetLon},${targetLon}&elevation=${baseAlt},${peakAlt}&current=temperature_2m,wind_speed_10m,snow_depth,weather_code&hourly=temperature_2m,snow_depth,freezing_level_height,snowfall,rain,cloud_cover,wind_speed_10m&daily=snowfall_sum&past_days=28&forecast_days=3&timezone=auto`;
        const res = await fetch(meteoUrl);
        if (!res.ok) throw new Error("PUBLIC_UPLINK_FAILED: Weather satellite did not respond.");
        
        const meteoDataArray = await res.json();
        const valleyData = meteoDataArray[0];
        const peakData = meteoDataArray[1];
        const historical_4_weeks = [];
        const daily = valleyData.daily || {};
        let forecast_48h = 0;
        if (daily.time && daily.snowfall_sum) {
          for(let i = 0; i < 28; i++) {
            historical_4_weeks.push({
              date: new Date(daily.time[i]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              amount_cm: Math.round(daily.snowfall_sum[i] || 0)
            });
          }
          forecast_48h = (daily.snowfall_sum[28] || 0) + (daily.snowfall_sum[29] || 0);
        }
        
        const telemetryRes = await fetch(`http://localhost:8000/api/resorts/${encodeURIComponent(matchedResort.name)}/telemetry`);
        let aiTelemetry: any = {};
        if (telemetryRes.ok) {
           aiTelemetry = await telemetryRes.json();
        }

        const currentFreeze = valleyData.hourly?.freezing_level_height?.[0] || 2000;

        const finalTelemetry = {
          resort_name: matchedResort.name,
          db_stats: matchedResort, 
          weather_code: valleyData.current?.weather_code !== undefined ? valleyData.current.weather_code : 0,
          live_conditions: {
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
          },
          forecast_72h: {
            time: valleyData.hourly?.time || [],
            tempPeak: peakData.hourly?.temperature_2m || [],
            tempValley: valleyData.hourly?.temperature_2m || [],
            snowCm: valleyData.hourly?.snowfall || [],
            rainMm: valleyData.hourly?.rain || [],
            windKmh: valleyData.hourly?.wind_speed_10m || [],
            cloudCover: valleyData.hourly?.cloud_cover || [],
            freezingLevel: valleyData.hourly?.freezing_level_height || [],
          },
          snow: {
            forecast_next_48h_cm: Math.round(forecast_48h),
            historical_4_weeks: historical_4_weeks.length ? historical_4_weeks : Array(28).fill({ date: "N/A", amount_cm: 0 }),
          },
          official_ski_map_url: aiTelemetry.official_ski_map_url || null
        };

        setData(finalTelemetry);
      } catch (err: any) {
        setError(err.message || "Failed to establish connection.");
      } finally {
        setLoading(false);
      }
    }

    fetchPublicTelemetry();
  }, [rawResortParam, userId]);

  // --- ACTIONS: SAVE TO ARCHIVE ---
  const handleToggleSave = async () => {
    if (!data?.db_stats?.id || !userId) return;
    setIsSaving(true);
    try {
      if (isSaved) {
        const res = await fetch(`http://localhost:8000/api/user/${userId}/saved_resorts/${data.db_stats.id}`, { method: "DELETE" });
        if (res.ok) setIsSaved(false);
      } else {
        const res = await fetch(`http://localhost:8000/api/resorts/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, resort_id: data.db_stats.id }),
        });
        if (res.ok) setIsSaved(true);
      }
    } catch (err) {
      console.error("SYS_ERR: Failed to update archives.", err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- ACTIONS: MISSION DEPLOYMENT ---
  const openMissionModal = async () => {
    if (!userId) {
      alert("Must be logged in to deploy missions.");
      return;
    }
    setIsMissionModalOpen(true);
    try {
      const res = await fetch(`http://localhost:8000/api/trips?user_id=${userId}`);
      if (res.ok) setUserTrips(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateNewMission = async () => {
    if (!newMissionName) return;
    setIsDeploying(true);
    try {
      // 1. Create Trip
      const tripRes = await fetch("http://localhost:8000/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMissionName, user_id: userId })
      });
      const newTrip = await tripRes.json();

      // 2. Add Leg
      await fetch(`http://localhost:8000/api/trips/${newTrip.id}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resort_id: data.db_stats.id, order_index: 0 })
      });

      // 3. Jump to Trip Hub
      router.push(`/my-trips/${newTrip.id}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
    }
  };

  const handleAddToExistingMission = async (tripId: number, currentLegCount: number) => {
    setIsDeploying(true);
    try {
      await fetch(`http://localhost:8000/api/trips/${tripId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resort_id: data.db_stats.id, order_index: currentLegCount })
      });
      router.push(`/my-trips/${tripId}`);
    } catch (err) {
      console.error(err);
      setIsDeploying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-mono gap-4 text-cyan-500">
      <div className="text-5xl animate-spin drop-shadow-sm">⚙️</div>
      <div className="text-xl font-bold text-center px-4 tracking-widest uppercase">
        ESTABLISHING_PUBLIC_TELEMETRY_UPLINK...<br />
        <span className="text-slate-600 text-sm font-normal">[ TARGET: {rawResortParam || "PENDING"} ]</span>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-mono gap-4 text-red-500">
      <div className="text-5xl">⚠️</div>
      <div className="text-xl font-bold text-center px-4 tracking-widest uppercase">
        {error}<br />
        <button onClick={() => router.back()} className="mt-4 text-slate-500 hover:text-red-400 text-sm border border-slate-800 p-2">← ABORT</button>
      </div>
    </div>
  );

  const totalKm = data.db_stats.total_slopes || 1; 
  const pBeginner = ((data.db_stats.beginner_slopes || 0) / totalKm) * 100;
  const pIntermediate = ((data.db_stats.intermediate_slopes || 0) / totalKm) * 100;
  const pExpert = ((data.db_stats.difficult_slopes || 0) / totalKm) * 100;

  return (
    <div className="min-h-screen relative font-mono selection:bg-cyan-500 selection:text-white pb-20">
      <div className="absolute bg-[url('/resort_background_img.png')] inset-0 bg-cover bg-center bg-fixed opacity-1"></div>
      <div className="absolute bg-[url('/resort_background_img.png')] inset-0 bg-cover bg-center bg-fixed backdrop-blur-sm"></div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 pt-24 text-white">

        <div className="border-b border-slate-800 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest drop-shadow-md">
              <span className="text-cyan-500">_</span> {data.resort_name}
            </h1>
            <p className="text-cyan-600/80 mt-2 text-xs font-bold uppercase tracking-[0.3em]">
              DATABASE_LINK_ESTABLISHED // LOCATION: {data.db_stats.country}
            </p>
          </div>
          
          <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2">
             <div className="flex gap-2">
               <button 
                 onClick={handleToggleSave}
                 disabled={isSaving || !userId}
                 className={`text-[10px] px-3 py-1.5 border font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${
                   isSaved 
                    ? 'bg-pink-900/40 text-pink-400 border-pink-500/50 hover:bg-pink-900/80 hover:text-pink-300' 
                    : 'bg-slate-900/60 text-cyan-500 border-cyan-500/50 hover:bg-cyan-900/80 hover:text-cyan-300'
                 } ${isSaving || !userId ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 {isSaving ? "SYNCING..." : isSaved ? "[-] REMOVE_FROM_ARCHIVE" : "[+] ADD_TO_ARCHIVE"}
               </button>

               {/* --- THE NEW DEPLOY BUTTON --- */}
               <button 
                 onClick={openMissionModal}
                 className="text-[10px] px-3 py-1.5 border border-purple-500 bg-purple-600 text-white font-bold tracking-widest uppercase hover:bg-purple-500 transition-all shadow-[0_0_10px_rgba(147,51,234,0.4)]"
               >
                 [+] DEPLOY_TO_MISSION
               </button>
             </div>

            <div className="flex flex-col items-start md:items-end mt-2">
              <span className="text-[10px] text-slate-500 tracking-widest uppercase">SYS_STATUS // OPEN_API_LIVE</span>
              <span className="text-cyan-400 font-bold tracking-widest uppercase text-xs mt-1">DATA_AGE: &lt; 1 MIN</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ============================== */}
          {/* LEFT COLUMN (Data Modules)     */}
          {/* ============================== */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            

            <ResortProfileWidget resortId={data.db_stats.id} resortName={data.resort_name} />

            {/* MOD 01: CURRENT CONDITIONS */}
            <CurrentConditions data={data.live_conditions} weatherCode={data.weather_code} />

            {/* MOD 05: 72H FORECAST */}
            <Forecast72h data={data.forecast_72h} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* MOD 03: LIFT MECHANICS */}
              <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between">
                <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase mb-4 border-b border-slate-800 pb-2">MOD_03 // LIFT_MECHANICS</h2>
                <div className="flex justify-between items-end mb-6">
                  <span className="text-4xl font-black text-white">{data.db_stats.total_lifts} <span className="text-xl text-slate-600">LIFTS</span></span>
                  <span className="text-cyan-400 text-[10px] tracking-widest uppercase font-bold border border-cyan-900 px-2 py-1 bg-cyan-950/30">CAP: {data.db_stats.lift_capacity}/HR</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[10px] tracking-widest text-slate-400 uppercase mb-1">
                      <span>GONDOLA</span><span>{data.db_stats.gondola_lifts}</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-800 h-2"><div className="bg-cyan-500 h-full" style={{ width: `${(data.db_stats.gondola_lifts / data.db_stats.total_lifts) * 100}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] tracking-widest text-slate-400 uppercase mb-1">
                      <span>CHAIR</span><span>{data.db_stats.chair_lifts}</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-800 h-2"><div className="bg-emerald-500 h-full" style={{ width: `${(data.db_stats.chair_lifts / data.db_stats.total_lifts) * 100}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] tracking-widest text-slate-400 uppercase mb-1">
                      <span>SURFACE</span><span>{data.db_stats.surface_lifts}</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-800 h-2"><div className="bg-red-500 h-full" style={{ width: `${(data.db_stats.surface_lifts / data.db_stats.total_lifts) * 100}%` }}></div></div>
                  </div>
                </div>
              </div>

              {/* MOD 04: ECONOMICS */}
              <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col">
                <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase mb-4 border-b border-slate-800 pb-2">MOD_04 // ECONOMICS</h2>
                <div className="grid grid-cols-1 gap-4 flex-grow content-center">
                  <div className="border border-slate-800 bg-slate-950/50 p-4 text-center">
                    <span className="block text-[9px] text-slate-500 tracking-widest uppercase mb-1">TICKET_PRICE</span>
                    <span className="text-2xl text-green-400 font-mono font-bold">€{data.db_stats.price}</span>
                  </div>
                  <div className="border border-slate-800 bg-slate-950/50 p-4 text-center">
                    <span className="block text-[9px] text-slate-500 tracking-widest uppercase mb-1">FAMILY_RATING</span>
                    <span className="text-lg text-yellow-400 font-mono font-bold">{data.db_stats.child_friendly ? "VERIFIED" : "WARNING"}</span>
                  </div>
                </div>
              </div>
            </div>
            <PrecipitationArchive snowData={data.snow} />

          </div>

          {/* ============================== */}
          {/* RIGHT COLUMN (Maps)            */}
          {/* ============================== */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
            
            {/* MOD 06: OFFICIAL SKI MAP */}
            <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col">
              <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase border-b border-slate-800 pb-2 mb-6 flex justify-between">
                <span>MOD_06 // OFFICIAL_TRAIL_MAP</span>
              </h2>
              {data.official_ski_map_url ? (
                <div 
                  className="w-full overflow-hidden bg-slate-950 border border-slate-800 rounded-sm relative group cursor-pointer" 
                  onClick={() => window.open(data.official_ski_map_url, '_blank')}
                >
                  <img 
                    src={data.official_ski_map_url} 
                    alt="Map" 
                    className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-all duration-700" 
                  />
                  <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-cyan-500/50 px-4 py-2 text-[10px] text-cyan-400 tracking-widest uppercase font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    [ CLICK_TO_ENLARGE ]
                  </div>
                </div>
              ) : (
                <div className="w-full h-48 bg-slate-950/50 border border-dashed border-slate-700 flex flex-col items-center justify-center">
                   <span className="text-slate-500 text-xs tracking-widest uppercase">NO_MAP_DATA_FOUND</span>
                </div>
              )}
            </div>

            {/* MOD 02: TERRAIN PROFILE */}
            <div className="bg-slate-900/80 border border-slate-800 p-6">
              <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase border-b border-slate-800 pb-2 mb-6 flex justify-between">
                <span>MOD_02 // TERRAIN_PROFILE</span>
                <span className="text-white">{data.db_stats.total_slopes} <span className="text-slate-500">TOTAL KM</span></span>
              </h2>
              
              <div className="flex justify-between items-end mb-6">
                <div>
                  <span className="block text-[9px] uppercase tracking-widest opacity-80">ELEVATION_DELTA</span>
                  <span className="text-3xl font-black text-cyan-400">{data.db_stats.lowest_point}M - {data.db_stats.highest_point}M</span>
                </div>
              </div>
              {/* Vertical Progress Bars */}
              <div className="flex items-end justify-around h-32 border-b border-slate-800 pb-2 mt-6">
                <div className="flex flex-col items-center justify-end h-full w-16 group">
                  <span className="text-[10px] text-blue-400 mb-2 group-hover:opacity-100 transition-opacity">{data.db_stats.beginner_slopes}km</span>
                  <div className="w-full bg-blue-500 transition-all duration-500" style={{ height: `${pBeginner}%` }}></div>
                  <span className="text-[9px] tracking-widest uppercase mt-2 text-slate-400">BEG</span>
                </div>
                
                <div className="flex flex-col items-center justify-end h-full w-16 group">
                  <span className="text-[10px] text-red-400 mb-2 group-hover:opacity-100 transition-opacity">{data.db_stats.intermediate_slopes}km</span>
                  <div className="w-full bg-red-500 transition-all duration-500" style={{ height: `${pIntermediate}%` }}></div>
                  <span className="text-[9px] tracking-widest uppercase mt-2 text-slate-400">INT</span>
                </div>

                <div className="flex flex-col items-center justify-end h-full w-16 group">
                  <span className="text-[10px] text-slate-400 mb-2 group-hover:opacity-100 transition-opacity">{data.db_stats.difficult_slopes}km</span>
                  <div className="w-full bg-slate-500 transition-all duration-500" style={{ height: `${pExpert}%` }}></div>
                  <span className="text-[9px] tracking-widest uppercase mt-2 text-slate-400">EXP</span>
                </div>
              </div>
              
              <div className="pt-4 flex justify-between text-[10px] text-slate-500 tracking-widest uppercase">
                <span>SNOW_CANNONS: {data.db_stats.snow_cannons}</span>
                <span>SNOWPARK: {data.db_stats.snowparks ? 'YES' : 'NO'}</span>
              </div>
            </div>
            
            {/* MOD 07: SATELLITE MAP OVERLAY */}
            <div className="h-[1000px]">
            <MapOverlayModule lat={mapCoords.lat} lon={mapCoords.lon} fullHeight={true} />
            </div>
          </div>
        </div>
      </div>

      {/* --- NEW: MISSION DEPLOYMENT MODAL --- */}
      {isMissionModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-purple-500 p-6 rounded-lg shadow-[0_0_30px_rgba(147,51,234,0.3)] max-w-md w-full relative">
            <button onClick={() => setIsMissionModalOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">X</button>
            
            <h2 className="text-purple-400 font-bold tracking-widest border-b border-purple-500/30 pb-2 mb-4">DEPLOY TARGET TO MISSION</h2>
            
            {isDeploying ? (
              <div className="text-center text-purple-500/50 text-xs py-8 animate-pulse tracking-widest">TRANSMITTING_COORDINATES...</div>
            ) : (
              <div className="space-y-6">
                
                {/* CREATE NEW MISSION */}
                <div>
                  <p className="text-[10px] text-slate-500 mb-2">INITIALIZE_NEW_MISSION</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newMissionName} 
                      onChange={e=>setNewMissionName(e.target.value)} 
                      placeholder="Codename (e.g. Operation Powder)" 
                      className="flex-1 bg-slate-950 border border-slate-700 p-2 text-xs text-white focus:border-purple-500 outline-none" 
                    />
                    <button 
                      onClick={handleCreateNewMission} 
                      disabled={!newMissionName} 
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-2 text-[10px] disabled:bg-slate-800 disabled:text-slate-500 transition-colors"
                    >
                      CREATE
                    </button>
                  </div>
                </div>

                {/* ADD TO EXISTING MISSION */}
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-[10px] text-slate-500 mb-2">APPEND_TO_ACTIVE_MISSION</p>
                  {userTrips.length === 0 ? (
                    <div className="text-xs text-slate-600 border border-slate-800 p-2 text-center">NO_ACTIVE_MISSIONS_FOUND</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar border border-slate-800">
                      {userTrips.map(trip => (
                        <div key={trip.id} className="flex justify-between items-center bg-slate-950 p-2 border-b border-slate-800 last:border-0 hover:bg-purple-900/20 group">
                          <div>
                            <p className="text-xs text-slate-300 font-bold uppercase">{trip.name}</p>
                            <p className="text-[9px] text-slate-500">{trip.legs?.length || 0} Targets Assigned</p>
                          </div>
                          <button 
                            onClick={() => handleAddToExistingMission(trip.id, trip.legs?.length || 0)} 
                            className="text-[9px] border border-purple-900 text-purple-400 group-hover:bg-purple-600 group-hover:text-white px-3 py-1 font-bold transition-colors"
                          >
                            + APPEND
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}