"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "../context/SearchContext";

// Types matching our backend schemas
interface TripLeg {
  id: number;
  resort_id: number;
  resort: { name: string };
}

interface Trip {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  legs: TripLeg[];
}

export default function MyTripsList() {
  const router = useRouter();
  const { userId } = useSearch(); // Pull user ID from context
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [formData, setFormData] = useState({ name: "", start_date: "", end_date: "" });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch Trips
  const fetchTrips = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/trips?user_id=${userId}`);
      if (res.ok) setTrips(await res.json());
    } catch (err) {
      console.error("Failed to load archive", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [userId]);

  // Modal Handlers
  const openModal = (trip?: Trip) => {
    if (trip) {
      setEditingTrip(trip);
      setFormData({ 
        name: trip.name, 
        start_date: trip.start_date || "", 
        end_date: trip.end_date || "" 
      });
    } else {
      setEditingTrip(null);
      setFormData({ name: "", start_date: "", end_date: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTrip(null);
  };

  // Submit Create/Edit
  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      const url = editingTrip 
        ? `http://127.0.0.1:8000/api/trips/${editingTrip.id}` 
        : `http://127.0.0.1:8000/api/trips`;
      
      const method = editingTrip ? "PATCH" : "POST";
      
      const payload = {
        name: formData.name,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        user_id: userId
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchTrips();
        closeModal();
      }
    } catch (err) {
      console.error("Failed to sync trip", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Trip
  const handleDelete = async (id: number) => {
    if (!confirm("WARNING: Confirm deletion of this mission file?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/trips/${id}`, { method: "DELETE" });
      if (res.ok) setTrips(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  // Render Loading
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-mono gap-4">
      <div className="text-5xl animate-pulse drop-shadow-sm">📁</div>
      <div className="text-cyan-500 text-xl font-bold text-center px-4 tracking-widest uppercase">
        ACCESSING_SECURE_ARCHIVE...<br />
        <span className="text-slate-600 text-sm font-normal">[ DECRYPTING_MISSION_FILES ]</span>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen relative bg-[url('/background_img.png')] bg-cover bg-center bg-fixed text-slate-800 font-mono selection:bg-cyan-500 selection:text-white">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[3px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-cyan-900/10 pointer-events-none"></div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-12 pt-24 pb-24 px-6 md:px-12">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 animate-fade-in-down border-l-4 border-purple-500 pl-4 bg-slate-900/50 p-4 rounded-r-lg shadow-lg">
          <div>
            <p className="text-xs text-purple-500/80 font-bold uppercase tracking-widest mb-1">
              DATABASE_LINK // USER: [{userId || 'GUEST'}]
            </p>
            <h1 className="text-white text-3xl md:text-4xl font-bold tracking-widest uppercase">
              MISSION_ARCHIVE
            </h1>
          </div>
          <button 
            onClick={() => openModal()}
            className="text-[10px] px-6 py-3 border border-purple-500 text-purple-400 bg-purple-950/30 hover:bg-purple-500 hover:text-white font-bold tracking-widest transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
          >
            + INITIALIZE_NEW_MISSION
          </button>
        </div>

        {/* --- TRIP GRID --- */}
        {trips.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 p-12 rounded text-center backdrop-blur-sm">
            <p className="text-slate-500 tracking-widest uppercase mb-4">NO_ACTIVE_MISSIONS_FOUND.</p>
            <button onClick={() => openModal()} className="text-cyan-500 border border-cyan-500/50 px-4 py-2 text-xs uppercase tracking-widest hover:bg-cyan-500 hover:text-slate-950 transition-colors">
              CREATE_FIRST_DEPLOYMENT ↗
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map(trip => (
              <div key={trip.id} className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-cyan-500 p-6 rounded-md shadow-lg flex flex-col group hover:border-purple-500 transition-colors">
                
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">{trip.name}</h3>
                  <span className="text-[9px] bg-slate-950 border border-cyan-900 text-cyan-500 px-2 py-1 tracking-widest">
                    {trip.status}
                  </span>
                </div>

                <div className="space-y-2 mb-6 flex-1">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-xs text-slate-500 tracking-widest">WINDOW:</span>
                    <span className="text-xs text-cyan-300">
                      {trip.start_date ? trip.start_date : 'TBD'} &gt; {trip.end_date ? trip.end_date : 'TBD'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="text-xs text-slate-500 tracking-widest">TARGETS:</span>
                    <span className="text-xs text-slate-300">
                      {trip.legs?.length || 0} SECTOR(S)
                    </span>
                  </div>
                  {/* Preview of the resorts attached to this trip */}
                  {trip.legs && trip.legs.length > 0 && (
                    <div className="pt-2">
                       <p className="text-[10px] text-slate-500 mb-1">WAYPOINTS:</p>
                       <div className="flex flex-wrap gap-1">
                         {trip.legs.map((leg, i) => (
                            <span key={i} className="text-[9px] bg-slate-950 text-slate-400 px-1 border border-slate-800">
                              {leg.resort?.name || "Unknown"}
                            </span>
                         ))}
                       </div>
                    </div>
                  )}
                </div>

                {/* ACTION BAR */}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <button 
                    onClick={() => router.push(`/my-trips/${trip.id}`)}
                    className="col-span-2 bg-cyan-950/40 hover:bg-cyan-500 border border-cyan-500 text-cyan-400 hover:text-slate-950 text-[10px] font-bold py-2 tracking-widest transition-colors"
                  >
                    ENTER_HUB ↗
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => openModal(trip)}
                      className="bg-slate-950 border border-slate-700 text-slate-400 hover:text-purple-400 hover:border-purple-500 flex items-center justify-center transition-colors"
                      title="Edit Mission"
                    >
                      ⚙️
                    </button>
                    <button 
                      onClick={() => handleDelete(trip.id)}
                      className="bg-slate-950 border border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500 flex items-center justify-center transition-colors"
                      title="Abort Mission"
                    >
                      ❌
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODAL FOR CREATE / EDIT --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-cyan-500 p-8 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.2)] max-w-md w-full relative">
            <button onClick={closeModal} className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold">X</button>
            <h2 className="text-xl font-bold text-cyan-400 uppercase tracking-widest mb-6 border-b border-cyan-500/30 pb-2">
              {editingTrip ? "EDIT_MISSION_PARAMETERS" : "INITIALIZE_MISSION"}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold tracking-widest mb-1 block">MISSION_CODENAME *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. ALPS_TOUR_2026"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold tracking-widest mb-1 block">START_DATE</label>
                  <input 
                    type="date" 
                    value={formData.start_date}
                    onChange={e => setFormData({...formData, start_date: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 p-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold tracking-widest mb-1 block">END_DATE</label>
                  <input 
                    type="date" 
                    value={formData.end_date}
                    onChange={e => setFormData({...formData, end_date: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 p-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={!formData.name || isProcessing}
                className="w-full mt-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-3 uppercase tracking-widest text-sm transition-colors"
              >
                {isProcessing ? "UPLOADING..." : "COMMIT_TO_DATABASE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}