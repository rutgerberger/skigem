"use client";

export default function PrecipitationArchive({ snowData }: { snowData: any }) {
  if (!snowData || !snowData.historical_4_weeks) return null;

  const localMaxSnowfall = Math.max(...snowData.historical_4_weeks.map((d: any) => d.amount_cm), 0); 
  const chartScaleMax = Math.max(localMaxSnowfall, 25);

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 flex flex-col">
      <div className="flex justify-between items-end border-b border-slate-800 pb-2 mb-6">
         <h2 className="text-cyan-600 text-xs font-bold tracking-widest uppercase">MOD_08 // PRECIPITATION_ARCHIVE</h2>
         <span className="text-[10px] text-cyan-400 tracking-widest uppercase bg-cyan-950/50 px-2 py-1 border border-cyan-900">NEXT 48H FORECAST: {snowData.forecast_next_48h_cm} CM</span>
      </div>
      
      <div className="h-48 w-full flex items-end justify-between gap-1 px-2 pt-8 border-b border-slate-800/50 bg-slate-950/50 overflow-x-auto pb-2">
        {snowData.historical_4_weeks.map((day: any, idx: number) => {
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
  );
}