import { create } from 'zustand'
import api from '@/lib/api'

/**
 * Store de autenticación con Zustand.
 * Persiste el token, usuario y rol en localStorage.
 */
const useAuthStore = create((set) => ({
  // Estado inicial — leer desde localStorage si existe sesión previa
  token: localStorage.getItem('access_token') || null,
  user: (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  })(),
  isLoading: false,
  error: null,

  /**
   * Realiza el login contra la API y guarda el token en localStorage.
   * Retorna true si el login fue exitoso, false si falló.
   */
  login: async (username, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.post('/auth/login', { username, password })
      const { access_token, role, nombre_completo } = response.data

      const userData = { username, role: role || 'abogado', nombre_completo }

      // Persistir sesión en localStorage
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))

      set({
        token: access_token,
        user: userData,
        isLoading: false,
        error: null,
      })
      return true
    } catch (error) {
      const message =
        error.response?.data?.detail || 'Error al iniciar sesión. Verifica tus credenciales.'
      set({ isLoading: false, error: message, token: null, user: null })
      return false
    }
  },

  /**
   * Cierra la sesión limpiando el estado y localStorage.
   */
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    set({ token: null, user: null, error: null })
  },

  /**
   * Limpia el mensaje de error del store.
   */
  clearError: () => set({ error: null }),

  /**
   * Helpers de rol.
   */
  isAdmin: () => {
    const state = useAuthStore.getState()
    return state.user?.role === 'admin'
  },
}))

export default useAuthStore
