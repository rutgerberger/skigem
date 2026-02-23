"use client";

import { useState } from "react";

// Mirroring the Python Pydantic models
interface Chalet {
  name: string;
  url: string;
  price_per_night: number;
  distance_to_lift_m: number;
  hidden_gem_score: number;
  reasoning: string;
}

interface SearchResult {
  resort_name: string;
  resort_slope_km: number;
  chalets: Chalet[];
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const criteria = {
      country: formData.get("country"),
      min_slope_length_km: parseInt(formData.get("min_slope") as string),
      max_budget_per_night: parseFloat(formData.get("budget") as string),
      lift_proximity_m: parseInt(formData.get("proximity") as string),
      additional_requirements: formData.get("requirements") || null,
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });

      if (!res.ok) throw new Error("The Orchestra hit a wrong note. Check backend logs.");
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    // FULL SCREEN EPIC BACKGROUND WITH DARK OVERLAY
    <main className="min-h-screen relative bg-[url('https://images.unsplash.com/photo-1495619744764-2cc11fcbe5f0?q=80&w=1732&auto=format&fit=crop')] bg-cover bg-center bg-fixed text-slate-100 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Dark gradient overlay to ensure text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/50 to-slate-900/50 pointer-events-none"></div>

      <div className="relative z-10 max-w-5xl mx-auto space-y-12 pt-20 pb-24 px-6 md:px-12">
        
        {/* HERO HEADER */}
        <div className="text-center space-y-4 animate-fade-in-down">
          <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-white drop-shadow-lg tracking-tight">
            S K I G E M
          </h1>
          <p className="text-lg md:text-xl text-cyan-100/80 max-w-2xl mx-auto font-light">
            Uncover the ultimate, uncrowded alpine chalets hidden deep within the web.
          </p>
        </div>

        {/* GLASSMORPHISM SEARCH FORM */}
        <form 
          onSubmit={handleSearch} 
          className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 md:p-10 rounded-3xl shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6 relative overflow-hidden"
        >
          {/* Subtle glow effect behind form */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <label className="block text-sm font-semibold text-cyan-50 mb-2 uppercase tracking-wider">Target Country</label>
            <input name="country" type="text" defaultValue="Austria" className="w-full bg-slate-900/50 border border-white/10 text-white placeholder-slate-400 p-4 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none transition-all" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-cyan-50 mb-2 uppercase tracking-wider">Min Slopes (km)</label>
            <input name="min_slope" type="number" defaultValue={100} className="w-full bg-slate-900/50 border border-white/10 text-white placeholder-slate-400 p-4 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none transition-all" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-cyan-50 mb-2 uppercase tracking-wider">Max Budget / Night (€)</label>
            <input name="budget" type="number" defaultValue={150} className="w-full bg-slate-900/50 border border-white/10 text-white placeholder-slate-400 p-4 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none transition-all" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-cyan-50 mb-2 uppercase tracking-wider">Max Distance to Lift (m)</label>
            <input name="proximity" type="number" defaultValue={500} className="w-full bg-slate-900/50 border border-white/10 text-white placeholder-slate-400 p-4 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none transition-all" required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-cyan-50 mb-2 uppercase tracking-wider">Additional Requirements (Optional)</label>
            <input name="requirements" type="text" placeholder="e.g., sauna, pet-friendly, fireplace, ski-in ski-out" className="w-full bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 p-4 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:outline-none transition-all" />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className={`md:col-span-2 mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:-translate-y-1 disabled:opacity-70 disabled:hover:translate-y-0 disabled:cursor-not-allowed ${loading ? 'animate-pulse' : ''}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin text-2xl">❄️</span> Agents are scouring the deep web...
              </span>
            ) : (
              "Unleash the Hunt 🏂"
            )}
          </button>
        </form>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="bg-red-900/50 backdrop-blur-md border border-red-500/50 text-red-100 p-6 rounded-2xl shadow-lg flex items-center gap-4">
            <span className="text-3xl">⚠️</span>
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* RESULTS DISPLAY */}
        {result && (
          <div className="space-y-8 animate-fade-in-up">
            
            {/* Target Resort Banner */}
            <div className="bg-gradient-to-r from-blue-900/80 to-slate-900/80 backdrop-blur-xl border border-cyan-500/30 p-8 rounded-3xl text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-blue-600"></div>
              <p className="text-cyan-400 font-semibold tracking-widest uppercase text-sm mb-2">Destination Secured</p>
              <h2 className="text-4xl font-black text-white mb-2">{result.resort_name}</h2>
              <p className="text-blue-200 text-lg flex justify-center items-center gap-2">
                <span>⛰️</span> {result.resort_slope_km} km of pure adrenaline
              </p>
            </div>

            {/* Chalet Grid */}
            <div className="grid grid-cols-1 gap-6">
              {result.chalets.map((chalet, idx) => (
                <div key={idx} className="group bg-slate-900/60 backdrop-blur-lg border border-white/10 p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between gap-6 hover:bg-slate-800/80 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                  
                  <div className="space-y-4 flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors">{chalet.name}</h3>
                      <div className="flex items-center gap-1 bg-cyan-950/80 border border-cyan-800/50 px-3 py-1 rounded-full text-cyan-300 text-sm font-bold shadow-inner">
                        💎 {chalet.hidden_gem_score}/10
                      </div>
                    </div>
                    
                    <p className="text-slate-300 italic border-l-2 border-cyan-500/50 pl-4 py-1 text-sm md:text-base">
                      "{chalet.reasoning}"
                    </p>
                    
                    <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-200 mt-4">
                      <span className="bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2">
                        💶 €{chalet.price_per_night} <span className="text-slate-400 font-normal">/ night</span>
                      </span>
                      <span className="bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-2">
                        🚠 {chalet.distance_to_lift_m}m <span className="text-slate-400 font-normal">to lift</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center md:items-stretch">
                    <a 
                      href={chalet.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-full md:w-auto flex items-center justify-center bg-white/10 border border-white/20 hover:bg-cyan-500 hover:border-cyan-400 text-white px-8 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap shadow-lg group-hover:shadow-cyan-500/20"
                    >
                      Inspect Chalet ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}