import type { Permissions } from '#src/core/repository/chat-plataforma-client.interface.ts'

export const REQUIRED_PERMISSIONS = Object.freeze(['tickets:view'] as const)

export const missingPermissions = (
  granted: Permissions,
  required: readonly string[] = REQUIRED_PERMISSIONS,
): readonly string[] => {
  if (granted.isAdmin) return []
  const has = (permission: string) =>
    granted.permissions.includes(permission) ||
    granted.permissions.includes(`${permission.split(':')[0]}:*`)
  return required.filter((permission) => !has(permission))
}
