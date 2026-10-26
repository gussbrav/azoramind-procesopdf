import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useBrandingStore from '@/store/brandingStore'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Documentos from '@/pages/Documentos'
import DocumentoDetalle from '@/pages/DocumentoDetalle'
import SubirPDF from '@/pages/SubirPDF'
import Expedientes from '@/pages/Expedientes'
import ExpedienteDetalle from '@/pages/ExpedienteDetalle'
import CalendarioAudiencias from '@/pages/CalendarioAudiencias'
import ProximasAudiencias from '@/pages/ProximasAudiencias'
import Notificaciones from '@/pages/Notificaciones'
import Configuracion from '@/pages/Configuracion'
import Setup from '@/pages/Setup'
import AcceptInvite from '@/pages/AcceptInvite'

/**
 * Componente de ruta protegida.
 * Redirige al login si el usuario no está autenticado.
 */
function PrivateRoute({ children }) {
  const { token } = useAuthStore()
  return token ? children : <Navigate to="/login" replace />
}

/**
 * Componente de ruta pública.
 * Redirige al dashboard si el usuario ya está autenticado.
 */
function PublicRoute({ children }) {
  const { token } = useAuthStore()
  return token ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  const { fetchBranding, color_primario } = useBrandingStore()

  // Cargar branding al montar la app y aplicarlo como variable CSS global
  useEffect(() => {
    fetchBranding()
  }, [fetchBranding])

  useEffect(() => {
    if (color_primario) {
      document.documentElement.style.setProperty('--brand-primary', color_primario)
    }
  }, [color_primario])

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta de setup inicial (solo si no hay usuarios) */}
        <Route path="/setup" element={<Setup />} />

        {/* Ruta pública: aceptar invitación */}
        <Route path="/invite" element={<AcceptInvite />} />

        {/* Ruta pública: login */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Rutas protegidas: requieren autenticación */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Redirección raíz al dashboard */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Documentos */}
          <Route path="documentos" element={<Documentos />} />
          <Route path="documentos/subir" element={<SubirPDF />} />
          <Route path="documentos/:id" element={<DocumentoDetalle />} />

          {/* Expedientes */}
          <Route path="expedientes" element={<Expedientes />} />
          <Route path="expedientes/:id" element={<ExpedienteDetalle />} />

          {/* Audiencias */}
          <Route path="audiencias/calendario" element={<CalendarioAudiencias />} />
          <Route path="audiencias/proximas" element={<ProximasAudiencias />} />

          {/* Notificaciones y configuración */}
          <Route path="notificaciones" element={<Notificaciones />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="usuarios" element={<Navigate to="/configuracion?tab=usuarios" replace />} />
        </Route>

        {/* Cualquier ruta desconocida redirige al dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
