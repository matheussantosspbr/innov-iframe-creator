import { z } from 'zod'

export const errorSchema = z.object({
  error: z.object({ message: z.string() }),
})

export const errorResponse = (message: string) =>
  errorSchema.meta({ description: message, example: { error: { message } } })

export const COMHUB_SECURITY = [{ comhubKey: [] }]
export const TENANT_SECURITY = [{ tenantId: [], userId: [] }]
