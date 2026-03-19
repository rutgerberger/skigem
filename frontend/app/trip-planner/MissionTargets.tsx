// --- app/trip-planner/MissionTargets.tsx ---
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSearch } from "../context/SearchContext";
import BucketListWidget from "../components/BucketListWidget";

export default function MissionTargets() {
  const searchParams = useSearchParams();
  const { userId } = useSearch();
  
  const tripId = searchParams.get("trip_id");
  const targetResort = searchParams.get("target_resort");
  
  const [tripData, setTripData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the full trip data to get the specific Leg ID and active bucket items
  const fetchTripData = async () => {
    if (!tripId) return;
    try {
      // Assuming you have a standard GET route for a single trip
      const res = await fetch(`http://127.0.0.1:8000/api/trips/${tripId}`);
      if (res.ok) {
        setTripData(await res.json());
      }
    } catch (err) {
      console.error("Failed to sync mission data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripData();
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center pt-32 gap-4 animate-fade-in-down">
        <div className="text-5xl animate-pulse drop-shadow-sm">🎯</div>
        <div className="text-emerald-500 text-xl font-bold text-center px-4 tracking-widest uppercase">
          SYNCING_MISSION_TARGETS...
        </div>
      </div>
    );
  }

  if (!tripData || !targetResort) {
    return <div className="text-red-500 text-xs tracking-widest text-center mt-20 uppercase">ERROR: NO_MISSION_DATA_FOUND</div>;
  }

  // Find the current leg of the trip based on the resort in the URL
  const currentLeg = tripData.legs?.find((leg: any) => leg.resort?.name === targetResort);

  if (!currentLeg) {
     return (
       <div className="max-w-2xl mx-auto mt-20 bg-slate-900 border border-emerald-900/50 p-8 rounded text-center">
         <p className="text-emerald-500 tracking-widest uppercase text-sm font-bold mb-2">TARGET_RESORT_NOT_LOCKED</p>
         <p className="text-slate-400 text-xs">You must select this resort from the Briefing tab before assigning targets.</p>
       </div>
     );
  }

  return (
    <div className="max-w-5xl mx-auto w-full mt-10 animate-fade-in-down">
      <div className="border-b border-slate-700 pb-6 mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest drop-shadow-md flex flex-wrap items-center gap-4">
          <span className="text-emerald-500">_</span> {targetResort}
        </h1>
        <p className="text-slate-400 mt-4 text-sm uppercase tracking-widest">
          MISSION_TARGETS // WAYPOINT_ID: [{currentLeg.id}]
        </p>
      </div>

      {/* Injecting your actual Widget here */}
      <BucketListWidget 
        userId={userId!}
        resortId={currentLeg.resort_id}
        resortName={targetResort}
        tripLegId={currentLeg.id}
        activeItems={currentLeg.bucket_items || []}
        onUpdate={fetchTripData} 
      />
    </div>
  );
}