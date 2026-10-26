import { cn } from '@/lib/utils'

/**
 * Badge semántico de estado para documentos y expedientes.
 * Colores: procesado=verde, pendiente=amarillo, error=rojo, activo=azul.
 */
const VARIANT_CLASSES = {
  procesado:  'bg-green-100 text-green-800 border border-green-200',
  completado: 'bg-green-100 text-green-800 border border-green-200',
  pendiente:  'bg-yellow-100 text-yellow-800 border border-yellow-200',
  error:      'bg-red-100 text-red-800 border border-red-200',
  activo:     'bg-blue-100 text-blue-800 border border-blue-200',
  enviado:    'bg-green-100 text-green-800 border border-green-200',
  programada: 'bg-blue-100 text-blue-800 border border-blue-200',
  realizada:  'bg-gray-100 text-gray-600 border border-gray-200',
  vencido:    'bg-red-100 text-red-800 border border-red-200',
}

const LABEL_MAP = {
  procesado:  'Procesado',
  completado: 'Completado',
  pendiente:  'Pendiente',
  error:      'Error',
  activo:     'Activo',
  enviado:    'Enviado',
  programada: 'Programada',
  realizada:  'Realizada',
  vencido:    'Vencido',
}

export default function StatusBadge({ estado, className }) {
  const key = estado?.toLowerCase()
  const classes = VARIANT_CLASSES[key] || 'bg-gray-100 text-gray-600 border border-gray-200'
  const label = LABEL_MAP[key] || estado || 'Desconocido'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        classes,
        className
      )}
    >
      {label}
    </span>
  )
}
