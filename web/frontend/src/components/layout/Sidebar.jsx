import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Upload, BarChart2,
  Settings, Receipt, LogOut, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import useAuthStore from '@/store/authStore'
import useBrandingStore from '@/store/brandingStore'

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Facturas', isSection: true,
    children: [
      { label: 'Todas las facturas', icon: FileText, path: '/facturas' },
      { label: 'Subir factura', icon: Upload, path: '/facturas/subir' },
    ],
  },
  { label: 'Reportes Excel', icon: BarChart2, path: '/reportes' },
]

function MenuItem({ icon: Icon, label, path, badge }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        )
      }
    >
      {Icon && <Icon size={17} className="shrink-0" />}
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

/** Popup menu that opens upward from user avatar — NocoDB style */
function UserPopup({ user, onClose, btnRef }) {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (btnRef?.current?.contains(e.target)) return
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose, btnRef])

  const items = [
    { icon: Settings, label: 'Configuración de la cuenta', onClick: () => { navigate('/configuracion'); onClose() } },
    { separator: true },
    { icon: LogOut, label: 'Cerrar sesión', onClick: () => { logout(); navigate('/login') }, danger: true },
  ]

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 z-50"
    >
      {/* User info header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {(user?.nombre_completo || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {user?.nombre_completo || user?.username || 'Usuario'}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.username}</p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      {items.map((item, i) => (
        item.separator ? (
          <div key={i} className="border-t border-gray-100 my-1" />
        ) : (
          <button
            key={i}
            onClick={item.onClick}
            className={`w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-3 transition-colors
              ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}`}
          >
            <item.icon size={15} className={item.danger ? 'text-red-400' : 'text-gray-400'} />
            {item.label}
          </button>
        )
      ))}
    </div>
  )
}

export default function Sidebar() {
  const { user } = useAuthStore()
  const { nombre_empresa, subtitulo, logo_url, color_primario } = useBrandingStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userBtnRef = useRef(null)

  return (
    <aside className="w-64 min-h-screen bg-slate-800 flex flex-col shrink-0 shadow-xl">
      {/* Logo + identidad de la empresa (personalizable) */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          {logo_url ? (
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md overflow-hidden shrink-0">
              <img src={logo_url} alt={nombre_empresa} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0"
              style={{ backgroundColor: color_primario }}
            >
              <Receipt size={22} className="text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{nombre_empresa}</p>
            <p className="text-blue-300 text-xs truncate">{subtitulo}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {menuItems.map((item, index) => {
          if (item.isSection) {
            return (
              <div key={index} className="pt-4">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest px-3 mb-2">
                  {item.label}
                </p>
                <div className="space-y-0.5">
                  {item.children.map((child) => (
                    <MenuItem key={child.path} {...child} />
                  ))}
                </div>
              </div>
            )
          }
          return <MenuItem key={item.path} {...item} />
        })}

      </nav>

      {/* User area — clickable, opens popup upward */}
      <div className="relative p-4 border-t border-slate-700">
        {showUserMenu && <UserPopup user={user} onClose={() => setShowUserMenu(false)} btnRef={userBtnRef} />}

        <button
          ref={userBtnRef}
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-slate-700/60 transition-colors group"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(user?.nombre_completo || user?.username || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-sm font-semibold truncate">
              {user?.nombre_completo || user?.username || 'Usuario'}
            </p>
            <p className="text-slate-400 text-xs truncate capitalize">{user?.role || 'usuario'}</p>
          </div>
          <ChevronUp size={14} className={`text-slate-500 transition-transform ${showUserMenu ? '' : 'rotate-180'}`} />
        </button>
        <p className="text-slate-600 text-xs text-center mt-3">Azoramind v2.0</p>
      </div>
    </aside>
  )
}
