import type { Board } from '../types'

export type AdapterKind = 'local' | 'github'

export interface StorageAdapter {
  kind: AdapterKind
  /** null quando ainda nao existe nada gravado */
  load(): Promise<Board | null>
  save(board: Board, message: string): Promise<void>
}

/** O PUT foi rejeitado porque o arquivo remoto mudou depois do nosso GET. */
export class ConflictError extends Error {
  constructor() {
    super('O board foi editado em outro dispositivo.')
    this.name = 'ConflictError'
  }
}

/** Token ausente, invalido, expirado ou sem permissao no repo. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/** Falha de rede: sem internet, DNS, CORS. */
export class OfflineError extends Error {
  constructor() {
    super('Sem conexão com o GitHub.')
    this.name = 'OfflineError'
  }
}
