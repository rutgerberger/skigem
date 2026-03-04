"use client";

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

export default function CurrentConditions({ data, weatherCode }: { data: any, weatherCode?: number }) {
  if (!data) return null;

  // Default to 0 if no code is passed
  const weatherStatus = getWeatherStatus(weatherCode ?? 0);

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col h-full">
      <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-4">
        <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase">
          MOD_01 // LIVE_ATMOSPHERICS
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-widest bg-cyan-950/50 px-2 py-1 border border-cyan-900">
            {weatherStatus.label}
          </span>
          <span className="text-xl drop-shadow-lg">{weatherStatus.icon}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-grow">
        {/* Valley Metrics */}
        <div className="border border-slate-800 bg-slate-950/50 p-4">
          <span className="block text-[10px] text-cyan-500 font-bold tracking-widest uppercase mb-3 border-b border-cyan-900/50 pb-1">Valley Level ({data.valleyAlt}m)</span>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Temp</span>
              <span className="text-lg text-white font-mono">{data.valleyTemp}°C</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Snow Base</span>
              <span className="text-lg text-white font-mono">{data.valleySnowDepth} <span className="text-[10px] text-slate-500">cm</span></span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Wind</span>
              <span className="text-lg text-white font-mono">{data.valleyWind} <span className="text-[10px] text-slate-500">km/h</span></span>
            </div>
          </div>
        </div>

        {/* Peak Metrics */}
        <div className="border border-slate-800 bg-slate-950/50 p-4">
          <span className="block text-[10px] text-cyan-500 font-bold tracking-widest uppercase mb-3 border-b border-cyan-900/50 pb-1">Peak Level ({data.peakAlt}m)</span>
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Temp</span>
              <span className="text-lg text-white font-mono">{data.peakTemp}°C</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Snow Base</span>
              <span className="text-lg text-white font-mono">{data.peakSnowDepth} <span className="text-[10px] text-slate-500">cm</span></span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest">Wind</span>
              <span className="text-lg text-white font-mono">{data.peakWind} <span className="text-[10px] text-slate-500">km/h</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Altitude Boundaries */}
      <div className="mt-4 flex gap-4 border-t border-slate-800 pt-4">
        <div className="flex-1 text-center">
          <span className="block text-[9px] text-slate-500 tracking-widest uppercase">0°C Freezing Level</span>
          <span className="text-sm text-cyan-400 font-mono">{data.freezingLevel}m</span>
        </div>
        <div className="flex-1 text-center border-l border-slate-800">
          <span className="block text-[9px] text-slate-500 tracking-widest uppercase">Rain/Snow Line</span>
          <span className="text-sm text-blue-400 font-mono">{data.snowLevel}m</span>
        </div>
      </div>
    </div>
  );
}