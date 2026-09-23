import { useMemo, useState } from 'react'
import type { Board as BoardModel, Card, Quadrant } from '../types'
import { PRIORITY_LABEL, QUADRANTS, QUADRANT_LABEL } from '../types'
import type { Action } from '../state/boardReducer'
import { PRIORITY_EDGE, PRIORITY_PILL } from '../lib/priority'
import { dueState, formatDue } from '../lib/dates'

const DUE_BADGE: Record<string, string> = {
  overdue: 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
  today: 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  soon: 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400',
  later: 'border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-500',
}

/** O que fazer com o que cai em cada quadrante, na ordem em que se lê a grade. */
const QUADRANT_HINT: Record<Quadrant, string> = {
  1: 'Importante e urgente. Faça hoje, você mesmo.',
  2: 'Importante, sem pressa. Marque uma data antes que vire o 1º.',
  3: 'Urgente, mas não é seu. Passe adiante ou combine com quem é.',
  4: 'Nem importante nem urgente. Candidato a sair do board.',
}

/** Faixa lateral do quadrante — cor por eixo, discreta. */
const QUADRANT_EDGE: Record<Quadrant, string> = {
  1: 'bg-red-500',
  2: 'bg-sky-500',
  3: 'bg-amber-500',
  4: 'bg-zinc-400 dark:bg-zinc-600',
}

export interface MatrixViewProps {
  board: BoardModel
  hiddenIds: Set<string>
  selectedCardId: string | null
  dispatch: (action: Action) => void
  onOpenCard: (card: Card) => void
}

export function MatrixView(props: MatrixViewProps) {
  const { board, dispatch } = props
  const [draggingId, setDraggingId] = useState<string | null>(null)
  /** alvo sob o cursor: um quadrante, ou 'tray' para desclassificar */
  const [dropTarget, setDropTarget] = useState<Quadrant | 'tray' | null>(null)

  const visible = useMemo(
    () => board.cards.filter((c) => !props.hiddenIds.has(c.id)),
    [board.cards, props.hiddenIds],
  )

  const { unclassified, byQuadrant } = useMemo(() => {
    const map = new Map<Quadrant, Card[]>(QUADRANTS.map((q) => [q, []]))
    const pending: Card[] = []
    for (const card of visible) {
      if (card.quadrant === undefined) pending.push(card)
      else map.get(card.quadrant)?.push(card)
    }
    const byDue = (a: Card, b: Card) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
    for (const list of map.values()) list.sort(byDue)
    pending.sort(byDue)
    return { unclassified: pending, byQuadrant: map }
  }, [visible])

  /** Só a prioridade "urgente" é sinal forte o bastante para sugerir sozinha. */
  const suggested = useMemo(() => unclassified.filter((c) => c.priority === 'urgente'), [unclassified])

  const place = (cardId: string, quadrant?: Quadrant) => {
    dispatch({ type: 'card/quadrant', id: cardId, quadrant })
    setDraggingId(null)
    setDropTarget(null)
  }

  const applySuggestions = () => {
    const n = suggested.length
    const label = n === 1 ? '1 card de prioridade Urgente' : `${n} cards de prioridade Urgente`
    if (!window.confirm(`Classificar ${label} como "Faça agora"?`)) return
    for (const card of suggested) dispatch({ type: 'card/quadrant', id: card.id, quadrant: 1 })
  }

  const tile = (card: Card) => (
    <article
      key={card.id}
      draggable
      onDragStart={(event) => {
        // Sem setData o Firefox nao inicia o arrasto -- mesmo par que o
        // ColumnView ja usa para os cards do board.
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', card.id)
        setDraggingId(card.id)
      }}
      onDragEnd={() => {
        setDraggingId(null)
        setDropTarget(null)
      }}
      onClick={() => props.onOpenCard(card)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          props.onOpenCard(card)
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Card ${card.title}`}
      className={[
        'group relative flex cursor-pointer gap-2 overflow-hidden rounded border bg-white py-1.5 pl-0 pr-1.5 text-left',
        'hover:border-zinc-400 dark:bg-zinc-900 dark:hover:border-zinc-600',
        props.selectedCardId === card.id
          ? 'border-sky-600 ring-1 ring-sky-600/40 dark:border-sky-400 dark:ring-sky-400/30'
          : 'border-zinc-200 dark:border-zinc-800',
        draggingId === card.id ? 'opacity-40' : '',
      ].join(' ')}
    >
      <span className={`w-1 shrink-0 self-stretch ${PRIORITY_EDGE[card.priority]}`} aria-hidden="true" />

      <div className="min-w-0 flex-1">
        <h3 className="break-words text-[12px] font-medium leading-snug">{card.title}</h3>

        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span
            className={`rounded-sm border px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide ${PRIORITY_PILL[card.priority]}`}
          >
            {PRIORITY_LABEL[card.priority]}
          </span>

          {card.dueDate && (
            <span
              className={`rounded-sm border px-1 text-[10px] font-medium leading-4 tabular-nums ${DUE_BADGE[dueState(card.dueDate)]}`}
            >
              {formatDue(card.dueDate)}
            </span>
          )}
        </div>

        {/*
         * Arrastar nao funciona em toque (o HTML5 drag-and-drop ignora eventos
         * de ponteiro tatil), entao os mesmos movimentos existem como botoes --
         * mesma razao pela qual o Board tem o MoveMenu ao lado do arrasto.
         */}
        <div
          className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          {QUADRANTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={card.quadrant === q}
              onClick={() => place(card.id, q)}
              title={`Mover para ${q}º — ${QUADRANT_LABEL[q]}`}
              aria-label={`Mover para quadrante ${q}, ${QUADRANT_LABEL[q]}`}
              className="rounded border border-zinc-300 px-1 text-[10px] leading-4 text-zinc-500 hover:border-zinc-500 hover:text-zinc-800 disabled:opacity-30 disabled:hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {q}
            </button>
          ))}
          {card.quadrant !== undefined && (
            <button
              type="button"
              onClick={() => place(card.id, undefined)}
              title="Tirar da matriz"
              aria-label="Tirar da matriz"
              className="rounded border border-zinc-300 px-1 text-[10px] leading-4 text-zinc-500 hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </article>
  )

  /**
   * O id do card vem do dataTransfer, nao do estado. Estado so seria lido no
   * render seguinte ao dragstart: se dragover/drop chegarem antes disso, o
   * closure ainda enxerga null e o drop se perde. O dataTransfer vale para o
   * arrasto inteiro, independente de re-render.
   */
  const dropProps = (target: Quadrant | 'tray') => ({
    onDragOver: (event: React.DragEvent) => {
      if (draggingId === null && !event.dataTransfer.types.includes('text/plain')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTarget(target)
    },
    onDragLeave: () => setDropTarget((current) => (current === target ? null : current)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      const cardId = event.dataTransfer.getData('text/plain') || draggingId
      if (cardId === null || cardId === '') return
      // Arrasto vindo do board (uma coluna) carrega um id de card que nao esta
      // nesta vista; ignorar em vez de criar um quadrante para um card oculto.
      if (!board.cards.some((c) => c.id === cardId)) return
      place(cardId, target === 'tray' ? undefined : target)
    },
  })

  const active = (target: Quadrant | 'tray') =>
    dropTarget === target ? 'border-sky-500 bg-sky-50/60 dark:border-sky-400 dark:bg-sky-950/30' : ''

  const cell = (q: Quadrant) => {
    const cards = byQuadrant.get(q) ?? []
    return (
      <section
        {...dropProps(q)}
        className={`flex min-h-0 flex-col rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 ${active(q)}`}
      >
        <header className="flex items-center gap-1.5 border-b border-zinc-200 px-2 py-1 dark:border-zinc-800">
          <span className={`h-3 w-1 rounded-sm ${QUADRANT_EDGE[q]}`} aria-hidden="true" />
          <h3 className="text-[12px] font-semibold">
            <span className="text-zinc-400 dark:text-zinc-500">{q}º</span> {QUADRANT_LABEL[q]}
          </h3>
          <span className="ml-auto text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{cards.length}</span>
        </header>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
          {cards.length === 0 ? (
            <p className="px-1 py-2 text-[11px] leading-snug text-zinc-400 dark:text-zinc-600">{QUADRANT_HINT[q]}</p>
          ) : (
            cards.map(tile)
          )}
        </div>
      </section>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <section
        {...dropProps('tray')}
        className={`shrink-0 rounded border border-dashed border-zinc-300 bg-zinc-50 p-1.5 dark:border-zinc-700 dark:bg-zinc-950/40 ${active('tray')}`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2 px-0.5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            A classificar
          </h2>
          <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{unclassified.length}</span>
          {suggested.length > 0 && (
            <button type="button" className="btn ml-auto" onClick={applySuggestions}>
              {suggested.length === 1
                ? 'Classificar o urgente como 1º'
                : `Classificar os ${suggested.length} urgentes como 1º`}
            </button>
          )}
        </div>

        {unclassified.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-zinc-400 dark:text-zinc-600">
            Tudo classificado. Arraste um card para cá para tirá-lo da matriz.
          </p>
        ) : (
          <div className="grid max-h-44 grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-1 overflow-y-auto">
            {unclassified.map(tile)}
          </div>
        )}
      </section>

      {/*
       * Rotulos de eixo na primeira linha e na primeira coluna, como na matriz
       * classica. Em telas estreitas a grade viraria ilegivel com os rotulos,
       * entao abaixo de sm eles somem e os quadrantes empilham -- o titulo de
       * cada um ja diz o que ele e.
       */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1fr] sm:grid-rows-[auto_1fr_1fr]">
        <div className="hidden sm:block" aria-hidden="true" />
        <div className="hidden text-center text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 sm:block">
          Urgente
        </div>
        <div className="hidden text-center text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 sm:block">
          Não urgente
        </div>

        <div
          className="hidden items-center justify-center sm:flex"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Importante
          </span>
        </div>
        {cell(1)}
        {cell(2)}

        <div
          className="hidden items-center justify-center sm:flex"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Não importante
          </span>
        </div>
        {cell(3)}
        {cell(4)}
      </div>
    </div>
  )
}
