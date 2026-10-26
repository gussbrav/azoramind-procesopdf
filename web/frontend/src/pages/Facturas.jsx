import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { DataTable } from "@/components/shared/DataTable"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
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
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const { data } = await api.get("/api/facturas", { params: { page, limit: 20 } })
        setFacturas(data.data)
        setTotal(data.total)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [page])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Facturas ({total})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <DataTable columns={COLUMNS} rows={facturas} />
        )}
      </CardContent>
    </Card>
  )
}
