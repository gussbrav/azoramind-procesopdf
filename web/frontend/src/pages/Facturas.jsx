import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import StatusBadge from "@/components/shared/StatusBadge"
import DataTable from "@/components/shared/DataTable"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import api from "@/lib/api"

const COLUMNS = [
  { key: "id", label: "ID", width: "w-12" },
  { key: "numero_factura", label: "N° Factura" },
  { key: "proveedor_razon_social", label: "Proveedor" },
  { key: "fecha_emision", label: "Fecha" },
  { key: "moneda", label: "Mon." },
  { key: "total_declarado", label: "Total", render: (v) => v ? `${v}` : "—" },
  { key: "total_discrepancia", label: "Discrepancia", render: (v) => v > 0.1 ? <span className="text-yellow-600 font-medium">{v}</span> : <span className="text-green-600">OK</span> },
  { key: "estado", label: "Estado", render: (v) => <StatusBadge status={v} /> },
]

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
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <p className="text-red-600 text-sm py-4">{error}</p>
        ) : (
          <DataTable columns={COLUMNS} rows={facturas} />
        )}
      </CardContent>
    </Card>
  )
}
