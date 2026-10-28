import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import StatusBadge from "@/components/shared/StatusBadge"
import DataTable from "@/components/shared/DataTable"
import api from "@/lib/api"

const HEADERS = [
  { key: "id", label: "ID" },
  { key: "numero_factura", label: "N° Factura" },
  { key: "proveedor_razon_social", label: "Proveedor" },
  { key: "fecha_emision", label: "Fecha" },
  { key: "moneda", label: "Mon." },
  { key: "total_declarado", label: "Total" },
  { key: "total_discrepancia", label: "Discrepancia" },
  { key: "estado", label: "Estado" },
  { key: "_acciones", label: "" },
]

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get("/api/facturas", { params: { page, limit: 20 } })
      setFacturas(data.data || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.response?.data?.detail || "Error al cargar facturas")
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleReprocesar = async (id) => {
    if (!confirm(`¿Reprocesar factura #${id}? Se borrarán los datos anteriores y se volverá a procesar con OCR + IA.`)) return
    setActionLoading((s) => ({ ...s, [id]: "reprocesando" }))
    try {
      await api.post(`/api/facturas/${id}/reprocesar`)
      setTimeout(fetchData, 1500)
    } catch (err) {
      alert(err.response?.data?.detail || "Error al reprocesar")
    } finally {
      setActionLoading((s) => ({ ...s, [id]: null }))
    }
  }

  const handleEliminar = async (id) => {
    if (!confirm(`¿Eliminar factura #${id}? Esta acción no se puede deshacer.`)) return
    setActionLoading((s) => ({ ...s, [id]: "eliminando" }))
    try {
      await api.delete(`/api/facturas/${id}`)
      fetchData()
    } catch (err) {
      alert(err.response?.data?.detail || "Error al eliminar")
    } finally {
      setActionLoading((s) => ({ ...s, [id]: null }))
    }
  }

  function renderCell(row, key) {
    if (key === "estado") return <StatusBadge estado={row.estado} />
    if (key === "total_discrepancia") {
      const v = row.total_discrepancia
      return v > 0.1
        ? <span className="text-yellow-600 font-medium">{v}</span>
        : <span className="text-green-600">OK</span>
    }
    if (key === "_acciones") {
      const busy = actionLoading[row.id]
      return (
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
            disabled={!!busy}
            onClick={() => handleReprocesar(row.id)}
          >
            {busy === "reprocesando" ? "..." : "↺ Reprocesar"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2 text-red-600 hover:bg-red-50 border-red-200"
            disabled={!!busy}
            onClick={() => handleEliminar(row.id)}
          >
            {busy === "eliminando" ? "..." : "Eliminar"}
          </Button>
        </div>
      )
    }
    return row[key] ?? "—"
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Facturas ({total})</CardTitle>
        <Button size="sm" variant="outline" onClick={fetchData}>Actualizar</Button>
      </CardHeader>
      <CardContent>
        <DataTable
          headers={HEADERS}
          rows={facturas}
          renderCell={renderCell}
          isLoading={loading}
          error={error}
        />
      </CardContent>
    </Card>
  )
}
