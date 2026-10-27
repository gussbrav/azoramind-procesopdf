import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import api from "@/lib/api"

export default function UploadFactura() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const { data } = await api.post("/api/facturas/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || "Error al subir la factura")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Subir Factura PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm"
          />

          <Button onClick={handleUpload} disabled={!file || loading} className="w-full">
            {loading ? <LoadingSpinner size="sm" /> : "Procesar Factura"}
          </Button>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
              <p className="font-medium text-green-800">
                {result.duplicado ? "Factura ya procesada anteriormente" : "Factura recibida y en proceso"}
              </p>
              <p className="text-green-700">ID: {result.factura_id}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
