import { SCHEMA_VERSION, type Board, type Card, type Column, type Priority } from '../types'
import { newId } from '../lib/ids'

export interface NewCardInput {
  columnId: string
  title: string
  description?: string
  priority?: Priority
  tags?: string[]
  dueDate?: string
}

export type CardPatch = Partial<Pick<Card, 'title' | 'description' | 'priority' | 'tags' | 'dueDate'>>

export type Action =
  | { type: 'card/create'; input: NewCardInput; atTop?: boolean }
  | { type: 'card/update'; id: string; patch: CardPatch }
  | { type: 'card/move'; id: string; toColumnId: string; toIndex: number }
  | { type: 'card/archive'; id: string }
  | { type: 'card/restore'; id: string; toColumnId?: string }
  | { type: 'card/delete'; id: string; from: 'board' | 'archive' }
  | { type: 'column/create'; title: string }
  | { type: 'column/rename'; id: string; title: string }
  | { type: 'column/wip'; id: string; wipLimit?: number }
  | { type: 'column/move'; id: string; toIndex: number }
  | { type: 'column/delete'; id: string; moveCardsTo?: string }
  | { type: 'board/replace'; board: Board; reason: string }
  | { type: 'board/archiveColumn'; columnId: string }

export interface ActionResult {
  board: Board
  /** mensagem de commit; string vazia = nada mudou, nao precisa salvar */
  message: string
}

const STEP = 100

function stamp(board: Board): Board {
  return { ...board, version: SCHEMA_VERSION, updatedAt: new Date().toISOString() }
}

function inColumn(board: Board, columnId: string): Card[] {
  return board.cards.filter((c) => c.columnId === columnId).sort((a, b) => a.order - b.order)
}

/** Reatribui order em passos de 100 dentro de uma coluna. */
function reindex(cards: Card[], columnId: string, ordered: Card[]): Card[] {
  const positions = new Map(ordered.map((card, i) => [card.id, (i + 1) * STEP]))
  return cards.map((card) => {
    const order = positions.get(card.id)
    if (order === undefined || card.columnId !== columnId) return card
    return order === card.order ? card : { ...card, order }
  })
}

function columnTitle(board: Board, columnId: string): string {
  return board.columns.find((c) => c.id === columnId)?.title ?? columnId
}

function quote(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean
}

function noop(board: Board): ActionResult {
  return { board, message: '' }
}

export function applyAction(board: Board, action: Action): ActionResult {
  const now = new Date().toISOString()

  switch (action.type) {
    case 'card/create': {
      const { columnId, title } = action.input
      const clean = title.trim()
      if (clean === '') return noop(board)
      const siblings = inColumn(board, columnId)
      const card: Card = {
        id: newId('card'),
        columnId,
        title: clean,
        description: action.input.description ?? '',
        priority: action.input.priority ?? 'media',
        tags: action.input.tags ?? [],
        ...(action.input.dueDate ? { dueDate: action.input.dueDate } : {}),
        createdAt: now,
        updatedAt: now,
        order: action.atTop
          ? (siblings[0]?.order ?? STEP * 2) - STEP
          : (siblings[siblings.length - 1]?.order ?? 0) + STEP,
      }
      return {
        board: stamp({ ...board, cards: [...board.cards, card] }),
        message: `feat: cria "${quote(clean)}" em ${columnTitle(board, columnId)}`,
      }
    }

    case 'card/update': {
      const current = board.cards.find((c) => c.id === action.id)
      if (!current) return noop(board)
      const patch = action.patch
      const next: Card = { ...current, ...patch, updatedAt: now }
      if ('dueDate' in patch && !patch.dueDate) delete next.dueDate
      if (next.title.trim() === '') return noop(board)
      next.title = next.title.trim()
      const fields = Object.keys(patch).filter((k) => k !== 'title')
      const label =
        patch.title !== undefined && patch.title.trim() !== current.title
          ? `renomeia "${quote(current.title)}" para "${quote(next.title)}"`
          : `edita "${quote(next.title)}"${fields.length > 0 ? ` (${fields.join(', ')})` : ''}`
      return {
        board: stamp({ ...board, cards: board.cards.map((c) => (c.id === action.id ? next : c)) }),
        message: `chore: ${label}`,
      }
    }

    case 'card/move': {
      const card = board.cards.find((c) => c.id === action.id)
      if (!card) return noop(board)
      if (!board.columns.some((c) => c.id === action.toColumnId)) return noop(board)

      const target = inColumn(board, action.toColumnId).filter((c) => c.id !== action.id)
      const index = Math.max(0, Math.min(action.toIndex, target.length))
      const sameColumn = card.columnId === action.toColumnId
      const currentIndex = inColumn(board, card.columnId).findIndex((c) => c.id === card.id)
      if (sameColumn && currentIndex === index) return noop(board)

      const moved: Card = { ...card, columnId: action.toColumnId, updatedAt: now }
      target.splice(index, 0, moved)

      let cards = board.cards.map((c) => (c.id === action.id ? moved : c))
      cards = reindex(cards, action.toColumnId, target)
      if (!sameColumn) cards = reindex(cards, card.columnId, inColumn({ ...board, cards }, card.columnId))

      return {
        board: stamp({ ...board, cards }),
        message: sameColumn
          ? `chore: reordena "${quote(card.title)}" em ${columnTitle(board, action.toColumnId)}`
          : `chore: move "${quote(card.title)}" para ${columnTitle(board, action.toColumnId)}`,
      }
    }

    case 'card/archive': {
      const card = board.cards.find((c) => c.id === action.id)
      if (!card) return noop(board)
      return {
        board: stamp({
          ...board,
          cards: board.cards.filter((c) => c.id !== action.id),
          archived: [{ ...card, updatedAt: now, archivedAt: now }, ...board.archived],
        }),
        message: `chore: arquiva "${quote(card.title)}"`,
      }
    }

    case 'card/restore': {
      const card = board.archived.find((c) => c.id === action.id)
      if (!card) return noop(board)
      const columnId =
        action.toColumnId && board.columns.some((c) => c.id === action.toColumnId)
          ? action.toColumnId
          : board.columns.some((c) => c.id === card.columnId)
            ? card.columnId
            : board.columns[0].id
      const siblings = inColumn(board, columnId)
      const { archivedAt: _archivedAt, ...rest } = card
      return {
        board: stamp({
          ...board,
          archived: board.archived.filter((c) => c.id !== action.id),
          cards: [
            ...board.cards,
            { ...rest, columnId, updatedAt: now, order: (siblings[siblings.length - 1]?.order ?? 0) + STEP },
          ],
        }),
        message: `chore: restaura "${quote(card.title)}" para ${columnTitle(board, columnId)}`,
      }
    }

    case 'card/delete': {
      const list = action.from === 'archive' ? board.archived : board.cards
      const card = list.find((c) => c.id === action.id)
      if (!card) return noop(board)
      const next =
        action.from === 'archive'
          ? { ...board, archived: board.archived.filter((c) => c.id !== action.id) }
          : { ...board, cards: board.cards.filter((c) => c.id !== action.id) }
      return { board: stamp(next), message: `chore: exclui "${quote(card.title)}"` }
    }

    case 'column/create': {
      const title = action.title.trim()
      if (title === '') return noop(board)
      const column: Column = { id: newId('col'), title }
      return {
        board: stamp({ ...board, columns: [...board.columns, column] }),
        message: `feat: cria coluna "${quote(title)}"`,
      }
    }

    case 'column/rename': {
      const column = board.columns.find((c) => c.id === action.id)
      const title = action.title.trim()
      if (!column || title === '' || title === column.title) return noop(board)
      return {
        board: stamp({
          ...board,
          columns: board.columns.map((c) => (c.id === action.id ? { ...c, title } : c)),
        }),
        message: `chore: renomeia coluna "${quote(column.title)}" para "${quote(title)}"`,
      }
    }

    case 'column/wip': {
      const column = board.columns.find((c) => c.id === action.id)
      if (!column) return noop(board)
      const limit = action.wipLimit !== undefined && action.wipLimit > 0 ? Math.floor(action.wipLimit) : undefined
      if (limit === column.wipLimit) return noop(board)
      return {
        board: stamp({
          ...board,
          columns: board.columns.map((c) => {
            if (c.id !== action.id) return c
            const { wipLimit: _drop, ...rest } = c
            return limit === undefined ? rest : { ...rest, wipLimit: limit }
          }),
        }),
        message:
          limit === undefined
            ? `chore: remove WIP limit de "${quote(column.title)}"`
            : `chore: define WIP limit ${limit} em "${quote(column.title)}"`,
      }
    }

    case 'column/move': {
      const from = board.columns.findIndex((c) => c.id === action.id)
      if (from === -1) return noop(board)
      const to = Math.max(0, Math.min(action.toIndex, board.columns.length - 1))
      if (from === to) return noop(board)
      const columns = [...board.columns]
      const [column] = columns.splice(from, 1)
      columns.splice(to, 0, column)
      return {
        board: stamp({ ...board, columns }),
        message: `chore: reordena coluna "${quote(column.title)}" (posicao ${to + 1})`,
      }
    }

    case 'column/delete': {
      const column = board.columns.find((c) => c.id === action.id)
      if (!column || board.columns.length <= 1) return noop(board)
      const columns = board.columns.filter((c) => c.id !== action.id)
      const target =
        action.moveCardsTo && columns.some((c) => c.id === action.moveCardsTo) ? action.moveCardsTo : null
      const affected = inColumn(board, action.id)

      let cards: Card[]
      if (target === null) {
        cards = board.cards.filter((c) => c.columnId !== action.id)
      } else {
        const targetCards = inColumn(board, target)
        let order = targetCards[targetCards.length - 1]?.order ?? 0
        const moved = new Map(
          affected.map((c) => [c.id, { ...c, columnId: target, updatedAt: now, order: (order += STEP) }]),
        )
        cards = board.cards.map((c) => moved.get(c.id) ?? c)
      }

      return {
        board: stamp({ ...board, columns, cards }),
        message:
          target === null
            ? `chore: exclui coluna "${quote(column.title)}" e ${affected.length} card(s)`
            : `chore: exclui coluna "${quote(column.title)}", cards para ${columnTitle(board, target)}`,
      }
    }

    case 'board/archiveColumn': {
      const affected = inColumn(board, action.columnId)
      if (affected.length === 0) return noop(board)
      const ids = new Set(affected.map((c) => c.id))
      return {
        board: stamp({
          ...board,
          cards: board.cards.filter((c) => !ids.has(c.id)),
          archived: [...affected.map((c) => ({ ...c, updatedAt: now, archivedAt: now })), ...board.archived],
        }),
        message: `chore: arquiva ${affected.length} card(s) de ${columnTitle(board, action.columnId)}`,
      }
    }

    case 'board/replace':
      return { board: stamp(action.board), message: action.reason }
  }
}
