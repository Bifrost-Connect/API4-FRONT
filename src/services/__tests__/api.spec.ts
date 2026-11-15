import { describe, it, expect, vi, beforeEach } from 'vitest'
import api, { mockactive, ApiError, extractApiErrorMessage } from '../api'

describe('API Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('deve exportar uma instância do axios', () => {
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
  })

  it('deve possuir a variável mockactive', () => {
    expect(typeof mockactive).toBe('boolean')
  })

  it('dispara evento api4:forbidden ao receber HTTP 403 e preserva status/erro no ApiError', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const interceptors = (api.interceptors.response as any).handlers
    const responseErrorHandler = interceptors[interceptors.length - 1].rejected

    const forbiddenErr = {
      response: {
        status: 403,
        data: { erro: 'Você não pode alterar seu próprio perfil ou status.' },
      },
    }

    await expect(responseErrorHandler(forbiddenErr)).rejects.toEqual(forbiddenErr)
    expect(dispatchSpy).toHaveBeenCalled()
    const eventArg = dispatchSpy.mock.calls.find(
      (call) => (call[0] as CustomEvent)?.type === 'api4:forbidden',
    )?.[0] as CustomEvent | undefined
    expect(eventArg).toBeDefined()

    const apiErr = new ApiError(forbiddenErr)
    expect(apiErr.status).toBe(403)
    expect(apiErr.message).toBe('Você não pode alterar seu próprio perfil ou status.')
    expect(extractApiErrorMessage(forbiddenErr)).toBe('Você não pode alterar seu próprio perfil ou status.')
  })
})
