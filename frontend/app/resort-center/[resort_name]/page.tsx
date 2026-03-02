"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Map, Marker } from "pigeon-maps";

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

// --- SUB-COMPONENT: GEOSPATIAL MAP MODULE ---
function GeospatialModule({ resortName, lat, lon }: { resortName: string, lat: number, lon: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [is3dMode, setIs3dMode] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isExpanded ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isExpanded]);

  return (
    <div className={`transition-all duration-500 ${
      isExpanded 
        ? 'fixed inset-4 z-[100] bg-slate-950/95 backdrop-blur-3xl border-l-4 border-cyan-500 p-8 rounded-xl shadow-2xl flex flex-col' 
        : 'bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500/50 p-6 rounded-md shadow-lg flex flex-col w-full h-full'
    }`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-cyan-500 uppercase tracking-widest">MOD_04 // GEOSPATIAL_OVERLAY</h3>
        <div className="flex gap-3">
          <button 
            onClick={() => setIs3dMode(!is3dMode)}
            className={`text-[9px] px-2 py-1 border font-bold tracking-widest transition-colors ${is3dMode ? 'bg-orange-500 text-slate-900 border-orange-500' : 'bg-transparent text-slate-500 border-slate-700 hover:text-orange-500 hover:border-orange-500'}`}
          >
            {is3dMode ? "[ PRO ] 3D_TERRAIN: REQ_UPGRADE" : "3D_TERRAIN"}
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[9px] px-2 py-1 border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-slate-950 font-bold tracking-widest transition-colors"
          >
            {isExpanded ? "COLLAPSE [X]" : "EXPAND [ ]"}
          </button>
        </div>
      </div>
      
      <div className={`w-full bg-slate-950/80 border border-slate-700 relative overflow-hidden rounded-sm group z-10 flex-grow ${isExpanded ? 'min-h-[50vh]' : 'min-h-[250px]'}`}>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-pulse pointer-events-none z-10"></div>
        
        <div className="w-full h-full invert-[.95] hue-rotate-[180deg] brightness-75 contrast-125 grayscale-[20%] transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-90 cursor-crosshair">
          <Map center={[lat, lon]} zoom={12} zoomSnap={false}>
            <Marker width={40} anchor={[lat, lon]} color="#06b6d4" />
          </Map>
        </div>
        
        <div className="absolute bottom-3 left-3 z-20 bg-slate-950/90 px-3 py-1.5 border border-cyan-500/40 text-[10px] text-cyan-500 font-bold uppercase tracking-widest shadow-lg backdrop-blur-sm pointer-events-none">
          SAT_LINK // {resortName.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function TelemetryDashboard() {
  const router = useRouter();
  const params = useParams(); 
  
  const rawResortParam = params?.resort_name ? decodeURIComponent(params.resort_name as string) : "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [mapCoords, setMapCoords] = useState<{lat: number, lon: number}>({ lat: 47.1296, lon: 10.2681 });

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

        let targetLat = 47.1296;
        let targetLon = 10.2681;

        if (matchedResort) {
          targetLat = matchedResort.latitude;
          targetLon = matchedResort.longitude;
          setMapCoords({ lat: targetLat, lon: targetLon });
        }

        // ADDED weather_code TO THE OPEN METEO QUERY
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,apparent_temperature,wind_speed_10m,weather_code&hourly=freezing_level_height&daily=snowfall_sum&past_days=28&forecast_days=3&timezone=auto`;
        
        const res = await fetch(meteoUrl);
        if (!res.ok) throw new Error("PUBLIC_UPLINK_FAILED: Weather satellite did not respond.");
        const meteoData = await res.json();

        const current = meteoData.current || {};
        const hourly = meteoData.hourly || {};
        const daily = meteoData.daily || {};

        const historical_4_weeks = [];
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

        const mockTelemetry = {
          resort_name: matchedResort ? matchedResort.name : rawResortParam,
          weather: {
            temp_peak_c: Math.round(current.temperature_2m) || -2,
            wind_speed_kmh: Math.round(current.wind_speed_10m) || 15,
            weather_code: current.weather_code !== undefined ? current.weather_code : 0, // NEW DATA POINT
          },
          snow: {
            base_depth_cm: 145, 
            forecast_next_48h_cm: Math.round(forecast_48h),
            historical_4_weeks: historical_4_weeks.length ? historical_4_weeks : Array(28).fill({ date: "N/A", amount_cm: 0 }),
          },
          open_lifts: 38, 
          total_lifts: 45, 
          deep_cuts: {
            wind_chill_c: Math.round(current.apparent_temperature) || -8,
            freezing_level_m: hourly.freezing_level_height ? Math.round(hourly.freezing_level_height[0]) : 2150,
            avalanche_danger: 3, 
            avalanche_trend: "STABLE", 
            artificial_snow_pct: 78, 
            lift_mechanics: { high_speed_quad_pct: 65, tbar_pct: 12, gondola_pct: 23 }, 
            economy: { beer_05l_eur: 6.80, kaiserschmarrn_eur: 14.50 } 
          }
        };

        setData(mockTelemetry);
      } catch (err: any) {
        setError(err.message || "Failed to establish connection.");
      } finally {
        setLoading(false);
      }
    }

    fetchPublicTelemetry();
  }, [rawResortParam]);

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

  const getAvalancheColor = (level: number) => {
    if (level <= 2) return "text-yellow-400 border-yellow-900";
    if (level === 3) return "text-orange-500 border-orange-700 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse";
    return "text-red-500 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse";
  };

  const localMaxSnowfall = Math.max(...data.snow.historical_4_weeks.map((d: any) => d.amount_cm), 0); 
  const chartScaleMax = Math.max(localMaxSnowfall, 25);
  
  // Calculate current weather state
  const weatherStatus = getWeatherStatus(data.weather.weather_code);

  return (
    <div className="min-h-screen bg-slate-950 relative font-mono selection:bg-cyan-500 selection:text-white pb-20">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1551524164-687a55dd1126?q=80&w=1625&auto=format&fit=crop')] bg-cover bg-center bg-fixed opacity-5"></div>
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"></div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-10 pt-24 text-white">

        <div className="border-b border-slate-800 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest drop-shadow-md">
              <span className="text-cyan-500">_</span> {data.resort_name}
            </h1>
            <p className="text-cyan-600/80 mt-2 text-xs font-bold uppercase tracking-[0.3em]">
              DEEP_CUT_TELEMETRY_HUB
            </p>
          </div>
          <div className="text-right flex flex-col items-start md:items-end">
             <span className="text-[10px] text-slate-500 tracking-widest uppercase">SYS_STATUS // OPEN_API_LIVE</span>
             <span className="text-cyan-400 font-bold tracking-widest uppercase text-xs">DATA_AGE: &lt; 1 MIN</span>
          </div>
        </div>

        {/* --- DASHBOARD GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COL 1: ATMOSPHERIC & HAZARD */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6">
              <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-4">
                <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase">MOD_01 // ATMOSPHERIC</h2>
                
                {/* DYNAMIC WEATHER ICON */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest bg-cyan-950/50 px-2 py-1 border border-cyan-900">
                    {weatherStatus.label}
                  </span>
                  <span className="text-xl drop-shadow-lg">{weatherStatus.icon}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 gap-x-4 mt-6">
                <div>
                  <span className="block text-[9px] text-slate-500 tracking-widest uppercase">PEAK_TEMP</span>
                  <span className="text-2xl text-cyan-400 font-bold">{data.weather.temp_peak_c}°C</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-500 tracking-widest uppercase">WIND_CHILL</span>
                  <span className="text-2xl text-cyan-600 font-bold">{data.deep_cuts.wind_chill_c}°C</span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-500 tracking-widest uppercase">WIND_VELOCITY</span>
                  <span className="text-lg text-slate-300 font-bold">{data.weather.wind_speed_kmh} <span className="text-xs">KM/H</span></span>
                </div>
                <div>
                  <span className="block text-[9px] text-slate-500 tracking-widest uppercase">FREEZING_LEVEL</span>
                  <span className="text-lg text-slate-300 font-bold">{data.deep_cuts.freezing_level_m} <span className="text-xs">M</span></span>
                </div>
              </div>
            </div>

            <div className={`bg-slate-900/80 border p-6 transition-colors ${getAvalancheColor(data.deep_cuts.avalanche_danger)}`}>
              <h2 className="text-xs font-bold tracking-widest uppercase mb-4 opacity-70 border-b border-current pb-2">MOD_02 // HAZARD_&_SNOW</h2>
              
              <div className="flex justify-between items-end mb-6">
                <div>
                  <span className="block text-[9px] uppercase tracking-widest opacity-80">LAWINENGEFAHR (1-5)</span>
                  <span className="text-5xl font-black">{data.deep_cuts.avalanche_danger}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] uppercase tracking-widest opacity-80">TREND</span>
                  <span className="text-xl font-bold uppercase tracking-widest">[{data.deep_cuts.avalanche_trend}]</span>
                </div>
              </div>

              <div className="space-y-4 border-t border-current pt-4 opacity-90">
                <div>
                  <div className="flex justify-between text-[10px] tracking-widest uppercase mb-1">
                    <span>NATURAL_BASE [SIMULATED]</span><span>{data.snow.base_depth_cm} CM</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5"><div className="bg-current h-full" style={{ width: `${Math.min((data.snow.base_depth_cm / 200) * 100, 100)}%` }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] tracking-widest uppercase mb-1">
                    <span>ARTIFICIAL_CANNON_COVERAGE</span><span>{data.deep_cuts.artificial_snow_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5"><div className="bg-current h-full" style={{ width: `${data.deep_cuts.artificial_snow_pct}%` }}></div></div>
                </div>
              </div>
            </div>
          </div>

          {/* COL 2: INFRASTRUCTURE & ECONOMY */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/80 border border-slate-800 p-6 flex-1">
              <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase mb-4 border-b border-slate-800 pb-2">MOD_03 // LIFT_MECHANICS</h2>
              
              <div className="flex justify-between items-end mb-6">
                <span className="text-4xl font-black text-white">{data.open_lifts} <span className="text-xl text-slate-600">/ {data.total_lifts}</span></span>
                <span className="text-cyan-400 text-[10px] tracking-widest uppercase font-bold border border-cyan-900 px-2 py-1 bg-cyan-950/30">ACTIVE</span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] tracking-widest text-slate-400 uppercase mb-1">
                    <span>HIGH_SPEED_DETACHABLE</span><span>{data.deep_cuts.lift_mechanics.high_speed_quad_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 border border-slate-800 h-2"><div className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${data.deep_cuts.lift_mechanics.high_speed_quad_pct}%` }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] tracking-widest text-slate-400 uppercase mb-1">
                    <span>GONDOLA / CABLE_CAR</span><span>{data.deep_cuts.lift_mechanics.gondola_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 border border-slate-800 h-2"><div className="bg-cyan-500 h-full" style={{ width: `${data.deep_cuts.lift_mechanics.gondola_pct}%` }}></div></div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] tracking-widest text-slate-400 uppercase mb-1">
                    <span>T-BAR / DRAG_LIFT (PAIN_INDEX)</span><span>{data.deep_cuts.lift_mechanics.tbar_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-950 border border-slate-800 h-2"><div className="bg-red-500 h-full" style={{ width: `${data.deep_cuts.lift_mechanics.tbar_pct}%` }}></div></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-6">
              <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase mb-4 border-b border-slate-800 pb-2">MOD_04 // APRÉS_ECONOMY</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-800 bg-slate-950/50 p-3 text-center">
                  <span className="block text-[8px] text-slate-500 tracking-widest uppercase mb-1">BEER_INDEX (0.5L)</span>
                  <span className="text-xl text-green-400 font-mono font-bold">€{data.deep_cuts.economy.beer_05l_eur.toFixed(2)}</span>
                </div>
                <div className="border border-slate-800 bg-slate-950/50 p-3 text-center">
                  <span className="block text-[8px] text-slate-500 tracking-widest uppercase mb-1">KAISERSCHMARRN</span>
                  <span className="text-xl text-yellow-400 font-mono font-bold">€{data.deep_cuts.economy.kaiserschmarrn_eur.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COL 3: MAP MODULE */}
          <div className="lg:col-span-1 h-full min-h-[300px]">
            <GeospatialModule resortName={data.resort_name} lat={mapCoords.lat} lon={mapCoords.lon} />
          </div>

          {/* FULL WIDTH: HISTORICAL PRECIPITATION */}
          <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800 p-6 flex flex-col">
            <div className="flex justify-between items-end border-b border-slate-800 pb-2 mb-6">
               <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase">MOD_05 // PRECIPITATION_ARCHIVE</h2>
               <span className="text-[10px] text-cyan-400 tracking-widest uppercase bg-cyan-950/50 px-2 py-1 border border-cyan-900">NEXT 48H FORECAST: {data.snow.forecast_next_48h_cm} CM</span>
            </div>
            
            <div className="h-48 w-full flex items-end justify-between gap-1 px-2 pt-8 border-b border-slate-800/50 bg-slate-950/50 overflow-x-auto pb-2">
              {data.snow.historical_4_weeks.map((day: any, idx: number) => {
                const heightPct = (day.amount_cm / chartScaleMax) * 100; 
                
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end group min-w-[20px] h-full">
                    <div className="w-full flex-1 flex items-end justify-center relative">
                      <div 
                        className={`w-full transition-all duration-500 relative flex justify-center
                          ${day.amount_cm > 0 ? 'bg-cyan-800 group-hover:bg-cyan-500 border-t border-cyan-400/50' : 'bg-transparent'}`}
                        style={{ height: `${Math.max(heightPct, day.amount_cm > 0 ? 3 : 0)}%` }}
                      >
                         {day.amount_cm > 0 && (
                           <span className="text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 z-20 bg-slate-900 px-1 rounded-sm border border-slate-700">
                             {day.amount_cm}cm
                           </span>
                         )}
                      </div>
                    </div>
                    <span className={`text-[7px] text-slate-500 mt-2 truncate w-full text-center tracking-tighter uppercase group-hover:text-cyan-400 ${idx % 4 === 0 ? 'block' : 'hidden md:block'}`}>
                      {day.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}