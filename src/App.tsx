import { useCallback, useMemo, useRef, useState } from 'react'
import type { Board as BoardModel, Priority } from './types'
import { useBoard } from './state/useBoard'
import { migrate } from './storage'
import { useHotkeys } from './hooks/useHotkeys'
import { Toolbar, type View } from './components/Toolbar'
import { Board } from './components/Board'
import { CardPanel } from './components/CardPanel'
import { ArchiveView } from './components/ArchiveView'
import { SettingsView } from './components/SettingsView'
import { ConflictBanner, ErrorBanner, FileMissingBanner, PermissionBanner } from './components/Banners'

type PanelState = { mode: 'create'; columnId: string } | { mode: 'edit'; cardId: string } | null

function downloadJson(board: BoardModel, suffix = ''): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const blob = new Blob([`${JSON.stringify(board, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `board-${stamp}${suffix}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function App() {
  const api = useBoard()
  const { board, dispatch } = api

  const [view, setView] = useState<View>('board')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [panel, setPanel] = useState<PanelState>(null)
  const [dismissedError, setDismissedError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const tags = useMemo(() => {
    if (!board) return []
    const set = new Set<string>()
    for (const card of board.cards) for (const t of card.tags) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [board])

  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>()
    if (!board) return hidden
    const q = query.trim().toLowerCase()
    for (const card of board.cards) {
      const matchesQuery =
        q === '' ||
        card.title.toLowerCase().includes(q) ||
        card.description.toLowerCase().includes(q) ||
        card.tags.some((t) => t.toLowerCase().includes(q))
      const matchesTag = tag === '' || card.tags.includes(tag)
      const matchesPriority = priority === '' || card.priority === priority
      if (!(matchesQuery && matchesTag && matchesPriority)) hidden.add(card.id)
    }
    return hidden
  }, [board, query, tag, priority])

  const openCreate = useCallback(
    (columnId?: string) => {
      if (!board) return
      setView('board')
      setPanel({ mode: 'create', columnId: columnId ?? board.columns[0].id })
    },
    [board],
  )

  useHotkeys({
    onNew: () => openCreate(),
    onSearch: () => searchRef.current?.focus(),
    onEscape: () => {
      if (panel) setPanel(null)
      else if (query !== '') setQuery('')
    },
  })

  const importFile = useCallback(
    async (file: File) => {
      if (!board) return
      let incoming: BoardModel
      try {
        incoming = migrate(JSON.parse(await file.text()))
      } catch (cause) {
        window.alert(`Não foi possível importar: ${cause instanceof Error ? cause.message : String(cause)}`)
        return
      }
      const ok = window.confirm(
        `Importar ${incoming.cards.length} card(s) e ${incoming.columns.length} coluna(s) de "${file.name}"?\n\n` +
          'Isso SUBSTITUI o board atual. Uma cópia do board atual será baixada antes, como segurança.',
      )
      if (!ok) return
      downloadJson(board, '-antes-do-import')
      dispatch({ type: 'board/replace', board: incoming, reason: `chore: importa board de ${file.name}` })
      setPanel(null)
    },
    [board, dispatch],
  )

  if (!board) {
    return (
      <div className="grid h-dvh place-items-center text-[12px] text-zinc-500">
        {api.error ?? 'Carregando o board…'}
      </div>
    )
  }

  const editing = panel?.mode === 'edit' ? (board.cards.find((c) => c.id === panel.cardId) ?? null) : null
  // card arquivado/excluido enquanto o painel estava aberto: o painel simplesmente sai
  const openPanel = panel === null || (panel.mode === 'edit' && editing === null) ? null : panel

  const visible = board.cards.length - hiddenIds.size
  const showError = api.error !== null && api.error !== dismissedError && api.status !== 'conflict'

  return (
    <div className="flex h-dvh flex-col">
      <Toolbar
        view={view}
        onView={setView}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        tags={tags}
        tag={tag}
        onTag={setTag}
        priority={priority}
        onPriority={setPriority}
        status={api.status}
        onSync={() => {
          api.saveNow()
          void api.reload()
        }}
        onNewCard={() => openCreate()}
        onExport={() => downloadJson(board)}
        onImport={importFile}
        visible={visible}
        total={board.cards.length}
        archivedCount={board.archived.length}
      />

      {api.status === 'permission' && (
        <PermissionBanner onGrant={() => void api.grantFilePermission()} onOpenSettings={() => setView('settings')} />
      )}

      {api.fileMissing && api.status !== 'permission' && (
        <FileMissingBanner onOpenSettings={() => setView('settings')} />
      )}

      {api.conflictRemote && (
        <ConflictBanner
          local={board}
          remote={api.conflictRemote}
          onKeepRemote={() => api.resolveConflict('remote')}
          onKeepLocal={() => api.resolveConflict('local')}
        />
      )}

      {showError && (
        <ErrorBanner
          message={api.error!}
          needsSettings={api.needsSettings}
          onOpenSettings={() => setView('settings')}
          onRetry={() => {
            setDismissedError(null)
            api.saveNow()
            void api.reload()
          }}
          onDismiss={() => setDismissedError(api.error)}
        />
      )}

      <main className="min-h-0 flex-1">
        {view === 'board' && (
          <Board
            board={board}
            hiddenIds={hiddenIds}
            selectedCardId={openPanel?.mode === 'edit' ? openPanel.cardId : null}
            dispatch={dispatch}
            onOpenCard={(card) => setPanel({ mode: 'edit', cardId: card.id })}
            onAddCard={(columnId) => openCreate(columnId)}
          />
        )}
        {view === 'archive' && <ArchiveView board={board} dispatch={dispatch} />}
        {view === 'settings' && (
          <SettingsView config={api.config} onSave={api.saveConfig} onExport={() => downloadJson(board)} />
        )}
      </main>

      {openPanel && (
        <CardPanel
          mode={openPanel.mode}
          card={editing}
          columnId={openPanel.mode === 'create' ? openPanel.columnId : (editing?.columnId ?? board.columns[0].id)}
          columns={board.columns}
          onClose={() => setPanel(null)}
          onCreate={(input) => {
            dispatch({ type: 'card/create', input })
            setPanel(null)
          }}
          onUpdate={(patch) => {
            if (editing) dispatch({ type: 'card/update', id: editing.id, patch })
          }}
          onArchive={() => {
            if (editing) dispatch({ type: 'card/archive', id: editing.id })
            setPanel(null)
          }}
          onDelete={() => {
            if (editing) dispatch({ type: 'card/delete', id: editing.id, from: 'board' })
            setPanel(null)
          }}
          onMove={(columnId) => {
            if (editing)
              dispatch({ type: 'card/move', id: editing.id, toColumnId: columnId, toIndex: Number.MAX_SAFE_INTEGER })
          }}
        />
      )}
    </div>
  )
}
