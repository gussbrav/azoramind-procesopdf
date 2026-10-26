import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases CSS con soporte para Tailwind — elimina conflictos de clases.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea una fecha ISO a formato legible en español peruano (DD/MM/YYYY).
 * IMPORTANTE: No usar new Date("YYYY-MM-DD") porque JavaScript lo interpreta
 * como UTC midnight, que en Perú (UTC-5) se convierte al día anterior.
 * Usa parsing manual de strings para evitar problemas de timezone.
 */
export function formatDate(dateString) {
  if (!dateString) return null
  try {
    const s = String(dateString).trim()
    // Formato YYYY-MM-DD (de la API/DB) → DD/MM/YYYY
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
    }
    // Formato DD/MM/YYYY ya listo
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
    // Fallback: intentar con Date pero añadir T12:00 para evitar timezone shift
    const date = new Date(s.length === 10 ? s + 'T12:00:00' : s)
    if (isNaN(date.getTime())) return null
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const yyyy = date.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return null
  }
}

/**
 * Formatea un string ISO "YYYY-MM-DDTHH:MM" a "DD/MM/YYYY HH:MM".
 * Si no incluye hora, delega a formatDate para retornar solo la fecha.
 */
export function formatDateTime(dateString) {
  if (!dateString) return null
  try {
    const s = String(dateString).trim()
    // Formato con hora: "YYYY-MM-DDTHH:MM" o "YYYY-MM-DD HH:MM"
    const dtMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
    if (dtMatch) {
      return `${dtMatch[3]}/${dtMatch[2]}/${dtMatch[1]} ${dtMatch[4]}:${dtMatch[5]}`
    }
    return formatDate(s)
  } catch {
    return null
  }
}

/**
 * Retorna las clases de color del badge según el estado del documento.
 * pendiente=amarillo, procesado=verde, error=rojo
 */
export function getStatusColor(estado) {
  switch (estado?.toLowerCase()) {
    case 'procesado':
      return 'bg-green-100 text-green-800 border border-green-200'
    case 'pendiente':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200'
    case 'error':
      return 'bg-red-100 text-red-800 border border-red-200'
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}
