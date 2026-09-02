export type AdminLane = 'read' | 'write'
export type AdminResource = 'accesos' | 'sucursal' | 'invitaciones'

export function adminLaneForPath(
  path: string,
  resource: AdminResource,
): AdminLane | null {
  if (path === `/api/admin/read/${resource}`) return 'read'
  if (path === `/api/admin/write/${resource}`) return 'write'
  return null
}

export function adminActionMatchesLane(lane: AdminLane, action: unknown): boolean {
  return lane === (action === 'listar' ? 'read' : 'write')
}
