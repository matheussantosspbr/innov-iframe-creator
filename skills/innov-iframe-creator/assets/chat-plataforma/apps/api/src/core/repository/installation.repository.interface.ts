import type { Credentials } from '../utils/credentials.ts'

export type Installation = Readonly<{ id: number; externalId: string; credentials: Credentials }>
export type NewInstallation = Omit<Installation, 'id'>

export interface InstallationRepository {
  create(installation: NewInstallation): Promise<Installation>
  find(externalId: string): Promise<Installation | null>
  update(installation: NewInstallation): Promise<boolean>
  delete(externalId: string): Promise<boolean>
  ping(): Promise<void>
}
