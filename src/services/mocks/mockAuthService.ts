import { ROLE_DEFAULT_PERMISSIONS, type UserSession } from '@/types/access'
import { normalizeRoleKey } from '@/utils/rbac'

const DEMO_PASSWORD = 'Troca123'

export interface DemoCredentialPreset {
  email: string
  password: string
}

export const DEMO_USERS: Record<string, UserSession> = {
  Operador: {
    id: 3,
    name: 'João Silva',
    email: 'operador@georural.com.br',
    role: 'Operador',
    roleId: 'OPERADOR_DADOS',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS || [])],
  },
  OPERADOR_DADOS: {
    id: 3,
    name: 'João Silva',
    email: 'operador@georural.com.br',
    role: 'Operador',
    roleId: 'OPERADOR_DADOS',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.OPERADOR_DADOS || [])],
  },
  Auditor: {
    id: 4,
    name: 'Daniel Natan',
    email: 'auditor@georural.com.br',
    role: 'Auditor',
    roleId: 'AUDITOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.AUDITOR || [])],
  },
  AUDITOR: {
    id: 4,
    name: 'Daniel Natan',
    email: 'auditor@georural.com.br',
    role: 'Auditor',
    roleId: 'AUDITOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.AUDITOR || [])],
  },
  Analista: {
    id: 2,
    name: 'Mariana Duarte',
    email: 'analista@georural.com.br',
    role: 'Analista',
    roleId: 'ANALISTA',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ANALISTA || [])],
  },
  ANALISTA: {
    id: 2,
    name: 'Mariana Duarte',
    email: 'analista@georural.com.br',
    role: 'Analista',
    roleId: 'ANALISTA',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ANALISTA || [])],
  },
  Administrador: {
    id: 1,
    name: 'Carlos Mendes',
    email: 'admin@georural.com.br',
    role: 'Administrador',
    roleId: 'ADMIN',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ADMIN || [])],
  },
  ADMIN: {
    id: 1,
    name: 'Carlos Mendes',
    email: 'admin@georural.com.br',
    role: 'Administrador',
    roleId: 'ADMIN',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.ADMIN || [])],
  },
  Gestor: {
    id: 5,
    name: 'Fernando Rocha',
    email: 'gestor@georural.com.br',
    role: 'Gestor',
    roleId: 'GESTOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.GESTOR || [])],
  },
  GESTOR: {
    id: 5,
    name: 'Fernando Rocha',
    email: 'gestor@georural.com.br',
    role: 'Gestor',
    roleId: 'GESTOR',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.GESTOR || [])],
  },
  Integrador: {
    id: 6,
    name: 'Sistema Integrador',
    email: 'integrador@georural.com.br',
    role: 'INTEGRADOR_EXTERNO',
    roleId: 'INTEGRADOR_EXTERNO',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.INTEGRADOR_EXTERNO || [])],
  },
  INTEGRADOR_EXTERNO: {
    id: 6,
    name: 'Sistema Integrador',
    email: 'integrador@georural.com.br',
    role: 'INTEGRADOR_EXTERNO',
    roleId: 'INTEGRADOR_EXTERNO',
    permissions: [...(ROLE_DEFAULT_PERMISSIONS.INTEGRADOR_EXTERNO || [])],
  },
}

const DEMO_EMAIL_ROLE_MAP: Record<string, string> = {
  'operador@georural.com.br': 'Operador',
  'auditor@georural.com.br': 'Auditor',
  'analista@georural.com.br': 'Analista',
  'admin@georural.com.br': 'Administrador',
  'administrador@georural.com.br': 'Administrador',
  'gestor@georural.com.br': 'Gestor',
  'integrador@georural.com.br': 'Integrador',
}

function cloneUserSession(session: UserSession): UserSession {
  return {
    ...session,
    permissions: [...session.permissions],
  }
}

export function getDefaultDemoSession(): UserSession {
  return cloneUserSession(DEMO_USERS.Operador!)
}

export function resolveLegacyDemoSession(legacyRole: string | null): UserSession | null {
  if (!legacyRole || !DEMO_USERS[legacyRole]) return null
  return cloneUserSession(DEMO_USERS[legacyRole]!)
}

export function resolveDemoRoleFromEmail(email: string): string | null {
  const emailLower = email.trim().toLowerCase()
  if (!emailLower) return null
  return DEMO_EMAIL_ROLE_MAP[emailLower] ?? null
}

export function getDemoCredentialPreset(role: string): DemoCredentialPreset | null {
  const trimmed = role.trim()
  if (!trimmed) return null
  const demo = DEMO_USERS[trimmed]
  if (!demo || !demo.email) return null
  return {
    email: demo.email,
    password: DEMO_PASSWORD,
  }
}

export function createDemoOfflineSession(role: string): UserSession {
  const demo = DEMO_USERS[role]
  if (demo) {
    return cloneUserSession(demo)
  }

  const key = normalizeRoleKey(role)
  const perms = (ROLE_DEFAULT_PERMISSIONS as Record<string, string[]>)[key] || []
  return {
    id: Date.now(),
    name: `Usuário (${role})`,
    email: `${role.toLowerCase()}@georural.com.br`,
    role,
    roleId: key,
    permissions: [...perms],
  }
}
