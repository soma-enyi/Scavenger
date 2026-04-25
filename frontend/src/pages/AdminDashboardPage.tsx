import { useState } from 'react'
import {
  Users,
  Package,
  Gift,
  Settings,
  ShieldAlert,
  Activity,
  Search,
  Ban,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { useContract } from '@/context/ContractContext'
import { useWallet } from '@/context/WalletContext'
import { networkConfig } from '@/lib/stellar'
import { wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'
import type { GlobalMetrics, Incentive } from '@/api/types'

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useAdminMetrics() {
  const { config } = useContract()
  return useQuery<GlobalMetrics>({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getMetrics()
    },
    staleTime: 30_000,
  })
}

function useAdminIncentives() {
  const { config } = useContract()
  return useQuery<Incentive[]>({
    queryKey: ['admin-incentives'],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getActiveIncentives()
    },
    staleTime: 30_000,
  })
}

// ── Audit log (local session only) ───────────────────────────────────────────

interface AuditEntry {
  id: number
  action: string
  target: string
  timestamp: number
}

let _auditId = 0
const _auditLog: AuditEntry[] = []

function addAuditEntry(action: string, target: string) {
  _auditLog.unshift({ id: ++_auditId, action, target, timestamp: Date.now() / 1000 })
  if (_auditLog.length > 50) _auditLog.pop()
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'wastes' | 'incentives' | 'config' | 'audit'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
  { id: 'wastes', label: 'Wastes', icon: <Package className="h-4 w-4" /> },
  { id: 'incentives', label: 'Incentives', icon: <Gift className="h-4 w-4" /> },
  { id: 'config', label: 'Config', icon: <Settings className="h-4 w-4" /> },
  { id: 'audit', label: 'Audit Log', icon: <ShieldAlert className="h-4 w-4" /> },
]

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: metrics, isLoading } = useAdminMetrics()

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Total Wastes"
          value={isLoading ? '—' : String(metrics?.total_wastes_count ?? 0)}
          isLoading={isLoading}
        />
        <StatCard
          icon={<Gift className="h-4 w-4" />}
          label="Total Tokens Earned"
          value={isLoading ? '—' : String(metrics?.total_tokens_earned ?? 0n)}
          variant="primary"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active Incentives"
          value="—"
          variant="success"
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

// ── Wastes tab ────────────────────────────────────────────────────────────────

function WastesTab() {
  const [wasteId, setWasteId] = useState('')
  const [searched, setSearched] = useState<bigint | null>(null)
  const { config } = useContract()
  const { address } = useWallet()

  const { data: waste, isLoading } = useQuery({
    queryKey: ['admin-waste', searched?.toString()],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      return client.getWaste(searched!)
    },
    enabled: searched !== null,
  })

  const handleDeactivate = async () => {
    if (!waste || !address) return
    addAuditEntry('deactivate_waste', waste.waste_id.toString())
    // Optimistic UI — actual call requires admin signer
    alert(`Deactivate waste #${waste.waste_id} — connect admin wallet to confirm.`)
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const trimmed = wasteId.trim()
          if (trimmed) setSearched(BigInt(trimmed))
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            placeholder="Waste ID…"
            value={wasteId}
            onChange={(e) => setWasteId(e.target.value)}
            className="pl-9"
            aria-label="Waste ID"
          />
        </div>
        <Button type="submit" disabled={!wasteId.trim()}>
          Lookup
        </Button>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {waste && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Waste #{waste.waste_id.toString()}</CardTitle>
            <Badge variant={waste.is_active ? 'default' : 'outline'}>
              {waste.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Type: {wasteTypeLabel(waste.waste_type)}</p>
            <p>Owner: {formatAddress(waste.current_owner)}</p>
            <p>Registered: {formatDate(waste.recycled_timestamp)}</p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeactivate}
                disabled={!waste.is_active}
                aria-label="Deactivate waste"
              >
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                Deactivate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {searched !== null && !isLoading && !waste && (
        <p className="text-sm text-muted-foreground">No waste found with ID #{searched.toString()}.</p>
      )}
    </div>
  )
}

// ── Incentives tab ────────────────────────────────────────────────────────────

function IncentivesTab() {
  const { data: incentives = [], isLoading } = useAdminIncentives()
  const [filter, setFilter] = useState('')

  const filtered = incentives.filter(
    (inc) =>
      !filter ||
      inc.rewarder.toLowerCase().includes(filter.toLowerCase()) ||
      wasteTypeLabel(inc.waste_type).toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter by rewarder or type…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter incentives"
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incentives found.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {filtered.map((inc) => (
            <div key={inc.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {wasteTypeLabel(inc.waste_type)}{' '}
                  <span className="text-muted-foreground">#{inc.id}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatAddress(inc.rewarder)} · {inc.reward_points} pts · Budget:{' '}
                  {inc.remaining_budget}/{inc.total_budget}
                </p>
              </div>
              <Badge variant={inc.active ? 'default' : 'outline'}>
                {inc.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Config tab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const [collectorPct, setCollectorPct] = useState('50')
  const [ownerPct, setOwnerPct] = useState('50')

  const total = Number(collectorPct) + Number(ownerPct)
  const isValid = total === 100

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reward Split Percentages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Collector %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={collectorPct}
                onChange={(e) => setCollectorPct(e.target.value)}
                aria-label="Collector percentage"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Owner %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={ownerPct}
                onChange={(e) => setOwnerPct(e.target.value)}
                aria-label="Owner percentage"
              />
            </div>
          </div>
          {!isValid && (
            <p className="text-xs text-destructive">Percentages must sum to 100 (currently {total}).</p>
          )}
          <Button disabled={!isValid} aria-label="Save configuration">
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Audit log tab ─────────────────────────────────────────────────────────────

function AuditLogTab() {
  const [log] = useState<AuditEntry[]>([..._auditLog])

  return (
    <div className="space-y-2">
      {log.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admin actions recorded this session.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {log.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{entry.action}</p>
                <p className="text-xs text-muted-foreground">Target: {entry.target}</p>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  useAppTitle('Admin Dashboard')
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  return (
    <div className="space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-destructive" />
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">System management and oversight.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'wastes' && <WastesTab />}
        {activeTab === 'incentives' && <IncentivesTab />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'audit' && <AuditLogTab />}
      </div>
    </div>
  )
}
