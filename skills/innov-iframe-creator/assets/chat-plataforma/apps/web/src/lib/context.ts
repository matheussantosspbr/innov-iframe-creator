import { type IframeContext, iframeContextSchema } from '@app/shared'

export type ContextResult = { ok: true; context: IframeContext } | { ok: false; error: string }

export const readIframeContext = (search = window.location.search): ContextResult => {
  const raw = Object.fromEntries(new URLSearchParams(search))
  const parsed = iframeContextSchema.safeParse(raw)
  return parsed.success
    ? { ok: true, context: parsed.data }
    : {
        ok: false,
        error: 'Abra este app pelo Chat Plataforma (parâmetros do atendimento ausentes).',
      }
}
