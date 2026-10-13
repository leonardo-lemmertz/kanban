import { decodeBase64 } from '../lib/base64'
import type { GithubConfig } from './config'

/**
 * Triagem do email gravada pela rotina na nuvem em `emails.json`, ao lado do
 * board.json, no mesmo repositorio. Arquivo separado de proposito: a rotina
 * nunca escreve no board.json (que o app grava com controle de sha), entao os
 * dois nao disputam o mesmo arquivo. O app so le; o que o usuario faz com cada
 * email (virar card, tratado) fica no proprio board, em `emailsHandled`.
 */

/** aguardando = email que o Leonardo enviou pedindo algo e ninguem respondeu */
export type EmailKind = 'acao' | 'pendente' | 'aguardando' | 'info'

export interface EmailItem {
  /** id estavel do email (internetMessageId ou id do Outlook) */
  id: string
  kind: EmailKind
  from: string
  /** so em aguardando: para quem foi o pedido */
  to?: string
  subject: string
  /** o que pedem, em uma ou duas frases */
  ask: string
  /** AAAA-MM-DD */
  due?: string
  company?: string
  suggestion?: string
  /** ISO; em aguardando, quando o Leonardo enviou */
  receivedAt?: string
  /** link para abrir o email no Outlook */
  link?: string
}

export interface EmailFeed {
  /** ISO de quando a triagem rodou */
  generatedAt: string
  /** texto livre: "12/10 12:00 → 12/10 18:10" */
  window: string
  items: EmailItem[]
  /** emails descartados (newsletter, sistema) */
  outCount: number
  /** link do recado completo no GitHub */
  recado?: string
}

const KINDS = new Set<EmailKind>(['acao', 'pendente', 'aguardando', 'info'])

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asItem(raw: unknown): EmailItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const id = str(o.id)
  const subject = str(o.subject)
  const kind = str(o.kind) as EmailKind
  if (id === '' || subject === '' || !KINDS.has(kind)) return null
  const due = str(o.due)
  const optional = (key: string) => (str(o[key]) !== '' ? { [key]: str(o[key]) } : {})
  return {
    id,
    kind,
    from: str(o.from) || '(sem remetente)',
    subject,
    ask: str(o.ask),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(due) ? { due } : {}),
    ...optional('to'),
    ...optional('company'),
    ...optional('suggestion'),
    ...optional('receivedAt'),
    ...optional('link'),
  }
}

export function parseEmailFeed(raw: unknown): EmailFeed | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  // id repetido: fica a primeira ocorrencia
  const byId = new Map<string, EmailItem>()
  for (const item of (Array.isArray(o.items) ? o.items : []).map(asItem)) {
    if (item && !byId.has(item.id)) byId.set(item.id, item)
  }
  const items = [...byId.values()]
  return {
    generatedAt: str(o.generatedAt),
    window: str(o.window),
    items,
    outCount: typeof o.outCount === 'number' ? o.outCount : 0,
    ...(str(o.recado) !== '' ? { recado: str(o.recado) } : {}),
  }
}

/** Caminho do emails.json: mesma pasta do board.json configurado. */
function feedPath(config: GithubConfig): string {
  const parts = config.path.replace(/^\/+/, '').split('/')
  parts[parts.length - 1] = 'emails.json'
  return parts.map(encodeURIComponent).join('/')
}

/** null = ainda nao existe triagem gravada (a rotina nunca rodou). */
export async function loadEmailFeed(config: GithubConfig): Promise<EmailFeed | null> {
  const url =
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}` +
    `/contents/${feedPath(config)}?ref=${encodeURIComponent(config.branch)}`
  let response: Response
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${config.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  } catch {
    throw new Error('Sem conexão com o GitHub.')
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`GitHub respondeu ${response.status} ao ler a triagem.`)
  const body = (await response.json()) as { content?: string }
  if (!body.content) return null
  return parseEmailFeed(JSON.parse(decodeBase64(body.content)))
}
