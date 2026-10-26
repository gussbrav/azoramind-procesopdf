import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Scale, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import useAuthStore from '@/store/authStore'
import useBrandingStore from '@/store/brandingStore'

export default function Login() {
  const navigate = useNavigate()
  const { login, isLoading, error, clearError } = useAuthStore()
  const { nombre_empresa, subtitulo, logo_url, color_primario } = useBrandingStore()

  useEffect(() => {
    api.get('/api/setup/status')
      .then(res => { if (res.data.needs_setup) navigate('/setup', { replace: true }) })
      .catch(() => {})
  }, [navigate])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setValidationError('')
    clearError()

    // Validación del lado del cliente
    if (!username.trim()) {
      setValidationError('El usuario es requerido.')
      return
    }
    if (!password) {
      setValidationError('La contraseña es requerida.')
      return
    }

    const success = await login(username.trim(), password)
    if (success) {
      navigate('/dashboard')
    }
  }

  const displayError = validationError || error

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          {/* Logo e identidad del sistema — usa logo del cliente si está configurado */}
          {logo_url ? (
            <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden bg-white border border-gray-100">
              <img src={logo_url} alt={nombre_empresa} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div
              className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{ backgroundColor: color_primario }}
            >
              <Scale size={28} className="text-white" />
            </div>
          )}
          <CardTitle className="text-2xl font-bold text-slate-900">
            {nombre_empresa}
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">
            {subtitulo} — Acceso al Portal
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo de usuario / email */}
            <div className="space-y-1.5">
              <Label htmlFor="username">Correo electrónico o usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="correo@ejemplo.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Campo de contraseña con toggle de visibilidad */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Mensaje de error */}
            {displayError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {displayError}
              </div>
            )}

            {/* Botón de login — usa el color primario del branding */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-medium text-white border-0 hover:opacity-90"
              style={{ backgroundColor: color_primario }}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                'Ingresar'
              )}
            </Button>
          </form>

          {/* Pie de página del formulario */}
          <p className="text-center text-xs text-gray-400 mt-6">
            Desarrollado por{' '}
            <a
              href="https://www.azoramind.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Azoramind
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
