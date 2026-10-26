import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/api"

export default function Reportes() {
  const [filters, setFilters] = useState({
    fecha_desde: "",
    fecha_hasta: "",
    proveedor_ruc: "",
    solo_alertas: false,
  })
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "" && v !== false)
      )
      const response = await api.get("/api/reportes/excel", {
        params,
        responseType: "blob",
      })
      const url = URL.createObjectURL(response.data)
      const a = document.createElement("a")
      a.href = url
      a.download = `Facturas_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error al exportar:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    const { data } = await api.get("/api/reportes/stats")
    setStats(data)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exportar Excel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha desde</Label>
              <Input type="date" value={filters.fecha_desde} onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })} />
            </div>
            <div>
              <Label>Fecha hasta</Label>
              <Input type="date" value={filters.fecha_hasta} onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })} />
            </div>
            <div>
              <Label>RUC Proveedor</Label>
              <Input placeholder="20123456789" value={filters.proveedor_ruc} onChange={(e) => setFilters({ ...filters, proveedor_ruc: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.solo_alertas} onChange={(e) => setFilters({ ...filters, solo_alertas: e.target.checked })} />
                <span className="text-sm">Solo con alertas de discrepancia</span>
              </label>
            </div>
          </div>
          <Button onClick={handleExport} disabled={loading} className="w-full">
            {loading ? "Generando..." : "Descargar Excel"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Estadísticas</CardTitle>
          <Button variant="outline" size="sm" onClick={loadStats}>Actualizar</Button>
        </CardHeader>
        {stats && (
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div><dt className="text-muted-foreground">Total facturas</dt><dd className="font-bold text-lg">{stats.total_facturas}</dd></div>
              <div><dt className="text-muted-foreground">Procesadas</dt><dd className="font-bold text-lg text-green-600">{stats.procesadas}</dd></div>
              <div><dt className="text-muted-foreground">Con alerta</dt><dd className="font-bold text-lg text-yellow-600">{stats.con_alerta}</dd></div>
              <div><dt className="text-muted-foreground">Con error</dt><dd className="font-bold text-lg text-red-600">{stats.con_error}</dd></div>
              <div><dt className="text-muted-foreground">Monto total</dt><dd className="font-bold text-lg">{stats.monto_total ? `S/ ${Number(stats.monto_total).toFixed(2)}` : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Confianza IA prom.</dt><dd className="font-bold text-lg">{stats.confianza_promedio ? `${(stats.confianza_promedio * 100).toFixed(1)}%` : "—"}</dd></div>
            </dl>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
