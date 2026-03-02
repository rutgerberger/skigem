"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearch } from "../context/SearchContext";

// Interface mapping to your SQLAlchemy SavedChalet model
interface SavedItem {
  id: number;
  resort_name: string;
  chalet_name: string;
  village: string;
  url: string | null;
  image_url: string | null;
  price_per_night: number | null;
  distance_to_lift_m: number | null;
}

export default function FavoritesDashboard() {
  const router = useRouter();
  const { userId } = useSearch();
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track which item is currently staged for deletion or editing
  const [pendingPurge, setPendingPurge] = useState<number | null>(null);
  const [editingImage, setEditingImage] = useState<number | null>(null);
  const [tempImageUrl, setTempImageUrl] = useState<string>("");

  useEffect(() => {
    if (!userId) return;

    async function fetchArchive() {
      setLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/user/${userId}/saved`);
        if (res.ok) {
          const data = await res.json();
          setSavedItems(data.saved_chalets || []);
        } else {
          console.error("Failed to access secure DB partition.");
        }
      } catch (err) {
        console.error("Network interface error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchArchive();
  }, [userId]);

  // Execute the actual deletion after confirmation
  const executePurge = async (chaletId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/user/${userId}/saved/${chaletId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSavedItems((prevItems) => prevItems.filter((item) => item.id !== chaletId));
        setPendingPurge(null);
      } else {
        console.error("Failed to purge target from archive.");
      }
    } catch (err) {
      console.error("Network interface error during purge:", err);
    }
  };

  // Execute image URL update
  const handleUpdateImage = async (chaletId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/user/${userId}/saved/${chaletId}/image`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: tempImageUrl }),
      });

      if (res.ok) {
        // Optimistically update the UI locally
        setSavedItems((prevItems) =>
          prevItems.map((item) =>
            item.id === chaletId ? { ...item, image_url: tempImageUrl } : item
          )
        );
        setEditingImage(null);
        setTempImageUrl("");
      } else {
        console.error("Failed to overwrite image data.");
      }
    } catch (err) {
      console.error("Network interface error during image update:", err);
    }
  };

  // Helper to open edit mode safely
  const startEditing = (id: number, currentUrl: string | null) => {
    setPendingPurge(null);
    setEditingImage(id);
    setTempImageUrl(currentUrl || "");
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 font-mono gap-4">
      <div className="text-5xl animate-pulse drop-shadow-sm">💾</div>
      <div className="text-cyan-500 text-xl font-bold text-center px-4 tracking-widest uppercase">
        ACCESSING_SECURE_ARCHIVE...<br />
        <span className="text-slate-600 text-sm font-normal">[ ID: {userId || "PENDING"} ]</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 relative font-mono selection:bg-cyan-500 selection:text-white pb-20">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1495619744764-2cc11fcbe5f0?q=80&w=1732&auto=format&fit=crop')] bg-cover bg-center bg-fixed opacity-50"></div>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[4px]"></div>

      <div className="relative z-10 max-w-6xl mx-auto p-6 md:p-10 pt-24 text-white">

        <div className="border-b border-slate-700 pb-6 mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest drop-shadow-md flex flex-wrap items-center gap-4">
            <span className="text-cyan-500">_</span> SECURE_ARCHIVE
          </h1>
          <p className="text-slate-400 mt-4 text-sm uppercase tracking-widest">
            SAVED_TARGETS. USER_ID: [{userId}]
          </p>
        </div>

        {savedItems.length === 0 ? (
          <div className="bg-slate-900 border border-cyan-900/50 p-12 rounded-sm text-center">
            <p className="text-cyan-600 tracking-widest uppercase text-lg">ARCHIVE_EMPTY.</p>
            <p className="text-slate-500 mt-2 text-sm uppercase">No targets have been saved to your local drive yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {savedItems.map((item) => (
              <div key={item.id} className="bg-slate-900/90 border border-slate-700 hover:border-cyan-500 transition-colors duration-300 rounded-sm flex flex-col overflow-hidden group">
                
                {/* IMAGE & OVERLAYS */}
                <div className="h-48 w-full bg-slate-950 relative overflow-hidden border-b border-slate-800">
                  
                  {/* FIXED OVERLAY WRAPPER */}
                  <div className="absolute top-0 left-0 w-full p-3 z-20 pointer-events-none">
                    
                    {/* INLINE CONFIRMATION STATE - DELETE */}
                    {pendingPurge === item.id ? (
                      <div className="pointer-events-auto bg-red-950/95 backdrop-blur-md border border-red-500 p-2 flex flex-col gap-2 shadow-2xl shadow-red-900/50">
                        <span className="text-red-400 font-bold tracking-widest text-[10px] uppercase text-center w-full">
                          Confirm Purge?
                        </span>
                        <div className="flex justify-between gap-2 w-full">
                          <button 
                            onClick={() => executePurge(item.id)} 
                            className="flex-1 bg-red-900 text-white text-[10px] py-1 border border-red-500 hover:bg-red-500 transition-colors uppercase font-bold tracking-widest cursor-pointer"
                          >
                            [ YES ]
                          </button>
                          <button 
                            onClick={() => setPendingPurge(null)} 
                            className="flex-1 bg-slate-900 text-slate-300 text-[10px] py-1 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors uppercase font-bold tracking-widest cursor-pointer"
                          >
                            [ NO ]
                          </button>
                        </div>
                      </div>
                    ) : editingImage === item.id ? (
                      /* INLINE EDIT STATE - IMAGE URL */
                      <div className="pointer-events-auto bg-slate-950/95 backdrop-blur-md border border-cyan-500 p-2 flex flex-col gap-2 shadow-2xl shadow-cyan-900/50">
                        <input
                          type="text"
                          value={tempImageUrl}
                          onChange={(e) => setTempImageUrl(e.target.value)}
                          placeholder="PASTE_NEW_IMAGE_URL..."
                          className="bg-slate-900 border border-slate-700 text-cyan-400 text-[10px] p-1.5 w-full outline-none focus:border-cyan-400 tracking-widest font-mono"
                        />
                        <div className="flex justify-between gap-2 w-full">
                          <button 
                            onClick={() => handleUpdateImage(item.id)} 
                            className="flex-1 bg-cyan-900 text-white text-[10px] py-1 border border-cyan-500 hover:bg-cyan-500 hover:text-slate-900 transition-colors uppercase font-bold tracking-widest cursor-pointer"
                          >
                            [ SAVE ]
                          </button>
                          <button 
                            onClick={() => setEditingImage(null)} 
                            className="flex-1 bg-slate-900 text-slate-300 text-[10px] py-1 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors uppercase font-bold tracking-widest cursor-pointer"
                          >
                            [ CANCEL ]
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* DEFAULT OVERLAY STATE */
                      <div className="flex justify-between items-start gap-2 w-full">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingImage(null); setPendingPurge(item.id); }}
                            className="pointer-events-auto shrink-0 bg-red-950/80 backdrop-blur-sm border border-red-900 px-2 py-1 text-[10px] text-red-400 font-bold tracking-widest uppercase hover:bg-red-900 hover:text-white transition-all cursor-pointer"
                            title="Purge from Archive"
                          >
                            [ X ]
                          </button>
                          <button
                            onClick={() => startEditing(item.id, item.image_url)}
                            className="pointer-events-auto shrink-0 bg-slate-900/80 backdrop-blur-sm border border-cyan-900 px-2 py-1 text-[10px] text-cyan-400 font-bold tracking-widest uppercase hover:bg-cyan-900 hover:text-white transition-all cursor-pointer"
                            title="Override Image Data"
                          >
                            [ EDIT IMG ]
                          </button>
                        </div>

                        <div 
                          className="pointer-events-auto bg-slate-950/80 backdrop-blur-sm border border-cyan-900 px-2 py-1 text-[10px] text-cyan-400 font-bold tracking-widest uppercase truncate max-w-[40%]"
                          title={item.resort_name}
                        >
                          {item.resort_name}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.chalet_name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs tracking-widest">NO_IMAGE_DATA</div>
                  )}
                </div>

                {/* DETAILS */}
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-1 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                    {item.chalet_name}
                  </h3>
                  <p className="text-cyan-600 text-xs font-bold tracking-widest uppercase mb-4">
                    📍 {item.village}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {item.price_per_night && (
                      <span className="bg-slate-950 border border-slate-800 px-2 py-1 text-[10px] text-slate-300 tracking-widest uppercase rounded-sm">
                        €{item.price_per_night}/NT
                      </span>
                    )}
                    {item.distance_to_lift_m && (
                      <span className="bg-slate-950 border border-slate-800 px-2 py-1 text-[10px] text-slate-300 tracking-widest uppercase rounded-sm">
                        LIFT: {item.distance_to_lift_m}m
                      </span>
                    )}
                  </div>

{/* ACTION BUTTONS */}
                  <div className="mt-auto pt-4 border-t border-slate-800 flex flex-col gap-2">
                    
                    {/* NEW TELEMETRY BUTTON */}
                    <button
                      onClick={() => router.push(`/resort-center/${encodeURIComponent(item.resort_name)}`)}
                      className="w-full flex items-center justify-center bg-transparent border border-emerald-900/80 hover:bg-emerald-900/40 text-emerald-500 py-1.5 transition-all duration-300 font-bold tracking-widest uppercase text-[10px] rounded-sm"
                    >
                      [ ACCESS TELEMETRY ]
                    </button>

                    {/* EXISTING SOURCE BUTTON */}
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center bg-transparent border border-cyan-700 hover:bg-cyan-500 hover:text-slate-950 text-cyan-400 py-2 transition-all duration-300 font-bold tracking-widest uppercase text-xs rounded-sm"
                      >
                        ACCESS_SOURCE
                      </a>
                    ) : (
                      <button disabled className="w-full py-2 bg-slate-950 text-slate-600 text-xs tracking-widest uppercase border border-slate-800 cursor-not-allowed">
                        LINK_CORRUPTED
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}