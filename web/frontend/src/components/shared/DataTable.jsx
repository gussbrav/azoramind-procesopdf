import { ChevronLeft, ChevronRight, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LoadingSpinner from './LoadingSpinner'
import EmptyState from './EmptyState'

/**
 * Tabla reutilizable con estados de carga, vacío y paginación integrada.
 * headers: array de { key, label, className? }
 * rows: array de objetos con los datos
 * renderCell: función (row, key) => ReactNode — para renderizado personalizado
 */
export default function DataTable({
  headers,
  rows,
  renderCell,
  isLoading,
  error,
  emptyTitle = 'No hay datos',
  emptyDescription = '',
  emptyIcon = Table,
  pagination,
  onPageChange,
  onRowClick,
  rowClassName,
}) {
  return (
    <div>
      {/* Estado de carga */}
      {isLoading && <LoadingSpinner />}

      {/* Estado de error */}
      {!isLoading && error && (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Tabla con datos */}
      {!isLoading && !error && rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {headers.map((h) => (
                  <th
                    key={h.key}
                    className={`text-left px-4 py-3 font-semibold text-gray-600 ${h.className || ''}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id || index}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`border-b border-gray-50 transition-colors
                    ${onRowClick ? 'cursor-pointer hover:bg-blue-50/60' : 'hover:bg-gray-50'}
                    ${index % 2 !== 0 ? 'bg-gray-50/40' : ''}
                    ${rowClassName ? rowClassName(row) : ''}`}
                >
                  {headers.map((h) => (
                    <td key={h.key} className={`px-4 py-3 ${h.tdClassName || ''}`}>
                      {renderCell ? renderCell(row, h.key) : (row[h.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && !error && (!rows || rows.length === 0) && (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      )}

      {/* Paginación */}
      {!isLoading && !error && pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Página {pagination.page} de {pagination.total_pages}
            <span className="ml-2 text-gray-400">({pagination.total} registros)</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.has_prev}
              className="gap-1"
            >
              <ChevronLeft size={14} />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.has_next}
              className="gap-1"
            >
              Siguiente
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
