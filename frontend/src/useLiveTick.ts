import { useEffect, useState } from 'react'

// A number that grows when the data on the page may be out of date: every `intervalMs` while the tab is visible, and
// when the person comes back to the tab. A page puts it into the dependencies of its loading effect, so the data is
// read again quietly (the page keeps showing the old data until the new answer comes).
export function useLiveTick(intervalMs: number): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const bump = () => setTick((value) => value + 1)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') bump()
    }, intervalMs)
    function onVisible() {
      if (document.visibilityState === 'visible') bump()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [intervalMs])

  return tick
}
