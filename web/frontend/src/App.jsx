import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import useBrandingStore from '@/store/brandingStore'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import UploadFactura from '@/pages/UploadFactura'
import Facturas from '@/pages/Facturas'
import Reportes from '@/pages/Reportes'
import Configuracion from '@/pages/Configuracion'
import Setup from '@/pages/Setup'
import AcceptInvite from '@/pages/AcceptInvite'

function PrivateRoute({ children }) {
  const { token } = useAuthStore()
  return token ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { token } = useAuthStore()
  return token ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  const { fetchBranding, color_primario } = useBrandingStore()

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
        <Route path="/setup" element={<Setup />} />
        <Route path="/invite" element={<AcceptInvite />} />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Facturas */}
          <Route path="facturas" element={<Facturas />} />
          <Route path="facturas/subir" element={<UploadFactura />} />

          {/* Reportes */}
          <Route path="reportes" element={<Reportes />} />

          {/* Configuración */}
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="usuarios" element={<Navigate to="/configuracion?tab=usuarios" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
