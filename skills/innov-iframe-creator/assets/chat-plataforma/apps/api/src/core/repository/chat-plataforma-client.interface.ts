import type { TicketView } from '@app/shared'
import type { Credentials } from '../utils/credentials.ts'

export type Permissions = Readonly<{ isAdmin: boolean; permissions: readonly string[] }>

export interface ChatPlataformaClient {
  getMyPermissions(): Promise<Permissions>
  getTicket(ticketId: string): Promise<TicketView>
  setContactTags(contactId: string, tagIds: readonly string[]): Promise<unknown>
}

export type ClientOptions = Readonly<{ requestId?: string; timeoutMs?: number }>

export type ClientFor = (credentials: Credentials, options?: ClientOptions) => ChatPlataformaClient
