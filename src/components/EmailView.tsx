import { useMemo, useState } from 'react'
import type { Board, Priority } from '../types'
import type { Action, NewCardInput } from '../state/boardReducer'
import type { EmailFeed, EmailItem, EmailKind } from '../storage/emailFeed'
import { formatDateTime, formatDue, todayISO } from '../lib/dates'

export interface EmailViewProps {
  board: Board
  feed: EmailFeed | null
  /** null = carregou; string = erro ou motivo de nao carregar */
  problem: string | null
  loading: boolean
  onReload: () => void
  dispatch: (action: Action) => void
  onOpenCard: (cardId: string) => void
}

const SECTION: Record<EmailKind, string> = {
  acao: 'Pede ação sua',
  pendente: 'Ainda sem resposta (de triagens anteriores)',
  aguardando: 'Aguardando resposta de outros',
  info: 'Informativo',
}

/** Coluna sugerida: a que tem o nome da empresa (ex.: EXPOBAND); senao a primeira. */
function columnFor(board: Board, company?: string): string {
  if (company) {
    const key = company.trim().toLowerCase()
    const match = board.columns.find((c) => c.title.trim().toLowerCase() === key)
    if (match) return match.id
  }
  return board.columns[0].id
}

function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const [ty, tm, td] = todayISO().split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}

/**
 * Dias uteis que ja passaram desde o envio (sabado e domingo nao contam).
 * Enviado na segunda: terca = 1, quarta = 2. Enviado na sexta: segunda = 1.
 */
export function businessDaysSince(iso: string): number {
  const sent = new Date(iso)
  const day = new Date(sent.getFullYear(), sent.getMonth(), sent.getDate())
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let count = 0
  while (day < end) {
    day.setDate(day.getDate() + 1)
    const wd = day.getDay()
    if (wd !== 0 && wd !== 6) count++
  }
  return count
}

/** Combinado com o Leonardo: 1 dia util sem resposta = atencao; 2 ou mais = cobrar. */
function waitLevel(email: EmailItem): 'ok' | 'atencao' | 'cobrar' {
  if (email.kind !== 'aguardando' || !email.receivedAt) return 'ok'
  const days = businessDaysSince(email.receivedAt)
  return days >= 2 ? 'cobrar' : days === 1 ? 'atencao' : 'ok'
}

function who(name: string): string {
  return name.split(/[(<]/)[0].trim()
}

function toCardInput(email: EmailItem, columnId: string): NewCardInput {
  const waiting = email.kind === 'aguardando'
  const priority: Priority =
    (email.due && daysUntil(email.due) <= 3) || (waiting && waitLevel(email) === 'cobrar') ? 'alta' : 'media'
  const lines = [
    email.ask || email.subject,
    '',
    ...(waiting ? [`- Para: ${email.to ?? email.from}`] : [`- De: ${email.from}`]),
    `- Assunto: ${email.subject}`,
    ...(email.receivedAt ? [`- ${waiting ? 'Enviado' : 'Recebido'}: ${formatDateTime(email.receivedAt)}`] : []),
    ...(email.due ? [`- Prazo: ${formatDue(email.due)}`] : []),
    ...(email.link ? [`- [Abrir no Outlook](${email.link})`] : []),
    '',
    '_Criado a partir da triagem do email._',
  ]
  // tira os prefixos de resposta/encaminhamento do assunto (podem vir encadeados: "RES: ENC: ...")
  const subject = email.subject.replace(/^((RES|ENC|RE|FW|FWD|TR)\s*:\s*)+/i, '')
  const title = waiting ? `Cobrar ${who(email.to ?? email.from)}: ${subject}` : `${who(email.from)}: ${subject}`
  return {
    columnId,
    title: title.length > 120 ? `${title.slice(0, 117)}...` : title,
    description: lines.join('\n'),
    priority,
    tags: [...(email.company && email.company !== '—' ? [email.company] : []), 'Email'],
    ...(email.due ? { dueDate: email.due } : {}),
  }
}

export function EmailView({ board, feed, problem, loading, onReload, dispatch, onOpenCard }: EmailViewProps) {
  const [showHandled, setShowHandled] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [columnPick, setColumnPick] = useState<Record<string, string>>({})

  const groups = useMemo(() => {
    const result: Record<EmailKind, EmailItem[]> = { acao: [], pendente: [], aguardando: [], info: [] }
    for (const item of feed?.items ?? []) {
      if (!showHandled && board.emailsHandled[item.id]) continue
      result[item.kind].push(item)
    }
    return result
  }, [feed, board.emailsHandled, showHandled])

  // o numero da aba conta so o que pede acao do Leonardo; aguardando fica na secao dela
  const open = (feed?.items ?? []).filter(
    (i) => (i.kind === 'acao' || i.kind === 'pendente') && !board.emailsHandled[i.id],
  ).length

  const header = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Email</h2>
      {feed && (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          triagem de {formatDateTime(feed.generatedAt)}
          {feed.window ? ` · janela ${feed.window}` : ''} · {open} em aberto
          {feed.outCount > 0 ? ` · ${feed.outCount} fora (newsletter, sistema)` : ''}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        {feed?.recado && (
          <a href={feed.recado} target="_blank" rel="noreferrer" className="text-[11px] text-sky-700 hover:underline dark:text-sky-400">
            recado completo
          </a>
        )}
        <label className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />
          mostrar tratados
        </label>
        <button type="button" className="btn" onClick={onReload} disabled={loading}>
          {loading ? 'Carregando…' : 'Atualizar'}
        </button>
      </div>
    </div>
  )

  if (problem || !feed) {
    return (
      <div className="mx-auto h-full max-w-4xl overflow-y-auto p-3">
        {header}
        <p className="rounded border border-dashed border-zinc-300 px-3 py-6 text-center text-[12px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {loading ? 'Carregando a triagem…' : (problem ?? 'Nenhuma triagem gravada ainda. A rotina grava o emails.json às 12h e às 18h nos dias úteis.')}
        </p>
      </div>
    )
  }

  const renderItem = (email: EmailItem) => {
    const handled = board.emailsHandled[email.id]
    const columnId = columnPick[email.id] ?? columnFor(board, email.company)
    const due = email.due ? daysUntil(email.due) : null
    const level = waitLevel(email)
    return (
      <li
        key={email.id}
        className={[
          'rounded border bg-white px-2.5 py-2 dark:bg-zinc-900',
          handled ? 'border-zinc-200 opacity-60 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-semibold">
            {email.kind === 'aguardando' ? `para ${email.to ?? email.from}` : email.from}
          </span>
          {email.kind === 'aguardando' && email.receivedAt && (
            <span
              className={`rounded-sm border px-1 text-[10px] font-semibold leading-4 tabular-nums ${
                level === 'cobrar'
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                  : level === 'atencao'
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-zinc-300 text-zinc-500 dark:border-zinc-700'
              }`}
            >
              {level === 'cobrar' ? 'cobrar · ' : level === 'atencao' ? 'atenção · ' : ''}
              {(() => {
                const days = businessDaysSince(email.receivedAt)
                return days === 0 ? 'enviado hoje' : days === 1 ? '1 dia útil sem resposta' : `${days} dias úteis sem resposta`
              })()}
            </span>
          )}
          {email.company && email.company !== '—' && (
            <span className="rounded-sm bg-sky-50 px-1 text-[10px] leading-4 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
              {email.company}
            </span>
          )}
          {email.due && (
            <span
              className={`rounded-sm border px-1 text-[10px] leading-4 tabular-nums ${
                due !== null && due < 0
                  ? 'border-red-400 text-red-700 dark:text-red-300'
                  : due !== null && due <= 1
                    ? 'border-amber-400 text-amber-800 dark:text-amber-300'
                    : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'
              }`}
            >
              prazo {formatDue(email.due)}
            </span>
          )}
          {email.receivedAt && (
            <span className="ml-auto text-[10px] tabular-nums text-zinc-400">{formatDateTime(email.receivedAt)}</span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-zinc-600 dark:text-zinc-300">{email.subject}</p>
        {email.ask && <p className="mt-1 text-[12px] leading-snug">{email.ask}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {handled ? (
            <>
              <span className="text-[11px] text-zinc-500">
                {handled.action === 'card' ? 'virou card' : 'tratado'} em {formatDateTime(handled.at)}
              </span>
              {handled.cardId && board.cards.some((c) => c.id === handled.cardId) && (
                <button type="button" className="btn" onClick={() => onOpenCard(handled.cardId!)}>
                  Abrir card
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'email/unhandle', emailId: email.id, subject: email.subject })}
              >
                Desfazer
              </button>
            </>
          ) : (
            <>
              {email.kind !== 'info' && (
                <>
                  <select
                    value={columnId}
                    onChange={(e) => setColumnPick((p) => ({ ...p, [email.id]: e.target.value }))}
                    aria-label="Coluna do card"
                    className="field w-auto py-0.5 text-[11px]"
                  >
                    {board.columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      dispatch({ type: 'email/toCard', emailId: email.id, input: toCardInput(email, columnId) })
                    }
                  >
                    Virar card
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => dispatch({ type: 'email/handle', emailId: email.id, subject: email.subject })}
              >
                {email.kind === 'aguardando' ? 'Resolvido' : 'Tratado'}
              </button>
              {email.link && (
                <a href={email.link} target="_blank" rel="noreferrer" className="text-[11px] text-sky-700 hover:underline dark:text-sky-400">
                  abrir no Outlook
                </a>
              )}
            </>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="mx-auto h-full max-w-4xl overflow-y-auto p-3">
      {header}
      <div className="space-y-4">
        {(['acao', 'pendente', 'aguardando'] as const).map((kind) => (
          <section key={kind}>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {SECTION[kind]} ({groups[kind].length})
            </h3>
            {groups[kind].length === 0 ? (
              <p className="text-[12px] text-zinc-400">Nada aqui.</p>
            ) : (
              <ul className="space-y-1.5">{groups[kind].map(renderItem)}</ul>
            )}
          </section>
        ))}
        <section>
          <button
            type="button"
            className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-600 dark:text-zinc-500"
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
          >
            {showInfo ? '▾' : '▸'} {SECTION.info} ({groups.info.length})
          </button>
          {showInfo && <ul className="space-y-1.5">{groups.info.map(renderItem)}</ul>}
        </section>
      </div>
    </div>
  )
}
