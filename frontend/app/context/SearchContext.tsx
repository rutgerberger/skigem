"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Resort, Chalet } from '../../types';

interface SearchContextType {
  userId: number | null; // <-- Added user identity
  
  resorts: Resort[];
  setResorts: (resorts: Resort[]) => void;
  lastResortCriteria: string | null;
  setLastResortCriteria: (criteria: string | null) => void;
  
  chalets: Chalet[];
  setChalets: (chalets: Chalet[]) => void;
  lastChaletCriteria: string | null;
  setLastChaletCriteria: (criteria: string | null) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);

  const [resorts, setResorts] = useState<Resort[]>([]);
  const [lastResortCriteria, setLastResortCriteria] = useState<string | null>(null);
  
  const [chalets, setChalets] = useState<Chalet[]>([]);
  const [lastChaletCriteria, setLastChaletCriteria] = useState<string | null>(null);

  // Initial load: Check for existing ID or create a new one
  useEffect(() => {
    const storedId = localStorage.getItem('skigem_user_id');
    if (storedId) {
      setUserId(parseInt(storedId, 10));
    } else {
      // Generate a random integer ID (e.g., between 1 and 1,000,000)
      const newId = Math.floor(Math.random() * 1000000) + 1;
      localStorage.setItem('skigem_user_id', newId.toString());
      setUserId(newId);
    }
  }, []);

  return (
    <SearchContext.Provider value={{ 
      userId,
      resorts, setResorts, lastResortCriteria, setLastResortCriteria,
      chalets, setChalets, lastChaletCriteria, setLastChaletCriteria
    }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}