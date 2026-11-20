import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getThemeColor, THEME_COLOR_DEFAULTS } from '../themeTokens'

describe('themeTokens', () => {
  beforeEach(() => {
    document.documentElement.style.cssText = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.cssText = ''
  })

  it('retorna o valor computado da variável CSS quando definida no :root', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (prop: string) => (prop === '--map-layer-car-stroke' ? '  #00aa55  ' : ''),
    } as CSSStyleDeclaration)

    expect(getThemeColor('--map-layer-car-stroke', '#15803d')).toBe('#00aa55')
  })

  it('retorna o fallback explícito quando a variável CSS está vazia no jsdom', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    expect(getThemeColor('--custom-missing-token', '#123456')).toBe('#123456')
  })

  it('retorna o padrão do catálogo THEME_COLOR_DEFAULTS quando não há fallback explícito', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    expect(getThemeColor('--map-layer-car-stroke')).toBe(
      THEME_COLOR_DEFAULTS['--map-layer-car-stroke'],
    )
    expect(getThemeColor('--color-brand')).toBe(THEME_COLOR_DEFAULTS['--color-brand'])
  })

  it('retorna string vazia para token desconhecido sem fallback', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    expect(getThemeColor('--token-inexistente')).toBe('')
  })

  it('lida com segurança quando getComputedStyle lança erro ou está indisponível', () => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
      throw new Error('CSSOM unavailable')
    })

    expect(getThemeColor('--map-layer-restriction-stroke')).toBe(
      THEME_COLOR_DEFAULTS['--map-layer-restriction-stroke'],
    )
    expect(getThemeColor('--token-desconhecido', '#abcdef')).toBe('#abcdef')
  })
})
