import { useRef, type RefObject } from 'react'
import { PRIORITIES, PRIORITY_LABEL, type Priority } from '../types'
import type { SyncStatus } from '../state/useBoard'
import { SyncBadge } from './SyncBadge'

export type View = 'board' | 'track' | 'archive' | 'settings'

export interface ToolbarProps {
  view: View
  onView: (view: View) => void
  query: string
  onQuery: (query: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  tags: string[]
  tag: string
  onTag: (tag: string) => void
  priority: Priority | ''
  onPriority: (priority: Priority | '') => void
  status: SyncStatus
  onSync: () => void
  onNewCard: () => void
  onExport: () => void
  onImport: (file: File) => void
  visible: number
  total: number
  archivedCount: number
}

export function Toolbar(props: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const filtering = props.query.trim() !== '' || props.tag !== '' || props.priority !== ''

  return (
    <header className="flex flex-wrap items-center gap-1.5 border-b border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mr-1 text-[13px] font-bold tracking-tight">Kanban</h1>

      <div className="flex overflow-hidden rounded border border-zinc-300 dark:border-zinc-700">
        {(
          [
            ['board', 'Board'],
            ['track', 'Pista'],
            ['archive', `Arquivo${props.archivedCount > 0 ? ` (${props.archivedCount})` : ''}`],
            ['settings', 'Config'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => props.onView(value)}
            className={[
              'px-2 py-1 text-[12px] font-medium',
              props.view === value
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <input
          ref={props.searchRef}
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              props.onQuery('')
              event.currentTarget.blur()
            }
          }}
          placeholder="Buscar  /"
          aria-label="Buscar cards"
          className="field py-1 pr-6"
        />
        {props.query !== '' && (
          <button
            type="button"
            onClick={() => props.onQuery('')}
            aria-label="Limpar busca"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ×
          </button>
        )}
      </div>

      <select
        value={props.tag}
        onChange={(event) => props.onTag(event.target.value)}
        aria-label="Filtrar por tag"
        className="field w-auto py-1"
      >
        <option value="">todas as tags</option>
        {props.tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>

      <select
        value={props.priority}
        onChange={(event) => props.onPriority(event.target.value as Priority | '')}
        aria-label="Filtrar por prioridade"
        className="field w-auto py-1"
      >
        <option value="">toda prioridade</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </select>

      {filtering && (
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {props.visible}/{props.total}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button type="button" className="btn" onClick={props.onExport} title="Baixar o board como arquivo JSON">
          Exportar
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()} title="Substituir o board por um arquivo JSON">
          Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) props.onImport(file)
            event.target.value = ''
          }}
        />
        <button type="button" className="btn btn-primary" onClick={props.onNewCard} title="Novo card (N)">
          + Card
        </button>
        <SyncBadge status={props.status} onClick={props.onSync} />
      </div>
    </header>
  )
}
