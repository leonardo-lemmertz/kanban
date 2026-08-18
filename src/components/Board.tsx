import { useMemo, useState } from 'react'
import type { Board as BoardModel, Card } from '../types'
import type { Action } from '../state/boardReducer'
import { ColumnView } from './ColumnView'

type DragState = { kind: 'card'; cardId: string } | { kind: 'column'; columnId: string } | null

export interface BoardProps {
  board: BoardModel
  hiddenIds: Set<string>
  selectedCardId: string | null
  dispatch: (action: Action) => void
  onOpenCard: (card: Card) => void
  onAddCard: (columnId: string) => void
}

export function Board(props: BoardProps) {
  const { board, dispatch } = props
  const [drag, setDrag] = useState<DragState>(null)
  const [cardDrop, setCardDrop] = useState<{ columnId: string; index: number } | null>(null)
  const [columnDrop, setColumnDrop] = useState<string | null>(null)

  const byColumn = useMemo(() => {
    const map = new Map<string, Card[]>()
    for (const column of board.columns) map.set(column.id, [])
    for (const card of board.cards) map.get(card.columnId)?.push(card)
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [board.columns, board.cards])

  const clearDrag = () => {
    setDrag(null)
    setCardDrop(null)
    setColumnDrop(null)
  }

  const dropCard = (columnId: string, index: number) => {
    if (drag?.kind === 'card') dispatch({ type: 'card/move', id: drag.cardId, toColumnId: columnId, toIndex: index })
    clearDrag()
  }

  const dropColumn = (targetId: string) => {
    if (drag?.kind === 'column' && drag.columnId !== targetId) {
      const to = board.columns.findIndex((c) => c.id === targetId)
      if (to !== -1) dispatch({ type: 'column/move', id: drag.columnId, toIndex: to })
    }
    clearDrag()
  }

  const deleteColumn = (columnId: string) => {
    const column = board.columns.find((c) => c.id === columnId)
    if (!column) return
    const count = byColumn.get(columnId)?.length ?? 0
    if (count === 0) {
      if (window.confirm(`Excluir a coluna "${column.title}"?`)) dispatch({ type: 'column/delete', id: columnId })
      return
    }
    const others = board.columns.filter((c) => c.id !== columnId)
    const target = others[0]
    const move = window.confirm(
      `A coluna "${column.title}" tem ${count} card(s).\n\n` +
        `OK = mover os cards para "${target.title}" e excluir a coluna.\n` +
        'Cancelar = manter tudo como está.',
    )
    if (move) dispatch({ type: 'column/delete', id: columnId, moveCardsTo: target.id })
  }

  const addColumn = () => {
    const title = window.prompt('Nome da nova coluna:')
    if (title !== null && title.trim() !== '') dispatch({ type: 'column/create', title })
  }

  const draggingColumnIndex = drag?.kind === 'column' ? board.columns.findIndex((c) => c.id === drag.columnId) : -1

  return (
    <div className="flex h-full snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden p-2 sm:snap-none">
      {board.columns.map((column, index) => (
        <ColumnView
          key={column.id}
          column={column}
          index={index}
          columnCount={board.columns.length}
          columns={board.columns}
          cards={byColumn.get(column.id) ?? []}
          hiddenIds={props.hiddenIds}
          selectedCardId={props.selectedCardId}
          dragKind={drag?.kind ?? null}
          draggingCardId={drag?.kind === 'card' ? drag.cardId : null}
          dropIndex={cardDrop && cardDrop.columnId === column.id ? cardDrop.index : null}
          columnDropIndicator={
            columnDrop === column.id && draggingColumnIndex !== -1 && draggingColumnIndex !== index
              ? draggingColumnIndex > index
                ? 'before'
                : 'after'
              : null
          }
          onOpenCard={props.onOpenCard}
          onAddCard={() => props.onAddCard(column.id)}
          onRename={(title) => dispatch({ type: 'column/rename', id: column.id, title })}
          onSetWip={(wipLimit) => dispatch({ type: 'column/wip', id: column.id, wipLimit })}
          onDeleteColumn={() => deleteColumn(column.id)}
          onArchiveAll={() => {
            const count = byColumn.get(column.id)?.length ?? 0
            if (window.confirm(`Arquivar os ${count} card(s) de "${column.title}"?`))
              dispatch({ type: 'board/archiveColumn', columnId: column.id })
          }}
          onMoveColumn={(toIndex) => dispatch({ type: 'column/move', id: column.id, toIndex })}
          onCardDragStart={(cardId) => setDrag({ kind: 'card', cardId })}
          onCardDragEnd={clearDrag}
          onCardDragOver={(dropIndex) => setCardDrop({ columnId: column.id, index: dropIndex })}
          onCardDrop={(dropIndex) => dropCard(column.id, dropIndex)}
          onColumnDragStart={() => setDrag({ kind: 'column', columnId: column.id })}
          onColumnDragOver={() => setColumnDrop(column.id)}
          onColumnDrop={() => dropColumn(column.id)}
          onMoveCard={(cardId, toColumnId, toIndex) =>
            dispatch({ type: 'card/move', id: cardId, toColumnId, toIndex })
          }
          onArchiveCard={(cardId) => dispatch({ type: 'card/archive', id: cardId })}
        />
      ))}

      <div className="shrink-0 pr-2">
        <button
          type="button"
          onClick={addColumn}
          className="h-9 rounded border border-dashed border-zinc-300 px-3 text-[12px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
        >
          + coluna
        </button>
      </div>
    </div>
  )
}
