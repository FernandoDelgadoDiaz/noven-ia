import { useContext } from 'react'
import {
  NovenAccessContext,
  type NovenAccessContextValue,
} from '@/context/novenAccessContextBase'

export function useNovenAccessContext(): NovenAccessContextValue {
  const value = useContext(NovenAccessContext)
  if (!value) throw new Error('useNovenAccessContext debe usarse dentro de NovenAccessProvider')
  return value
}
