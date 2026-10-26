import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Spinner de carga centrado para estados de carga de página o sección.
 */
export default function LoadingSpinner({ message = 'Cargando...', className }) {
  return (
    <div className={cn('flex items-center justify-center py-16 text-gray-400', className)}>
      <RefreshCw size={20} className="animate-spin mr-2 text-blue-500" />
      <span>{message}</span>
    </div>
  )
}
