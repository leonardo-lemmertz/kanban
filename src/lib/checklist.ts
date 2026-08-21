import type { ChecklistItem, ItemState } from '../types'
import { newId } from './ids'
import { todayISO } from './dates'

export interface ChecklistStats {
  total: number
  todo: number
  waiting: number
  done: number
}

export function checklistStats(items: ChecklistItem[]): ChecklistStats {
  let waiting = 0
  let done = 0
  for (const item of items) {
    if (item.state === 'waiting') waiting += 1
    else if (item.state === 'done') done += 1
  }
  return { total: items.length, todo: items.length - waiting - done, waiting, done }
}

/** Data mais proxima entre os itens ainda abertos -- e o que o card mostra no board. */
export function nearestItemDue(items: ChecklistItem[]): string | undefined {
  let nearest: string | undefined
  for (const item of items) {
    if (item.state === 'done' || !item.dueDate) continue
    if (nearest === undefined || item.dueDate < nearest) nearest = item.dueDate
  }
  return nearest
}

/** Dias inteiros desde a data ISO informada; 0 quando e hoje. */
export function daysSince(iso: string): number {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 0
  const start = new Date(then.getFullYear(), then.getMonth(), then.getDate())
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86_400_000))
}

export function newChecklistItem(text: string, state: ItemState = 'todo'): ChecklistItem {
  const now = new Date().toISOString()
  return {
    id: newId('item'),
    text: text.trim(),
    state,
    ...(state === 'waiting' ? { waitingSince: now } : {}),
    updatedAt: now,
  }
}

/* --- conversao de descricao em itens ------------------------------------- */

/** "24/08", "24/8/2026" -- dia/mes, ano opcional. */
const DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/
/** "10h", "10h30", "14 h" */
const TIME_RE = /\b(\d{1,2})\s*h(?:\s*(\d{2}))?\b/i
/**
 * Frases que indicam que a bola esta com outra pessoa.
 *
 * "tentar novamente" ficou de fora de proposito: e acao de quem escreveu, nao
 * espera por terceiro. Ja "tive que chamar" entra, porque o contato foi feito e
 * o retorno e que falta.
 */
const WAITING_RE = /aguard|em contato|chamei|chamar|retorno/i
/** Marcadores de lista no inicio da linha. */
const BULLET_RE = /^\s*(?:[-*+•]|\d+[.)])\s+/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function extractDate(line: string, referenceYear: number): { dueDate?: string; time?: string } {
  const out: { dueDate?: string; time?: string } = {}

  const date = DATE_RE.exec(line)
  if (date) {
    const day = Number(date[1])
    const month = Number(date[2])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const rawYear = date[3]
      const year = rawYear === undefined ? referenceYear : rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)
      out.dueDate = `${year}-${pad(month)}-${pad(day)}`
    }
  }

  const time = TIME_RE.exec(line)
  if (time) {
    const hour = Number(time[1])
    const minute = time[2] === undefined ? 0 : Number(time[2])
    if (hour <= 23 && minute <= 59) out.time = `${pad(hour)}:${pad(minute)}`
  }

  return out
}

export interface ParsedChecklist {
  items: ChecklistItem[]
  /** quantos itens sairam ja marcados como aguardando */
  waiting: number
  /** quantos itens vieram com data reconhecida */
  dated: number
}

/**
 * Transforma cada linha nao vazia da descricao num item.
 *
 * A deteccao e um chute informado, nao uma promessa: "aguardando"/"chamei" viram
 * estado aguardando, "24/08" vira data, "10h" vira hora. O usuario revisa depois
 * -- e por isso a conversao nao apaga a descricao original.
 */
export function parseDescriptionToChecklist(description: string): ParsedChecklist {
  const referenceYear = Number(todayISO().slice(0, 4))
  const items: ChecklistItem[] = []
  let waiting = 0
  let dated = 0

  for (const raw of description.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(BULLET_RE, '').trim()
    if (line === '') continue

    const state: ItemState = WAITING_RE.test(line) ? 'waiting' : 'todo'
    const { dueDate, time } = extractDate(line, referenceYear)
    const item = newChecklistItem(line, state)
    if (dueDate) {
      item.dueDate = dueDate
      dated += 1
    }
    if (time) item.time = time
    if (state === 'waiting') waiting += 1
    items.push(item)
  }

  return { items, waiting, dated }
}
