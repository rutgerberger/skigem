"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// --- SSR SAFE LEAFLET IMPORTS ---
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

interface ResortData {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
}

interface MapOverlayProps {
  fullHeight?: boolean;
}

export default function MapOverlayModule({ fullHeight = false }: MapOverlayProps) {
  const router = useRouter();
  
  const [allResorts, setAllResorts] = useState<ResortData[]>([]);
  
  // 1. Tracks the EXACT coordinates for the marker and weather API
  const [activeLocation, setActiveLocation] = useState({ 
    name: "Chamonix Valley, France", 
    lat: 45.9237, 
    lon: 6.8694 
  });

  // 2. NEW: Tracks the closest resort specifically for the Hub routing URL
  const [selectedResortForHub, setSelectedResortForHub] = useState<string>("Chamonix Valley, France");
  
  const [is3dMode, setIs3dMode] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [weatherData, setWeatherData] = useState<{ temp: number | null; wind: number | null; snow: number | null; status: string }>({
    temp: null, wind: null, snow: null, status: "LINKING...",
  });
  
  const [mapQuery, setMapQuery] = useState("");
  const [mapResults, setMapResults] = useState<ResortData[]>([]);
  const [showMapDropdown, setShowMapDropdown] = useState(false);
  const mapDropdownRef = useRef<HTMLDivElement>(null);

  const [mapInstance, setMapInstance] = useState<any>(null);
  const [customIcon, setCustomIcon] = useState<any>(null);

  // Initialize Custom Cyberpunk Marker
  useEffect(() => {
    import('leaflet').then((L) => {
      setCustomIcon(L.divIcon({
        className: 'bg-transparent',
        html: `<div class="w-4 h-4 bg-cyan-500 rounded-full shadow-[0_0_15px_3px_rgba(6,182,212,0.8)] border-2 border-slate-900 pointer-events-none"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      }));
    });
  }, []);

  // Handle Map Clicks, Closest Resort Math, and Resizing
  useEffect(() => {
    if (!mapInstance) return;

    const onMapClick = (e: any) => {
      const clickedLat = e.latlng.lat;
      const clickedLon = e.latlng.lng;

      // Ensure we have data loaded before trying to find the closest
      if (allResorts.length > 0) {
        let closestResort = allResorts[0];
        let minDistance = Infinity;

        // Haversine formula to find true geographic distance
        allResorts.forEach((resort) => {
          const R = 6371; 
          const dLat = (resort.latitude - clickedLat) * (Math.PI / 180);
          const dLon = (resort.longitude - clickedLon) * (Math.PI / 180);
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(clickedLat * (Math.PI / 180)) * Math.cos(resort.latitude * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
          const distanceInKm = R * c;

          if (distanceInKm < minDistance) {
            minDistance = distanceInKm;
            closestResort = resort;
          }
        });

        // UPDATE 1: Set pointer and weather to the EXACT clicked spot
        setActiveLocation({
          name: `CSTM_${clickedLat.toFixed(2)}_${clickedLon.toFixed(2)}`,
          lat: clickedLat,
          lon: clickedLon
        });

        // UPDATE 2: Save the closest resort name purely for the Open Hub button
        setSelectedResortForHub(closestResort.name);
        
      } else {
        // Fallback if the database hasn't loaded yet
        setActiveLocation({
          name: `CSTM_${clickedLat.toFixed(2)}_${clickedLon.toFixed(2)}`,
          lat: clickedLat,
          lon: clickedLon
        });
        setSelectedResortForHub(`CSTM_${clickedLat.toFixed(2)}_${clickedLon.toFixed(2)}`);
      }
    };

    mapInstance.on('click', onMapClick);

    const container = document.getElementById('map-container-wrapper');
    let resizeObserver: ResizeObserver | null = null;
    
    if (container) {
      resizeObserver = new ResizeObserver(() => {
        mapInstance.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      mapInstance.off('click', onMapClick);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [mapInstance, allResorts]);

  // Smoothly fly to new locations
  useEffect(() => {
    if (mapInstance) {
      mapInstance.flyTo([activeLocation.lat, activeLocation.lon], 13, { duration: 1.5 });
    }
  }, [activeLocation, mapInstance]);

  useEffect(() => {
    async function loadDatabaseResorts() {
      try {
        const res = await fetch("http://localhost:8000/api/resorts");
        if (res.ok) {
          const data: ResortData[] = await res.json();
          setAllResorts(data);
          if (data.length > 0) {
             setActiveLocation({ name: data[0].name, lat: data[0].latitude, lon: data[0].longitude });
             setSelectedResortForHub(data[0].name);
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
    setSelectedResortForHub(resort.name); // Keep them synced on search
    setMapQuery(""); 
    setShowMapDropdown(false);
  }

  function navigateToTelemetryHub() {
    router.push(`/resort-center/${encodeURIComponent(selectedResortForHub)}`);
  }

  return (
    <div 
      className={`transition-all duration-500 ${
        isMapExpanded 
          ? 'fixed inset-4 z-[100] bg-slate-950/95 backdrop-blur-3xl border-l-4 border-cyan-500 p-8 rounded-xl shadow-2xl flex flex-col' 
          : `bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500/50 p-6 rounded-md shadow-lg col-span-1 md:col-span-2 space-y-4 flex flex-col ${fullHeight ? 'h-full' : ''}`
      }`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-cyan-500/80 uppercase tracking-widest">MODULE: MAP_OVERLAY</h3>
        <div className="flex gap-4">
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
            className="w-full bg-transparent text-xs text-cyan-300 placeholder-slate-600 p-2 focus:outline-none tracking-wider"
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
      
      <div 
        id="map-container-wrapper" 
        className={`w-full bg-slate-950 border border-slate-700 relative overflow-hidden rounded-sm group z-10 flex-grow ${
          isMapExpanded ? 'min-h-[50vh]' : (fullHeight ? 'flex-1 min-h-[300px]' : 'h-72')
        }`}
      >
        <div className="absolute inset-0 z-0 w-full h-full cursor-crosshair">
          <MapContainer 
            ref={setMapInstance}
            center={[activeLocation.lat, activeLocation.lon]} 
            zoom={13} 
            scrollWheelZoom={true} 
            zoomSnap={1}
            style={{ height: "100%", width: "100%", background: "#020617" }}
            attributionControl={false}
          >
            {/* UPDATED: OpenTopoMap terrain base layer. MaxZoom 17 prevents grey tiles if they zoom too deep */}
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
              className="invert-[.95] hue-rotate-[180deg] brightness-80 contrast-100 grayscale-[40%]"
            />
            
            <TileLayer
              url="https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png"
              className="mix-blend-screen opacity-100 contrast-100 saturate-100 brightness-90"
            />

            {customIcon && (
              <Marker position={[activeLocation.lat, activeLocation.lon]} icon={customIcon} />
            )}
          </MapContainer>
        </div>

        {/* UPDATED: Added OpenTopoMap to the attribution array */}
        <div className="absolute bottom-1 right-1 z-[400] text-[8px] text-slate-500 bg-slate-950/80 px-2 py-0.5 rounded-tl-md backdrop-blur-sm pointer-events-auto">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-cyan-500">OSM</a> | 
          Terrain © <a href="https://opentopomap.org" target="_blank" rel="noreferrer" className="hover:text-cyan-500">OpenTopoMap</a> | 
          Tiles © <a href="https://www.opensnowmap.org" target="_blank" rel="noreferrer" className="hover:text-cyan-500">OpenSnowMap</a>
        </div>
        
        <div className="absolute bottom-3 left-3 z-[400] bg-slate-950/90 px-3 py-1.5 border border-cyan-500/40 text-[10px] text-cyan-500 font-bold uppercase tracking-widest shadow-lg backdrop-blur-sm pointer-events-none flex items-center gap-3">
          <span>LIVE_SAT_LINK // {selectedResortForHub.toUpperCase()}</span>
          <button 
            onClick={navigateToTelemetryHub}
            className="bg-cyan-500/20 hover:bg-cyan-500 text-cyan-500 hover:text-slate-950 px-2 py-1 border border-cyan-500 transition-colors pointer-events-auto"
            title={`Route to: ${selectedResortForHub}`}
          >
            OPEN_HUB ↗
          </button>
        </div>

        <div className="absolute top-3 right-3 z-[400] bg-slate-950/80 px-4 py-3 border border-cyan-500/40 shadow-xl backdrop-blur-md min-w-[180px]">
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