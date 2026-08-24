import { useMemo, useState, type DragEvent } from 'react'
import { ITEM_STATE_LABEL, ITEM_STATES, type Card, type ChecklistItem, type ItemState, type Lane } from '../types'
import type { Action } from '../state/boardReducer'
import { checklistStats, daysSince, itemsInLane, looseItems } from '../lib/checklist'
import { dueState, formatDue } from '../lib/dates'

/**
 * O quadro interno de um card: as etapas daquele assunto especifico.
 *
 * Ocupa a area principal em vez do painel lateral porque tres ou quatro raias
 * nao cabem em 24rem -- e porque arrastar cartao exige espaco. O board principal
 * continua sendo sobre as frentes de trabalho; este e sobre uma frente so.
 */

const KIND_TINT: Record<ItemState, string> = {
  todo: 'border-zinc-300 dark:border-zinc-700',
  waiting: 'border-amber-400 dark:border-amber-700',
  done: 'border-emerald-400 dark:border-emerald-800',
}

const KIND_DOT: Record<ItemState, string> = {
  todo: 'bg-zinc-400',
  waiting: 'bg-amber-500',
  done: 'bg-emerald-500',
}

const DUE_BADGE: Record<string, string> = {
  overdue: 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
  today: 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  soon: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
  later: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500',
  none: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500',
}

export interface CardBoardProps {
  card: Card
  dispatch: (action: Action) => void
  onBack: () => void
  onOpenItem: (itemId: string) => void
  selectedItemId: string | null
}

interface MiniCardProps {
  item: ChecklistItem
  lanes: Lane[]
  laneId: string
  index: number
  count: number
  selected: boolean
  dragging: boolean
  onOpen: () => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onMove: (laneId: string, toIndex: number) => void
  onDelete: () => void
}

function MiniCard(props: MiniCardProps) {
  const { item } = props
  const [menu, setMenu] = useState(false)
  const due = dueState(item.dueDate)
  // igual a lista: espera de zero dia nao vira selo (ver ChecklistEditor)
  const days = item.state === 'waiting' && item.waitingSince ? daysSince(item.waitingSince) : null
  const waited = days !== null && days > 0 ? days : null

  return (
    <article
      draggable
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      className={[
        'relative rounded border bg-white px-2 py-1.5 dark:bg-zinc-900',
        props.selected
          ? 'border-sky-600 ring-1 ring-sky-600/40 dark:border-sky-400'
          : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600',
        props.dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={props.onOpen}
          title={item.text}
          className={`min-w-0 flex-1 break-words text-left text-[12px] leading-snug line-clamp-3 ${
            item.state === 'done' ? 'text-zinc-400 line-through dark:text-zinc-600' : ''
          }`}
        >
          {item.text}
        </button>

        <button
          type="button"
          aria-label="Mover cartão"
          className="shrink-0 rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
          onClick={() => setMenu((v) => !v)}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        </button>
      </div>

      {(waited !== null || item.dueDate) && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {waited !== null && (
            <span
              className="rounded-sm border border-amber-400 px-1 text-[10px] leading-4 text-amber-700 dark:border-amber-700 dark:text-amber-400"
              title="Tempo desde que entrou nesta raia"
            >
              há {waited}d
            </span>
          )}
          {item.dueDate && (
            <span className={`rounded-sm border px-1 text-[10px] leading-4 tabular-nums ${DUE_BADGE[due]}`}>
              {formatDue(item.dueDate)}
              {item.time && ` ${item.time}`}
            </span>
          )}
        </div>
      )}

      {menu && (
        <div className="absolute right-1 top-6 z-20 w-48 overflow-hidden rounded border border-zinc-300 bg-white text-[12px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="border-b border-zinc-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Mover para
          </p>
          {props.lanes.map((lane) => (
            <button
              key={lane.id}
              type="button"
              disabled={lane.id === props.laneId}
              className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={() => {
                setMenu(false)
                props.onMove(lane.id, Number.MAX_SAFE_INTEGER)
              }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[lane.kind]}`} aria-hidden="true" />
              <span className="truncate">{lane.name}</span>
            </button>
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              disabled={props.index === 0}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={() => {
                setMenu(false)
                props.onMove(props.laneId, props.index - 1)
              }}
            >
              Subir
            </button>
            <button
              type="button"
              disabled={props.index >= props.count - 1}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={() => {
                setMenu(false)
                props.onMove(props.laneId, props.index + 1)
              }}
            >
              Descer
            </button>
            <button
              type="button"
              className="w-full border-t border-zinc-200 px-2.5 py-1.5 text-left text-red-700 hover:bg-red-50 dark:border-zinc-800 dark:text-red-400 dark:hover:bg-red-950"
              onClick={() => {
                setMenu(false)
                props.onDelete()
              }}
            >
              Excluir cartão
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function LaneMenu(props: {
  lane: Lane
  index: number
  count: number
  dispatch: (action: Action) => void
  cardId: string
  onRename: () => void
}) {
  const [open, setOpen] = useState(false)
  const act = (run: () => void) => () => {
    setOpen(false)
    run()
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Opções da raia ${props.lane.name}`}
        className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded border border-zinc-300 bg-white text-[12px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={act(props.onRename)}
          >
            Renomear raia
          </button>
          <p className="border-t border-zinc-200 px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Conta como
          </p>
          {ITEM_STATES.map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={kind === props.lane.kind}
              className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(() => props.dispatch({ type: 'lane/kind', cardId: props.cardId, laneId: props.lane.id, kind }))}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${KIND_DOT[kind]}`} aria-hidden="true" />
              {ITEM_STATE_LABEL[kind]}
              {kind === props.lane.kind && <span className="ml-auto text-[10px]">atual</span>}
            </button>
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              disabled={props.index === 0}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(() =>
                props.dispatch({ type: 'lane/move', cardId: props.cardId, laneId: props.lane.id, toIndex: props.index - 1 }),
              )}
            >
              Mover para a esquerda
            </button>
            <button
              type="button"
              disabled={props.index >= props.count - 1}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(() =>
                props.dispatch({ type: 'lane/move', cardId: props.cardId, laneId: props.lane.id, toIndex: props.index + 1 }),
              )}
            >
              Mover para a direita
            </button>
            <button
              type="button"
              className="w-full border-t border-zinc-200 px-2.5 py-1.5 text-left text-red-700 hover:bg-red-50 dark:border-zinc-800 dark:text-red-400 dark:hover:bg-red-950"
              onClick={act(() => props.dispatch({ type: 'lane/delete', cardId: props.cardId, laneId: props.lane.id }))}
            >
              Excluir raia
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CardBoard(props: CardBoardProps) {
  const { card, dispatch } = props
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ laneId: string; index: number } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [newItem, setNewItem] = useState<{ laneId: string; text: string } | null>(null)

  const stats = checklistStats(card.checklist)
  const loose = useMemo(() => looseItems(card.checklist), [card.checklist])

  const clearDrag = () => {
    setDragId(null)
    setDrop(null)
  }

  const dropAt = (laneId: string, index: number) => {
    if (dragId) dispatch({ type: 'item/lane', cardId: card.id, itemId: dragId, laneId, toIndex: index })
    clearDrag()
  }

  const addLane = () => {
    const name = window.prompt('Nome da nova raia:')
    if (name !== null && name.trim() !== '') dispatch({ type: 'lane/add', cardId: card.id, name })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
        <button type="button" className="btn" onClick={props.onBack}>
          ← Board
        </button>
        <h2 className="truncate text-[13px] font-semibold">{card.title}</h2>
        <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          {stats.done}/{stats.total} feitos
          {stats.waiting > 0 && ` · ${stats.waiting} aguardando`}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className="btn" onClick={addLane}>
            + raia
          </button>
          <button
            type="button"
            className="btn"
            title="Desfaz as raias e volta o card para uma lista simples de itens"
            onClick={() => {
              if (window.confirm('Voltar este card para lista de itens? Os cartões e seus estados são mantidos.'))
                dispatch({ type: 'lanes/clear', cardId: card.id })
            }}
          >
            Voltar a lista
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto p-2 sm:snap-none">
        {card.lanes.map((lane, laneIndex) => {
          const items = itemsInLane(card.checklist, lane.id)
          const waiting = items.filter((i) => i.state === 'waiting').length
          return (
            <section
              key={lane.id}
              className={`flex h-full w-[86vw] shrink-0 snap-start flex-col rounded border bg-zinc-50 sm:w-[17rem] dark:bg-zinc-900/40 ${KIND_TINT[lane.kind]}`}
            >
              <header className="flex items-center gap-1.5 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
                <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_DOT[lane.kind]}`} title={ITEM_STATE_LABEL[lane.kind]} />
                {renaming === lane.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => {
                      dispatch({ type: 'lane/rename', cardId: card.id, laneId: lane.id, name: renameDraft })
                      setRenaming(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') setRenaming(null)
                    }}
                    className="field py-0.5 text-[12px] font-semibold"
                    aria-label="Nome da raia"
                  />
                ) : (
                  <h3
                    className="min-w-0 flex-1 cursor-text truncate text-[12px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                    onDoubleClick={() => {
                      setRenameDraft(lane.name)
                      setRenaming(lane.id)
                    }}
                    title={`${lane.name} (duplo clique para renomear)`}
                  >
                    {lane.name}
                  </h3>
                )}
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  {items.length}
                  {waiting > 0 && lane.kind !== 'waiting' && (
                    <span className="ml-0.5 text-amber-600 dark:text-amber-400">·{waiting}</span>
                  )}
                </span>
                <LaneMenu
                  lane={lane}
                  index={laneIndex}
                  count={card.lanes.length}
                  dispatch={dispatch}
                  cardId={card.id}
                  onRename={() => {
                    setRenameDraft(lane.name)
                    setRenaming(lane.id)
                  }}
                />
              </header>

              <div
                className="flex-1 space-y-1.5 overflow-y-auto p-1.5"
                onDragOver={(event) => {
                  if (!dragId) return
                  event.preventDefault()
                  setDrop({ laneId: lane.id, index: items.length })
                }}
                onDrop={(event) => {
                  if (!dragId) return
                  event.preventDefault()
                  dropAt(lane.id, items.length)
                }}
              >
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    onDragOver={(event) => {
                      if (!dragId) return
                      event.preventDefault()
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      setDrop({ laneId: lane.id, index: event.clientY > rect.top + rect.height / 2 ? index + 1 : index })
                    }}
                    onDrop={(event) => {
                      if (!dragId) return
                      event.preventDefault()
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      dropAt(lane.id, event.clientY > rect.top + rect.height / 2 ? index + 1 : index)
                    }}
                  >
                    {drop?.laneId === lane.id && drop.index === index && (
                      <div className="pointer-events-none -my-0.5 h-1 rounded-full bg-sky-600 dark:bg-sky-400" />
                    )}
                    <MiniCard
                      item={item}
                      lanes={card.lanes}
                      laneId={lane.id}
                      index={index}
                      count={items.length}
                      selected={props.selectedItemId === item.id}
                      dragging={dragId === item.id}
                      onOpen={() => props.onOpenItem(item.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', item.id)
                        setDragId(item.id)
                      }}
                      onDragEnd={clearDrag}
                      onMove={(laneId, toIndex) =>
                        dispatch({ type: 'item/lane', cardId: card.id, itemId: item.id, laneId, toIndex })
                      }
                      onDelete={() => dispatch({ type: 'item/delete', cardId: card.id, itemId: item.id })}
                    />
                  </div>
                ))}

                {drop?.laneId === lane.id && drop.index === items.length && (
                  <div className="pointer-events-none h-1 rounded-full bg-sky-600 dark:bg-sky-400" />
                )}

                {newItem?.laneId === lane.id ? (
                  <input
                    autoFocus
                    value={newItem.text}
                    onChange={(event) => setNewItem({ laneId: lane.id, text: event.target.value })}
                    onBlur={() => {
                      if (newItem.text.trim() !== '')
                        dispatch({ type: 'item/add', cardId: card.id, text: newItem.text, laneId: lane.id })
                      setNewItem(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                      if (event.key === 'Escape') setNewItem(null)
                    }}
                    placeholder="Título do cartão"
                    className="field py-1 text-[12px]"
                    aria-label="Novo cartão"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewItem({ laneId: lane.id, text: '' })}
                    className="w-full rounded border border-dashed border-zinc-300 px-2 py-1.5 text-[11px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:text-zinc-300"
                  >
                    + cartão
                  </button>
                )}
              </div>
            </section>
          )
        })}

        <div className="shrink-0 pr-2">
          <button
            type="button"
            onClick={addLane}
            className="h-9 rounded border border-dashed border-zinc-300 px-3 text-[12px] text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
          >
            + raia
          </button>
        </div>
      </div>

      {loose.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          <span className="flex-1">
            {loose.length} cartão(ões) fora de qualquer raia — criados antes de este card virar quadro.
          </span>
          <button
            type="button"
            className="btn border-amber-400 dark:border-amber-700"
            onClick={() => dispatch({ type: 'lanes/collectLoose', cardId: card.id })}
          >
            Colocar em {card.lanes[0]?.name ?? 'primeira raia'}
          </button>
        </div>
      )}
    </div>
  )
}
