import { useMemo, useState } from 'react'
import type { Board } from '../types'
import { PRIORITY_LABEL } from '../types'
import { PRIORITY_PILL } from '../lib/priority'
import { formatDateTime, formatDue } from '../lib/dates'
import { Markdown } from '../lib/markdown'
import type { Action } from '../state/boardReducer'

export function ArchiveView({ board, dispatch }: { board: Board; dispatch: (action: Action) => void }) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...board.archived].sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
    if (q === '') return list
    return list.filter(
      (card) =>
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        card.tags.some((tag) => tag.toLowerCase().includes(q)),
    )
  }, [board.archived, query])

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Arquivo
        </h2>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {cards.length} de {board.archived.length}
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar no arquivo"
          className="field ml-auto w-auto py-1"
          aria-label="Buscar no arquivo"
        />
      </div>

      {board.archived.length === 0 && (
        <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nada arquivado ainda. Use <span className="font-semibold">Arquivar</span> no card em vez de excluir — assim
          ele sai do board mas continua consultável aqui.
        </p>
      )}

      <ul className="space-y-1.5">
        {cards.map((card) => (
          <li
            key={card.id}
            className="rounded border border-zinc-200 bg-white px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpenId((id) => (id === card.id ? null : card.id))}
              >
                <span className="break-words text-[13px] font-medium">{card.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded-sm border px-1 text-[10px] font-semibold uppercase leading-4 ${PRIORITY_PILL[card.priority]}`}
                  >
                    {PRIORITY_LABEL[card.priority]}
                  </span>
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-sm bg-zinc-100 px-1 text-[10px] leading-4 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                  {card.dueDate && (
                    <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      entrega {formatDue(card.dueDate)}
                    </span>
                  )}
                  {card.archivedAt && (
                    <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      arquivado {formatDateTime(card.archivedAt)}
                    </span>
                  )}
                </span>
              </button>

              <select
                className="field w-auto py-0.5 text-[11px]"
                value=""
                onChange={(event) => {
                  if (event.target.value !== '')
                    dispatch({ type: 'card/restore', id: card.id, toColumnId: event.target.value })
                }}
                aria-label={`Restaurar ${card.title}`}
              >
                <option value="">restaurar para…</option>
                {board.columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (window.confirm(`Excluir "${card.title}" definitivamente do arquivo?`))
                    dispatch({ type: 'card/delete', id: card.id, from: 'archive' })
                }}
              >
                Excluir
              </button>
            </div>

            {openId === card.id && card.description.trim() !== '' && (
              <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                <Markdown source={card.description} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
