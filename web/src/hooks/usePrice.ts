/*
 * Charli3 Hackathon settlement demo. MIT License.
 *
 * Polls a stub price feed for the Day 1 demo. By Saturday EOD this will be
 * replaced by the Oracle Engineer's HTTP service which returns live ODV data.
 */
import { useEffect, useRef, useState } from 'react'

export interface PriceTick {
  pair: string
  price: number
  source: string
  fetchedAt: string
}

const STUB_URL = '/stub/price.json'

export function usePrice(intervalMs = 5000) {
  const [tick, setTick] = useState<PriceTick | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${STUB_URL}?_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as PriceTick
        if (!cancelled.current) {
          setTick(json)
          setError(null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled.current) {
          setError(e instanceof Error ? e.message : 'Price fetch failed')
          setLoading(false)
        }
      }
    }
    fetchOnce()
    const id = window.setInterval(fetchOnce, intervalMs)
    return () => {
      cancelled.current = true
      window.clearInterval(id)
    }
  }, [intervalMs])

  return { tick, error, loading }
}
