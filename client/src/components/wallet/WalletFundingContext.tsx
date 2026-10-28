import { createContext, useContext } from 'react';

const WalletFundingContext = createContext<(() => void) | null>(null);

export const WalletFundingProvider = WalletFundingContext.Provider;

export function useOpenWalletFunding() {
  const openWalletFunding = useContext(WalletFundingContext);

  if (!openWalletFunding) {
    throw new Error('useOpenWalletFunding must be used within the dashboard layout.');
  }

  return openWalletFunding;
}
