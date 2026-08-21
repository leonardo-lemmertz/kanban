import { useState } from 'react'
import { ITEM_STATE_LABEL, type ChecklistItem, type ItemState } from '../types'
import type { ItemPatch } from '../state/boardReducer'
import { checklistStats, daysSince, parseDescriptionToChecklist } from '../lib/checklist'
import { dueState, formatDue } from '../lib/dates'

/** Ciclo do clique no marcador: a fazer -> aguardando -> feito -> a fazer. */
const NEXT_STATE: Record<ItemState, ItemState> = { todo: 'waiting', waiting: 'done', done: 'todo' }

const STATE_STYLE: Record<ItemState, string> = {
  todo: 'border-zinc-400 text-transparent hover:border-zinc-600 dark:border-zinc-600 dark:hover:border-zinc-400',
  waiting: 'border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  done: 'border-emerald-600 bg-emerald-600 text-white',
}

const DUE_STYLE: Record<string, string> = {
  overdue: 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
  today: 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  soon: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
  later: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500',
  none: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500',
}

function StateMark({ state }: { state: ItemState }) {
  if (state === 'done') {
    return (
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M2.5 6.5 5 9l4.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (state === 'waiting') {
    return (
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
        <circle cx="2.5" cy="6" r="1.1" />
        <circle cx="6" cy="6" r="1.1" />
        <circle cx="9.5" cy="6" r="1.1" />
      </svg>
    )
  }
  return <span className="h-2.5 w-2.5" />
}

export interface ChecklistEditorProps {
  items: ChecklistItem[]
  description: string
  onAdd: (text: string) => void
  onPatch: (itemId: string, patch: ItemPatch) => void
  onState: (itemId: string, state: ItemState) => void
  onMove: (itemId: string, delta: number) => void
  onDelete: (itemId: string) => void
  onImportFromDescription: () => void
}

export function ChecklistEditor(props: ChecklistEditorProps) {
  const [draft, setDraft] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState('')

  const stats = checklistStats(props.items)
  /**
   * So oferece a conversao com a lista vazia. Com itens ja criados, converter de
   * novo duplicaria tudo -- a descricao original continua la, intacta.
   */
  const convertible = stats.total === 0 ? parseDescriptionToChecklist(props.description) : null

  const add = () => {
    if (draft.trim() === '') return
    props.onAdd(draft)
    setDraft('')
  }

  const openEditor = (item: ChecklistItem) => {
    setOpenId((current) => (current === item.id ? null : item.id))
    setEditing(item.text)
  }

  const commitText = (item: ChecklistItem) => {
    if (editing.trim() !== '' && editing.trim() !== item.text) props.onPatch(item.id, { text: editing })
  }

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Itens
        </span>
        {stats.total > 0 && (
          <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {stats.done}/{stats.total} feitos
            {stats.waiting > 0 && ` · ${stats.waiting} aguardando`}
          </span>
        )}
      </div>

      {stats.total > 0 && (
        <div className="mb-1.5 flex h-1 overflow-hidden rounded-sm bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
          <span className="bg-emerald-500" style={{ width: `${(stats.done / stats.total) * 100}%` }} />
          <span className="bg-amber-400" style={{ width: `${(stats.waiting / stats.total) * 100}%` }} />
        </div>
      )}

      <ul className="space-y-0.5">
        {props.items.map((item, index) => {
          const due = dueState(item.dueDate)
          const waited = item.state === 'waiting' && item.waitingSince ? daysSince(item.waitingSince) : null
          return (
            <li key={item.id} className="rounded border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800">
              <div className="flex items-start gap-1.5 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => props.onState(item.id, NEXT_STATE[item.state])}
                  title={`${ITEM_STATE_LABEL[item.state]} — clique para mudar`}
                  aria-label={`${item.text}: ${ITEM_STATE_LABEL[item.state]}`}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${STATE_STYLE[item.state]}`}
                >
                  <StateMark state={item.state} />
                </button>

                <button
                  type="button"
                  onClick={() => openEditor(item)}
                  className={`min-w-0 flex-1 break-words text-left text-[12px] leading-snug ${
                    item.state === 'done' ? 'text-zinc-400 line-through dark:text-zinc-600' : ''
                  }`}
                >
                  {item.text}
                </button>

                {waited !== null && (
                  <span
                    className="shrink-0 rounded-sm border border-amber-400 px-1 text-[10px] leading-4 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                    title="Tempo desde que entrou em aguardando"
                  >
                    {waited === 0 ? 'hoje' : `${waited}d`}
                  </span>
                )}

                {item.dueDate && (
                  <span className={`shrink-0 rounded-sm border px-1 text-[10px] leading-4 tabular-nums ${DUE_STYLE[due]}`}>
                    {formatDue(item.dueDate)}
                    {item.time && ` ${item.time}`}
                  </span>
                )}
              </div>

              {openId === item.id && (
                <div className="space-y-1.5 border-t border-zinc-200 px-1 py-1.5 dark:border-zinc-800">
                  <input
                    value={editing}
                    onChange={(event) => setEditing(event.target.value)}
                    onBlur={() => commitText(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitText(item)
                        setOpenId(null)
                      }
                      if (event.key === 'Escape') {
                        event.stopPropagation()
                        setOpenId(null)
                      }
                    }}
                    className="field py-1 text-[12px]"
                    aria-label="Texto do item"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="date"
                      value={item.dueDate ?? ''}
                      onChange={(event) => props.onPatch(item.id, { dueDate: event.target.value })}
                      className="field w-auto py-0.5 text-[11px]"
                      aria-label="Data do item"
                    />
                    <input
                      type="time"
                      value={item.time ?? ''}
                      onChange={(event) => props.onPatch(item.id, { time: event.target.value })}
                      className="field w-auto py-0.5 text-[11px]"
                      aria-label="Hora do item"
                    />
                    <button
                      type="button"
                      className="btn px-1.5 py-0.5"
                      disabled={index === 0}
                      onClick={() => props.onMove(item.id, -1)}
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn px-1.5 py-0.5"
                      disabled={index === props.items.length - 1}
                      onClick={() => props.onMove(item.id, 1)}
                      title="Descer"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger ml-auto px-1.5 py-0.5"
                      onClick={() => {
                        setOpenId(null)
                        props.onDelete(item.id)
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder={stats.total === 0 ? 'Adicionar item…' : 'Adicionar mais um…'}
        className="field mt-1 py-1 text-[12px]"
        aria-label="Novo item"
      />

      {convertible !== null && convertible.items.length > 1 && (
        <button
          type="button"
          className="btn mt-1.5 w-full justify-center"
          onClick={() => {
            const ok = window.confirm(
              `Converter as ${convertible.items.length} linhas da descrição em itens?\n\n` +
                `${convertible.waiting} viriam já como "aguardando" e ${convertible.dated} com data reconhecida — ` +
                'revise depois, é um chute a partir do texto.\n\n' +
                'A descrição original é mantida.',
            )
            if (ok) props.onImportFromDescription()
          }}
        >
          Converter descrição em {convertible.items.length} itens
        </button>
      )}
    </section>
  )
}
