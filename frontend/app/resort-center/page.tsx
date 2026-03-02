"use client";

import Link from "next/link";
import MapOverlayModule from "../components/MapOverlayModule";

// Dummy data for our new modules
const MY_RESORTS = [
  { name: "Chamonix", country: "FR", status: "ONLINE" },
  { name: "St. Anton am Arlberg", country: "AT", status: "ONLINE" },
  { name: "Zermatt", country: "CH", status: "SYNCING..." },
];

const HOT_RESORTS = [
  { name: "Verbier", metric: "60cm POWDER", condition: "DUMPING", color: "text-cyan-400", border: "border-cyan-500" },
  { name: "Ischgl", metric: "BLUEBIRD", condition: "CLEAR", color: "text-yellow-400", border: "border-yellow-500" },
  { name: "Kitzbühel", metric: "LOW HAZARD", condition: "STABLE", color: "text-green-400", border: "border-green-500" },
];

export default function GlobalTelemetryHub() {
  return (
    <main className="min-h-screen relative bg-[url('/background_mountain.png')] bg-cover bg-center bg-fixed text-slate-800 font-mono selection:bg-cyan-500 selection:text-white pb-20">
      {/* Background Overlays */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[3px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-cyan-950/20 pointer-events-none"></div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8 pt-10 px-6 md:px-12 flex flex-col">
        
        {/* System Header */}
        <div className="space-y-2 animate-fade-in-down drop-shadow-xl border-l-4 border-cyan-500 pl-4 mt-8">
          <p className="text-xs text-cyan-500/80 font-bold uppercase tracking-widest">
            SYSTEM_STATUS: ONLINE_OK // USER: GUEST_SKIGEEK
          </p>
          <h1 className="text-4xl text-white tracking-widest uppercase font-black drop-shadow-lg">
            RESORT_CENTER<span className="text-cyan-500">_</span>
          </h1>
          <p className="text-sm md:text-base text-cyan-100/80 font-medium max-w-2xl drop-shadow-md">
            Find resorts by typing in the search bar. Or click on the map to triangulate.
          </p>
        </div>

        {/* --- MAIN HERO GRID: Map (Left) + Target Lists (Right) --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-down delay-100">
          
          {/* Global Map Module - Takes up 2/3 of the screen width on Desktop */}
          <div className="lg:col-span-2 w-full h-[50vh] lg:h-[65vh] min-h-[450px] flex flex-col relative group border border-slate-700 rounded-md overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-cyan-500/5 blur-xl group-hover:bg-cyan-500/10 transition-colors pointer-events-none -z-10"></div>
            <div className="flex-1 w-full h-full">
              <MapOverlayModule fullHeight={true} />
            </div>
          </div>

          {/* Right Sidebar: My Resorts & Hot Resorts */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-[50vh] lg:h-[65vh] min-h-[450px]">
            
            {/* MY RESORTS */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 border-l-2 border-l-cyan-500 p-6 rounded-md shadow-lg flex-1 flex flex-col overflow-hidden">
              <h3 className="text-sm font-bold text-cyan-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">
                [+] SAVED_TARGETS
              </h3>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                {MY_RESORTS.map((resort, idx) => (
                  <Link 
                    key={idx} 
                    href={`/resort-center/${encodeURIComponent(resort.name)}`}
                    className="block bg-slate-950/50 border border-slate-800 p-3 hover:border-cyan-500/50 hover:bg-slate-900 transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-slate-200 text-sm font-bold uppercase group-hover:text-cyan-400 transition-colors">
                        {resort.name}
                      </span>
                      <span className="text-[9px] text-slate-500">{resort.country}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${resort.status === 'ONLINE' ? 'bg-cyan-500 shadow-[0_0_5px_cyan]' : 'bg-slate-500'}`}></div>
                      <span className="text-[9px] text-slate-400 tracking-widest">{resort.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* HOT RESORTS */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700 border-l-2 border-l-orange-500 p-6 rounded-md shadow-lg flex-1 flex flex-col overflow-hidden relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange-500/10 to-transparent pointer-events-none"></div>
              <h3 className="text-sm font-bold text-orange-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2 flex justify-between items-center">
                <span>[!] HIGH_PRIORITY</span>
                <span className="text-[10px] bg-orange-950/50 text-orange-400 px-2 py-0.5 border border-orange-900 rounded-sm animate-pulse">BOOMING</span>
              </h3>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                {HOT_RESORTS.map((resort, idx) => (
                  <Link 
                    key={idx} 
                    href={`/resort-center/${encodeURIComponent(resort.name)}`}
                    className={`block bg-slate-950/50 border border-slate-800 p-3 hover:bg-slate-900 transition-all group hover:border-orange-500/50`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-slate-200 text-sm font-bold uppercase group-hover:text-white transition-colors">
                        {resort.name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 border-t border-slate-800/50 pt-2">
                      <span className={`text-[10px] font-bold tracking-widest ${resort.color}`}>
                        {resort.metric}
                      </span>
                      <span className="text-[9px] text-slate-500 tracking-widest border border-slate-700 px-1 py-0.5">
                        {resort.condition}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* --- LOWER INTELLIGENCE MODULES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-down delay-200">
          
          {/* News Feed - Takes up 2 columns to give room for reading */}
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-purple-500 p-6 rounded-md shadow-lg space-y-4 md:col-span-2">
            <h3 className="text-lg font-bold text-purple-500 uppercase tracking-widest mb-2">MODULE: NETWORK_INTEL</h3>
            <div className="space-y-3">
              <div className="bg-slate-950/50 border border-slate-800 p-3 border-l-4 border-l-cyan-500">
                <p className="text-[10px] text-slate-500 tracking-widest mb-1">SYS_TIME: 08:42 // TARGET: CHAMONIX</p>
                <p className="text-sm text-slate-300">Weather satellite detects incoming front. <span className="text-cyan-400 font-bold">+15cm fresh snow</span> expected overnight. Conditions optimal for tomorrow.</p>
              </div>
              
              <div className="bg-slate-950/50 border border-slate-800 p-3 border-l-4 border-l-green-500">
                <p className="text-[10px] text-slate-500 tracking-widest mb-1">SYS_TIME: 06:15 // TARGET: ST. ANTON AM ARLBERG</p>
                <p className="text-sm text-slate-300">Avalanche control completed on Valluga. Hazard level reduced to <span className="text-green-400 font-bold">LEVEL 2 (MODERATE)</span>. Off-piste sectors opening.</p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-3 border-l-4 border-l-red-500">
                <p className="text-[10px] text-slate-500 tracking-widest mb-1">SYS_TIME: YESTERDAY // TARGET: ZERMATT</p>
                <p className="text-sm text-slate-300">High winds at peak altitude. Matterhorn Glacier Paradise lifts currently on <span className="text-red-400 font-bold">STANDBY</span>. Monitor for updates.</p>
              </div>
            </div>
          </div>
          
          {/* Expert Zone / Quick Actions */}
          <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-red-500 p-6 rounded-md shadow-lg space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-red-500 uppercase tracking-widest mb-4">EXPERT_TOOLS</h3>
              <ul className="text-slate-300 text-sm space-y-3">
                <li className="flex items-center justify-between group cursor-pointer border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> COULOIR_MAPS</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-red-400 transition-colors">ACCESS ↗</span>
                </li>
                <li className="flex items-center justify-between group cursor-pointer border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> EPIC_RUNS_LOG</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-red-400 transition-colors">ACCESS ↗</span>
                </li>
                <li className="flex items-center justify-between group cursor-pointer border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><span className="text-red-500 font-bold">&gt;</span> LAWINE_GEFAHR_LIVE</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-red-400 transition-colors">ACCESS ↗</span>
                </li>
              </ul>
            </div>
            <button className="w-full bg-red-950/30 border border-red-900 text-red-500 hover:bg-red-900 hover:text-slate-950 transition-all font-bold tracking-widest text-[10px] uppercase py-2">
              INITIATE_DISTRESS_BEACON
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}