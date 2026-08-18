import type { ReactNode } from 'react'

/**
 * Renderizador de markdown basico: negrito, italico, codigo inline, listas,
 * links e paragrafos.
 *
 * Produz elementos React -- nunca innerHTML/dangerouslySetInnerHTML. Isso
 * importa: o app fica num dominio publico com o token no localStorage, entao
 * um XSS aqui vazaria o token. Links passam por whitelist de protocolo.
 */

const SAFE_PROTOCOL = /^(?:https?:\/\/|mailto:)/i

/**
 * Compilado por chamada, nunca compartilhado: `inline` se chama recursivamente
 * (negrito dentro de item de lista, por exemplo) e um `lastIndex` comum entre as
 * chamadas faria o laco externo reprocessar o mesmo texto para sempre.
 */
function inlinePattern(): RegExp {
  return /(\*\*|__)([\s\S]+?)\1|(\*|_)([\s\S]+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>)"']+)/g
}

function safeHref(raw: string): string | null {
  const url = raw.trim()
  return SAFE_PROTOCOL.test(url) ? url : null
}

function link(href: string, label: string, key: string): ReactNode {
  const safe = safeHref(href)
  if (!safe) return <span key={key}>{label}</span>
  return (
    <a
      key={key}
      href={safe}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-sky-700 underline decoration-sky-700/40 hover:decoration-sky-700 dark:text-sky-400 dark:decoration-sky-400/40"
    >
      {label}
    </a>
  )
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = inlinePattern()
  let last = 0
  let n = 0
  for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-${n++}`
    if (m[2] !== undefined) {
      out.push(<strong key={key} className="font-semibold">{inline(m[2], key)}</strong>)
    } else if (m[4] !== undefined) {
      out.push(<em key={key} className="italic">{inline(m[4], key)}</em>)
    } else if (m[5] !== undefined) {
      out.push(
        <code key={key} className="rounded bg-zinc-200/70 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-700/60">
          {m[5]}
        </code>,
      )
    } else if (m[6] !== undefined && m[7] !== undefined) {
      out.push(link(m[7], m[6], key))
    } else if (m[8] !== undefined) {
      out.push(link(m[8], m[8], key))
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: string[] }

function parse(source: string): Block[] {
  const blocks: Block[] = []
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const prev = blocks[blocks.length - 1]

    if (line.trim() === '') {
      if (prev) blocks.push({ kind: 'p', lines: [] })
      continue
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)

    if (bullet) {
      if (prev && prev.kind === 'ul') prev.items.push(bullet[1])
      else blocks.push({ kind: 'ul', items: [bullet[1]] })
      continue
    }
    if (numbered) {
      if (prev && prev.kind === 'ol') prev.items.push(numbered[1])
      else blocks.push({ kind: 'ol', items: [numbered[1]] })
      continue
    }
    if (prev && prev.kind === 'p' && prev.lines.length > 0) prev.lines.push(line)
    else blocks.push({ kind: 'p', lines: [line] })
  }
  return blocks.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0))
}

export function Markdown({ source }: { source: string }): ReactNode {
  const blocks = parse(source)
  if (blocks.length === 0) return null
  return (
    <div className="space-y-2 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
      {blocks.map((block, i) => {
        if (block.kind === 'p') {
          return (
            <p key={i} className="whitespace-pre-wrap break-words">
              {block.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && '\n'}
                  {inline(line, `${i}-${j}`)}
                </span>
              ))}
            </p>
          )
        }
        const List = block.kind === 'ul' ? 'ul' : 'ol'
        return (
          <List
            key={i}
            className={
              block.kind === 'ul'
                ? 'list-disc space-y-1 pl-5 marker:text-zinc-400'
                : 'list-decimal space-y-1 pl-5 marker:text-zinc-400'
            }
          >
            {block.items.map((item, j) => (
              <li key={j} className="break-words">
                {inline(item, `${i}-${j}`)}
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
