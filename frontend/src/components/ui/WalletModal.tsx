import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { formatAddress } from '@/lib/helpers';
import { Button } from '@/components/ui/Button';

const WALLETS = [
  {
    id: 'freighter',
    name: 'Freighter',
    icon: '🔑',
    installUrl: 'https://freighter.app',
  },
  {
    id: 'albedo',
    name: 'Albedo',
    icon: '🌐',
    installUrl: 'https://albedo.link',
  },
];

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { address, isConnected, isInstalled, connect, disconnect, isLoading, error } = useWallet();

  const handleConnect = async (walletId: string) => {
    if (walletId !== 'freighter') return; // only Freighter supported via API
    await connect();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold">
              {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Connected as</p>
              <p className="font-mono text-sm bg-muted rounded px-3 py-2">{address}</p>
              <Button variant="destructive" className="w-full" onClick={() => { disconnect(); onOpenChange(false); }}>
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {error && <p className="text-sm text-destructive">{error}</p>}
              {WALLETS.map((wallet) => {
                const supported = wallet.id === 'freighter';
                const notInstalled = supported && !isInstalled;
                return (
                  <div key={wallet.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span>{wallet.icon}</span> {wallet.name}
                    </span>
                    {notInstalled ? (
                      <a href={wallet.installUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        Install
                      </a>
                    ) : supported ? (
                      <Button size="sm" onClick={() => handleConnect(wallet.id)} disabled={isLoading}>
                        {isLoading ? 'Connecting…' : 'Connect'}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Coming soon</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
