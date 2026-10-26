import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import api from '@/lib/api'

export default function Setup() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('carlos')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Si ya hay usuarios, redirigir al login
    api.get('/api/setup/status')
      .then(res => {
        if (!res.data.needs_setup) navigate('/login', { replace: true })
        else setChecking(false)
      })
      .catch(() => { setChecking(false) })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      await api.post('/api/setup/create-admin', { username, password, nombre_completo: nombreCompleto })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el usuario.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <Scale size={28} className="text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Configuración Inicial
          </CardTitle>
          <CardDescription className="text-slate-500 mt-1">
            Crea el usuario administrador del sistema
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre Completo</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Ej: Carlos Pérez"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar contraseña</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repite la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-base font-medium bg-green-600 hover:bg-green-700" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando usuario...
                </span>
              ) : 'Crear usuario y continuar'}
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
