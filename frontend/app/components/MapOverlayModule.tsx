"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Map, Marker } from "pigeon-maps";

// Define the shape of the data coming from your new backend
interface ResortData {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
}

// --- ADD THE PROP INTERFACE HERE ---
interface MapOverlayProps {
  fullHeight?: boolean;
}

export default function MapOverlayModule({ fullHeight = false }: MapOverlayProps) {
  const router = useRouter();
  
  // State for our database resorts
  const [allResorts, setAllResorts] = useState<ResortData[]>([]);
  
  // Set a fallback initial location until the DB loads
  const [activeLocation, setActiveLocation] = useState({ 
    name: "Chamonix Valley, France", 
    lat: 45.9237, 
    lon: 6.8694 
  });
  
  const [is3dMode, setIs3dMode] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [weatherData, setWeatherData] = useState<{ temp: number | null; wind: number | null; snow: number | null; status: string }>({
    temp: null, wind: null, snow: null, status: "LINKING...",
  });
  
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState<ResortData[]>([]);
  const [showMapDropdown, setShowMapDropdown] = useState(false);
  const mapDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadDatabaseResorts() {
      try {
        const res = await fetch("http://localhost:8000/api/resorts");
        if (res.ok) {
          const data: ResortData[] = await res.json();
          setAllResorts(data);
          
          if (data.length > 0) {
             setActiveLocation({ name: data[0].name, lat: data[0].latitude, lon: data[0].longitude });
          }
        }
      } catch (err) {
        console.error("SYS_ERR: Failed to load resort database", err);
      }
    }
    loadDatabaseResorts();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mapDropdownRef.current && !mapDropdownRef.current.contains(event.target as Node)) {
        setShowMapDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMapExpanded ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [isMapExpanded]);

  useEffect(() => {
    async function fetchWeather() {
      setWeatherData(prev => ({ ...prev, status: "RECALIBRATING..." }));
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${activeLocation.lat}&longitude=${activeLocation.lon}&current=temperature_2m,wind_speed_10m,snow_depth`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setWeatherData({
            temp: data.current.temperature_2m,
            wind: data.current.wind_speed_10m,
            snow: data.current.snow_depth,
            status: "ONLINE",
          });
        } else {
          setWeatherData(prev => ({ ...prev, status: "ERR_UPLINK" }));
        }
      } catch (err) {
        setWeatherData(prev => ({ ...prev, status: "OFFLINE" }));
      }
    }
    fetchWeather();
  }, [activeLocation]);

  function handleMapSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setMapQuery(query);
    if (query.length > 0) {
      const filtered = allResorts.filter((resort) => 
        resort.name.toLowerCase().includes(query.toLowerCase())
      );
      setMapResults(filtered);
      setShowMapDropdown(true);
    } else {
      setMapResults([]);
      setShowMapDropdown(false);
    }
  }

  function handleSelectMapResort(resort: ResortData) {
    setActiveLocation({
      name: resort.name,
      lat: resort.latitude,
      lon: resort.longitude
    });
    setMapQuery(""); 
    setShowMapDropdown(false);
  }

  function handleMapClick({ latLng }: { latLng: [number, number] }) {
    setActiveLocation({
      name: `CSTM_${latLng[0].toFixed(2)}_${latLng[1].toFixed(2)}`,
      lat: latLng[0],
      lon: latLng[1]
    });
  }

  function navigateToTelemetryHub(resortName: string) {
    router.push(`/resort-center/${encodeURIComponent(resortName)}`);
  }

  return (
    <div 
      className={`transition-all duration-500 ${
        isMapExpanded 
          ? 'fixed inset-4 z-[100] bg-slate-950/95 backdrop-blur-3xl border-l-4 border-cyan-500 p-8 rounded-xl shadow-2xl flex flex-col' 
          // --- UPDATED: Added h-full if fullHeight is true ---
          : `bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500/50 p-6 rounded-md shadow-lg col-span-1 md:col-span-2 space-y-4 flex flex-col ${fullHeight ? 'h-full' : ''}`
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-cyan-500/80 uppercase tracking-widest">MODULE: MAP_OVERLAY</h3>
        <div className="flex gap-4">
          <button 
            onClick={() => setIs3dMode(!is3dMode)}
            className={`text-[10px] px-2 py-1 border font-bold tracking-widest transition-colors ${is3dMode ? 'bg-orange-500 text-slate-900 border-orange-500' : 'bg-transparent text-slate-500 border-slate-700 hover:text-orange-500 hover:border-orange-500'}`}
          >
            {is3dMode ? "[ PRO ] 3D_TERRAIN: REQ_UPGRADE" : "3D_TERRAIN_MODE"}
          </button>
          <button 
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className="text-[10px] px-2 py-1 border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-slate-950 font-bold tracking-widest transition-colors"
          >
            {isMapExpanded ? "COLLAPSE_VIEW [X]" : "EXPAND_VIEW [ ]"}
          </button>
        </div>
      </div>
      
      <div className="relative z-30 mb-2" ref={mapDropdownRef}>
        <div className="flex bg-slate-950/50 border border-slate-700 focus-within:border-cyan-500 rounded-sm p-1 items-center shadow-inner">
          <span className="text-cyan-500/50 pl-2 font-bold select-none">&gt;</span>
          <input 
            type="text"
            value={mapQuery}
            onChange={handleMapSearchChange}
            onFocus={() => { if (mapResults.length > 0) setShowMapDropdown(true); }}
            placeholder={allResorts.length === 0 ? "AWAITING_DB_SYNC..." : "Scan coordinates for resort..."}
            disabled={allResorts.length === 0}
            className="w-full bg-transparent text-xs text-cyan-300 placeholder-slate-600 p-2 focus:outline-none tracking-wider disabled:opacity-50"
          />
        </div>

        {showMapDropdown && mapResults.length > 0 && (
          <ul className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-cyan-500/50 rounded-sm shadow-2xl max-h-48 overflow-y-auto z-50">
            {mapResults.map((resort) => (
              <li 
                key={resort.id} 
                className="p-2 text-xs text-slate-300 hover:bg-cyan-900/50 hover:text-cyan-300 cursor-pointer transition-colors border-b border-slate-800 last:border-0" 
                onClick={() => handleSelectMapResort(resort)}
              >
                {resort.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* --- UPDATED: Replaced h-72 logic with fullHeight prop logic --- */}
      <div className={`w-full bg-slate-950/80 border border-slate-700 relative overflow-hidden rounded-sm group z-10 flex-grow ${
        isMapExpanded ? 'min-h-[50vh]' : (fullHeight ? 'flex-1 min-h-[300px]' : 'h-72')
      }`}>
        <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent animate-pulse pointer-events-none z-10"></div>
        
        <div className="w-full h-full invert-[.95] hue-rotate-[180deg] brightness-75 contrast-125 grayscale-[20%] transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-90 cursor-crosshair">
          <Map center={[activeLocation.lat, activeLocation.lon]} zoom={11} onClick={handleMapClick} zoomSnap={false}>
            <Marker width={40} anchor={[activeLocation.lat, activeLocation.lon]} color="#06b6d4" />
          </Map>
        </div>
        
        <div className="absolute bottom-3 left-3 z-20 bg-slate-950/90 px-3 py-1.5 border border-cyan-500/40 text-[10px] text-cyan-500 font-bold uppercase tracking-widest shadow-lg backdrop-blur-sm pointer-events-none flex items-center gap-3">
          <span>LIVE_SAT_LINK // {activeLocation.name.toUpperCase()}</span>
          <button 
            onClick={() => navigateToTelemetryHub(activeLocation.name)}
            className="bg-cyan-500/20 hover:bg-cyan-500 text-cyan-500 hover:text-slate-950 px-2 py-1 border border-cyan-500 transition-colors pointer-events-auto"
          >
            OPEN_HUB ↗
          </button>
        </div>

        <div className="absolute top-3 right-3 z-20 bg-slate-950/80 px-4 py-3 border border-cyan-500/40 shadow-xl backdrop-blur-md min-w-[180px]">
          <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest mb-2 border-b border-cyan-500/30 pb-1 flex justify-between">
            <span>ENV_TELEMETRY</span>
            <span className={weatherData.status === "ONLINE" ? "text-green-500" : "text-orange-500 animate-pulse"}>
              [{weatherData.status}]
            </span>
          </p>
          
          {weatherData.temp !== null ? (
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] text-slate-400">TEMP</p>
                <p className="text-lg font-bold text-white">{weatherData.temp}°<span className="text-sm text-cyan-500">c</span></p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400">WIND</p>
                <p className="text-lg font-bold text-white">{weatherData.wind} <span className="text-xs text-cyan-500">km/h</span></p>
              </div>
              <div className="text-right">
                <a href={`https://open-meteo.com/en/docs#latitude=${activeLocation.lat}&longitude=${activeLocation.lon}`} target="_blank" rel="noopener noreferrer" className="group/link block pointer-events-auto">
                  <p className="text-[10px] text-slate-400 group-hover/link:text-cyan-400 transition-colors">SNOW ↗</p>
                  <p className="text-lg font-bold text-white group-hover/link:text-cyan-300 transition-colors">
                    {weatherData.snow ?? 0} <span className="text-xs text-cyan-500 group-hover/link:text-cyan-300">m</span>
                  </p>
                </a>
              </div>
            </div>
          ) : (
            <p className="text-xs text-cyan-500/70 font-bold animate-pulse py-2 text-center">
              AWAITING_DATA...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}