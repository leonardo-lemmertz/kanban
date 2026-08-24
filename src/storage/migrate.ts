import {
  SCHEMA_VERSION,
  type Board,
  type Card,
  type ChecklistItem,
  type Lane,
  type Column,
  type ItemState,
  type Priority,
} from '../types'
import { newId } from '../lib/ids'

const PRIORITY_SET = new Set<Priority>(['baixa', 'media', 'alta', 'urgente'])
const ITEM_STATE_SET = new Set<ItemState>(['todo', 'waiting', 'done'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^\d{2}:\d{2}$/

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asPriority(value: unknown): Priority {
  return typeof value === 'string' && PRIORITY_SET.has(value as Priority) ? (value as Priority) : 'media'
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
}

/**
 * Itens de checklist chegaram no schema 2. Board gravado antes disso simplesmente
 * nao tem o campo, e o card abre com a lista vazia -- nada a converter.
 */
/**
 * Raias chegaram no schema 3. Board anterior nao tem o campo, e o card abre
 * como lista de itens -- que continua sendo o modo padrao.
 */
function asLanes(raw: unknown): Lane[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry): Lane | null => {
      if (typeof entry !== 'object' || entry === null) return null
      const o = entry as Record<string, unknown>
      const name = asString(o.name).trim()
      if (name === '') return null
      const kind = asString(o.kind)
      return {
        id: asString(o.id) || newId('lane'),
        name,
        kind: ITEM_STATE_SET.has(kind as ItemState) ? (kind as ItemState) : 'todo',
      }
    })
    .filter((lane): lane is Lane => lane !== null)
}

function asChecklist(raw: unknown, laneIds: Set<string>): ChecklistItem[] {
  if (!Array.isArray(raw)) return []
  const now = new Date().toISOString()
  return raw
    .map((entry): ChecklistItem | null => {
      if (typeof entry !== 'object' || entry === null) return null
      const o = entry as Record<string, unknown>
      const text = asString(o.text).trim()
      if (text === '') return null
      const state = typeof o.state === 'string' && ITEM_STATE_SET.has(o.state as ItemState) ? (o.state as ItemState) : 'todo'
      const dueDate = asString(o.dueDate).trim()
      const time = asString(o.time).trim()
      const waitingSince = asString(o.waitingSince).trim()
      const laneId = asString(o.laneId).trim()
      return {
        id: asString(o.id) || newId('item'),
        text,
        state,
        ...(ISO_DATE.test(dueDate) ? { dueDate } : {}),
        ...(HHMM.test(time) ? { time } : {}),
        // so faz sentido guardar "espera desde" enquanto o item esta aguardando
        ...(state === 'waiting' ? { waitingSince: waitingSince || now } : {}),
        // raia apagada devolve o item para a lista, em vez de apontar para o vazio
        ...(laneIds.has(laneId) ? { laneId } : {}),
        updatedAt: asString(o.updatedAt, now),
      }
    })
    .filter((item): item is ChecklistItem => item !== null)
}

function asColumn(raw: unknown): Column | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const title = asString(o.title).trim()
  if (title === '') return null
  const wip = typeof o.wipLimit === 'number' && o.wipLimit > 0 ? Math.floor(o.wipLimit) : undefined
  return { id: asString(o.id) || newId('col'), title, ...(wip !== undefined ? { wipLimit: wip } : {}) }
}

function asCard(raw: unknown, columnIds: Set<string>, fallbackColumn: string, index: number): Card | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const title = asString(o.title).trim()
  if (title === '') return null
  const now = new Date().toISOString()
  const lanes = asLanes(o.lanes)
  const columnId = asString(o.columnId)
  const dueDate = asString(o.dueDate).trim()
  const archivedAt = asString(o.archivedAt).trim()
  return {
    id: asString(o.id) || newId('card'),
    columnId: columnIds.has(columnId) ? columnId : fallbackColumn,
    title,
    description: asString(o.description),
    priority: asPriority(o.priority),
    tags: asTags(o.tags),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? { dueDate } : {}),
    createdAt: asString(o.createdAt, now),
    updatedAt: asString(o.updatedAt, now),
    order: typeof o.order === 'number' ? o.order : (index + 1) * 100,
    lanes,
    checklist: asChecklist(o.checklist, new Set(lanes.map((l) => l.id))),
    ...(archivedAt !== '' ? { archivedAt } : {}),
  }
}

/**
 * Aceita qualquer JSON e devolve um Board valido, descartando o que nao
 * reconhece. Usado tanto no load (local e remoto) quanto no import manual --
 * o board.json pode ter sido editado a mao no GitHub.
 */
export function migrate(raw: unknown): Board {
  if (typeof raw !== 'object' || raw === null) throw new Error('Arquivo inválido: não é um objeto JSON.')
  const o = raw as Record<string, unknown>

  const columns = Array.isArray(o.columns)
    ? o.columns.map(asColumn).filter((c): c is Column => c !== null)
    : []
  if (columns.length === 0) throw new Error('Arquivo inválido: nenhuma coluna encontrada.')

  const columnIds = new Set(columns.map((c) => c.id))
  const fallback = columns[0].id

  const cards = Array.isArray(o.cards)
    ? o.cards
        .map((c, i) => asCard(c, columnIds, fallback, i))
        .filter((c): c is Card => c !== null)
        .map(({ archivedAt: _ignored, ...card }) => card)
    : []

  const now = new Date().toISOString()
  const archived = Array.isArray(o.archived)
    ? o.archived
        .map((c, i) => asCard(c, columnIds, fallback, i))
        .filter((c): c is Card => c !== null)
        .map((card) => ({ ...card, archivedAt: card.archivedAt ?? card.updatedAt ?? now }))
    : []

  return {
    version: SCHEMA_VERSION,
    columns,
    cards,
    archived,
    updatedAt: asString(o.updatedAt, now),
  }
}
