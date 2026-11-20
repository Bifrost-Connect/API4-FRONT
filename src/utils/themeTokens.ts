/**
 * Utilitário para leitura segura de tokens de cor CSS em código JavaScript
 * (ex.: estilos de camadas Leaflet, gráficos e badges dinâmicos).
 */

export const THEME_COLOR_DEFAULTS: Record<string, string> = {
  '--vis-brand-orange': '#f26522',
  '--color-brand': '#f26522',
  '--color-accent-link': '#0284c7',
  '--map-layer-car-stroke': '#15803d',
  '--map-layer-car-fill': '#22c55e',
  '--map-layer-car-swatch': '#bbf7d0',
  '--map-layer-restriction-stroke': '#dc2626',
  '--map-layer-restriction-fill': '#fecaca',
  '--map-layer-intersection-stroke': '#c2410c',
  '--map-layer-intersection-fill': '#facc15',
  '--map-layer-hatch-bg': '#fef08a',
  '--map-layer-hatch-stroke': '#ea580c',
  '--map-layer-app': '#7c3aed',
  '--map-layer-reserva': '#c2410c',
  '--map-layer-indigena': '#0f766e',
  '--map-layer-delta-kept': '#d6a217',
  '--map-layer-compare-a': '#2563eb',
  '--map-layer-compare-b': '#7c3aed',
  '--map-layer-neutral': '#64748b',
}

export function getThemeColor(tokenName: string, fallback?: string): string {
  const resolvedFallback = fallback ?? THEME_COLOR_DEFAULTS[tokenName] ?? ''

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return resolvedFallback
  }

  try {
    if (typeof window.getComputedStyle !== 'function') {
      return resolvedFallback
    }
    const raw = window.getComputedStyle(document.documentElement).getPropertyValue(tokenName)
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    return trimmed || resolvedFallback
  } catch {
    return resolvedFallback
  }
}
