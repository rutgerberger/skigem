"use client";
import { useState, useEffect } from "react";

export default function NewsIntelWidget({ resortName }: { resortName: string }) {
  const [intel, setIntel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!resortName) return;
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/resorts/${encodeURIComponent(resortName)}/intel`)
      .then(res => res.json())
      .then(data => setIntel(data))
      .catch(err => console.error("INTEL_ERR", err))
      .finally(() => setLoading(false));
  }, [resortName]);

  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "text-red-500 border-red-500 bg-red-950/30";
      case "WARNING": return "text-orange-500 border-orange-500 bg-orange-950/30";
      case "GOOD": return "text-green-500 border-green-500 bg-green-950/30";
      default: return "text-cyan-500 border-cyan-500 bg-cyan-950/30";
    }
  };

  // Helper to format the messy RSS pub_date into a clean tactical timestamp
  const formatTime = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase() + ' // ' + 
             d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "SYS_TIME: UNKNOWN";
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-yellow-500 p-6 rounded-md shadow-lg flex flex-col min-h-[250px] shrink-0">
      <h3 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="animate-pulse">📡</span> MODULE: TACTICAL_INTEL
      </h3>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-yellow-500/50 text-xs animate-pulse tracking-widest">
          INTERCEPTING_COMMUNICATIONS...
        </div>
      ) : intel?.intel_feed?.length > 0 ? (
        <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
          {intel.intel_feed.map((item: any, idx: number) => (
            <div key={idx} className={`p-3 border-l-2 flex flex-col justify-between ${getSeverityColors(item.severity)}`}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-1 bg-slate-950/50">
                    [{item.severity}]
                  </span>
                  <span className="text-[9px] text-slate-500 tracking-widest">
                    {formatTime(item.date)}
                  </span>
                </div>
                <h4 className="text-white text-xs font-bold mb-2 line-clamp-2">
                  {item.headline}
                </h4>
              </div>
              
              <a 
                href={item.url} 
                target="_blank" 
                rel="noreferrer"
                className="text-[9px] uppercase tracking-widest text-slate-400 hover:text-white mt-2 border-t border-slate-800/50 pt-2 inline-flex items-center gap-1 w-max"
              >
                ACCESS_SOURCE ↗
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[10px] text-slate-500 tracking-widest">
          NO_SIGNALS_DETECTED
        </div>
      )}
    </div>
  );
}