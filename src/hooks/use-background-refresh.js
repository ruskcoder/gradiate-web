import { useEffect, useRef } from 'react'
import { useCurrentUser, useStore } from '@/lib/store'
import { getClasses } from '@/lib/grades-api'
import { CLASSES_ENDPOINT } from '@/lib/constants'

/**
 * Re-fetch the current term's classes on the user's interval while the app is
 * open. Change alerts fire from the grades-api store merge, so this only has to
 * bust the cache and drain the stream.
 */
export function useBackgroundRefresh() {
  const user = useCurrentUser()
  const minutes = user?.alertSettings?.autoRefreshMinutes || 0
  const running = useRef(false)

  useEffect(() => {
    if (!minutes) return
    const tick = async () => {
      if (running.current || !navigator.onLine) return
      running.current = true
      try {
        useStore.getState().invalidateCache(CLASSES_ENDPOINT)
        const stream = getClasses()
        while (!(await stream.next()).done) { /* drain */ }
      } catch (e) {
        console.error('Background refresh failed:', e)
      } finally {
        running.current = false
      }
    }
    const id = setInterval(tick, minutes * 60 * 1000)
    return () => clearInterval(id)
  }, [minutes])
}
