import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, XCircle, Loader, Trash2, Workflow, FolderOpen, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const MAX_SIZE_MB = 50

function getMaxPdfs() {
  const stored = localStorage.getItem('max_pdfs_upload')
  const val = parseInt(stored, 10)
  return isNaN(val) || val < 1 ? 5 : val
}

// Estado por archivo: idle | uploading | ok | error
function fileEntry(file) {
  return { file, estado: 'idle', error: null }
}

function FileRow({ entry, onRemove, uploading }) {
  const { file, estado, error } = entry
  const sizeMB = (file.size / 1024 / 1024).toFixed(2)

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-gray-50/60">
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        {estado === 'idle' && <FileText size={18} className="text-gray-400" />}
        {estado === 'uploading' && <Loader size={16} className="animate-spin text-blue-500" />}
        {estado === 'ok' && <CheckCircle size={18} className="text-green-500" />}
        {estado === 'error' && <XCircle size={18} className="text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <p className={cn('text-xs', estado === 'error' ? 'text-red-500' : 'text-gray-400')}>
          {estado === 'error' ? error : `${sizeMB} MB`}
        </p>
      </div>
      {(estado === 'idle' || estado === 'error') && !uploading && (
        <button
          type="button"
          onClick={() => onRemove(file.name)}
          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      )}
      {estado === 'ok' && (
        <span className="text-xs font-semibold text-green-700 shrink-0">Subido</span>
      )}
    </div>
  )
}

export default function SubirPDF() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState([])
  const [observaciones, setObservaciones] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [globalError, setGlobalError] = useState(null)
  const [dupDialog, setDupDialog] = useState(null) // { fileName, detail }
  const fileInputRef = useRef(null)

  const maxPdfs = getMaxPdfs()

  const resetForm = () => {
    setEntries([])
    setObservaciones('')
    setUploading(false)
    setDone(false)
    setGlobalError(null)
    setDupDialog(null)
  }

  const addFiles = (fileList) => {
    setGlobalError(null)
    setDone(false)
    const incoming = Array.from(fileList)

    const valid = []
    const errors = []

    for (const file of incoming) {
      if (file.type !== 'application/pdf') {
        errors.push(`"${file.name}" no es un PDF.`)
        continue
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        errors.push(`"${file.name}" supera ${MAX_SIZE_MB} MB.`)
        continue
      }
      valid.push(file)
    }

    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name))
      const toAdd = valid.filter((f) => !existing.has(f.name)).map(fileEntry)
      const combined = [...prev, ...toAdd]
      const limited = combined.slice(0, maxPdfs)
      if (combined.length > maxPdfs) {
        errors.push(`Solo se pueden subir hasta ${maxPdfs} archivos a la vez.`)
      }
      if (errors.length > 0) setGlobalError(errors.join(' '))
      return limited
    })
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    addFiles(e.dataTransfer.files)
  }, [maxPdfs])

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = () => setIsDragOver(false)

  const removeFile = (name) => {
    setEntries((prev) => prev.filter((e) => e.file.name !== name))
  }

  const updateEntry = (name, patch) => {
    setEntries((prev) => prev.map((e) => e.file.name === name ? { ...e, ...patch } : e))
  }

  const uploadSingleFile = async (entry, forceUpload = false) => {
    const name = entry.file.name
    const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'
    updateEntry(name, { estado: 'uploading', error: null })

    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 1500))
      } else {
        const formData = new FormData()
        formData.append('file', entry.file)
        if (observaciones) formData.append('observaciones', observaciones)
        if (forceUpload) formData.append('force', 'true')
        await api.post('/api/documentos/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      updateEntry(name, { estado: 'ok' })
      return 'ok'
    } catch (err) {
      const resp = err.response
      if (resp?.status === 409 && resp?.data?.detail?.type === 'duplicate') {
        updateEntry(name, { estado: 'idle', error: null })
        return { duplicate: true, detail: resp.data.detail }
      }
      const msg = resp?.data?.detail || 'Error al subir el archivo.'
      updateEntry(name, { estado: 'error', error: typeof msg === 'string' ? msg : msg.message || 'Error' })
      return 'error'
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (entries.length === 0) {
      setGlobalError('Selecciona al menos un PDF.')
      return
    }

    setUploading(true)
    setGlobalError(null)

    for (const entry of entries) {
      if (entry.estado === 'ok') continue
      const result = await uploadSingleFile(entry)

      if (result && typeof result === 'object' && result.duplicate) {
        // Pausar y mostrar diálogo de duplicado
        setUploading(false)
        setDupDialog({ fileName: entry.file.name, detail: result.detail })
        return
      }
    }

    setUploading(false)
    setDone(true)
  }

  const handleDupConfirm = async () => {
    if (!dupDialog) return
    const name = dupDialog.fileName
    setDupDialog(null)
    setUploading(true)

    const entry = entries.find((e) => e.file.name === name)
    if (entry) {
      await uploadSingleFile(entry, true)
    }

    // Continuar con los archivos restantes
    for (const e of entries) {
      if (e.file.name === name || e.estado === 'ok') continue
      const result = await uploadSingleFile(e)
      if (result && typeof result === 'object' && result.duplicate) {
        setUploading(false)
        setDupDialog({ fileName: e.file.name, detail: result.detail })
        return
      }
    }

    setUploading(false)
    setDone(true)
  }

  const handleDupSkip = () => {
    if (!dupDialog) return
    const name = dupDialog.fileName
    updateEntry(name, { estado: 'error', error: 'Omitido (duplicado)' })
    setDupDialog(null)

    // Continuar con los restantes
    const remaining = entries.filter((e) => e.file.name !== name && e.estado !== 'ok' && e.estado !== 'error')
    if (remaining.length > 0) {
      // Re-trigger submit for remaining
      setUploading(true)
      ;(async () => {
        for (const e of remaining) {
          const result = await uploadSingleFile(e)
          if (result && typeof result === 'object' && result.duplicate) {
            setUploading(false)
            setDupDialog({ fileName: e.file.name, detail: result.detail })
            return
          }
        }
        setUploading(false)
        setDone(true)
      })()
    } else {
      setDone(true)
    }
  }

  const pendingCount = entries.filter((e) => e.estado !== 'ok').length
  const okCount = entries.filter((e) => e.estado === 'ok').length
  const allOk = entries.length > 0 && entries.every((e) => e.estado === 'ok')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subir Documentos PDF</h1>
        <p className="text-gray-500 text-sm mt-1">
          Puedes subir hasta <strong>{maxPdfs} archivos</strong> a la vez. El sistema procesará cada uno con IA.
        </p>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Seleccionar Archivos</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Zona de drop */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer',
                isDragOver
                  ? 'border-blue-500 bg-blue-50'
                  : entries.length > 0
                  ? 'border-blue-300 bg-blue-50/30 hover:border-blue-400'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30',
                uploading && 'pointer-events-none opacity-60'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
                disabled={uploading}
              />
              <div className="flex flex-col items-center gap-3">
                <Upload size={32} className={entries.length > 0 ? 'text-blue-400' : 'text-gray-400'} />
                <div>
                  <p className="text-gray-600 font-medium">
                    {entries.length > 0
                      ? `${entries.length} archivo${entries.length !== 1 ? 's' : ''} seleccionado${entries.length !== 1 ? 's' : ''} — Click para agregar más`
                      : 'Arrastra tus PDFs aquí o haz click para seleccionar'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    PDF únicamente · Máximo {MAX_SIZE_MB} MB por archivo · Hasta {maxPdfs} archivos
                  </p>
                </div>
              </div>
            </div>

            {/* Error global */}
            {globalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm flex items-start gap-2">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                {globalError}
              </div>
            )}

            {/* Lista de archivos */}
            {entries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {entries.length} archivo{entries.length !== 1 ? 's' : ''} en cola
                  </p>
                  {!uploading && !allOk && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-gray-400 hover:text-red-500 underline"
                    >
                      Limpiar todo
                    </button>
                  )}
                </div>
                {entries.map((entry) => (
                  <FileRow
                    key={entry.file.name}
                    entry={entry}
                    onRemove={removeFile}
                    uploading={uploading}
                  />
                ))}
              </div>
            )}

            {/* Observaciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Observaciones <span className="text-gray-400 font-normal">(opcional, aplica a todos)</span>
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales sobre estos documentos..."
                rows={2}
                disabled={uploading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
              />
            </div>

            {/* Diálogo de duplicado */}
            {dupDialog && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-amber-900">Documento duplicado detectado</p>
                    <p className="text-sm text-amber-800 mt-1">
                      {dupDialog.detail.match_type === 'contenido_identico'
                        ? 'Ya existe un documento con el mismo contenido en el sistema.'
                        : 'Ya existe un documento con el mismo nombre de archivo.'}
                    </p>
                    <div className="mt-2 text-xs text-amber-700 space-y-0.5">
                      <p><strong>Archivo:</strong> {dupDialog.detail.existing?.nombre_archivo}</p>
                      {dupDialog.detail.existing?.numero_expediente && (
                        <p><strong>Expediente:</strong> {dupDialog.detail.existing.numero_expediente}</p>
                      )}
                      <p><strong>Estado:</strong> {dupDialog.detail.existing?.estado}</p>
                      {dupDialog.detail.existing?.fecha_subida && (
                        <p><strong>Subido:</strong> {new Date(dupDialog.detail.existing.fecha_subida).toLocaleString('es-PE')}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDupSkip}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Omitir
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDupConfirm}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Reprocesar
                  </Button>
                </div>
              </div>
            )}

            {/* Resultado exitoso */}
            {done && allOk && (
              <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle size={20} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">
                    {okCount} documento{okCount !== 1 ? 's' : ''} enviado{okCount !== 1 ? 's' : ''} a procesar
                  </p>
                  <p className="text-xs text-purple-700 mt-0.5">
                    Procesando en background: OCR → IA → Calendario.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs text-purple-700 underline hover:text-purple-900"
                    >
                      Subir más documentos
                    </button>
                    <Button
                      type="button"
                      onClick={() => navigate('/expedientes')}
                      variant="outline"
                      size="sm"
                      className="border-purple-300 text-purple-700 hover:bg-purple-100 hover:text-purple-900 gap-1.5"
                    >
                      <FolderOpen size={14} />
                      Ver estado en Expedientes
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Botón de envío */}
            {!allOk && (
              <Button
                type="submit"
                disabled={entries.length === 0 || uploading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {uploading ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Enviando {okCount + 1} de {entries.length}...
                  </>
                ) : (
                  <>
                    <Workflow size={16} />
                    {entries.length > 1
                      ? `Procesar ${entries.length} documentos`
                      : 'Procesar'}
                  </>
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="border-purple-100 bg-purple-50/40">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-purple-900 mb-2">¿Qué ocurre al subir los archivos?</p>
          <ol className="space-y-1.5 text-sm text-purple-800">
            <li className="flex gap-2"><span className="font-bold shrink-0">1.</span> OCR extrae el texto del PDF</li>
            <li className="flex gap-2"><span className="font-bold shrink-0">2.</span> Extracción automática de expediente, fechas, juzgado y partes</li>
            <li className="flex gap-2"><span className="font-bold shrink-0">3.</span> IA interpreta la resolución, plazos y advertencias legales</li>
            <li className="flex gap-2"><span className="font-bold shrink-0">4.</span> Cálculo de vencimiento con días hábiles peruanos</li>
            <li className="flex gap-2"><span className="font-bold shrink-0">5.</span> Audiencias y plazos registrados en el calendario interno</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
