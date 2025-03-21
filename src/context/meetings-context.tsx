'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { setupInsightsListener } from '@/lib/insights-listener';
import { useAuth } from '@/context/auth-context';

interface MeetingsContextType {
  refreshMeetings: () => void;
  refreshTrigger: number;
}

const MeetingsContext = createContext<MeetingsContextType | undefined>(undefined);

export function MeetingsProvider({ children }: { children: React.ReactNode }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { user } = useAuth();

  const refreshMeetings = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Set up insights listener when user is authenticated
  useEffect(() => {
    if (user?.email) {
      const unsubscribe = setupInsightsListener(user.email);
      return () => {
        unsubscribe();
      };
    }
  }, [user?.email]);

  return (
    <MeetingsContext.Provider value={{ refreshMeetings, refreshTrigger }}>
      {children}
    </MeetingsContext.Provider>
  );
}

export function useMeetings() {
  const context = useContext(MeetingsContext);
  if (context === undefined) {
    throw new Error('useMeetings must be used within a MeetingsProvider');
  }
  return context;
} 