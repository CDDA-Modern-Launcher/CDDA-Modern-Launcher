import { useEffect, useState } from 'react'
import { AppAppearance } from '../../../shared/appearance'

export function useSystemAppearance(): AppAppearance {
  const [appearance, setAppearance] = useState<AppAppearance>({ colorScheme: 'dark' })

  useEffect(() => {
    let mounted = true

    window.api.appearance.get().then((initialAppearance) => {
      if (mounted) {
        setAppearance(initialAppearance)
      }
    })

    const unsubscribe = window.api.appearance.onChanged(setAppearance)

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return appearance
}
