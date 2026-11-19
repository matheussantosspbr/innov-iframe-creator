import type { TicketView } from '@app/shared'

export type ZappyConnection = Readonly<{ id: number; name: string; status: string }>

export type ZappyCredentials = Readonly<{ baseUrl: string; token: string }>

export interface ZappyClient {
  listConnections(): Promise<readonly ZappyConnection[]>
  isReachable(): Promise<boolean>
  getTicket(ticketId: number): Promise<TicketView>
  verify(): Promise<void>
}

export type ZappyClientFor = (credentials: ZappyCredentials) => ZappyClient
