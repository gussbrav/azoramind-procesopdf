import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
]

function renderCell(row, key) {
  if (key === "estado") return <StatusBadge estado={row.estado} />
  if (key === "total_discrepancia") {
    const v = row.total_discrepancia
    return v > 0.1
      ? <span className="text-yellow-600 font-medium">{v}</span>
      : <span className="text-green-600">OK</span>
  }
  return row[key] ?? "—"
}

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
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
    }
    fetchData()
  }, [page])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas ({total})</CardTitle>
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
