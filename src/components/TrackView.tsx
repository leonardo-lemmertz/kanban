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
 * Os cards viram karts distribuidos dentro do seu setor. Posicao e angulo de
 * cada kart saem de getPointAtLength() no proprio path -- ou seja, o desenho da
 * pista pode mudar sem mexer em nada da distribuicao.
 */

const TRACK =
  'M840 380 L840 150 ' +
  'C840 112 802 80 744 90 C692 99 686 150 640 170 ' +
  'C580 195 520 148 420 140 L160 210 ' +
  'C98 228 68 282 110 320 C150 358 240 332 250 280 ' +
  'C260 228 322 240 340 290 C360 342 420 350 440 300 ' +
  'C460 248 520 258 560 300 C610 352 740 420 800 420 ' +
  'C828 420 840 406 840 380 Z '

/** Largura da faixa de asfalto e da zebra que a contorna. */
const ROAD = 24
const KERB = 30

/** Cor de cada setor, na ordem das colunas. Repete se houver mais colunas. */
const SECTOR = [
  { road: 'stroke-sky-200 dark:stroke-sky-950', chip: 'bg-sky-200 dark:bg-sky-950' },
  { road: 'stroke-emerald-200 dark:stroke-emerald-950', chip: 'bg-emerald-200 dark:bg-emerald-950' },
  { road: 'stroke-amber-200 dark:stroke-amber-950', chip: 'bg-amber-200 dark:bg-amber-950' },
  { road: 'stroke-violet-200 dark:stroke-violet-950', chip: 'bg-violet-200 dark:bg-violet-950' },
  { road: 'stroke-rose-200 dark:stroke-rose-950', chip: 'bg-rose-200 dark:bg-rose-950' },
  { road: 'stroke-teal-200 dark:stroke-teal-950', chip: 'bg-teal-200 dark:bg-teal-950' },
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
  { x: 726, y: 64, text: 'S do Senna' },
  { x: 488, y: 116, text: 'Curva do Sol' },
  { x: 294, y: 130, text: 'Reta oposta' },
  { x: 52, y: 342, text: 'Descida do lago' },
  { x: 183, y: 370, text: 'Ferradura' },
  { x: 470, y: 372, text: 'Bico de pato' },
  { x: 708, y: 452, text: 'Junção' },
  // dentro do loop: junto a reta dos boxes o rotulo caia sobre o asfalto e sobre os karts
  { x: 760, y: 265, text: 'Subida dos boxes' },
]

/** Tufos de grama, so decoracao. Posicoes conferidas contra asfalto e rotulos. */
const GRASS: [number, number][] = [
  [690, 210],
  [726, 302],
  [668, 264],
  [624, 228],
  [380, 198],
  [332, 203],
  [284, 303],
  [404, 248],
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
  angle: number
  number: number
}

/**
 * Raio de referencia do kart conforme a lotacao do setor: com poucos cards fica
 * no tamanho cheio, com muitos encolhe para nao encavalar. Abaixo de 8 o desenho
 * do kart nao se le mais e viramos bolinha.
 */
function kartRadius(spacing: number): number {
  return Math.max(5, Math.min(10, spacing / 2.4))
}

/**
 * Ponto e angulo de um kart a uma dada distancia da largada.
 *
 * A geometria do TRACK esta espelhada em x justamente para que percorrer o path
 * na ordem em que foi desenhado (largada -> S do Senna -> Curva do Sol -> reta
 * oposta -> ... -> juncao) resulte no sentido anti-horario, que e o de
 * Interlagos. Inverter o percurso, em vez de espelhar, embaralharia a ordem das
 * curvas.
 */
function raceAt(path: SVGPathElement, length: number, distance: number) {
  const at = distance % length
  const point = path.getPointAtLength(at)
  const ahead = path.getPointAtLength((at + 8) % length)
  return {
    x: point.x,
    y: point.y,
    angle: (Math.atan2(ahead.y - point.y, ahead.x - point.x) * 180) / Math.PI,
  }
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
              const spot = raceAt(path, length, start + (position + 1) * spacing)
              return { card, ...spot, number: position + 1 }
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

  /** Ponto e inclinacao da largada, para o quadriculado cruzar a pista. */
  const grid = useMemo(() => {
    const path = pathRef.current
    if (!path || length === 0) return null
    return raceAt(path, length, 0)
  }, [length])

  return (
    <div className="h-full overflow-y-auto p-3">
      <svg
        viewBox="0 0 940 500"
        className="mx-auto block w-full max-w-5xl"
        role="img"
        aria-label="O board desenhado como uma volta de kart, com um setor por coluna"
      >
        {/* zebra: contorno da faixa de asfalto */}
        <path
          d={TRACK}
          fill="none"
          strokeWidth={KERB}
          strokeLinejoin="round"
          className="stroke-zinc-400/60 dark:stroke-zinc-600/60"
        />

        {/* asfalto -- este e o path de referencia para todas as medidas */}
        <path
          ref={pathRef}
          d={TRACK}
          fill="none"
          strokeWidth={ROAD}
          strokeLinejoin="round"
          className="stroke-zinc-100 dark:stroke-zinc-800"
        />

        {/* um trecho colorido do mesmo path por coluna */}
        {length > 0 &&
          layout.map(({ column, start, share }, index) => (
            <path
              key={column.id}
              d={TRACK}
              fill="none"
              strokeWidth={ROAD}
              strokeDasharray={`${share} ${length}`}
              strokeDashoffset={-start}
              className={SECTOR[index % SECTOR.length].road}
            />
          ))}

        {/* tracejado do meio da pista */}
        <path
          d={TRACK}
          fill="none"
          strokeWidth={2}
          strokeDasharray="12 14"
          strokeLinecap="round"
          className="stroke-zinc-400 dark:stroke-zinc-500"
          opacity={0.75}
        />

        {grid && (
          <g transform={`translate(${grid.x} ${grid.y}) rotate(${grid.angle})`}>
            {[0, 1, 2, 3, 4, 5].map((row) =>
              [0, 1].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * 5}
                  y={-ROAD / 2 + row * 4}
                  width={5}
                  height={4}
                  className={
                    (row + col) % 2 === 0 ? 'fill-zinc-800 dark:fill-zinc-200' : 'fill-white dark:fill-zinc-700'
                  }
                />
              )),
            )}
          </g>
        )}

        {GRASS.map(([x, y]) => (
          <path
            key={`${x}-${y}`}
            d={`M${x} ${y} l4 -7 l4 7`}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="stroke-emerald-500/50 dark:stroke-emerald-600/60"
          />
        ))}

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

        {layout.map(({ karts, radius }) =>
          karts.map(({ card, x, y, angle, number }) => {
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
                  {`${number}. ${card.title} — ${PRIORITY_LABEL[card.priority]}${
                    card.dueDate ? `, entrega ${formatDue(card.dueDate)}` : ''
                  }`}
                </title>

                {selected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 5}
                    fill="none"
                    strokeWidth={2}
                    className="stroke-sky-600 dark:stroke-sky-400"
                  />
                )}

                {radius >= 8 ? (
                  // kart visto de cima, apontado na direcao da volta
                  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${radius / 10})`}>
                    <rect x={-8} y={-6.6} width={5} height={2.6} rx={1} className="fill-zinc-700 dark:fill-zinc-950" />
                    <rect x={-8} y={4} width={5} height={2.6} rx={1} className="fill-zinc-700 dark:fill-zinc-950" />
                    <rect x={4} y={-6.6} width={4.5} height={2.6} rx={1} className="fill-zinc-700 dark:fill-zinc-950" />
                    <rect x={4} y={4} width={4.5} height={2.6} rx={1} className="fill-zinc-700 dark:fill-zinc-950" />
                    <rect
                      x={-9}
                      y={-4.4}
                      width={18}
                      height={8.8}
                      rx={3}
                      className={`${flag.fill} stroke-white dark:stroke-zinc-900`}
                      strokeWidth={1.2}
                    />
                    <circle cx={1} cy={0} r={2.6} className="fill-white dark:fill-zinc-200" />
                  </g>
                ) : (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    className={`${flag.fill} stroke-white dark:stroke-zinc-900`}
                    strokeWidth={1.5}
                  />
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
                <span
                  className={`h-2.5 w-5 rounded-sm border border-zinc-300 dark:border-zinc-700 ${SECTOR[index % SECTOR.length].chip}`}
                  aria-hidden="true"
                />
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
                {hidden > 0 && <span className="text-[11px] text-zinc-400 dark:text-zinc-500">({hidden} oculto)</span>}
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
