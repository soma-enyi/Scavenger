import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { ScavengerClient } from '@/api/client'
import { Incentive, WasteType } from '@/api/types'
import { getNetworkPassphrase } from '@/lib/stellar'

const ALL_WASTE_TYPES = [
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass,
]

export function useIncentives() {
  const { address } = useWallet()
  const { config } = useContract()
  const [incentives, setIncentives] = useState<Incentive[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = new ScavengerClient({
    rpcUrl: config.rpcUrl,
    networkPassphrase: getNetworkPassphrase(config.network),
    contractId: config.contractId,
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const idSets = await Promise.all(
        ALL_WASTE_TYPES.map((wt) => client.getIncentivesByWasteType(wt))
      )
      const allIds = [...new Set(idSets.flat())]
      const results = await Promise.all(allIds.map((id) => client.getIncentiveById(id)))
      setIncentives(results.filter((i): i is Incentive => i !== null && i.active))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incentives')
    } finally {
      setIsLoading(false)
    }
  }, [config])

  useEffect(() => { load() }, [load])

  const createIncentive = useCallback(
    async (wasteType: WasteType, rewardPoints: bigint, budget: bigint) => {
      if (!address) return
      await client.createIncentive(address, wasteType, rewardPoints, budget, address)
      await load()
    },
    [address, config, load]
  )

  const updateIncentive = useCallback(
    async (id: number, rewardPoints: bigint, budget: bigint) => {
      if (!address) return
      await client.updateIncentive(id, rewardPoints, budget, address)
      await load()
    },
    [address, config, load]
  )

  const deactivateIncentive = useCallback(
    async (id: number) => {
      if (!address) return
      await client.deactivateIncentive(address, id, address)
      await load()
    },
    [address, config, load]
  )

  return { incentives, isLoading, error, address, createIncentive, updateIncentive, deactivateIncentive }
}
