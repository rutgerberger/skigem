"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import ResortWeatherCard from "./ResortWeatherCard";

export interface ResortData {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  highest_point?: number; // Added to interface just in case
}

interface MyResortsModuleProps {
  userId?: number | null; 
}

export default function MyResortsModule({ userId = 1 }: MyResortsModuleProps) {
  const router = useRouter();

  const [allResorts, setAllResorts] = useState<ResortData[]>([]);
  const [myResortsQuery, setMyResortsQuery] = useState("");
  const [myResortsResults, setMyResortsResults] = useState<ResortData[]>([]);
  const [showMyResortsDropdown, setShowMyResortsDropdown] = useState(false);
  const myResortsDropdownRef = useRef<HTMLDivElement>(null);

  const [savedResorts, setSavedResorts] = useState<ResortData[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (userId === null) return;
    async function loadData() {
      try {
        const allRes = await fetch("http://localhost:8000/api/resorts"); 
        if (allRes.ok) setAllResorts(await allRes.json());

        const savedRes = await fetch(`http://localhost:8000/api/user/${userId}/saved_resorts`);
        if (savedRes.ok) {
          const savedData = await savedRes.json();
          setSavedResorts(savedData.saved_resorts || []);
        }
      } catch (err) {
        console.error("SYS_ERR: Failed to load resort modules", err);
      }
    }
    loadData();
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (myResortsDropdownRef.current && !myResortsDropdownRef.current.contains(event.target as Node)) {
        setShowMyResortsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleMyResortsSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setMyResortsQuery(query);
    if (query.length > 0) {
      const filtered = allResorts.filter((resort) =>
        resort.name.toLowerCase().includes(query.toLowerCase())
      );
      setMyResortsResults(filtered);
      setShowMyResortsDropdown(true);
    } else {
      setMyResortsResults([]);
      setShowMyResortsDropdown(false);
    }
  }

  function handleSelectResort(resortName: string) {
    setMyResortsQuery("");
    setShowMyResortsDropdown(false);
    router.push(`/resort-center/${encodeURIComponent(resortName)}`);
  }

  // --- UPDATED: Sliced at 2 instead of 3 ---
  const displayedSavedResorts = isExpanded ? savedResorts : savedResorts.slice(0, 2);
  const hiddenCount = savedResorts.length - 2;

  return (
    <div className="h-full w-full bg-slate-900/80 backdrop-blur-xl border-l-2 border-pink-500 p-6 rounded-md shadow-lg flex flex-col relative z-40 overflow-hidden">
      <h3 className="text-lg font-bold text-pink-500 uppercase tracking-widest mb-4 shrink-0">MODULE: MY_RESORTS</h3>
      
      {/* Search Input */}
      <div className="relative z-20 shrink-0 mb-4" ref={myResortsDropdownRef}>
        <div className="flex bg-slate-950/50 border border-slate-700 focus-within:border-pink-500 rounded-sm p-1 items-center shadow-inner">
          <span className="text-pink-500/50 pl-2 font-bold select-none">&gt;</span>
          <input
            type="text"
            value={myResortsQuery}
            onChange={handleMyResortsSearchChange}
            onFocus={() => { if (myResortsResults.length > 0) setShowMyResortsDropdown(true); }}
            placeholder={allResorts.length === 0 ? "AWAITING_DB_SYNC..." : "Find resort to open Hub..."}
            disabled={allResorts.length === 0}
            className="w-full bg-transparent text-xs text-pink-300 placeholder-slate-600 p-2 focus:outline-none tracking-wider disabled:opacity-50"
          />
        </div>
        {showMyResortsDropdown && myResortsResults.length > 0 && (
          <ul className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-pink-500/50 rounded-sm shadow-2xl max-h-48 overflow-y-auto z-50">
            {myResortsResults.map((resort) => (
              <li
                key={resort.id}
                className="p-2 text-xs text-slate-300 hover:bg-pink-900/50 hover:text-pink-300 cursor-pointer transition-colors border-b border-slate-800 last:border-0 flex items-center gap-2"
                onClick={() => handleSelectResort(resort.name)}
              >
                <span className="text-pink-500 font-bold">&gt;</span>
                {resort.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Scrollable Cards Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mb-2 flex flex-col gap-3">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest border-b border-slate-700 pb-1 shrink-0">
          SAVED_ARCHIVES
        </p>
        
        {savedResorts.length === 0 ? (
          <p className="text-xs text-slate-500 italic border-l-2 border-slate-700 pl-2">
            NO_DATA: No resorts saved yet.
          </p>
        ) : (
          displayedSavedResorts.map((resort) => (
            <ResortWeatherCard
              key={resort.id}
              name={resort.name}
              lat={resort.latitude}
              lon={resort.longitude}
              alt={resort.highest_point}
              href={`/resort-center/${encodeURIComponent(resort.name)}`}
              hoverBorderClass="hover:border-pink-500/50" // Use pink for 'My Resorts'
            />
          ))
        )}
      </div>

      {/* --- UPDATED: Threshold checked against 2 instead of 3 --- */}
      {savedResorts.length > 2 && (
        <div className="shrink-0 border-t border-slate-800/50 pt-3 mt-auto">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-pink-500/70 hover:text-pink-400 font-bold tracking-widest uppercase transition-colors text-left w-full"
          >
            {isExpanded ? "[-] COLLAPSE_ARCHIVE" : `[+] EXPAND_ARCHIVE (${hiddenCount} MORE)`}
          </button>
        </div>
      )}
    </div>
  );
}