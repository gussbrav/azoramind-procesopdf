import { create } from 'zustand'
import api from '@/lib/api'

/**
 * Store de branding (personalización del cliente).
 *
 * - Carga la config desde GET /api/settings/branding (endpoint público)
 * - Cachea en localStorage para mostrar el branding al instante en el próximo
 *   load (evita el "flash" del logo/nombre por defecto antes del fetch)
 * - Expone updateBranding() para guardar cambios desde la página de Configuración
 */

const STORAGE_KEY = 'branding_config'

const DEFAULTS = {
  nombre_empresa: 'Sistema Jurídico',
  subtitulo: 'Estudio de Abogados',
  logo_url: '',
  color_primario: '#2563eb',
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function saveToCache(branding) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding))
  } catch {
    // ignorar (quota, modo privado, etc.)
  }
}

const useBrandingStore = create((set) => ({
  ...loadFromCache(),
  isLoading: false,
  error: null,

  /**
   * Recarga el branding desde el backend.
   * Se llama en el bootstrap de la app y después de guardar cambios.
   */
  fetchBranding: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.get('/api/settings/branding')
      const branding = { ...DEFAULTS, ...res.data }
      saveToCache(branding)
      set({ ...branding, isLoading: false })
      return branding
    } catch (err) {
      // Si falla, mantenemos lo que ya tenemos cacheado / defaults
      set({ isLoading: false, error: err.message })
      return null
    }
  },

  /**
   * Guarda branding en el backend (solo admin) y refresca el store.
   */
  updateBranding: async (config) => {
    set({ isLoading: true, error: null })
    try {
      const res = await api.put('/api/settings/branding', config)
      const branding = { ...DEFAULTS, ...(res.data?.branding || config) }
      saveToCache(branding)
      set({ ...branding, isLoading: false })
      return { ok: true, branding }
    } catch (err) {
      const message = err.response?.data?.detail || 'No se pudo guardar el branding.'
      set({ isLoading: false, error: message })
      return { ok: false, error: message }
    }
  },
}))

export default useBrandingStore
export { DEFAULTS as BRANDING_DEFAULTS }
