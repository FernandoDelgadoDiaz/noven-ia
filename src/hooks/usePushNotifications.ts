import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Convierte la VAPID public key (base64url) al Uint8Array que espera pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

interface UsePushNotificationsReturn {
  soportado: boolean
  permiso: NotificationPermission
  activar: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth()
  const soportado =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const [permiso, setPermiso] = useState<NotificationPermission>(
    soportado ? Notification.permission : 'denied',
  )

  // Registrar el service worker al montar (si el browser soporta push)
  useEffect(() => {
    if (!soportado) return
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.error('[push] No se pudo registrar el service worker', e)
    })
  }, [soportado])

  const activar = useCallback(async (): Promise<void> => {
    if (!soportado || !user) return
    if (!VAPID_PUBLIC_KEY) {
      console.error('[push] Falta VITE_VAPID_PUBLIC_KEY')
      return
    }

    const permission = await Notification.requestPermission()
    setPermiso(permission)
    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }))

    const json = subscription.toJSON()
    const endpoint = json.endpoint ?? ''

    // Upsert manual: el índice único es sobre una expresión (subscription->>'endpoint'),
    // que PostgREST no puede usar como onConflict. Buscamos y actualizamos/insertamos.
    const { data: existingRow } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('subscription->>endpoint', endpoint)
      .maybeSingle()

    if (existingRow) {
      await supabase
        .from('push_subscriptions')
        .update({ subscription: json, updated_at: new Date().toISOString() })
        .eq('id', existingRow.id)
    } else {
      await supabase.from('push_subscriptions').insert({ usuario_id: user.id, subscription: json })
    }
  }, [soportado, user])

  return { soportado, permiso, activar }
}
