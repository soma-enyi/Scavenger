import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { ScavengerClient } from '@/api/client'
import { Material } from '@/api/types'
import { getNetworkPassphrase } from '@/lib/stellar'
import { useToast } from '@/hooks/useToast'

export function useWasteList() {
  const { address } = useWallet()
  const { config } = useContract()
  const toast = useToast()
  const [wastes, setWastes] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getClient = useCallback(
    () =>
      new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: getNetworkPassphrase(config.network),
        contractId: config.contractId,
      }),
    [config]
  )

  const load = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const client = getClient()
      const ids = await client.getParticipantWastes(address)
      const materials = await Promise.all(ids.map((id) => client.getMaterial(id)))
      setWastes(materials.filter((m): m is Material => m !== null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wastes')
    } finally {
      setIsLoading(false)
    }
  }, [address, getClient])

  useEffect(() => { load() }, [load])

  const confirmWaste = useCallback(async (wasteId: number | bigint) => {
    if (!address) return
    // Optimistic update
    setWastes((prev) =>
      prev.map((w) => (BigInt(w.id) === BigInt(wasteId) ? { ...w, is_confirmed: true } : w))
    )
    try {
      await getClient().confirmWasteDetails(BigInt(wasteId), address, address)
      toast.success(`Waste #${wasteId} confirmed successfully.`)
      await load()
    } catch (err) {
      // Revert optimistic update on failure
      await load()
      toast.error(err)
    }
  }, [address, getClient, load, toast])

  const transferWaste = useCallback(async (wasteId: number | bigint, to: string) => {
    if (!address) return
    await getClient().transferWaste(BigInt(wasteId), address, to, 0n, 0n, '', address)
    await load()
  }, [address, getClient, load])

  return { wastes, isLoading, error, reload: load, confirmWaste, transferWaste }
}
