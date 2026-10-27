import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, CheckCircle, Clock, AlertTriangle, BarChart2, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import api from '@/lib/api'

function MetricCard({ title, value, icon: Icon, iconBg, iconColor, onClick }) {
  return (
    <Card
      className={`hover:shadow-md transition-shadow duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon size={20} className={iconColor} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-gray-900">{value ?? '—'}</p>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/api/reportes/stats')
      .then(r => setStats(r.data))
      .catch(() => setError('No se pudieron cargar las estadísticas'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner />
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen del procesamiento de facturas</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total Facturas"
          value={stats?.total_facturas ?? 0}
          icon={FileText}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          onClick={() => navigate('/facturas')}
        />
        <MetricCard
          title="Procesadas"
          value={stats?.procesadas ?? 0}
          icon={CheckCircle}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          onClick={() => navigate('/facturas?estado=procesado')}
        />
        <MetricCard
          title="Pendientes"
          value={stats?.pendientes ?? 0}
          icon={Clock}
          iconBg="bg-yellow-100"
          iconColor="text-yellow-600"
          onClick={() => navigate('/facturas?estado=pendiente')}
        />
        <MetricCard
          title="Con Error"
          value={stats?.con_error ?? 0}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          onClick={() => navigate('/facturas?estado=error')}
        />
        <MetricCard
          title="Con Distribución"
          value={stats?.con_distribucion ?? 0}
          icon={BarChart2}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          onClick={() => navigate('/reportes')}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <button
          onClick={() => navigate('/facturas/subir')}
          className="flex items-center gap-3 p-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm"
        >
          <Upload size={22} />
          <div className="text-left">
            <p className="font-semibold">Subir Factura PDF</p>
            <p className="text-blue-200 text-sm">Procesar nueva factura</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/reportes')}
          className="flex items-center gap-3 p-5 bg-white hover:bg-gray-50 text-gray-800 rounded-xl transition-colors shadow-sm border border-gray-200"
        >
          <BarChart2 size={22} className="text-purple-600" />
          <div className="text-left">
            <p className="font-semibold">Exportar Excel</p>
            <p className="text-gray-500 text-sm">Descargar distribución contable</p>
          </div>
        </button>
      </div>
    </div>
  )
}
