import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isConnected, requestAccess, getPublicKey, isBrowser } from '@stellar/freighter-api';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isInstalled: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  isLoading: boolean;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(localStorage.getItem('wallet_address'));
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!isBrowser) return setLoading(false);
      try {
        const connected = await isConnected();
        setIsInstalled(true);
        if (connected) {
          const addr = await getPublicKey();
          if (addr) { setAddress(addr); localStorage.setItem('wallet_address', addr); }
        }
      } catch {
        setIsInstalled(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const connect = async () => {
    setError(null);
    if (!isInstalled) {
      setError('Freighter extension is not installed. Please install it from freighter.app.');
      return;
    }
    setLoading(true);
    try {
      const addr = await requestAccess();
      setAddress(addr);
      localStorage.setItem('wallet_address', addr);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)) ?? '';
      setError(msg.includes('User declined') ? 'Connection rejected.' : 'Failed to connect wallet.');
    } finally {
      setLoading(false)
    }
  }

  const disconnect = () => { setAddress(null); localStorage.removeItem('wallet_address'); };

  return (
    <WalletContext.Provider value={{ address, isConnected: !!address, isInstalled, connect, disconnect, isLoading: loading, error }}>
      {children}
    </WalletContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
};
