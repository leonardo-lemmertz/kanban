import type { Board } from '../types'
import { decodeBase64, encodeBase64 } from '../lib/base64'
import type { GithubConfig } from './config'
import { AuthError, ConflictError, OfflineError, type StorageAdapter } from './types'
import { migrate } from './migrate'

const API = 'https://api.github.com'

interface ContentsResponse {
  content?: string
  sha?: string
  encoding?: string
}

function contentsUrl(config: GithubConfig): string {
  const path = config.path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')
  return `${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`
}

/**
 * Adaptador GitHub. Le e grava um unico arquivo JSON via contents API.
 *
 * O `sha` do arquivo e guardado no GET e devolvido no PUT: e isso que faz o
 * GitHub recusar a gravacao se outro dispositivo escreveu no meio -- nunca
 * sobrescrevemos as cegas.
 */
export function createGithubAdapter(config: GithubConfig): StorageAdapter {
  let sha: string | null = null

  async function request(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${config.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
      })
    } catch {
      throw new OfflineError()
    }
  }

  async function fail(response: Response): Promise<never> {
    let detail = ''
    try {
      const body = (await response.json()) as { message?: string }
      detail = body.message ?? ''
    } catch {
      /* resposta sem corpo JSON */
    }

    if (response.status === 401) {
      throw new AuthError('Token inválido ou expirado. Gere um novo em Configurações.')
    }
    if (response.status === 403) {
      if (response.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error('Limite de requisições do GitHub atingido. Tente de novo em alguns minutos.')
      }
      throw new AuthError(
        'O token não tem permissão neste repositório. Confira em Configurações se o escopo inclui ' +
          `"${config.owner}/${config.repo}" com Contents: Read and write.`,
      )
    }
    if (response.status === 404) {
      throw new AuthError(
        `Repositório ou caminho não encontrado: ${config.owner}/${config.repo}/${config.path}. ` +
          'Verifique os dados em Configurações (um token sem acesso também responde 404).',
      )
    }
    if (response.status === 409 || (response.status === 422 && /sha/i.test(detail))) {
      throw new ConflictError()
    }
    throw new Error(`GitHub respondeu ${response.status}${detail ? `: ${detail}` : ''}`)
  }

  return {
    kind: 'github',

    async load() {
      const url = `${contentsUrl(config)}?ref=${encodeURIComponent(config.branch)}`
      const response = await request(url, { cache: 'no-store' })

      if (response.status === 404) {
        // Repo acessivel mas arquivo ainda nao existe: o primeiro save cria.
        const probe = await request(
          `${API}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`,
        )
        if (!probe.ok) await fail(probe)
        sha = null
        return null
      }
      if (!response.ok) await fail(response)

      const body = (await response.json()) as ContentsResponse
      sha = body.sha ?? null
      if (!body.content) throw new Error('O GitHub não devolveu o conteúdo do arquivo (arquivo muito grande?).')
      return migrate(JSON.parse(decodeBase64(body.content)))
    },

    async save(board: Board, message: string) {
      const response = await request(contentsUrl(config), {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: encodeBase64(`${JSON.stringify(board, null, 2)}\n`),
          branch: config.branch,
          ...(sha !== null ? { sha } : {}),
        }),
      })
      if (!response.ok) await fail(response)
      const body = (await response.json()) as { content?: { sha?: string } }
      sha = body.content?.sha ?? null
    },
  }
}

/** Usado pelo botao "testar conexao" da tela de configuracoes. */
export async function testConnection(config: GithubConfig): Promise<string> {
  const adapter = createGithubAdapter(config)
  const board = await adapter.load()
  if (board === null) return `Conexão ok. O arquivo ${config.path} ainda não existe e será criado no primeiro salvamento.`
  return `Conexão ok. ${board.cards.length} card(s) no board remoto e ${board.archived.length} arquivado(s).`
}
