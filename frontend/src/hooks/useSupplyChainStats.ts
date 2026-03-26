import { useState, useEffect } from 'react'
import { ScavengerClient } from '@/api/client'
import { config } from '@/config'
import { networkConfig } from '@/lib/stellar'

const client = new ScavengerClient({
  rpcUrl: networkConfig.rpcUrl,
  networkPassphrase: networkConfig.networkPassphrase,
  contractId: config.contractId,
})

export function useSupplyChainStats() {
  const [totalWastes, setTotalWastes] = useState<bigint>(0n)
  const [totalWeight, setTotalWeight] = useState<bigint>(0n)
  const [totalTokens, setTotalTokens] = useState<bigint>(0n)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      setIsLoading(true)
      const [wastes, weight, tokens] = await client.getSupplyChainStats()
      setTotalWastes(wastes)
      setTotalWeight(weight)
      setTotalTokens(tokens)
      setIsLoading(false)
    }

    fetch()
    const interval = setInterval(fetch, 60_000)
    return () => clearInterval(interval)
  }, [])

  return { totalWastes, totalWeight, totalTokens, isLoading }
}
