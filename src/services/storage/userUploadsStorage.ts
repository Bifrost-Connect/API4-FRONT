/**
 * @file Armazenamento local de identificadores de cargas submetidas pelo usuário logado.
 * Permite que a interface filtre e exiba com precisão apenas as bases submetidas
 * pelo operador logado, mesmo antes do backend implementar o filtro por operador_id.
 */

const STORAGE_KEY = 'api4_user_uploads'

export interface UserUploadRecord {
  processoId: string
  userId?: number
  userEmail?: string
  timestamp: number
}

function getStoredUploads(): UserUploadRecord[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return []
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveUploads(records: UserUploadRecord[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    }
  } catch {
    // Falha silenciosa de quota/storage
  }
}

export const userUploadsStorage = {
  recordUpload(processoId: string | number, user?: { id?: number; email?: string }): void {
    const pId = String(processoId)
    const records = getStoredUploads()
    if (!records.some((r) => String(r.processoId) === pId)) {
      records.unshift({
        processoId: pId,
        userId: user?.id,
        userEmail: user?.email,
        timestamp: Date.now(),
      })
      saveUploads(records.slice(0, 50))
    }
  },

  hasUpload(processoId: string | number, user?: { id?: number; email?: string }): boolean {
    const pId = String(processoId)
    const records = getStoredUploads()
    return records.some((r) => {
      if (String(r.processoId) !== pId) return false
      if (user?.email && r.userEmail) {
        return r.userEmail === user.email
      }
      if (user?.id && r.userId) {
        return r.userId === user.id
      }
      return true
    })
  },

  getUserUploadIds(user?: { id?: number; email?: string }): string[] {
    const records = getStoredUploads()
    return records
      .filter((r) => {
        if (!user) return true
        if (user.email && r.userEmail) return r.userEmail === user.email
        if (user.id && r.userId) return r.userId === user.id
        return true
      })
      .map((r) => String(r.processoId))
  },
}
