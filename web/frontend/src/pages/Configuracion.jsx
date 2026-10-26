import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader, RefreshCw, Database, Zap, Bot, Server, Upload, Mail, Settings, Lock, Users, Eye, EyeOff, Palette, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useAuthStore from '@/store/authStore'
import useBrandingStore from '@/store/brandingStore'
import api from '@/lib/api'
import UsuariosPage from './Usuarios'

// Tabs
const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'marca', label: 'Marca', icon: Palette, adminOnly: true },
  { id: 'usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { id: 'correo', label: 'Correo', icon: Mail },
  { id: 'subida', label: 'Subida', icon: Upload },
  { id: 'seguridad', label: 'Seguridad', icon: Lock },
]

// Servicios del sistema a verificar
const SERVICIOS = [
  { id: 'api', label: 'API Backend', descripcion: 'FastAPI — Servidor principal', icon: Server, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'db', label: 'Base de Datos', descripcion: 'PostgreSQL — Schema gestordocumentos', icon: Database, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'ollama', label: 'Ollama', descripcion: 'Motor de IA local — Extracción', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
  { id: 'claude', label: 'Claude IA', descripcion: 'Extracción y análisis de documentos', icon: Bot, color: 'text-orange-600', bg: 'bg-orange-50' },
]

function StatusDot({ estado }) {
  if (estado === 'verificando') return <Loader size={16} className="animate-spin text-blue-500" />
  if (estado === 'online' || estado === 'demo_mode') return <CheckCircle size={16} className="text-green-500" />
  if (estado === 'offline' || estado === 'error') return <XCircle size={16} className="text-red-500" />
  return <div className="w-3 h-3 rounded-full bg-gray-300" />
}

function StatusLabel({ estado }) {
  const map = {
    verificando: { label: 'Verificando...', cls: 'text-blue-600' },
    online: { label: 'Conectado', cls: 'text-green-700' },
    demo_mode: { label: 'Modo Demo', cls: 'text-amber-600' },
    offline: { label: 'Sin conexión', cls: 'text-red-600' },
    error: { label: 'Error', cls: 'text-red-600' },
    desconocido: { label: '—', cls: 'text-gray-400' },
  }
  const info = map[estado] || map.desconocido
  return <span className={`text-xs font-semibold ${info.cls}`}>{info.label}</span>
}

function MsgBox({ msg }) {
  if (!msg) return null
  const isOk = msg.tipo === 'ok'
  return (
    <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
      isOk ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'
    }`}>
      {isOk ? <CheckCircle size={15} /> : <XCircle size={15} />}
      {msg.texto}
    </div>
  )
}

const MAX_PDFS_KEY = 'max_pdfs_upload'
const DEFAULT_MAX_PDFS = 5
function getStoredMaxPdfs() {
  const val = parseInt(localStorage.getItem(MAX_PDFS_KEY), 10)
  return isNaN(val) || val < 1 ? DEFAULT_MAX_PDFS : val
}

const SMTP_DEFAULTS = {
  from_address: '', smtp_server: '', from_domain: '', smtp_port: 587,
  username: '', password: '', use_ssl: false, ignore_tls_errors: false, reject_unauthorized: true,
}

// Tamaño máximo del logo en bytes (antes de codificar a base64)
const MAX_LOGO_BYTES = 250 * 1024 // 250KB

export default function Configuracion() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const branding = useBrandingStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'general'
  const [tab, setTab] = useState(initialTab)

  // ─── Estado del formulario de marca ───
  const [brandForm, setBrandForm] = useState({
    nombre_empresa: branding.nombre_empresa,
    subtitulo: branding.subtitulo,
    logo_url: branding.logo_url,
    color_primario: branding.color_primario,
  })
  const [brandMsg, setBrandMsg] = useState(null)
  const [brandLoading, setBrandLoading] = useState(false)
  const logoFileRef = useRef(null)

  // Sincronizar el formulario cuando el store cambie (ej: al cargar al inicio)
  useEffect(() => {
    setBrandForm({
      nombre_empresa: branding.nombre_empresa,
      subtitulo: branding.subtitulo,
      logo_url: branding.logo_url,
      color_primario: branding.color_primario,
    })
  }, [branding.nombre_empresa, branding.subtitulo, branding.logo_url, branding.color_primario])

  const changeTab = (id) => {
    setTab(id)
    if (id === 'general') {
      setSearchParams({})
    } else {
      setSearchParams({ tab: id })
    }
  }
  const [servicios, setServicios] = useState(Object.fromEntries(SERVICIOS.map((s) => [s.id, 'desconocido'])))
  const [verificando, setVerificando] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [maxPdfs, setMaxPdfs] = useState(getStoredMaxPdfs)
  const [maxPdfsMsg, setMaxPdfsMsg] = useState(null)
  const [smtp, setSmtp] = useState(SMTP_DEFAULTS)
  const [smtpMsg, setSmtpMsg] = useState(null)
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [smtpTestLoading, setSmtpTestLoading] = useState(false)
  const [smtpTestMsg, setSmtpTestMsg] = useState(null)
  const [showSmtpPass, setShowSmtpPass] = useState(false)

  useEffect(() => {
    api.get('/api/settings/smtp')
      .then(res => setSmtp({ ...SMTP_DEFAULTS, ...res.data }))
      .catch(() => {})
  }, [])

  const verificarConexiones = useCallback(async () => {
    setVerificando(true)
    setServicios(Object.fromEntries(SERVICIOS.map((s) => [s.id, 'verificando'])))
    try {
      const response = await api.get('/api/health')
      const { db, demo } = response.data
      if (demo) {
        setServicios({ api: 'online', db: 'demo_mode', ollama: 'demo_mode', claude: 'demo_mode' })
      } else {
        setServicios({ api: 'online', db: db === 'connected' ? 'online' : 'offline', ollama: 'desconocido', claude: 'desconocido' })
      }
    } catch {
      setServicios({ api: 'offline', db: 'offline', ollama: 'offline', claude: 'offline' })
    } finally {
      setVerificando(false)
    }
  }, [])

  useEffect(() => { verificarConexiones() }, [verificarConexiones])

  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (!passwordForm.actual || !passwordForm.nueva) { setPasswordMsg({ tipo: 'error', texto: 'Completa todos los campos.' }); return }
    if (passwordForm.nueva !== passwordForm.confirmar) { setPasswordMsg({ tipo: 'error', texto: 'La contraseña nueva no coincide con la confirmación.' }); return }
    // Reglas alineadas con backend (validate_password_strength): ≥12, mayúsc, minúsc, dígito
    if (passwordForm.nueva.length < 12) { setPasswordMsg({ tipo: 'error', texto: 'La contraseña debe tener al menos 12 caracteres.' }); return }
    if (!/[A-Z]/.test(passwordForm.nueva)) { setPasswordMsg({ tipo: 'error', texto: 'La contraseña debe contener al menos una letra mayúscula.' }); return }
    if (!/[a-z]/.test(passwordForm.nueva)) { setPasswordMsg({ tipo: 'error', texto: 'La contraseña debe contener al menos una letra minúscula.' }); return }
    if (!/\d/.test(passwordForm.nueva)) { setPasswordMsg({ tipo: 'error', texto: 'La contraseña debe contener al menos un dígito.' }); return }
    setPasswordMsg({ tipo: 'ok', texto: 'Contraseña actualizada exitosamente.' })
    setPasswordForm({ actual: '', nueva: '', confirmar: '' })
  }

  const handleMaxPdfsSubmit = (e) => {
    e.preventDefault()
    const val = parseInt(maxPdfs, 10)
    if (isNaN(val) || val < 1 || val > 50) { setMaxPdfsMsg({ tipo: 'error', texto: 'Ingresa un número entre 1 y 50.' }); return }
    localStorage.setItem(MAX_PDFS_KEY, String(val))
    setMaxPdfsMsg({ tipo: 'ok', texto: `Límite actualizado a ${val} PDFs por lote.` })
  }

  // ─── Handlers de branding ───
  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBrandMsg(null)

    if (!file.type.startsWith('image/')) {
      setBrandMsg({ tipo: 'error', texto: 'El archivo debe ser una imagen (PNG, JPG, SVG, WebP).' })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setBrandMsg({ tipo: 'error', texto: `Imagen demasiado grande. Máximo ${Math.round(MAX_LOGO_BYTES / 1024)}KB.` })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setBrandForm((b) => ({ ...b, logo_url: reader.result }))
    }
    reader.onerror = () => {
      setBrandMsg({ tipo: 'error', texto: 'No se pudo leer la imagen.' })
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setBrandForm((b) => ({ ...b, logo_url: '' }))
    if (logoFileRef.current) logoFileRef.current.value = ''
  }

  const handleBrandSubmit = async (e) => {
    e.preventDefault()
    setBrandMsg(null)

    if (!brandForm.nombre_empresa?.trim()) {
      setBrandMsg({ tipo: 'error', texto: 'El nombre de la empresa es obligatorio.' })
      return
    }
    const hex = brandForm.color_primario?.trim() || ''
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
      setBrandMsg({ tipo: 'error', texto: 'El color primario debe ser un código hex válido (#rrggbb).' })
      return
    }

    setBrandLoading(true)
    const result = await branding.updateBranding(brandForm)
    setBrandLoading(false)

    if (result.ok) {
      setBrandMsg({ tipo: 'ok', texto: 'Personalización guardada. Los cambios se aplican al instante.' })
    } else {
      setBrandMsg({ tipo: 'error', texto: result.error || 'No se pudo guardar la personalización.' })
    }
  }

  const handleSmtpSubmit = async (e) => {
    e.preventDefault()
    setSmtpMsg(null)
    setSmtpLoading(true)
    try {
      await api.put('/api/settings/smtp', smtp)
      setSmtpMsg({ tipo: 'ok', texto: 'Configuración SMTP guardada exitosamente.' })
    } catch {
      setSmtpMsg({ tipo: 'error', texto: 'No se pudo guardar la configuración SMTP.' })
    } finally {
      setSmtpLoading(false)
    }
  }

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  // Count online services for badge
  const onlineCount = Object.values(servicios).filter(s => s === 'online' || s === 'demo_mode').length

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header — NocoDB style */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
          <Settings size={18} className="text-blue-600" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Configuración</h1>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6 mt-2">
        {TABS.filter(t => !t.adminOnly || isAdmin).map((t) => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => changeTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                ${isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon size={15} />
              {t.label}
              {t.id === 'general' && onlineCount > 0 && (
                <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{onlineCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className={tab === 'usuarios' ? '' : 'max-w-2xl'}>

        {/* ============ USUARIOS (admin) ============ */}
        {tab === 'usuarios' && isAdmin && <UsuariosPage />}

        {/* ============ MARCA (admin) ============ */}
        {tab === 'marca' && isAdmin && (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900">Personalización de Marca</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Configura el logo, nombre y colores de tu estudio. Estos cambios se aplican al login y a toda la interfaz.
              </p>
            </div>

            <form onSubmit={handleBrandSubmit} className="space-y-5">
              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la empresa</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {brandForm.logo_url ? (
                      <img src={brandForm.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <ImagePlus size={28} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => logoFileRef.current?.click()}
                      >
                        <Upload size={14} className="mr-1.5" />
                        {brandForm.logo_url ? 'Cambiar logo' : 'Subir logo'}
                      </Button>
                      {brandForm.logo_url && (
                        <Button
                          type="button" variant="outline" size="sm"
                          onClick={handleRemoveLogo}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={14} className="mr-1.5" />
                          Quitar
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      PNG, JPG, SVG o WebP. Máximo 250KB. Recomendado: cuadrado, fondo transparente.
                    </p>
                    <input
                      ref={logoFileRef} type="file" accept="image/*"
                      onChange={handleLogoFileChange} className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Nombre y subtítulo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la empresa</label>
                  <input
                    type="text" value={brandForm.nombre_empresa}
                    onChange={(e) => setBrandForm((b) => ({ ...b, nombre_empresa: e.target.value }))}
                    placeholder="Estudio Jurídico Pérez"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subtítulo / Descripción</label>
                  <input
                    type="text" value={brandForm.subtitulo}
                    onChange={(e) => setBrandForm((b) => ({ ...b, subtitulo: e.target.value }))}
                    placeholder="Abogados y Consultores"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Color primario */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Color primario</label>
                <p className="text-xs text-gray-400 mb-2">
                  Se usa en botones, enlaces y acentos visuales del sistema.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color" value={brandForm.color_primario}
                    onChange={(e) => setBrandForm((b) => ({ ...b, color_primario: e.target.value }))}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text" value={brandForm.color_primario}
                    onChange={(e) => setBrandForm((b) => ({ ...b, color_primario: e.target.value }))}
                    placeholder="#2563eb"
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">Ingresa un código hex</span>
                </div>
              </div>

              {/* Vista previa */}
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vista previa</p>
                <div className="flex items-center gap-3">
                  {brandForm.logo_url ? (
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={brandForm.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: brandForm.color_primario }}
                    >
                      <Settings size={20} className="text-white" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{brandForm.nombre_empresa || 'Nombre de la empresa'}</p>
                    <p className="text-xs text-gray-500 truncate">{brandForm.subtitulo || 'Subtítulo'}</p>
                  </div>
                  <div className="ml-auto">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg text-white text-xs font-semibold"
                      style={{ backgroundColor: brandForm.color_primario }}
                    >
                      Botón ejemplo
                    </button>
                  </div>
                </div>
              </div>

              <MsgBox msg={brandMsg} />

              <div className="pt-1">
                <Button
                  type="submit"
                  className="text-white border-0 hover:opacity-90"
                  style={{ backgroundColor: brandForm.color_primario }}
                  disabled={brandLoading}
                >
                  {brandLoading ? (
                    <span className="flex items-center gap-2"><Loader size={14} className="animate-spin" />Guardando...</span>
                  ) : 'Guardar personalización'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ============ GENERAL ============ */}
        {tab === 'general' && (
          <div className="space-y-6">
            {/* Estado del sistema */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Estado del Sistema</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Conexión a los servicios del sistema.</p>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={verificarConexiones} disabled={verificando}
                  className="gap-1.5"
                >
                  <RefreshCw size={14} className={verificando ? 'animate-spin' : ''} />
                  Verificar
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SERVICIOS.map((servicio) => {
                  const Icon = servicio.icon
                  return (
                    <div key={servicio.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50/60">
                      <div className={`w-10 h-10 rounded-xl ${servicio.bg} flex items-center justify-center shrink-0`}>
                        <Icon size={18} className={servicio.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{servicio.label}</p>
                        <p className="text-xs text-gray-400 truncate">{servicio.descripcion}</p>
                      </div>
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <StatusDot estado={servicios[servicio.id]} />
                        <StatusLabel estado={servicios[servicio.id]} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {isDemoMode && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Modo Demo activo.</strong> Los servicios muestran estado simulado.
                </div>
              )}
            </div>

            {/* Información del sistema */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Información del Sistema</h2>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {[
                  { label: 'Versión', value: 'v2.0.0 — Fase 2' },
                  { label: 'Cliente', value: 'Carlos Abogado — Estudio Jurídico, Arequipa' },
                  { label: 'Desarrollado por', value: 'Azoramind — www.azoramind.com' },
                  { label: 'Stack', value: 'React + FastAPI + PostgreSQL + Ollama + Claude AI' },
                  { label: 'Modo', value: isDemoMode ? 'Demo (sin base de datos)' : 'Producción' },
                ].map(({ label, value }, i) => (
                  <div key={label} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium text-gray-800 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ CORREO ============ */}
        {tab === 'correo' && (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900">Configuración de Correo (SMTP)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ajustes del servidor de correo para invitaciones y alertas.</p>
            </div>

            <form onSubmit={handleSmtpSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección remitente</label>
                  <input type="email" value={smtp.from_address} onChange={(e) => setSmtp(s => ({ ...s, from_address: e.target.value }))}
                    placeholder="notificaciones@tudominio.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Dominio del remitente</label>
                  <input type="text" value={smtp.from_domain} onChange={(e) => setSmtp(s => ({ ...s, from_domain: e.target.value }))}
                    placeholder="tudominio.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Servidor SMTP</label>
                  <input type="text" value={smtp.smtp_server} onChange={(e) => setSmtp(s => ({ ...s, smtp_server: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Puerto SMTP</label>
                  <input type="number" value={smtp.smtp_port} onChange={(e) => setSmtp(s => ({ ...s, smtp_port: parseInt(e.target.value) || 587 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuario SMTP</label>
                  <input type="text" value={smtp.username} onChange={(e) => setSmtp(s => ({ ...s, username: e.target.value }))}
                    placeholder="usuario@gmail.com" autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña SMTP</label>
                  <div className="relative">
                    <input type={showSmtpPass ? 'text' : 'password'} value={smtp.password} onChange={(e) => setSmtp(s => ({ ...s, password: e.target.value }))}
                      placeholder="••••••••" autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={() => setShowSmtpPass(!showSmtpPass)} tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5 pt-1">
                {[
                  { key: 'use_ssl', label: 'Usar conexión segura (SSL/TLS)', description: 'Habilita cifrado SSL/TLS para la conexión SMTP.' },
                  { key: 'ignore_tls_errors', label: 'Ignorar errores TLS', description: 'No detiene el envío si hay errores de certificado.' },
                  { key: 'reject_unauthorized', label: 'Rechazar certificados no autorizados', description: 'Recomendado en producción.' },
                ].map(({ key, label, description }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input type="checkbox" checked={smtp[key]} onChange={(e) => setSmtp(s => ({ ...s, [key]: e.target.checked }))} className="sr-only" />
                      <div
                        onClick={() => setSmtp(s => ({ ...s, [key]: !s[key] }))}
                        className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${smtp[key] ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${smtp[key] ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                      <p className="text-xs text-gray-400">{description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <MsgBox msg={smtpMsg} />

              <div className="flex gap-3 pt-1">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={smtpLoading}>
                  {smtpLoading ? (
                    <span className="flex items-center gap-2"><Loader size={14} className="animate-spin" />Guardando...</span>
                  ) : 'Guardar configuración SMTP'}
                </Button>
                <Button type="button" variant="outline" disabled={smtpTestLoading}
                  onClick={async () => {
                    setSmtpTestMsg(null)
                    const testTo = smtp.from_address || smtp.username
                    if (!testTo) { setSmtpTestMsg({ tipo: 'error', texto: 'Configura un email primero.' }); return }
                    setSmtpTestLoading(true)
                    try {
                      const res = await api.post('/api/settings/smtp/test', { to: testTo })
                      setSmtpTestMsg({ tipo: 'ok', texto: res.data.message })
                    } catch (err) {
                      setSmtpTestMsg({ tipo: 'error', texto: err.response?.data?.detail || 'Error al probar SMTP' })
                    } finally { setSmtpTestLoading(false) }
                  }}
                >
                  {smtpTestLoading ? (
                    <span className="flex items-center gap-2"><Loader size={14} className="animate-spin" />Probando...</span>
                  ) : 'Probar envío'}
                </Button>
              </div>

              <MsgBox msg={smtpTestMsg} />
            </form>
          </div>
        )}

        {/* ============ SUBIDA ============ */}
        {tab === 'subida' && (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900">Configuración de Subida</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ajustes para la carga de documentos PDF.</p>
            </div>

            <form onSubmit={handleMaxPdfsSubmit} className="space-y-4">
              <div>
                <label htmlFor="maxPdfs" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Máximo de PDFs por lote
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Cantidad máxima de archivos que se pueden seleccionar en una sola subida.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    id="maxPdfs" type="number" min={1} max={50} value={maxPdfs}
                    onChange={(e) => { setMaxPdfs(e.target.value); setMaxPdfsMsg(null) }}
                    className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500">archivos (mín. 1 — máx. 50)</span>
                </div>
              </div>

              <MsgBox msg={maxPdfsMsg} />

              <Button type="submit" variant="outline" size="sm">
                Guardar configuración
              </Button>
            </form>
          </div>
        )}

        {/* ============ SEGURIDAD ============ */}
        {tab === 'seguridad' && (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-gray-900">Cambiar Contraseña</h2>
              <p className="text-xs text-gray-400 mt-0.5">Actualiza la contraseña de tu cuenta.</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm">
              {[
                { id: 'actual', label: 'Contraseña actual', field: 'actual' },
                { id: 'nueva', label: 'Nueva contraseña', field: 'nueva' },
                { id: 'confirmar', label: 'Confirmar nueva contraseña', field: 'confirmar' },
              ].map(({ id, label, field }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <input
                    id={id} type="password" value={passwordForm[field]}
                    onChange={(e) => setPasswordForm((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              ))}

              <MsgBox msg={passwordMsg} />

              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Actualizar contraseña
              </Button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
