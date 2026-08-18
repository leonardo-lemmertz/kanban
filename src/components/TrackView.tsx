import { useEffect, useMemo, useRef, useState } from 'react'
import type { Board, Card } from '../types'
import { PRIORITY_LABEL } from '../types'
import { dueState, formatDue } from '../lib/dates'

/**
 * O board desenhado como uma volta de kart, com tracado inspirado em Interlagos.
 *
 * Aproximacao estilizada, nao um decalque do autodromo: mantem as referencias
 * que dao a cara do circuito (S do Senna, Curva do Sol, reta oposta, ferradura,
 * juncao e a subida de volta aos boxes) em proporcoes que caibam na tela.
 *
 * Cada coluna do board vira um setor da pista, na ordem em que estao no board.
 * Os cards viram karts distribuidos dentro do seu setor. A posicao de cada kart
 * sai de getPointAtLength() no proprio path -- ou seja, o desenho da pista pode
 * mudar sem mexer em nada da distribuicao.
 */

const TRACK =
  'M100 380 L100 150 ' +
  'C100 112 138 80 196 90 C248 99 254 150 300 170 ' +
  'C360 195 420 148 520 140 L780 210 ' +
  'C842 228 872 282 830 320 C790 358 700 332 690 280 ' +
  'C680 228 618 240 600 290 C580 342 520 350 500 300 ' +
  'C480 248 420 258 380 300 C330 352 200 420 140 420 ' +
  'C112 420 100 406 100 380 Z'

/** Cor de cada setor, na ordem das colunas. Repete se houver mais colunas. */
const SECTOR = [
  { stroke: 'stroke-sky-500 dark:stroke-sky-400', chip: 'bg-sky-500 dark:bg-sky-400' },
  { stroke: 'stroke-emerald-500 dark:stroke-emerald-400', chip: 'bg-emerald-500 dark:bg-emerald-400' },
  { stroke: 'stroke-amber-500 dark:stroke-amber-400', chip: 'bg-amber-500 dark:bg-amber-400' },
  { stroke: 'stroke-violet-500 dark:stroke-violet-400', chip: 'bg-violet-500 dark:bg-violet-400' },
  { stroke: 'stroke-rose-500 dark:stroke-rose-400', chip: 'bg-rose-500 dark:bg-rose-400' },
  { stroke: 'stroke-teal-500 dark:stroke-teal-400', chip: 'bg-teal-500 dark:bg-teal-400' },
]

/** Bandeira do kart: vem do prazo, igual aos selos do board. */
const FLAG: Record<string, { fill: string; label: string }> = {
  overdue: { fill: 'fill-red-500', label: 'atrasado' },
  today: { fill: 'fill-amber-400', label: 'vence hoje' },
  soon: { fill: 'fill-sky-500', label: 'vence em breve' },
  later: { fill: 'fill-zinc-400 dark:fill-zinc-500', label: 'no prazo' },
  none: { fill: 'fill-zinc-300 dark:fill-zinc-600', label: 'sem prazo' },
}

/** Marcos do circuito, posicionados para o tracado acima. */
const LANDMARKS = [
  { x: 214, y: 64, text: 'S do Senna' },
  { x: 452, y: 116, text: 'Curva do Sol' },
  { x: 646, y: 130, text: 'Reta oposta' },
  { x: 888, y: 342, text: 'Descida do lago' },
  { x: 757, y: 370, text: 'Ferradura' },
  { x: 470, y: 372, text: 'Bico de pato' },
  { x: 232, y: 452, text: 'Junção' },
  // dentro do loop: na borda esquerda o rotulo caia sobre o asfalto e sobre os karts
  { x: 180, y: 265, text: 'Subida dos boxes' },
]

export interface TrackViewProps {
  board: Board
  hiddenIds: Set<string>
  selectedCardId: string | null
  onOpenCard: (card: Card) => void
}

interface Kart {
  card: Card
  x: number
  y: number
  number: number
}

/**
 * Raio do kart conforme a lotacao do setor: com poucos cards fica no tamanho
 * cheio, com muitos encolhe para nao encavalar. Abaixo de 8 o numero dentro do
 * kart deixa de ser legivel, entao ele nao e desenhado.
 */
function kartRadius(spacing: number): number {
  return Math.max(5, Math.min(10, spacing / 2.4))
}

export function TrackView(props: TrackViewProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [length, setLength] = useState(0)

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength())
  }, [])

  const layout = useMemo(() => {
    const path = pathRef.current
    const columns = props.board.columns
    const share = length / Math.max(columns.length, 1)

    return columns.map((column, index) => {
      const cards = props.board.cards
        .filter((card) => card.columnId === column.id)
        .sort((a, b) => a.order - b.order)
      const visible = cards.filter((card) => !props.hiddenIds.has(card.id))
      const start = share * index

      const spacing = share / (visible.length + 1)
      const karts: Kart[] =
        path && length > 0
          ? visible.map((card, position) => {
              const at = start + (position + 1) * spacing
              const point = path.getPointAtLength(at)
              return { card, x: point.x, y: point.y, number: position + 1 }
            })
          : []

      return {
        column,
        start,
        share,
        karts,
        radius: kartRadius(spacing),
        total: cards.length,
        hidden: cards.length - visible.length,
      }
    })
  }, [length, props.board, props.hiddenIds])

  /** Linha de largada/chegada, desenhada na perpendicular do tracado. */
  const startLine = useMemo(() => {
    const path = pathRef.current
    if (!path || length === 0) return null
    const a = path.getPointAtLength(0)
    const b = path.getPointAtLength(8)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const size = Math.hypot(dx, dy) || 1
    const nx = (-dy / size) * 13
    const ny = (dx / size) * 13
    return { x1: a.x - nx, y1: a.y - ny, x2: a.x + nx, y2: a.y + ny }
  }, [length])

  return (
    <div className="h-full overflow-y-auto p-3">
      <svg
        viewBox="0 0 940 500"
        className="mx-auto block w-full max-w-5xl"
        role="img"
        aria-label="O board desenhado como uma volta de kart, com um setor por coluna"
      >
        {/* asfalto */}
        <path
          ref={pathRef}
          d={TRACK}
          fill="none"
          strokeWidth={22}
          strokeLinejoin="round"
          className="stroke-zinc-300/70 dark:stroke-zinc-700/60"
        />

        {/* setores coloridos sobre o asfalto: um trecho do mesmo path por coluna */}
        {length > 0 &&
          layout.map(({ column, start, share }, index) => (
            <path
              key={column.id}
              d={TRACK}
              fill="none"
              strokeWidth={9}
              strokeDasharray={`${share} ${length}`}
              strokeDashoffset={-start}
              className={SECTOR[index % SECTOR.length].stroke}
              opacity={0.9}
            />
          ))}

        {startLine && (
          <line
            x1={startLine.x1}
            y1={startLine.y1}
            x2={startLine.x2}
            y2={startLine.y2}
            strokeWidth={4}
            strokeDasharray="3 3"
            className="stroke-zinc-800 dark:stroke-zinc-200"
          />
        )}

        {LANDMARKS.map((mark) => (
          <text
            key={mark.text}
            x={mark.x}
            y={mark.y}
            textAnchor="middle"
            className="fill-zinc-400 text-[11px] dark:fill-zinc-500"
          >
            {mark.text}
          </text>
        ))}

        {/* karts */}
        {layout.map(({ karts, radius }) =>
          karts.map(({ card, x, y, number }) => {
            const flag = FLAG[dueState(card.dueDate)]
            const selected = props.selectedCardId === card.id
            return (
              <g
                key={card.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => props.onOpenCard(card)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    props.onOpenCard(card)
                  }
                }}
              >
                <title>
                  {`${card.title} — ${PRIORITY_LABEL[card.priority]}${
                    card.dueDate ? `, entrega ${formatDue(card.dueDate)}` : ''
                  }`}
                </title>
                <circle
                  cx={x}
                  cy={y}
                  r={selected ? radius + 2 : radius}
                  className={`${flag.fill} stroke-white dark:stroke-zinc-900`}
                  strokeWidth={2}
                />
                {radius >= 8 && (
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    className="pointer-events-none fill-white text-[10px] font-semibold"
                  >
                    {number}
                  </text>
                )}
              </g>
            )
          }),
        )}
      </svg>

      <div className="mx-auto mt-2 max-w-5xl space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {layout.map(({ column, total, hidden }, index) => {
            const overWip = column.wipLimit !== undefined && total > column.wipLimit
            return (
              <span key={column.id} className="inline-flex items-center gap-1.5 text-[12px]">
                <span className={`h-2 w-4 rounded-sm ${SECTOR[index % SECTOR.length].chip}`} aria-hidden="true" />
                <span className="font-medium">{column.title}</span>
                <span
                  className={
                    overWip
                      ? 'rounded-sm border border-red-400 px-1 text-[11px] font-semibold text-red-700 dark:border-red-800 dark:text-red-300'
                      : 'text-[11px] text-zinc-500 dark:text-zinc-400'
                  }
                >
                  {total}
                  {column.wipLimit !== undefined && `/${column.wipLimit}`}
                </span>
                {hidden > 0 && (
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">({hidden} oculto)</span>
                )}
              </span>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-200 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span className="font-semibold uppercase tracking-wide">Bandeiras</span>
          {(['overdue', 'today', 'soon', 'later', 'none'] as const).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                <circle cx="6" cy="6" r="5" className={FLAG[key].fill} />
              </svg>
              {FLAG[key].label}
            </span>
          ))}
          <span className="ml-auto">Clique num kart para abrir o card.</span>
        </div>
      </div>
    </div>
  )
}
