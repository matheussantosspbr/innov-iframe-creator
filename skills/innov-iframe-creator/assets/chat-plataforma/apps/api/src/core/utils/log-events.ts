import type { ValueOf } from '@app/shared'

export const LOG_EVENT = Object.freeze({
  installationInstalled: 'installation.installed',
  installationConfigured: 'installation.configured',
  installationUninstalled: 'installation.uninstalled',
  diagnosticsChecked: 'diagnostics.checked',
} as const)
export type LogEvent = ValueOf<typeof LOG_EVENT>
