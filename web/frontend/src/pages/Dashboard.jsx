import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  FileText,
  Calendar,
  AlertTriangle,
  RefreshCw,
  AlarmClock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusBadge from '@/components/shared/StatusBadge'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import useAuthStore from '@/store/authStore'
import useDashboardStore from '@/store/dashboardStore'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

/**
 * Tarjeta de métrica principal del dashboard.
 * Muestra ícono, valor numérico, etiqueta y descripción.
 */
function MetricCard({ title, value, description, icon: Icon, iconBg, iconColor, badge }) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
            <Icon size={20} className={iconColor} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-gray-900">{value ?? '—'}</span>
          {badge && (
            <span className="mb-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Urgente
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

/**
 * Gráfico de dona simplificado con CSS para distribución de estados.
 */
function DonutChart({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  const segments = [
    { key: 'procesado', label: 'Procesados', color: 'bg-green-500', value: data.procesado || 0 },
    { key: 'pendiente', label: 'Pendientes', color: 'bg-yellow-400', value: data.pendiente || 0 },
    { key: 'error', label: 'Con error', color: 'bg-red-500', value: data.error || 0 },
  ]

  return (
    <div className="flex items-center gap-6">
      {/* Barras proporcionales */}
      <div className="flex-1">
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.key}
                className={`${s.color} transition-all duration-500`}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value}`}
              />
            ) : null
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">{total} documentos en total</p>
      </div>

      {/* Leyenda */}
      <div className="flex flex-col gap-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
            <span className="text-gray-600">
              {s.label}: <strong>{s.value}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const { setMetrics } = useDashboardStore()
  const navigate = useNavigate()

  const [metrics, setLocalMetrics] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/dashboard/metrics')
      const data = response.data
      setLocalMetrics(data)
      // Actualizar store global para que el Header y Sidebar accedan a las alertas
      setMetrics(data)
    } catch {
      // Si falla la carga (BD vacía o sin conexión), mostrar ceros en lugar de error
      const empty = {
        total_expedientes: 0,
        documentos_esta_semana: 0,
        audiencias_proximos_30_dias: 0,
        plazos_por_vencer: 0,
        documentos_por_estado: {},
        ultimos_documentos: [],
        alertas_urgentes: [],
      }
      setLocalMetrics(empty)
      setMetrics(empty)
    } finally {
      setIsLoading(false)
    }
  }, [setMetrics])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const metricCards = [
    {
      title: 'Total Expedientes',
      value: metrics?.total_expedientes,
      description: 'Expedientes registrados en el sistema',
      icon: FolderOpen,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      badge: false,
    },
    {
      title: 'Documentos esta semana',
      value: metrics?.documentos_esta_semana,
      description: 'Recibidos en los últimos 7 días',
      icon: FileText,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      badge: false,
    },
    {
      title: 'Audiencias (30 días)',
      value: metrics?.audiencias_proximos_30_dias,
      description: 'Próximas audiencias programadas',
      icon: Calendar,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      badge: false,
    },
    {
      title: 'Plazos por vencer',
      value: metrics?.plazos_por_vencer,
      description: 'Vencen en los próximos 3 días',
      icon: AlertTriangle,
      iconBg: (metrics?.plazos_por_vencer || 0) > 0 ? 'bg-red-50' : 'bg-orange-50',
      iconColor: (metrics?.plazos_por_vencer || 0) > 0 ? 'text-red-600' : 'text-orange-500',
      badge: (metrics?.plazos_por_vencer || 0) > 0,
    },
  ]

  if (isLoading) return <LoadingSpinner message="Cargando dashboard..." />

  return (
    <div className="space-y-6">
      {/* Saludo y descripción */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bienvenido,{' '}
            <span className="text-blue-600 capitalize">{user?.username || 'Carlos'}</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Panel de control — Sistema de Gestión de Documentos Judiciales
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Fila de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metricCards.map((card) => (
          <MetricCard key={card.title} {...card} />
        ))}
      </div>

      {/* Distribución de estados + alertas urgentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de distribución */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-gray-800">
              Distribución por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.documentos_por_estado ? (
              <DonutChart data={metrics.documentos_por_estado} />
            ) : (
              <p className="text-sm text-gray-400">Sin datos de estado disponibles.</p>
            )}
          </CardContent>
        </Card>

        {/* Panel de alertas urgentes */}
        <Card className="border-red-100 bg-red-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-red-800 flex items-center gap-2">
              <AlarmClock size={16} className="text-red-600" />
              Alertas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.alertas_urgentes?.length > 0 ? (
              <div className="space-y-2.5">
                {metrics.alertas_urgentes.map((alerta, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg p-3 border border-red-100 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-blue-700 truncate">
                          {alerta.expediente}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                          {alerta.descripcion}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                          alerta.dias_restantes <= 1
                            ? 'bg-red-600 text-white'
                            : alerta.dias_restantes <= 2
                            ? 'bg-red-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {alerta.dias_restantes === 0
                          ? 'Hoy'
                          : `${alerta.dias_restantes}d`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Vence: {formatDate(alerta.fecha_vencimiento)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-green-700 font-medium">
                Sin alertas urgentes. Todo al dia.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimos documentos */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800">
            Últimos Documentos
          </CardTitle>
          <button
            onClick={() => navigate('/documentos')}
            className="text-sm text-blue-600 hover:underline"
          >
            Ver todos
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {metrics?.ultimos_documentos?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Archivo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.ultimos_documentos.map((doc, index) => (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/documentos/${doc.id}`)}
                      className={`border-b border-gray-50 hover:bg-blue-50/60 cursor-pointer transition-colors ${
                        index % 2 !== 0 ? 'bg-gray-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-gray-400 shrink-0" />
                          <span
                            className="text-gray-800 truncate max-w-[260px] text-xs"
                            title={doc.nombre_archivo}
                          >
                            {doc.nombre_archivo}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize text-xs">
                        {doc.tipo_documento || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge estado={doc.estado} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {formatDate(doc.fecha_recepcion)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center text-gray-400 text-sm">
              No hay documentos registrados aún.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
