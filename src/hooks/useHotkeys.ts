import { useEffect } from 'react'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export interface Hotkeys {
  /** N: novo card */
  onNew: () => void
  /** barra: focar a busca */
  onSearch: () => void
  /** Esc: fechar painel/overlay */
  onEscape: () => void
}

export function useHotkeys({ onNew, onSearch, onEscape }: Hotkeys): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape()
        return
      }
      // atalhos so valem fora de campos de texto e sem modificadores
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return

      if (event.key === '/') {
        event.preventDefault()
        onSearch()
        return
      }
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        onNew()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNew, onSearch, onEscape])
}
