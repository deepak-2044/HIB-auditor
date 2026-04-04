import React, { createContext, useContext, useState, ReactNode } from 'react';

type AppMode = 'hospital' | 'hib';

interface RoleContextType {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [appMode, setAppMode] = useState<AppMode>('hospital');

  return (
    <RoleContext.Provider value={{ appMode, setAppMode }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
