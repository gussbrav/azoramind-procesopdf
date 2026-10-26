import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Scale, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import api from '@/lib/api'

const ROLE_LABELS = { admin: 'Administrador', abogado: 'Abogado', asistente: 'Asistente' }

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [verifying, setVerifying] = useState(true)
  const [invite, setInvite] = useState(null)
  const [tokenError, setTokenError] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setTokenError('No se proporcionó un token de invitación.')
      setVerifying(false)
      return
    }
    api.get(`/auth/invite/${token}`)
      .then(res => { setInvite(res.data); setVerifying(false) })
      .catch(err => { setTokenError(err.response?.data?.detail || 'Invitación no válida.'); setVerifying(false) })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      await api.post('/auth/accept-invite', {
        token,
        username: invite.email,
        password,
        nombre_completo: nombreCompleto || null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la cuenta.')
    } finally {
      setLoading(false)
    }
  }

  // -- Loading --
  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="flex flex-col items-center py-16">
            <Loader2 size={36} className="text-blue-500 animate-spin mb-4" />
            <p className="text-slate-500 text-sm">Verificando invitación...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // -- Token inválido --
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="flex flex-col items-center py-16">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle size={28} className="text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Invitación no válida</h2>
            <p className="text-slate-500 text-sm text-center mb-6 max-w-xs">{tokenError}</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // -- Cuenta creada --
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="flex flex-col items-center py-16">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Cuenta creada exitosamente</h2>
            <p className="text-slate-500 text-sm text-center mb-6 max-w-xs">
              Ya puedes iniciar sesión con <strong className="text-slate-700">{invite.email}</strong>
            </p>
            <Button onClick={() => navigate('/login')} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // -- Formulario de registro --
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Scale size={28} className="text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Crear tu cuenta
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">
            Has sido invitado como <strong className="text-slate-700">{ROLE_LABELS[invite.role] || invite.role}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          {/* Email (solo lectura) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-blue-600 font-semibold text-sm">
                {invite.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Correo electrónico</p>
              <p className="text-sm font-medium text-slate-700 truncate">{invite.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre" className="text-sm font-medium text-slate-700">Nombre completo</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Ej: Carlos Pérez"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                disabled={loading}
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="pr-10 h-10"
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

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-medium text-slate-700">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
                className="h-10"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando cuenta...
                </span>
              ) : 'Crear mi cuenta'}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Desarrollado por{' '}
            <a href="https://www.azoramind.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Azoramind
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
