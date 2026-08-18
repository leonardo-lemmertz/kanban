export interface Debounced {
  schedule(): void
  flush(): void
  cancel(): void
  pending(): boolean
}

export function createDebounced(fn: () => void, delayMs: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    schedule() {
      clear()
      timer = setTimeout(() => {
        timer = null
        fn()
      }, delayMs)
    },
    flush() {
      if (timer === null) return
      clear()
      fn()
    },
    cancel: clear,
    pending: () => timer !== null,
  }
}
