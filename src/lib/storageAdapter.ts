interface Store {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const memoryStore: Record<string, string> = {}

function createStore(store: Record<string, string | undefined>): Store {
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value },
    removeItem: (key) => { delete store[key] },
  }
}

function probe(storage: Storage): Store | null {
  try {
    const key = '__squill_probe__'
    storage.setItem(key, '1')
    storage.removeItem(key)
    return createStore(storage as unknown as Record<string, string | undefined>)
  } catch {
    return null
  }
}

const ls = probe(localStorage)
const ss = ls ? null : probe(sessionStorage)

export const storageAdapter: Store = ls ?? ss ?? {
  getItem: (key) => memoryStore[key] ?? null,
  setItem: (key, value) => { memoryStore[key] = value },
  removeItem: (key) => { delete memoryStore[key] },
}
