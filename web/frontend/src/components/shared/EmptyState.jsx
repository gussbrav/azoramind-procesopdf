import { cn } from '@/lib/utils'

/**
 * Estado vacío reutilizable con ícono, título y descripción.
 * Se usa cuando una tabla o lista no tiene datos que mostrar.
 */
export default function EmptyState({ icon: Icon, title, description, className, children }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-gray-400', className)}>
      {Icon && <Icon size={40} className="mb-3 opacity-30" />}
      {title && <p className="font-medium text-gray-500">{title}</p>}
      {description && <p className="text-sm mt-1 text-center max-w-xs">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
