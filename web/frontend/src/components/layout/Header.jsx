import { Bell, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import useBrandingStore from '@/store/brandingStore'
import useDashboardStore from '@/store/dashboardStore'

const ROUTE_LABELS = {
  '/dashboard': 'Dashboard',
  '/documentos': 'Documentos',
  '/documentos/subir': 'Subir PDF',
  '/expedientes': 'Expedientes',
  '/audiencias/calendario': 'Calendario de Audiencias',
  '/audiencias/proximas': 'Próximas Audiencias',
  '/notificaciones': 'Notificaciones',
  '/configuracion': 'Configuración',
}

const TAB_LABELS = {
  marca: 'Marca',
  usuarios: 'Usuarios',
  correo: 'Correo',
  subida: 'Subida',
  seguridad: 'Seguridad',
}

function useBreadcrumb(pathname, tab) {
  if (pathname.startsWith('/expedientes/')) {
    return [
      { label: 'Expedientes', path: '/expedientes' },
      { label: 'Detalle de Expediente', path: null },
    ]
  }
  if (pathname.startsWith('/documentos/') && pathname !== '/documentos/subir') {
    return [
      { label: 'Documentos', path: '/documentos' },
      { label: 'Detalle de Documento', path: null },
    ]
  }
  const label = ROUTE_LABELS[pathname]
  if (label && tab && TAB_LABELS[tab]) {
    return [
      { label, path: pathname },
      { label: TAB_LABELS[tab], path: null },
    ]
  }
  return label ? [{ label, path: null }] : [{ label: 'Sistema Jurídico', path: null }]
}

export default function Header() {
  const { nombre_empresa, color_primario } = useBrandingStore()
  const { plazosUrgentes } = useDashboardStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const breadcrumb = useBreadcrumb(location.pathname, searchParams.get('tab'))

  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumb — la raíz usa el nombre de empresa configurado */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-gray-400 font-medium">{nombre_empresa}</span>
        {breadcrumb.map((crumb, index) => (
          <span key={index} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="text-gray-300" />
            {crumb.path ? (
              <button
                onClick={() => navigate(crumb.path)}
                className="hover:underline font-medium"
                style={{ color: color_primario }}
              >
                {crumb.label}
              </button>
            ) : (
              <span className="font-semibold text-gray-800">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {isDemoMode && (
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            Modo Demo
          </span>
        )}

        {/* Bell — única acción del header. El menú de usuario vive en el sidebar */}
        <div className="relative">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            title="Alertas urgentes"
          >
            <Bell size={17} />
          </button>
          {plazosUrgentes > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {plazosUrgentes > 9 ? '9+' : plazosUrgentes}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
