import type { DragEvent } from 'react'
import type { Card, Column } from '../types'
import { PRIORITY_LABEL } from '../types'
import { PRIORITY_EDGE, PRIORITY_PILL } from '../lib/priority'
import { dueState, formatDue } from '../lib/dates'
import { MoveMenu } from './MoveMenu'

const DUE_BADGE: Record<string, string> = {
  overdue: 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
  today: 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  soon: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
  later: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500',
}

const DUE_PREFIX: Record<string, string> = {
  overdue: 'Venceu ',
  today: 'Hoje ',
  soon: '',
  later: '',
}

export interface CardTileProps {
  card: Card
  columns: Column[]
  selected: boolean
  dragging: boolean
  onOpen: () => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onMoveToColumn: (columnId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onArchive: () => void
  canMoveUp: boolean
  canMoveDown: boolean
}

export function CardTile(props: CardTileProps) {
  const { card } = props
  const due = dueState(card.dueDate)

  return (
    <article
      draggable
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onClick={props.onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onOpen()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Card ${card.title}`}
      className={[
        'group relative flex cursor-pointer gap-2 overflow-hidden rounded border bg-white pl-0 pr-2 py-1.5 text-left',
        'hover:border-zinc-400 dark:bg-zinc-900 dark:hover:border-zinc-600',
        props.selected
          ? 'border-sky-600 ring-1 ring-sky-600/40 dark:border-sky-400 dark:ring-sky-400/30'
          : 'border-zinc-200 dark:border-zinc-800',
        props.dragging ? 'opacity-40' : '',
      ].join(' ')}
    >
      <span className={`w-1 shrink-0 self-stretch ${PRIORITY_EDGE[card.priority]}`} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <h3 className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug">{card.title}</h3>
          <div className="-mt-0.5 -mr-1 shrink-0 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
            <MoveMenu
              columns={props.columns}
              currentColumnId={card.columnId}
              canMoveUp={props.canMoveUp}
              canMoveDown={props.canMoveDown}
              onMoveToColumn={props.onMoveToColumn}
              onMoveUp={props.onMoveUp}
              onMoveDown={props.onMoveDown}
              onArchive={props.onArchive}
            />
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span
            className={`rounded-sm border px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide ${PRIORITY_PILL[card.priority]}`}
          >
            {PRIORITY_LABEL[card.priority]}
          </span>

          {card.dueDate && (
            <span
              className={`rounded-sm border px-1 text-[10px] font-medium leading-4 tabular-nums ${DUE_BADGE[due]}`}
              title={due === 'overdue' ? 'Prazo vencido' : due === 'today' ? 'Vence hoje' : 'Prazo de entrega'}
            >
              {DUE_PREFIX[due]}
              {formatDue(card.dueDate)}
            </span>
          )}

          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-sm bg-zinc-100 px-1 text-[10px] leading-4 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {tag}
            </span>
          ))}

          {card.description.trim() !== '' && (
            <span className="ml-auto text-zinc-400 dark:text-zinc-600" title="Tem descrição">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <rect x="2" y="3" width="12" height="1.6" rx="0.8" />
                <rect x="2" y="7" width="12" height="1.6" rx="0.8" />
                <rect x="2" y="11" width="7" height="1.6" rx="0.8" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
