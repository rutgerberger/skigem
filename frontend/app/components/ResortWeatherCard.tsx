"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

interface ResortWeatherCardProps {
  name: string;
  lat?: number;
  lon?: number;
  alt?: number;
  href: string;
  aiData?: {
    metric: string;
    condition: string;
    color: string;
    border: string;
  };
  hoverBorderClass?: string;
}

export default function ResortWeatherCard({ name, lat, lon, alt, href, aiData, hoverBorderClass = "hover:border-cyan-500/50" }: ResortWeatherCardProps) {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchWeather() {
      try {
        let finalLat = lat;
        let finalLon = lon;
        let finalAlt = alt || 2000;

        // 1. If coordinates weren't passed (e.g. AI generated a name), Geocode it.
        if (!finalLat || !finalLon) {
          const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&format=json`);
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            finalLat = geoData.results[0].latitude;
            finalLon = geoData.results[0].longitude;
            finalAlt = geoData.results[0].elevation || 2000;
          } else {
            if (isMounted) setLoading(false);
            return; 
          }
        }

        // 2. Fetch Weather & Snow History
        const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLon}&elevation=${finalAlt}&current=temperature_2m,weather_code&daily=snowfall_sum&past_days=28&forecast_days=1&timezone=auto`;
        const mRes = await fetch(meteoUrl);
        const mData = await mRes.json();

        const wCode = mData.current?.weather_code || 0;
        const statusInfo = getWeatherStatus(wCode);
        const isSnowing = [71, 73, 75, 77, 85, 86].includes(wCode);

        let lastSnowAmount = 0;
        let lastSnowDate = "NO RECENT SNOW";
        
        if (mData.daily?.snowfall_sum) {
          for (let i = 28; i >= 0; i--) {
            if (mData.daily.snowfall_sum[i] > 0.5) {
              lastSnowAmount = Math.round(mData.daily.snowfall_sum[i]);
              const d = new Date(mData.daily.time[i]);
              lastSnowDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              break;
            }
          }
        }

        if (isMounted) {
          setWeather({
            temp: Math.round(mData.current?.temperature_2m || 0),
            isSnowing,
            lastSnowDate,
            lastSnowAmount,
            weatherLabel: statusInfo.label,
            weatherIcon: statusInfo.icon
          });
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) setLoading(false);
      }
    }

    fetchWeather();
    return () => { isMounted = false; };
  }, [name, lat, lon, alt]);

  // Determine border class (AI passes its own, otherwise use default)
  const borderClass = aiData ? `hover:${aiData.border}/50` : hoverBorderClass;

  return (
    <Link 
      href={href}
      className={`block bg-slate-950/50 border border-slate-800 p-3 hover:bg-slate-900 transition-all group ${borderClass}`}
    >
      {/* Top Row: Resort Name & Live Temperature + Icon */}
      <div className="flex justify-between items-start mb-1">
        <span className="text-slate-200 text-sm font-bold uppercase group-hover:text-white transition-colors truncate pr-2">
          {name}
        </span>
        {weather && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-lg drop-shadow-md">{weather.weatherIcon}</span>
            <span className="text-cyan-400 font-mono text-sm font-bold">{weather.temp}°C</span>
          </div>
        )}
      </div>
      
      {/* Middle Row: AI Metric OR Standard Weather Label */}
      <div className="flex justify-between items-center mb-2">
        {aiData ? (
          <>
            <span className={`text-[10px] font-bold tracking-widest ${aiData.color}`}>
              {aiData.metric}
            </span>
            <span className="text-[9px] text-slate-500 tracking-widest border border-slate-700 px-1 py-0.5">
              {aiData.condition}
            </span>
          </>
        ) : (
          weather && (
            <span className="text-[9px] text-cyan-500 tracking-widest uppercase border border-cyan-900/50 px-1 py-0.5">
              {weather.weatherLabel}
            </span>
          )
        )}
      </div>

      {/* Bottom Row: Snow Telemetry */}
      {weather ? (
        <div className="flex justify-between items-center mt-2 border-t border-slate-800/50 pt-2 text-[9px] tracking-widest text-slate-400 uppercase font-mono">
          <span className="truncate pr-2">
            L_SNOW: {weather.lastSnowAmount && weather.lastSnowAmount > 0 
              ? <span className="text-white">{weather.lastSnowAmount}cm <span className="text-slate-500">({weather.lastSnowDate})</span></span> 
              : <span className="text-slate-600">{weather.lastSnowDate}</span>}
          </span>
          <span className="shrink-0">
            ACTIVE: {weather.isSnowing 
              ? <span className="text-cyan-400 font-bold animate-pulse">YES</span> 
              : <span className="text-slate-600">NO</span>}
          </span>
        </div>
      ) : loading ? (
        <div className="mt-2 border-t border-slate-800/50 pt-2 text-[9px] text-slate-600 animate-pulse tracking-widest uppercase">
          ACQUIRING_TELEMETRY...
        </div>
      ) : (
        <div className="mt-2 border-t border-slate-800/50 pt-2 text-[9px] text-red-500/70 tracking-widest uppercase">
          TELEMETRY_UNAVAILABLE
        </div>
      )}
    </Link>
  );
}