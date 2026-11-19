import type { ZappyCredentials } from './zappy-client.interface.ts'

export type Tenant = Readonly<{
  id: string
  name: string
  zappyUrl: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}>

export type TenantWithCredentials = Tenant & Readonly<{ credentials: ZappyCredentials }>

export type NewTenant = Readonly<{
  id: string
  name: string
  zappyUrl: string
  zappyToken: string
}>

export interface TenantRepository {
  create(tenant: NewTenant): Promise<Tenant>
  findById(id: string): Promise<TenantWithCredentials | null>
  list(): Promise<readonly Tenant[]>
  setActive(id: string, active: boolean): Promise<boolean>
  remove(id: string): Promise<boolean>
}
