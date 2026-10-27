import { ChevronRight } from 'lucide-react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import useBrandingStore from '@/store/brandingStore'

const ROUTE_LABELS = {
  '/dashboard': 'Dashboard',
  '/facturas': 'Facturas',
  '/facturas/subir': 'Subir Factura',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
}

const TAB_LABELS = {
  marca: 'Marca',
  usuarios: 'Usuarios',
  seguridad: 'Seguridad',
}

function useBreadcrumb(pathname, tab) {
  const label = ROUTE_LABELS[pathname] || 'Transaltisa'
  if (tab && TAB_LABELS[tab]) {
    return [
      { label, path: pathname },
      { label: TAB_LABELS[tab], path: null },
    ]
  }
  return [{ label, path: null }]
}

export default function Header() {
  const { nombre_empresa, color_primario } = useBrandingStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const breadcrumb = useBreadcrumb(location.pathname, searchParams.get('tab'))

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
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

      <div className="flex items-center gap-3">
        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            Modo Demo
          </span>
        )}
      </div>
    </header>
  )
}
