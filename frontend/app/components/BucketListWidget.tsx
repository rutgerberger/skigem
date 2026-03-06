// --- components/BucketListWidget.tsx ---
"use client";
import { useState, useEffect } from "react";

type TabMode = "MISSION" | "AI_RECON" | "ARCHIVE" | "CUSTOM";
type ArchiveFilter = "LOCAL" | "GLOBAL";

export default function BucketListWidget({ 
  userId, resortId, resortName, tripLegId, activeItems = [], onUpdate 
}: { 
  userId: number, resortId: number, resortName: string, tripLegId: number, activeItems: any[], onUpdate: () => void 
}) {
  const [activeTab, setActiveTab] = useState<TabMode>("MISSION");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("LOCAL");
  
  const [aiTargets, setAiTargets] = useState<any[]>([]);
  const [archiveTargets, setArchiveTargets] = useState<any[]>([]);
  
  const [loadingAI, setLoadingAI] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [customForm, setCustomForm] = useState({ name: "", description: "", category: "PISTE", logo: "🎯" });

  useEffect(() => {
    if (userId) {
      fetch(`http://127.0.0.1:8000/api/users/${userId}/bucketlist`)
        .then(res => res.json())
        .then(data => setArchiveTargets(data || []))
        .catch(err => console.error("ARCHIVE_ERR", err));
    }
  }, [userId, isProcessing]);

  const loadAIRecon = async () => {
    if (aiTargets.length > 0) return; 
    setLoadingAI(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/resorts/${encodeURIComponent(resortName)}/ai-bucketlist`);
      const data = await res.json();
      setAiTargets(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };
  const isInArchive = (itemName: string) => {
    return archiveTargets.some(target => 
      target.name.toLowerCase() === itemName.toLowerCase() && 
      target.resort_id === resortId
    );
  };
  const handleSaveToMission = async (item: any) => {
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/bucketlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          resort_id: resortId,
          trip_leg_id: tripLegId, 
          name: item.title || item.name,
          description: item.description,
          category: item.category,
          logo: item.logo || "🎯"
        })
      });
      onUpdate();
      setActiveTab("MISSION");
    } finally { setIsProcessing(false); }
  };

  const handleAttachFromArchive = async (itemId: number) => {
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trip_legs/${tripLegId}/bucketlist/${itemId}`, { method: "POST" });
      onUpdate();
      setActiveTab("MISSION");
    } finally { setIsProcessing(false); }
  };

  const handleDetachFromMission = async (itemId: number) => {
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/trip_legs/${tripLegId}/bucketlist/${itemId}`, { method: "DELETE" });
      onUpdate();
    } finally { setIsProcessing(false); }
  };

  // --- NEW: PERMANENTLY ERASE FROM DATABASE ---
  const handleDeleteFromArchive = async (itemId: number) => {
    if (!confirm("Permanently erase this target from your global database? This will also erase it from your mission")) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/bucketlist/${itemId}`, { method: "DELETE" });
      if (res.ok) {
        // Update local state instantly so UI feels snappy
        setArchiveTargets(prev => prev.filter(target => target.id !== itemId));
        onUpdate(); // Refresh the trip in case it was attached to the active leg
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!customForm.name) return;
    setIsProcessing(true);
    try {
      await fetch(`http://127.0.0.1:8000/api/bucketlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          resort_id: resortId,
          trip_leg_id: tripLegId,
          name: customForm.name,
          description: customForm.description,
          category: customForm.category,
          logo: customForm.logo
        })
      });
      setCustomForm({ name: "", description: "", category: "PISTE", logo: "🎯" });
      onUpdate();
      setActiveTab("MISSION");
    } finally { setIsProcessing(false); }
  };

  // --- NEW: FILTER LOGIC ---
  const displayedArchive = archiveTargets.filter(item => {
    if (archiveFilter === "GLOBAL") return true;
    return item.resort_id === resortId;
  });

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-l-2 border-purple-500 p-6 rounded-md shadow-lg flex flex-col w-full min-h-[400px]">
      <div className="flex justify-between items-end border-b border-slate-800 pb-3 mb-4">
        <h3 className="text-sm font-bold text-purple-500 uppercase tracking-widest">
          MODULE: BUCKET_LIST
        </h3>
        <div className="flex gap-2">
          {["MISSION", "AI_RECON", "ARCHIVE", "CUSTOM"].map((tab) => (
            <button 
              key={tab}
              onClick={() => {
                setActiveTab(tab as TabMode);
                if (tab === "AI_RECON") loadAIRecon();
              }}
              className={`text-[9px] font-bold tracking-widest px-3 py-1 border transition-colors ${
                activeTab === tab 
                  ? "bg-purple-900/40 border-purple-500 text-purple-300" 
                  : "bg-slate-950 border-slate-700 text-slate-500 hover:border-purple-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
        
        {/* --- TAB: MISSION TARGETS --- */}
        {activeTab === "MISSION" && (
          activeItems.length === 0 ? (
            <div className="text-center text-[10px] text-slate-500 mt-12 tracking-widest">NO_TARGETS_ASSIGNED_TO_THIS_LEG</div>
          ) : (
            activeItems.map((item, idx) => (
              <div key={idx} className="p-3 bg-slate-950/50 border border-purple-900 flex justify-between items-start relative group">
                <div className="flex gap-3 items-start">
                  <div className="text-xl">{item.logo}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] text-purple-400 bg-purple-950 px-1 border border-purple-800">{item.category}</span>
                      <h4 className="text-white text-xs font-bold uppercase">{item.name}</h4>
                    </div>
                    <p className="text-[10px] text-slate-400">{item.description}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleDetachFromMission(item.id)}
                  disabled={isProcessing}
                  className="text-[9px] text-slate-600 hover:text-red-500 transition-colors shrink-0"
                  title="Detach from current mission"
                >
                  [X]
                </button>
              </div>
            ))
          )
        )}

        {aiTargets.map((item, idx) => {
          const exists = isInArchive(item.title);
          const attached = activeItems.some(a => a.name === item.title);

          return (
            <div key={idx} className="p-3 bg-slate-950/80 border border-slate-700 flex justify-between items-center group">
              <div>
                <span className="text-[9px] text-slate-500 block mb-1">
                    {item.category} {exists && "• [IN_DATABASE]"}
                </span>
                <h4 className={`text-xs font-bold ${exists ? 'text-cyan-400' : 'text-purple-300'}`}>
                    {item.title}
                </h4>
                <p className="text-[10px] text-slate-500 max-w-sm">{item.description}</p>
              </div>
              <button 
                onClick={() => handleSaveToMission(item)}
                disabled={isProcessing || attached}
                className={`text-[9px] px-3 py-2 font-bold tracking-widest transition-colors shrink-0 border ${
                  attached 
                    ? "bg-slate-900 text-slate-600 border-slate-800" 
                    : "bg-slate-800 text-purple-400 hover:bg-purple-600 hover:text-white border-purple-900"
                }`}
              >
                {attached ? "SECURED" : exists ? "+ RE-ATTACH" : "+ SECURE"}
              </button>
            </div>
          );
        })}

        {/* --- TAB: ARCHIVE --- */}
        {activeTab === "ARCHIVE" && (
          <div className="space-y-4">
            
            {/* ARCHIVE FILTER TOGGLE */}
            <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-sm">
              <button 
                onClick={() => setArchiveFilter("LOCAL")}
                className={`flex-1 text-[9px] font-bold tracking-widest py-1.5 transition-all ${
                  archiveFilter === "LOCAL" 
                    ? "bg-slate-800 text-cyan-400 shadow-sm" 
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                CURRENT_SECTOR
              </button>
              <button 
                onClick={() => setArchiveFilter("GLOBAL")}
                className={`flex-1 text-[9px] font-bold tracking-widest py-1.5 transition-all ${
                  archiveFilter === "GLOBAL" 
                    ? "bg-slate-800 text-cyan-400 shadow-sm" 
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                GLOBAL_NETWORK
              </button>
            </div>

            {displayedArchive.length === 0 ? (
               <div className="text-center text-[10px] text-slate-500 mt-8 tracking-widest">NO_TARGETS_FOUND</div>
            ) : (
              <div className="space-y-3">
                {displayedArchive.map((item, idx) => {
                  const alreadyAttached = activeItems.some(active => active.id === item.id);
                  return (
                    <div key={idx} className="p-3 bg-slate-950/80 border border-slate-700 flex justify-between items-center group transition-colors hover:border-slate-500">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{item.logo}</span>
                        <div>
                          <h4 className="text-slate-300 text-xs font-bold">{item.name}</h4>
                          <p className="text-[9px] text-slate-500">
                            {item.resort_id === resortId ? "LOCAL SECTOR" : "OFF-WORLD TARGET"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {/* DELETE BUTTON */}
                        <button 
                          onClick={() => handleDeleteFromArchive(item.id)}
                          disabled={isProcessing}
                          className="text-[9px] px-2 py-2 font-bold tracking-widest border border-red-900/50 text-red-500 hover:bg-red-900 hover:text-white transition-colors"
                          title="Erase from Archive entirely"
                        >
                          DEL
                        </button>
                        
                        {/* ATTACH BUTTON */}
                        <button 
                          onClick={() => handleAttachFromArchive(item.id)}
                          disabled={isProcessing || alreadyAttached}
                          className={`text-[9px] px-3 py-2 font-bold tracking-widest transition-colors ${
                            alreadyAttached 
                              ? "bg-slate-900 text-slate-600 border border-slate-800" 
                              : "bg-slate-800 text-cyan-400 hover:bg-cyan-600 hover:text-white border border-cyan-900"
                          }`}
                        >
                          {alreadyAttached ? "ATTACHED" : "+ ATTACH"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB: CUSTOM --- */}
        {activeTab === "CUSTOM" && (
          <div className="space-y-3 bg-slate-950 p-4 border border-slate-800">
            <div>
              <label className="text-[9px] text-slate-500 tracking-widest block mb-1">TARGET_NAME</label>
              <input type="text" value={customForm.name} onChange={e=>setCustomForm({...customForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2 focus:border-purple-500 outline-none" placeholder="e.g. La Folie Douce" />
            </div>
            <div>
              <label className="text-[9px] text-slate-500 tracking-widest block mb-1">DESCRIPTION</label>
              <textarea value={customForm.description} onChange={e=>setCustomForm({...customForm, description: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2 focus:border-purple-500 outline-none min-h-[60px]" placeholder="Mandatory pit stop..." />
            </div>
            <div className="flex gap-3">
               <div className="flex-1">
                <label className="text-[9px] text-slate-500 tracking-widest block mb-1">CATEGORY</label>
                <select value={customForm.category} onChange={e=>setCustomForm({...customForm, category: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-xs text-white p-2">
                  <option value="PISTE">PISTE</option>
                  <option value="OFF-PISTE">OFF-PISTE</option>
                  <option value="APRES">APRES</option>
                  <option value="DINING">DINING</option>
                  <option value="PARK">PARK</option>
                </select>
              </div>
              <div className="w-20">
                <label className="text-[9px] text-slate-500 tracking-widest block mb-1">LOGO</label>
                <input type="text" value={customForm.logo} onChange={e=>setCustomForm({...customForm, logo: e.target.value})} className="w-full bg-slate-900 border border-slate-700 text-xs text-center text-white p-2 focus:border-purple-500 outline-none" />
              </div>
            </div>
            <button onClick={handleCreateCustom} disabled={isProcessing || !customForm.name} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold tracking-widest text-[10px] py-2 mt-2 disabled:bg-slate-800 disabled:text-slate-500 transition-colors">
              + COMMIT_TO_DATABASE
            </button>
          </div>
        )}

      </div>
    </div>
  );
}