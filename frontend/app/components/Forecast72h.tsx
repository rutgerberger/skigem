"use client";

import { useState } from "react";

export default function Forecast72h({ data }: { data: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data || !data.time) return null;
  const dataPoints = [];
  
  // The specific hours of the day we want to extract (0-23 format)
  const targetHours = [0, 3, 6, 9, 12, 15, 18, 21];
  
  // Loop through the 72 hours of data
  for (let i = 0; i < 72; i++) {
    if (data.time[i]) {
      const dateObj = new Date(data.time[i]);
      const currentHour = dateObj.getHours();

      // Only grab the data if it falls on one of our target hours
      if (targetHours.includes(currentHour)) {
        // Format the hour nicely (e.g., 06:00 instead of 6:00)
        const formattedHour = currentHour.toString().padStart(2, '0');
        
        dataPoints.push({
          label: `${dateObj.toLocaleDateString('en-US', { weekday: 'short' })} ${formattedHour}:00`,
          snow: Math.round(data.snowCm[i] || 0),
          rain: Math.round(data.rainMm[i] || 0),
          tempP: Math.round(data.tempPeak[i] || 0),
          tempV: Math.round(data.tempValley[i] || 0),
          wind: Math.round(data.windKmh[i] || 0),
          sunLevel: 100 - (data.cloudCover[i] || 0),
          freeze: Math.round(data.freezingLevel[i] || 0)
        });
      }
    }
  }

  // Determine how many rows to show based on expanded state
  const visibleData = isExpanded ? dataPoints : dataPoints.slice(0, 8);

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 transition-all duration-500">
      <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-4">
        <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase">
          MOD_05 // 72H_PROJECTION_MATRIX
        </h2>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[9px] px-2 py-1 border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500 hover:text-slate-950 font-bold tracking-widest transition-colors uppercase"
        >
          {isExpanded ? "COLLAPSE [X]" : "EXPAND [ ]"}
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b border-slate-800 text-[9px] text-slate-500 uppercase tracking-widest">
              <th className="p-2">Timeline</th>
              <th className="p-2">Precip (Snow/Rain)</th>
              <th className="p-2">Sun %</th>
              <th className="p-2">Temp (Peak/Valley)</th>
              <th className="p-2">Valley Wind</th>
              <th className="p-2 text-right">0°C Level</th>
            </tr>
          </thead>
          <tbody>
            {visibleData.map((dp, idx) => (
              <tr key={idx} className="border-b border-slate-800/50 text-sm font-mono hover:bg-slate-800/30 transition-colors">
                <td className="p-2 text-cyan-500">{dp.label}</td>
                <td className="p-2">
                  {dp.snow > 0 ? <span className="text-cyan-300">{dp.snow}cm ❄️</span> : null}
                  {dp.rain > 0 ? <span className="text-blue-500 ml-2">{dp.rain}mm 💧</span> : null}
                  {dp.snow === 0 && dp.rain === 0 ? <span className="text-slate-600">-</span> : null}
                </td>
                <td className="p-2 text-yellow-500">{dp.sunLevel}%</td>
                <td className="p-2">
                  <span className="text-white">{dp.tempP}°</span> <span className="text-slate-500">/</span> <span className="text-slate-400">{dp.tempV}°</span>
                </td>
                <td className="p-2 text-slate-400">{dp.wind} <span className="text-[10px]">km/h</span></td>
                <td className="p-2 text-right text-cyan-600">{dp.freeze}m</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Small hint at the bottom when collapsed */}
        {!isExpanded && dataPoints.length > 8 && (
          <div className="text-center mt-3 pt-2">
            <span className="text-[9px] text-slate-600 tracking-widest uppercase">
              SHOWING NEXT 24H. CLICK EXPAND FOR FULL PROJECTION.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}