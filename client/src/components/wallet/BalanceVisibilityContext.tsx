import { createContext, useContext, type ReactNode } from 'react';

interface BalanceVisibilityContextValue {
  isBalanceHidden: boolean;
  toggleBalanceVisibility: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);

export function BalanceVisibilityProvider({ value, children }: { value: BalanceVisibilityContextValue; children: ReactNode }) {
  return <BalanceVisibilityContext.Provider value={value}>{children}</BalanceVisibilityContext.Provider>;
}

export function useBalanceVisibility() {
  const context = useContext(BalanceVisibilityContext);
  if (!context) throw new Error('useBalanceVisibility must be used within the dashboard layout.');
  return context;
}
