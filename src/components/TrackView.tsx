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

/**
 * Tracado em planta (visto de cima, sem perspectiva).
 *
 * A geometria esta espelhada em x justamente para que percorrer o path na ordem
 * em que foi desenhado (largada -> S do Senna -> Curva do Sol -> reta oposta ->
 * ... -> juncao) resulte no sentido anti-horario, que e o de Interlagos.
 * Inverter o percurso, em vez de espelhar, embaralharia a ordem das curvas.
 */
const PLAN =
  'M840 380 L840 150 ' +
  'C840 112 802 80 744 90 C692 99 686 150 640 170 ' +
  'C580 195 520 148 420 140 L160 210 ' +
  'C98 228 68 282 110 320 C150 358 240 332 250 280 ' +
  'C260 228 322 240 340 290 C360 342 420 350 440 300 ' +
  'C460 248 520 258 560 300 C610 352 740 420 800 420 ' +
  'C828 420 840 406 840 380 Z'

/**
 * Projecao obliqua: achata o eixo vertical, como uma foto aerea tirada de lado
 * em vez de exatamente de cima. E o que da a impressao de volume, junto com a
 * sombra sob a pista e sob os karts.
 *
 * A projecao e assada no path (e nas coordenadas dos rotulos e da grama) em vez
 * de virar um transform de grupo. Assim getPointAtLength() ja devolve a posicao
 * projetada, e os textos nao saem achatados.
 */
const SQUASH = 0.58
const HORIZON = 128

/** Aplica a projecao a um `d` de path: pares x,y na ordem em que aparecem. */
function project(d: string): string {
  let index = 0
  return d.replace(/-?\d+\.?\d*/g, (raw) => {
    const value = Number(raw)
    const projected = index % 2 === 0 ? value : value * SQUASH + HORIZON
    index += 1
    return String(Math.round(projected * 10) / 10)
  })
}

const projectY = (y: number) => Math.round((y * SQUASH + HORIZON) * 10) / 10

const TRACK = project(PLAN)

/** Larguras, do centro para fora: asfalto, linha branca, zebra. */
const ROAD = 26
const LINES = ROAD + 4
const KERB = ROAD + 12

/** Altura da "casca" sob o asfalto, que faz a pista parecer levantada do chao. */
const DEPTH = 9

/** Cor de cada setor, na ordem das colunas. Repete se houver mais colunas. */
const SECTOR = [
  { road: 'stroke-sky-400/40', chip: 'bg-sky-400/70' },
  { road: 'stroke-emerald-400/40', chip: 'bg-emerald-400/70' },
  { road: 'stroke-amber-400/40', chip: 'bg-amber-400/70' },
  { road: 'stroke-violet-400/40', chip: 'bg-violet-400/70' },
  { road: 'stroke-rose-400/40', chip: 'bg-rose-400/70' },
  { road: 'stroke-teal-400/40', chip: 'bg-teal-400/70' },
]

/** Bandeira do kart: vem do prazo, igual aos selos do board. */
const FLAG: Record<string, { fill: string; label: string }> = {
  overdue: { fill: 'fill-red-500', label: 'atrasado' },
  today: { fill: 'fill-amber-400', label: 'vence hoje' },
  soon: { fill: 'fill-sky-500', label: 'vence em breve' },
  later: { fill: 'fill-zinc-300', label: 'no prazo' },
  none: { fill: 'fill-zinc-400', label: 'sem prazo' },
}

/** Marcos do circuito, em coordenadas de planta (projetadas na renderizacao). */
const LANDMARKS = [
  { x: 724, y: 35, text: 'S do Senna' },
  { x: 488, y: 90, text: 'Curva do Sol' },
  { x: 292, y: 110, text: 'Reta oposta' },
  { x: 52, y: 366, text: 'Descida do lago' },
  { x: 184, y: 407, text: 'Ferradura' },
  { x: 472, y: 380, text: 'Bico de pato' },
  { x: 708, y: 469, text: 'Junção' },
  { x: 760, y: 262, text: 'Subida dos boxes' },
]

/** Manchas de terra na area de escape, so ambiente. Coordenadas de planta. */
const RUNOFF: { x: number; y: number; rx: number; ry: number }[] = [
  { x: 700, y: 250, rx: 62, ry: 30 },
  { x: 300, y: 250, rx: 70, ry: 26 },
  { x: 520, y: 210, rx: 48, ry: 20 },
  { x: 480, y: 330, rx: 56, ry: 22 },
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
 * Tamanho do kart conforme a lotacao do setor: com poucos cards fica no tamanho
 * cheio, com muitos encolhe para nao encavalar. Abaixo de 8 o desenho do kart
 * nao se le mais e viramos bolinha.
 */
const MAX_KART = 15

function kartRadius(spacing: number): number {
  return Math.max(5, Math.min(MAX_KART, spacing / 2.4))
}

/** Ponto e angulo de um kart a uma dada distancia da largada. */
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
        viewBox="0 0 940 470"
        className="mx-auto block w-full max-w-5xl overflow-hidden rounded-lg"
        role="img"
        aria-label="O board desenhado como uma volta de kart vista de cima, com um setor por coluna"
      >
        {/* --- terreno --- */}
        <rect x="0" y="0" width="940" height="470" className="fill-[#5b7f4a] dark:fill-[#2f4a2a]" />
        <rect x="0" y="0" width="940" height={projectY(60)} className="fill-[#4a6b3d] dark:fill-[#263d22]" />
        {RUNOFF.map((patch) => (
          <ellipse
            key={`${patch.x}-${patch.y}`}
            cx={patch.x}
            cy={projectY(patch.y)}
            rx={patch.rx}
            ry={patch.ry * SQUASH}
            className="fill-[#9c7040]/60 dark:fill-[#5c4426]/60"
          />
        ))}

        {/* --- sombra da pista no chao --- */}
        <path
          d={TRACK}
          fill="none"
          strokeWidth={KERB}
          strokeLinejoin="round"
          transform={`translate(3 ${DEPTH + 4})`}
          className="stroke-black/25"
        />

        {/* --- casca lateral: mesma pista deslocada, dando a impressao de volume --- */}
        <path
          d={TRACK}
          fill="none"
          strokeWidth={KERB}
          strokeLinejoin="round"
          transform={`translate(0 ${DEPTH})`}
          className="stroke-[#3a3a3f] dark:stroke-[#18181b]"
        />

        {/* --- zebra: vermelho e branco alternados --- */}
        <path d={TRACK} fill="none" strokeWidth={KERB} strokeLinejoin="round" className="stroke-[#b91c1c]" />
        <path
          d={TRACK}
          fill="none"
          strokeWidth={KERB}
          strokeDasharray="11 11"
          strokeLinejoin="round"
          className="stroke-zinc-100"
        />

        {/* --- linhas brancas da borda da pista --- */}
        <path d={TRACK} fill="none" strokeWidth={LINES} strokeLinejoin="round" className="stroke-zinc-100/90" />

        {/* --- asfalto: path de referencia para todas as medidas --- */}
        <path
          ref={pathRef}
          d={TRACK}
          fill="none"
          strokeWidth={ROAD}
          strokeLinejoin="round"
          className="stroke-[#44454a] dark:stroke-[#2a2a2e]"
        />

        {/* --- um trecho colorido do mesmo path por coluna --- */}
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

        {/* --- tracejado do meio --- */}
        <path
          d={TRACK}
          fill="none"
          strokeWidth={2}
          strokeDasharray="13 15"
          strokeLinecap="round"
          className="stroke-zinc-100/60"
        />

        {grid && (
          <g transform={`translate(${grid.x} ${grid.y}) rotate(${grid.angle})`}>
            {[0, 1, 2, 3, 4, 5, 6].map((row) =>
              [0, 1].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={col * 5}
                  y={-ROAD / 2 + row * (ROAD / 7)}
                  width={5}
                  height={ROAD / 7}
                  className={(row + col) % 2 === 0 ? 'fill-zinc-900' : 'fill-zinc-100'}
                />
              )),
            )}
          </g>
        )}

        {LANDMARKS.map((mark) => (
          <text
            key={mark.text}
            x={mark.x}
            y={projectY(mark.y)}
            textAnchor="middle"
            paintOrder="stroke"
            strokeWidth={2.5}
            className="fill-zinc-50 stroke-black/45 text-[11px] font-medium"
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
                  <ellipse
                    cx={x}
                    cy={y}
                    rx={radius + 6}
                    ry={(radius + 6) * 0.7}
                    fill="none"
                    strokeWidth={2}
                    className="stroke-sky-300"
                  />
                )}

                {radius >= 8 ? (
                  <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${radius / 10} ${(radius / 10) * 0.8})`}>
                    {/* sombra no asfalto */}
                    <ellipse cx={1} cy={4} rx={10} ry={4.5} className="fill-black/35" />
                    <rect x={-8} y={-6.6} width={5} height={2.6} rx={1} className="fill-zinc-900" />
                    <rect x={-8} y={4} width={5} height={2.6} rx={1} className="fill-zinc-900" />
                    <rect x={4} y={-6.6} width={4.5} height={2.6} rx={1} className="fill-zinc-900" />
                    <rect x={4} y={4} width={4.5} height={2.6} rx={1} className="fill-zinc-900" />
                    <rect
                      x={-9}
                      y={-4.4}
                      width={18}
                      height={8.8}
                      rx={3}
                      className={`${flag.fill} stroke-black/40`}
                      strokeWidth={1}
                    />
                    {/* brilho no topo do chassi, para nao parecer chapado */}
                    <rect x={-7} y={-3.6} width={14} height={2} rx={1} className="fill-white/25" />
                    <circle cx={1} cy={0} r={2.6} className="fill-zinc-100" />
                  </g>
                ) : (
                  <>
                    <ellipse cx={x + 1} cy={y + radius * 0.5} rx={radius} ry={radius * 0.5} className="fill-black/35" />
                    <circle cx={x} cy={y} r={radius} className={`${flag.fill} stroke-black/40`} strokeWidth={1.2} />
                  </>
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
                  className={`h-2.5 w-5 rounded-sm border border-zinc-400/60 ${SECTOR[index % SECTOR.length].chip}`}
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
