/**
 * Le e reescreve a descricao de um card como tabela.
 *
 * A descricao continua sendo a unica fonte de verdade: nao existe campo novo no
 * board.json, nao existe migracao. A tabela le linhas e, quando o usuario edita
 * uma celula, reescreve a mesma linha de volta no texto. Quem abre o card ve a
 * prosa de sempre.
 *
 * O formato reconhecido e o que ele ja usa naturalmente, uma linha por assunto:
 *
 *     Celcoin: Aguardando retorno WPP
 *     F360: Reunião 24/08 10h // https://meet.google.com/... (contato Sara WPP)
 *
 * O que vem antes dos dois-pontos e o nome; o resto e o detalhe, de onde saem
 * situacao, canal de contato e data.
 */

export type Situation = 'meeting' | 'waiting' | 'todo' | 'untouched' | 'discarded'

export const SITUATION_LABEL: Record<Situation, string> = {
  meeting: 'Reunião marcada',
  waiting: 'Aguardando',
  todo: 'A fazer',
  untouched: 'Sem contato',
  discarded: 'Descartado',
}

/** Ordem em que as situacoes aparecem na lista e ao ordenar por essa coluna. */
export const SITUATIONS: Situation[] = ['meeting', 'waiting', 'todo', 'untouched', 'discarded']

/**
 * Marcador escrito no fim da linha quando a situacao escolhida a mao difere da
 * que o texto sugere -- ex.: a reuniao ja aconteceu e agora e so espera:
 *
 *     Akropoli: Reunião 24/08 14h [aguardando]
 *
 * Fica visivel no texto de proposito: nada some da descricao sem o usuario ver.
 */
const MARKER_WORD: Record<Situation, string> = {
  meeting: 'reunião',
  waiting: 'aguardando',
  todo: 'a fazer',
  untouched: 'sem contato',
  discarded: 'descartado',
}

const MARKER_BY_WORD: Record<string, Situation> = {
  'reunião': 'meeting',
  reuniao: 'meeting',
  aguardando: 'waiting',
  'a fazer': 'todo',
  'sem contato': 'untouched',
  descartado: 'discarded',
}

const MARKER_RE = /\s*\[(reuni[aã]o|aguardando|a fazer|sem contato|descartado)\]\s*$/i

export interface Row {
  /** posicao entre as linhas de assunto, para poder voltar a ordem do texto */
  index: number
  /** numero da linha na descricao, para poder reescrever exatamente essa linha */
  line: number
  name: string
  detail: string
  situation: Situation
  /** situacao escolhida a mao, e nao deduzida do texto */
  explicit: boolean
  /** canais achados no texto, ex.: "WhatsApp · e-mail" */
  contact: string
  /** YYYY-MM-DD, para ordenar */
  date?: string
  /** HH:MM */
  time?: string
}

export interface ParsedRows {
  rows: Row[]
  /** linhas sem dois-pontos: titulo, observacao, tarefa geral */
  notes: string[]
}

const MEETING_RE = /reuni[aã]o|reuni[aã]/i
/** "reuniao realizada 24/08" e o oposto de compromisso: ja passou */
const DONE_RE = /realizad|realizei|realizamos|aconteceu|j[áa] tivemos|j[áa] conversamos/i
const WAITING_RE = /aguard|em contato|chamei|chamar|retorno/i
const DISCARD_RE = /descartad|sem interesse|n[ãa]o (?:nos )?atende|n[ãa]o atendem|n[ãa]o temos porte/i

const CHANNELS: { re: RegExp; label: string }[] = [
  { re: /\bwpp\b|whats/i, label: 'WhatsApp' },
  { re: /instagram|\binsta\b/i, label: 'Instagram' },
  { re: /\bsite\b/i, label: 'site' },
  { re: /\b0800[\s.-]?\d{3}[\s.-]?\d{4}\b|\+\d{2}\s?\d{2}\s?\d{4,5}[\s.-]?\d{4}/, label: 'telefone' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, label: 'e-mail' },
  { re: /https?:\/\//i, label: 'link' },
]

/** dia/mes com ano opcional; exige a barra para nao confundir com telefone */
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g
/** "10h", "10h30", "14 h" */
const TIME_RE = /\b(\d{1,2})\s*h(?:\s*(\d{2}))?\b/i
/** marcadores de lista no comeco da linha */
const BULLET_RE = /^\s*(?:[-*+•]|\d+[.)])\s+/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function guessSituation(detail: string): Situation {
  if (detail.trim() === '') return 'untouched'
  // reuniao antes de aguardando: "Reunião 24/08" nao e espera, e compromisso --
  // mas "Reunião realizada 24/08" ja aconteceu, e o que sobra e a tarefa
  if (MEETING_RE.test(detail) && !DONE_RE.test(detail)) return 'meeting'
  if (DISCARD_RE.test(detail)) return 'discarded'
  if (WAITING_RE.test(detail)) return 'waiting'
  return 'todo'
}

function contactOf(detail: string): string {
  return CHANNELS.filter((channel) => channel.re.test(detail))
    .map((channel) => channel.label)
    .join(' · ')
}

function whenOf(detail: string, referenceYear: number): { date?: string; time?: string } {
  const out: { date?: string; time?: string } = {}

  const found: { iso: string; end: number }[] = []
  for (const match of detail.matchAll(DATE_RE)) {
    const day = Number(match[1])
    const month = Number(match[2])
    if (day < 1 || day > 31 || month < 1 || month > 12) continue
    const raw = match[3]
    const year = raw === undefined ? referenceYear : raw.length === 2 ? 2000 + Number(raw) : Number(raw)
    found.push({ iso: `${year}-${pad(month)}-${pad(day)}`, end: match.index + match[0].length })
  }

  /*
   * "Reunião realizada 24/08 14h, cobrar Paulo dia 25/08": a primeira data e a
   * da reuniao que ja passou. O que interessa na coluna Quando e o proximo
   * compromisso -- 25/08 --, e quando nao ha nenhum a coluna fica vazia em vez
   * de alarmar por uma reuniao que ja aconteceu.
   */
  const dates = DONE_RE.test(detail) ? found.slice(1) : found
  const first = dates[0]
  if (first === undefined) return out
  out.date = first.iso

  // a hora tem que estar colada na data escolhida, senao e a hora de outra data
  const near = TIME_RE.exec(detail.slice(first.end, first.end + 12))
  if (near) {
    const hour = Number(near[1])
    const minute = near[2] === undefined ? 0 : Number(near[2])
    if (hour <= 23 && minute <= 59) out.time = `${pad(hour)}:${pad(minute)}`
  }

  return out
}

/** As partes de uma linha de assunto; null quando a linha nao e um assunto. */
interface Parts {
  bullet: string
  name: string
  detail: string
  /** situacao marcada a mao, se houver */
  marker: Situation | null
}

function partsOf(raw: string): Parts | null {
  const bullet = BULLET_RE.exec(raw)?.[0] ?? ''
  const body = raw.slice(bullet.length).trim()
  if (body === '') return null

  const at = body.indexOf(':')
  // dois-pontos logo no comeco, ou dentro de "https://", nao separa nada
  const name = at > 0 ? body.slice(0, at).trim() : ''
  if (at <= 0 || name === '' || name.length > 40 || /https?$/i.test(name)) return null

  let detail = body.slice(at + 1).trim()
  let marker: Situation | null = null
  const found = MARKER_RE.exec(detail)
  if (found) {
    marker = MARKER_BY_WORD[found[1].toLowerCase()] ?? null
    if (marker !== null) detail = detail.slice(0, found.index).trim()
  }

  return { bullet, name, detail, marker }
}

/** Escreve a linha de volta, guardando o marcador so quando ele muda algo. */
function renderParts(parts: Parts): string {
  const marker =
    parts.marker !== null && parts.marker !== guessSituation(parts.detail) ? ` [${MARKER_WORD[parts.marker]}]` : ''
  return `${parts.bullet}${parts.name}:${parts.detail === '' ? '' : ` ${parts.detail}`}${marker}`
}

export function parseRows(description: string, referenceYear: number): ParsedRows {
  const rows: Row[] = []
  const notes: string[] = []

  const lines = description.replace(/\r\n?/g, '\n').split('\n')

  lines.forEach((raw, line) => {
    if (raw.trim() === '') return
    const parts = partsOf(raw)
    if (parts === null) {
      notes.push(raw.trim())
      return
    }
    const situation = parts.marker ?? guessSituation(parts.detail)
    rows.push({
      index: rows.length,
      line,
      name: parts.name,
      detail: parts.detail,
      situation,
      explicit: parts.marker !== null && parts.marker !== guessSituation(parts.detail),
      contact: contactOf(parts.detail),
      ...whenOf(parts.detail, referenceYear),
    })
  })

  return { rows, notes }
}

/** A tabela so vale a pena quando ha varias linhas no formato "nome: detalhe". */
export function looksLikeTable(description: string, referenceYear: number): boolean {
  return parseRows(description, referenceYear).rows.length >= 3
}

/* ---------------------------------------------------------------------------
 * Escrita: sempre uma linha por vez, o resto da descricao fica intocado.
 * ------------------------------------------------------------------------ */

function editLine(description: string, line: number, edit: (parts: Parts) => Parts | null): string {
  const lines = description.replace(/\r\n?/g, '\n').split('\n')
  if (line < 0 || line >= lines.length) return description
  const parts = partsOf(lines[line])
  if (parts === null) return description

  const next = edit(parts)
  if (next === null) lines.splice(line, 1)
  else lines[line] = renderParts(next)
  return lines.join('\n')
}

export function setRowName(description: string, line: number, name: string): string {
  // dois-pontos no nome partiria a linha em outro lugar na proxima leitura
  const clean = name.replace(/[:\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (clean === '') return description
  return editLine(description, line, (parts) => ({ ...parts, name: clean }))
}

export function setRowDetail(description: string, line: number, detail: string): string {
  const clean = detail.replace(/\s*\n\s*/g, ' ').trim()
  return editLine(description, line, (parts) => ({ ...parts, detail: clean }))
}

export function setRowSituation(description: string, line: number, situation: Situation): string {
  return editLine(description, line, (parts) => ({ ...parts, marker: situation }))
}

export function removeRow(description: string, line: number): string {
  return editLine(description, line, () => null)
}

/** Acrescenta uma linha no fim e devolve em que linha ela ficou, para focar. */
export function addRow(description: string, name: string): { description: string; line: number } {
  const lines = description.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  lines.push(`${name}:`)
  return { description: lines.join('\n'), line: lines.length - 1 }
}
