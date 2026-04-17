/*
 * Charli3 Hackathon settlement demo. MIT License.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  KNOWN_WALLETS,
  detectInstalledWallets,
  getInitial,
  lovelaceFromBalanceCbor,
} from '../lib/cip30'
import type { Cip30Api, WalletKey } from '../lib/cip30'

export interface WalletState {
  api: Cip30Api | null
  key: WalletKey | null
  label: string | null
  networkId: number | null
  changeAddress: string | null
  lovelace: bigint
  installed: WalletKey[]
  status: 'idle' | 'connecting' | 'connected' | 'error'
  error: string | null
}

const initial: WalletState = {
  api: null,
  key: null,
  label: null,
  networkId: null,
  changeAddress: null,
  lovelace: 0n,
  installed: [],
  status: 'idle',
  error: null,
}

export function useWallet() {
  const [state, setState] = useState<WalletState>(initial)

  useEffect(() => {
    const tick = () => setState((s) => ({ ...s, installed: detectInstalledWallets() }))
    tick()
    const id = window.setInterval(tick, 1500)
    return () => window.clearInterval(id)
  }, [])

  const refresh = useCallback(async (api: Cip30Api) => {
    const [networkId, balanceHex, change] = await Promise.all([
      api.getNetworkId(),
      api.getBalance(),
      api.getChangeAddress(),
    ])
    setState((s) => ({
      ...s,
      networkId,
      lovelace: lovelaceFromBalanceCbor(balanceHex),
      changeAddress: change,
    }))
  }, [])

  const connect = useCallback(async (key: WalletKey) => {
    setState((s) => ({ ...s, status: 'connecting', error: null }))
    const initialApi = getInitial(key)
    if (!initialApi) {
      setState((s) => ({ ...s, status: 'error', error: `${key} wallet not detected` }))
      return
    }
    try {
      const api = await initialApi.enable()
      const label = KNOWN_WALLETS.find((w) => w.key === key)?.label ?? key
      setState((s) => ({ ...s, api, key, label, status: 'connected' }))
      await refresh(api)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to enable wallet'
      setState((s) => ({ ...s, status: 'error', error: message }))
    }
  }, [refresh])

  const disconnect = useCallback(() => {
    setState((s) => ({ ...initial, installed: s.installed }))
  }, [])

  const reload = useCallback(async () => {
    if (state.api) await refresh(state.api)
  }, [state.api, refresh])

  return useMemo(() => ({ ...state, connect, disconnect, reload }), [state, connect, disconnect, reload])
}
