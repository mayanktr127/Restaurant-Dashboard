import { useSyncExternalStore } from "react"

let currentClock = typeof window !== "undefined" ? Date.now() : 0
const listeners = new Set<() => void>()

if (typeof window !== "undefined") {
  setInterval(() => {
    currentClock = Date.now()
    listeners.forEach((listener) => listener())
  }, 15000)
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot() {
  return currentClock
}

function getServerSnapshot() {
  return null
}

export function useCurrentTime(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
