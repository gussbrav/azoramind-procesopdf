import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import LoadingSpinner from "@/components/shared/LoadingSpinner"
import api from "@/lib/api"

export default function UploadFactura() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null)
    setResult(null)
    setError(null)
  }

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
      // Limpiar el input para permitir subir otro archivo
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
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
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full text-sm cursor-pointer"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Archivo seleccionado: <span className="font-medium">{file.name}</span>
                {" "}({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Procesando...
              </span>
            ) : "Procesar Factura"}
          </Button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded p-4 text-sm space-y-1">
              <p className="font-semibold text-green-800 text-base">
                {result.duplicado ? "⚠ Factura ya procesada anteriormente" : "✓ Factura recibida y en proceso"}
              </p>
              <p className="text-green-700">
                ID asignado: <span className="font-mono font-bold">#{result.factura_id}</span>
              </p>
              {result.numero_factura && (
                <p className="text-green-700">Número: {result.numero_factura}</p>
              )}
              <p className="text-green-600 text-xs mt-2">
                El procesamiento OCR e IA continúa en segundo plano. Revisa el estado en la sección Facturas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
