import { ApiRequestError } from './api.ts'

export const FRONT_MESSAGES = Object.freeze({
  offline: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
  unexpected: 'Algo deu errado. Tente novamente em instantes.',
} as const)

export const friendlyMessage = (error: unknown) => {
  if (error instanceof ApiRequestError) return error.message
  if (error instanceof TypeError) return FRONT_MESSAGES.offline
  if (error instanceof Error && error.message) return error.message
  return FRONT_MESSAGES.unexpected
}
