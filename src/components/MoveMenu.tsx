import { useEffect, useRef, useState } from 'react'
import type { Column } from '../types'

export interface MoveMenuProps {
  columns: Column[]
  currentColumnId: string
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveToColumn: (columnId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onArchive: () => void
}

/**
 * Fallback de movimentacao sem arrastar. Drag and drop por toque e fragil no
 * celular, entao todo card tem este menu -- ele e o caminho principal no
 * telefone e o atalho de teclado no desktop.
 */
export function MoveMenu(props: MoveMenuProps) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const act = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Mover card"
        title="Mover para..."
        className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded border border-zinc-300 bg-white text-[12px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          onClick={(event) => event.stopPropagation()}
        >
          <p className="border-b border-zinc-200 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Mover para
          </p>
          {props.columns.map((column) => (
            <button
              key={column.id}
              type="button"
              disabled={column.id === props.currentColumnId}
              className="flex w-full items-center justify-between px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(() => props.onMoveToColumn(column.id))}
            >
              <span className="truncate">{column.title}</span>
              {column.id === props.currentColumnId && <span className="text-[10px]">atual</span>}
            </button>
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              disabled={!props.canMoveUp}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(props.onMoveUp)}
            >
              Subir na coluna
            </button>
            <button
              type="button"
              disabled={!props.canMoveDown}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(props.onMoveDown)}
            >
              Descer na coluna
            </button>
            <button
              type="button"
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={act(props.onArchive)}
            >
              Arquivar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
