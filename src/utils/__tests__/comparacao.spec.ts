import { describe, expect, it, vi } from 'vitest'
import { parseBbox, percentageVariation, synchronizeCameras, type CameraMap } from '../comparacao'

function camera(lat: number, lng: number, zoom: number) {
  const handlers = new Set<() => void>()
  let center = { lat, lng }
  const map: CameraMap = {
    getCenter: () => center,
    getZoom: () => zoom,
    setView: vi.fn((nextCenter, nextZoom) => {
      center = nextCenter
      zoom = nextZoom
      handlers.forEach((handler) => handler())
    }),
    on: (_events, handler) => handlers.add(handler),
    off: (_events, handler) => handlers.delete(handler),
  }
  return map
}

describe('comparação temporal', () => {
  it('sincroniza pan e zoom nas duas direções sem retroalimentar eventos', () => {
    const a = camera(-15, -47, 4)
    const b = camera(-15, -47, 4)
    const stop = synchronizeCameras(a, b)
    a.setView({ lat: -10, lng: -50 }, 9, { animate: false })
    expect(b.getCenter()).toEqual(a.getCenter())
    expect(b.getZoom()).toBe(9)
    expect(a.setView).toHaveBeenCalledTimes(1)
    expect(b.setView).toHaveBeenCalledTimes(1)
    b.setView({ lat: -20, lng: -40 }, 12, { animate: false })
    expect(a.getCenter()).toEqual(b.getCenter())
    expect(a.getZoom()).toBe(12)
    expect(a.setView).toHaveBeenCalledTimes(2)
    expect(b.setView).toHaveBeenCalledTimes(2)
    stop()
    a.setView({ lat: 0, lng: 0 }, 3, { animate: false })
    expect(b.getZoom()).toBe(12)
  })

  it('não replica eventos quando a câmera de destino já está na mesma posição', () => {
    const a = camera(0, 0, 4)
    const b = camera(0, 0, 4)
    synchronizeCameras(a, b)
    a.setView({ lat: 0, lng: 0 }, 4, { animate: false })
    expect(b.setView).not.toHaveBeenCalled()
  })

  it.each([
    [40, 70, 75],
    [70, 40, -3000 / 70],
    [0, 0, 0],
    [0, 70, null],
    [-1, 10, null],
    [NaN, 10, null],
    [10, Infinity, null],
  ])('calcula a variação de %s para %s sem Infinity ou NaN', (a, b, expected) => {
    expect(percentageVariation(a, b)).toBe(expected)
  })

  it('valida limites do recorte em longitude e latitude', () => {
    expect(parseBbox([-50, -20, -40, -10])).toBe('-50,-20,-40,-10')
    expect(parseBbox(['-50', '-20', '-40', '-10'])).toBe('-50,-20,-40,-10')
    for (const values of [
      ['', '-20', '-40', '-10'],
      ['-40', '-20', '-50', '-10'],
      ['-181', '-20', '-40', '-10'],
      ['-50', '-20', '-40', '91'],
      ['-50', '-10', '-40', '-10'],
      ['NaN', '-20', '-40', '-10'],
    ])
      expect(parseBbox(values)).toBeNull()
  })
})
