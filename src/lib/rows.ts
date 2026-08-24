/**
 * Le a descricao de um card como tabela.
 *
 * Nada aqui grava nada: a descricao continua sendo a unica fonte de verdade, e a
 * tabela e so uma leitura dela. O usuario escreve prosa como sempre escreveu.
 *
 * O formato reconhecido e o que ele ja usa naturalmente, uma linha por assunto:
 *
 *     Celcoin: Aguardando retorno WPP
 *     F360: Reunião 24/08 10h // https://meet.google.com/... (contato Sara WPP)
 *
 * O que vem antes dos dois-pontos e o nome; o resto e o detalhe, de onde saem
 * situacao, canal de contato e data.
 */

export type Situation = 'meeting' | 'waiting' | 'todo' | 'untouched'

export const SITUATION_LABEL: Record<Situation, string> = {
  meeting: 'Reunião marcada',
  waiting: 'Aguardando',
  todo: 'A fazer',
  untouched: 'Sem contato',
}

export interface Row {
  /** posicao na descricao, para poder voltar a ordem original */
  index: number
  name: string
  detail: string
  situation: Situation
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
const WAITING_RE = /aguard|em contato|chamei|chamar|retorno/i

const CHANNELS: { re: RegExp; label: string }[] = [
  { re: /\bwpp\b|whats/i, label: 'WhatsApp' },
  { re: /instagram|\binsta\b/i, label: 'Instagram' },
  { re: /\bsite\b/i, label: 'site' },
  { re: /\b0800[\s.-]?\d{3}[\s.-]?\d{4}\b|\+\d{2}\s?\d{2}\s?\d{4,5}[\s.-]?\d{4}/, label: 'telefone' },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, label: 'e-mail' },
  { re: /https?:\/\//i, label: 'link' },
]

/** dia/mes com ano opcional; exige a barra para nao confundir com telefone */
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/
/** "10h", "10h30", "14 h" */
const TIME_RE = /\b(\d{1,2})\s*h(?:\s*(\d{2}))?\b/i
/** marcadores de lista no comeco da linha */
const BULLET_RE = /^\s*(?:[-*+•]|\d+[.)])\s+/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function situationOf(detail: string): Situation {
  if (detail.trim() === '') return 'untouched'
  // reuniao antes de aguardando: "Reunião 24/08" nao e espera, e compromisso
  if (MEETING_RE.test(detail)) return 'meeting'
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

  const date = DATE_RE.exec(detail)
  if (date) {
    const day = Number(date[1])
    const month = Number(date[2])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const raw = date[3]
      const year = raw === undefined ? referenceYear : raw.length === 2 ? 2000 + Number(raw) : Number(raw)
      out.date = `${year}-${pad(month)}-${pad(day)}`
    }
  }

  const time = TIME_RE.exec(detail)
  if (time) {
    const hour = Number(time[1])
    const minute = time[2] === undefined ? 0 : Number(time[2])
    if (hour <= 23 && minute <= 59) out.time = `${pad(hour)}:${pad(minute)}`
  }

  return out
}

export function parseRows(description: string, referenceYear: number): ParsedRows {
  const rows: Row[] = []
  const notes: string[] = []

  const lines = description
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((raw) => raw.replace(BULLET_RE, '').trim())
    .filter((line) => line !== '')

  for (const line of lines) {
    const at = line.indexOf(':')
    // dois-pontos logo no comeco, ou dentro de "https://", nao separa nada
    const name = at > 0 ? line.slice(0, at).trim() : ''
    if (at <= 0 || name === '' || name.length > 40 || /https?$/i.test(name)) {
      notes.push(line)
      continue
    }

    const detail = line.slice(at + 1).trim()
    rows.push({
      index: rows.length,
      name,
      detail,
      situation: situationOf(detail),
      contact: contactOf(detail),
      ...whenOf(detail, referenceYear),
    })
  }

  return { rows, notes }
}

/** A tabela so vale a pena quando ha varias linhas no formato "nome: detalhe". */
export function looksLikeTable(description: string, referenceYear: number): boolean {
  return parseRows(description, referenceYear).rows.length >= 3
}
