import { ROLE_DEFAULT_PERMISSIONS, type StandardRole, type UserSession } from '@/types/access'
import { userService } from '@/services/user'
import { normalizeRoleKey } from '@/utils/rbac'

const ROLE_DISPLAY_META: Record<StandardRole, { id: number; name: string; email: string; label: string }> = {
  ADMIN: { id: 1, name: 'Carlos Mendes', email: 'admin@georural.com.br', label: 'Administrador' },
  OPERADOR_DADOS: { id: 2, name: 'João Silva', email: 'operador@georural.com.br', label: 'Operador' },
  ANALISTA: { id: 3, name: 'Mariana Duarte', email: 'analista@georural.com.br', label: 'Analista' },
  AUDITOR: { id: 4, name: 'Daniel Natan', email: 'auditor@georural.com.br', label: 'Auditor' },
  GESTOR: { id: 5, name: 'Fernanda Rocha', email: 'gestor@georural.com.br', label: 'Gestor' },
}

export function setTestUserRole(role: string, token = 'test-jwt-token'): UserSession {
  const key = normalizeRoleKey(role) as StandardRole
  const meta = ROLE_DISPLAY_META[key] ?? {
    id: 99,
    name: role,
    email: `${role.toLowerCase()}@georural.com.br`,
    label: role,
  }
  const permissions = [...(ROLE_DEFAULT_PERMISSIONS[key] ?? [])]
  const session: UserSession = {
    id: meta.id,
    name: meta.name,
    email: meta.email,
    role: meta.label,
    roleId: key,
    permissions,
    token,
  }
  userService.setCurrentUser(session, { accessToken: token })
  return session
}
