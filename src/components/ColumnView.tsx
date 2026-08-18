import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { Card, Column } from '../types'
import { CardTile } from './CardTile'

export interface ColumnViewProps {
  column: Column
  index: number
  columnCount: number
  columns: Column[]
  /** todos os cards da coluna, ordenados */
  cards: Card[]
  /** ids escondidos pelo filtro (continuam contando na ordenacao) */
  hiddenIds: Set<string>
  selectedCardId: string | null
  dragKind: 'card' | 'column' | null
  draggingCardId: string | null
  dropIndex: number | null
  columnDropIndicator: 'before' | 'after' | null
  onOpenCard: (card: Card) => void
  onAddCard: () => void
  onRename: (title: string) => void
  onSetWip: (limit?: number) => void
  onDeleteColumn: () => void
  onArchiveAll: () => void
  onMoveColumn: (toIndex: number) => void
  onCardDragStart: (cardId: string) => void
  onCardDragEnd: () => void
  onCardDragOver: (index: number) => void
  onCardDrop: (index: number) => void
  onColumnDragStart: () => void
  onColumnDragOver: () => void
  onColumnDrop: () => void
  onMoveCard: (cardId: string, toColumnId: string, toIndex: number) => void
  onArchiveCard: (cardId: string) => void
}

function ColumnMenu(props: {
  column: Column
  index: number
  columnCount: number
  cardCount: number
  onRename: () => void
  onSetWip: (limit?: number) => void
  onArchiveAll: () => void
  onDelete: () => void
  onMove: (toIndex: number) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  const act = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const askWip = () => {
    const answer = window.prompt(
      `WIP limit de "${props.column.title}" (vazio para remover):`,
      props.column.wipLimit ? String(props.column.wipLimit) : '',
    )
    if (answer === null) return
    const trimmed = answer.trim()
    if (trimmed === '') return props.onSetWip(undefined)
    const value = Number.parseInt(trimmed, 10)
    if (Number.isFinite(value) && value > 0) props.onSetWip(value)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={`Opções da coluna ${props.column.title}`}
        className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded border border-zinc-300 bg-white text-[12px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {[
            { label: 'Renomear coluna', run: props.onRename, disabled: false },
            {
              label: props.column.wipLimit ? `WIP limit (${props.column.wipLimit})` : 'Definir WIP limit',
              run: askWip,
              disabled: false,
            },
            { label: 'Mover para a esquerda', run: () => props.onMove(props.index - 1), disabled: props.index === 0 },
            {
              label: 'Mover para a direita',
              run: () => props.onMove(props.index + 1),
              disabled: props.index === props.columnCount - 1,
            },
            {
              label: `Arquivar os ${props.cardCount} cards`,
              run: props.onArchiveAll,
              disabled: props.cardCount === 0,
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:disabled:text-zinc-600"
              onClick={act(item.run)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            disabled={props.columnCount <= 1}
            className="w-full border-t border-zinc-200 px-2.5 py-1.5 text-left text-red-700 hover:bg-red-50 disabled:text-zinc-400 disabled:hover:bg-transparent dark:border-zinc-800 dark:text-red-400 dark:hover:bg-red-950 dark:disabled:text-zinc-600"
            onClick={act(props.onDelete)}
          >
            Excluir coluna
          </button>
        </div>
      )}
    </div>
  )
}

export function ColumnView(props: ColumnViewProps) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(props.column.title)
  const total = props.cards.length
  const overWip = props.column.wipLimit !== undefined && total > props.column.wipLimit
  const hidden = props.cards.filter((c) => props.hiddenIds.has(c.id)).length

  const startRename = () => {
    setDraft(props.column.title)
    setRenaming(true)
  }

  const commitRename = () => {
    setRenaming(false)
    if (draft.trim() !== '' && draft.trim() !== props.column.title) props.onRename(draft.trim())
  }

  const acceptCard = (event: DragEvent) => props.dragKind === 'card' && event.preventDefault()

  const dropLine = (index: number) =>
    props.dropIndex === index ? (
      <div className="pointer-events-none -my-0.5 h-1 rounded-full bg-sky-600 dark:bg-sky-400" />
    ) : null

  return (
    <section
      className={[
        'flex h-full w-[86vw] shrink-0 snap-start flex-col rounded border bg-zinc-50 sm:w-[19rem]',
        props.columnDropIndicator === 'before'
          ? 'border-l-4 border-l-sky-600 dark:border-l-sky-400'
          : props.columnDropIndicator === 'after'
            ? 'border-r-4 border-r-sky-600 dark:border-r-sky-400'
            : '',
        'border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/40',
      ].join(' ')}
      onDragOver={(event) => {
        if (props.dragKind === 'column') {
          event.preventDefault()
          props.onColumnDragOver()
        }
      }}
      onDrop={(event) => {
        if (props.dragKind === 'column') {
          event.preventDefault()
          props.onColumnDrop()
        }
      }}
    >
      <header
        draggable={!renaming}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', props.column.id)
          props.onColumnDragStart()
        }}
        className="flex items-center gap-1.5 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800"
      >
        <span className="cursor-grab text-zinc-300 dark:text-zinc-600" title="Arraste para reordenar a coluna">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <circle cx="6" cy="4" r="1.2" />
            <circle cx="10" cy="4" r="1.2" />
            <circle cx="6" cy="8" r="1.2" />
            <circle cx="10" cy="8" r="1.2" />
            <circle cx="6" cy="12" r="1.2" />
            <circle cx="10" cy="12" r="1.2" />
          </svg>
        </span>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
              if (event.key === 'Escape') setRenaming(false)
            }}
            className="field py-0.5 text-[13px] font-semibold"
            aria-label="Nome da coluna"
          />
        ) : (
          <h2
            className="min-w-0 flex-1 cursor-text truncate text-[13px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
            onDoubleClick={startRename}
            title={`${props.column.title} (duplo clique para renomear)`}
          >
            {props.column.title}
          </h2>
        )}

        <span
          className={[
            'rounded-sm border px-1 text-[11px] font-semibold tabular-nums',
            overWip
              ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
              : 'border-transparent text-zinc-500 dark:text-zinc-400',
          ].join(' ')}
          title={props.column.wipLimit ? `WIP limit: ${props.column.wipLimit}` : 'Cards nesta coluna'}
        >
          {total}
          {props.column.wipLimit !== undefined && `/${props.column.wipLimit}`}
        </span>

        <button
          type="button"
          onClick={props.onAddCard}
          aria-label={`Novo card em ${props.column.title}`}
          title="Novo card nesta coluna"
          className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M7.2 3h1.6v4.2H13v1.6H8.8V13H7.2V8.8H3V7.2h4.2z" />
          </svg>
        </button>

        <ColumnMenu
          column={props.column}
          index={props.index}
          columnCount={props.columnCount}
          cardCount={total}
          onRename={startRename}
          onSetWip={props.onSetWip}
          onArchiveAll={props.onArchiveAll}
          onDelete={props.onDeleteColumn}
          onMove={props.onMoveColumn}
        />
      </header>

      <div
        className="flex-1 space-y-1.5 overflow-y-auto p-1.5"
        onDragOver={(event) => {
          if (props.dragKind !== 'card') return
          event.preventDefault()
          props.onCardDragOver(total)
        }}
        onDrop={(event) => {
          if (props.dragKind !== 'card') return
          event.preventDefault()
          props.onCardDrop(total)
        }}
      >
        {props.cards.map((card, index) => {
          if (props.hiddenIds.has(card.id)) return null
          return (
            <div
              key={card.id}
              onDragOver={(event) => {
                if (props.dragKind !== 'card') return
                event.preventDefault()
                event.stopPropagation()
                const rect = event.currentTarget.getBoundingClientRect()
                const after = event.clientY > rect.top + rect.height / 2
                props.onCardDragOver(after ? index + 1 : index)
              }}
              onDrop={(event) => {
                if (props.dragKind !== 'card') return
                event.preventDefault()
                event.stopPropagation()
                const rect = event.currentTarget.getBoundingClientRect()
                const after = event.clientY > rect.top + rect.height / 2
                props.onCardDrop(after ? index + 1 : index)
              }}
            >
              {dropLine(index)}
              <CardTile
                card={card}
                columns={props.columns}
                selected={props.selectedCardId === card.id}
                dragging={props.draggingCardId === card.id}
                onOpen={() => props.onOpenCard(card)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', card.id)
                  props.onCardDragStart(card.id)
                }}
                onDragEnd={props.onCardDragEnd}
                canMoveUp={index > 0}
                canMoveDown={index < total - 1}
                onMoveToColumn={(columnId) => props.onMoveCard(card.id, columnId, Number.MAX_SAFE_INTEGER)}
                onMoveUp={() => props.onMoveCard(card.id, card.columnId, index - 1)}
                onMoveDown={() => props.onMoveCard(card.id, card.columnId, index + 1)}
                onArchive={() => props.onArchiveCard(card.id)}
              />
            </div>
          )
        })}

        {dropLine(total)}

        {total === 0 && (
          <button
            type="button"
            onClick={props.onAddCard}
            onDragOver={acceptCard}
            className="w-full rounded border border-dashed border-zinc-300 px-2 py-4 text-center text-[12px] text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
          >
            Coluna vazia — clique para criar um card
          </button>
        )}

        {hidden > 0 && (
          <p className="px-1 pt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            {hidden} card{hidden > 1 ? 's' : ''} oculto{hidden > 1 ? 's' : ''} pelo filtro
          </p>
        )}
      </div>
    </section>
  )
}
