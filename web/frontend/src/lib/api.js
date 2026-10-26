import axios from 'axios'

// Instancia de axios con baseURL leída de las variables de entorno de Vite
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor de request: agrega el token JWT a cada petición si existe
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Rutas públicas donde un 401 NO debe forzar redirect (la propia página
// ya muestra el error al usuario y un reload solo arruinaría la UX).
const PUBLIC_PATHS = ['/login', '/setup', '/invite']
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/accept-invite', '/auth/invite/']

// Interceptor de response: limpia sesión y redirige al login si el token es inválido (401),
// pero SOLO cuando el 401 viene de una ruta autenticada — nunca durante el propio login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || ''
      const currentPath = window.location.pathname

      const isPublicPage = PUBLIC_PATHS.some((p) => currentPath.startsWith(p))
      const isPublicEndpoint = PUBLIC_ENDPOINTS.some((e) => requestUrl.includes(e))

      // Si estamos en una página pública o el 401 es de un endpoint público
      // (ej. login con credenciales malas), NO recargamos — dejamos que el
      // componente maneje el error. Esto evita el reload del formulario.
      if (!isPublicPage && !isPublicEndpoint) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
