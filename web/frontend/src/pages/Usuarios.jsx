import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Plus, Trash2, Shield, Briefcase, UserCheck, Mail, Copy, Check, X, Clock, Send, MoreVertical, RefreshCw, Link2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogHeader, DialogContent } from '@/components/ui/dialog'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import api from '@/lib/api'
import useAuthStore from '@/store/authStore'

const ROLES = [
  { value: 'admin', label: 'Administrador', icon: Shield },
  { value: 'abogado', label: 'Abogado', icon: Briefcase },
  { value: 'asistente', label: 'Asistente', icon: UserCheck },
]

function RoleBadge({ role }) {
  const r = ROLES.find((x) => x.value === role) || ROLES[1]
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 bg-white text-gray-600">
      {r.label}
    </span>
  )
}

/** Dropdown menu de tres puntos — usa fixed positioning para evitar overflow clip */
function ActionMenu({ items }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    const handleScroll = () => setOpen(false)
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    return () => { document.removeEventListener('mousedown', handleClick); window.removeEventListener('scroll', handleScroll, true) }
  }, [open])

  const toggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.right - 264 })
    }
    setOpen(!open)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5"
          style={{ top: pos.top, left: Math.max(8, pos.left), zIndex: 9999 }}
        >
          {items.map((item, i) => (
            item.separator ? (
              <div key={i} className="border-t border-gray-100 my-1.5" />
            ) : (
              <button
                key={i}
                onClick={() => { setOpen(false); item.onClick() }}
                disabled={item.disabled}
                className={`w-full text-left px-4 py-2 text-[13px] flex items-center gap-3 transition-colors
                  ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'}
                  ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {item.icon && <item.icon size={15} className={item.danger ? 'text-red-400' : 'text-gray-400'} />}
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </>
  )
}

export default function Usuarios() {
  const { user } = useAuthStore()
  const [users, setUsers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [search, setSearch] = useState('')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  // Create user form
  const [form, setForm] = useState({ username: '', password: '', role: 'abogado', nombre_completo: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('abogado')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Toast
  const [toast, setToast] = useState(null)
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const fetchUsers = useCallback(async (silent = false) => {
    if (!silent) { setIsLoading(true); setError(null) }
    try {
      const [usersRes, invRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/auth/invitations').catch(() => ({ data: [] })),
      ])
      setUsers(usersRes.data)
      setInvitations(invRes.data)
    } catch (err) {
      if (!silent) setError(err.response?.data?.detail || 'Error al cargar usuarios')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  useEffect(() => {
    const interval = setInterval(() => fetchUsers(true), 15000)
    return () => clearInterval(interval)
  }, [fetchUsers])

  const resetCreateForm = () => {
    setForm({ username: '', password: '', role: 'abogado', nombre_completo: '' })
    setFormError('')
  }

  const resetInviteForm = () => {
    setInviteEmail('')
    setInviteRole('abogado')
    setInviteError('')
    setInviteSuccess(null)
    setCopiedUrl(false)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.username.trim() || form.username.length < 3) {
      setFormError('El usuario debe tener al menos 3 caracteres'); return
    }
    if (!form.password || form.password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres'); return
    }
    setFormLoading(true)
    try {
      await api.post('/auth/register', form)
      resetCreateForm()
      setShowCreateModal(false)
      fetchUsers()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Error al crear usuario')
    } finally {
      setFormLoading(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess(null)
    if (!inviteEmail.includes('@')) {
      setInviteError('Ingresa un email válido'); return
    }
    setInviteLoading(true)
    try {
      const res = await api.post('/auth/invite', { email: inviteEmail, role: inviteRole })
      setInviteSuccess(res.data)
      setInviteEmail('')
      fetchUsers()
    } catch (err) {
      setInviteError(err.response?.data?.detail || 'Error al enviar invitación')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.username}"?`)) return
    setDeletingId(u.id)
    try {
      await api.delete(`/auth/users/${u.id}`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar usuario')
    } finally {
      setDeletingId(null)
    }
  }

  const handleResendInvite = async (email, role) => {
    try {
      await api.post('/auth/invite', { email, role })
      showToast(`Invitación reenviada a ${email}`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al reenviar invitación')
    }
  }

  const handleCancelInvite = async (inv) => {
    if (!window.confirm(`¿Cancelar invitación a "${inv.email}"?`)) return
    try {
      await api.delete(`/auth/invitations/${inv.id}`)
      fetchUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al cancelar invitación')
    }
  }

  const copyToClipboard = (text, msg) => {
    navigator.clipboard.writeText(text)
    if (msg) showToast(msg)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const buildInviteUrl = (token) => `${window.location.origin}/invite?token=${token}`

  if (user?.role !== 'admin') {
    return <div className="p-8 text-center text-gray-500">No tienes permisos para acceder a esta sección.</div>
  }

  // Filtrar por búsqueda
  const filteredUsers = users.filter(u =>
    !search || u.username.toLowerCase().includes(search.toLowerCase()) || (u.nombre_completo || '').toLowerCase().includes(search.toLowerCase())
  )

  const pendingInvites = invitations.filter(i => !i.accepted_at && new Date(i.expires_at) > new Date())

  return (
    <div className="space-y-0 max-w-4xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <Check size={14} />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <Users size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Gestión de usuarios</h1>
            <p className="text-gray-400 text-xs">{users.length} miembros{pendingInvites.length > 0 && ` · ${pendingInvites.length} pendientes`}</p>
          </div>
        </div>
        <Button onClick={() => { resetInviteForm(); setShowInviteModal(true) }} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm">
          <Plus size={15} />
          Invitar a un usuario
        </Button>
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar miembros"
            value={search || ''}
            onChange={(e) => setSearch(e.target.value || '')}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => fetchUsers()}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Users table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="py-12"><LoadingSpinner message="Cargando usuarios..." /></div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-4 text-sm">{error}</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Usuarios</th>
                <th className="text-center px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-44">Acceder</th>
                <th className="text-center px-3 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-blue-600 font-semibold text-xs">
                          {(u.nombre_completo || u.username).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.username}</p>
                        {u.nombre_completo && (
                          <p className="text-xs text-gray-400 truncate">{u.nombre_completo}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    {u.username !== user?.username ? (
                      <ActionMenu items={[
                        { icon: Mail, label: 'Reenviar la invitación al correo electrónico', onClick: () => handleResendInvite(u.username, u.role) },
                        { icon: Copy, label: 'Copiar URL de invitación', onClick: () => {
                          const inv = invitations.find(i => i.email === u.username && !i.accepted_at)
                          if (inv?.token) copyToClipboard(buildInviteUrl(inv.token), 'URL de invitación copiada')
                          else showToast('No hay invitación pendiente para este usuario')
                        }},
                        { separator: true },
                        { icon: Trash2, label: 'Eliminar Usuario', onClick: () => handleDelete(u), danger: true, disabled: deletingId === u.id },
                      ]} />
                    ) : null}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-gray-400 text-sm">
                    {search ? 'No se encontraron miembros.' : 'No hay usuarios registrados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Invitations section (pendientes) */}
      {pendingInvites.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white mt-5">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-medium text-gray-600 text-sm">Invitaciones pendientes</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {pendingInvites.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Clock size={14} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-700">{inv.email}</p>
                        <p className="text-xs text-gray-400">Invitado por {inv.invited_by}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <RoleBadge role={inv.role} />
                  </td>
                  <td className="px-3 py-3 text-center w-20">
                    <ActionMenu items={[
                      { icon: RefreshCw, label: 'Reenviar la invitación al correo electrónico', onClick: () => handleResendInvite(inv.email, inv.role) },
                      { icon: Copy, label: 'Copiar URL de invitación', onClick: () => copyToClipboard(buildInviteUrl(inv.token), 'URL de invitación copiada') },
                      { separator: true },
                      { icon: Trash2, label: 'Cancelar invitación', onClick: () => handleCancelInvite(inv), danger: true },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Modal: Invitar por Email ===== */}
      <Dialog open={showInviteModal} onClose={() => setShowInviteModal(false)}>
        <DialogHeader onClose={() => setShowInviteModal(false)}>
          Invitar a un usuario
        </DialogHeader>
        <DialogContent>
          {!inviteSuccess ? (
            <form onSubmit={handleInvite} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Correo electrónico:</Label>
                  <Input
                    type="email"
                    placeholder="Correo electrónico"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviteLoading}
                    autoFocus
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Seleccione el rol de usuario</Label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    disabled={inviteLoading}
                    className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {inviteError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{inviteError}</div>}

              <div className="flex justify-end">
                <Button type="submit" disabled={inviteLoading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6">
                  <Send size={14} />
                  {inviteLoading ? 'Enviando...' : 'Invitar'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {inviteSuccess.email_sent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <Check size={20} className="text-green-600 mx-auto mb-2" />
                  <p className="text-sm text-green-800 font-medium">{inviteSuccess.message}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Link2 size={14} />
                    Copiar URL de invitación
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                    <Check size={18} className="text-green-600 shrink-0" />
                    <code className="text-xs text-green-800 flex-1 break-all leading-relaxed">{inviteSuccess.invite_url}</code>
                    <button
                      onClick={() => copyToClipboard(inviteSuccess.invite_url, 'URL copiada al portapapeles')}
                      className="p-2 rounded-md hover:bg-green-100 text-green-600 shrink-0 transition-colors"
                    >
                      {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Copia el link de invitación y envíalo a <strong>{inviteSuccess.invite_email || 'el usuario'}</strong>.
                  </p>
                </>
              )}

              <div className="flex justify-end pt-1">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => resetInviteForm()}>
                  <Send size={14} />
                  Invitar más
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Modal: Crear Usuario ===== */}
      <Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <DialogHeader onClose={() => setShowCreateModal(false)}>
          Crear usuario
        </DialogHeader>
        <DialogContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Nombre completo</Label>
                <Input placeholder="Ej: Carlos Pérez" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} disabled={formLoading} autoFocus className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Correo electrónico</Label>
                <Input type="email" placeholder="correo@ejemplo.com" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} disabled={formLoading} autoComplete="off" className="h-10" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Contraseña</Label>
                <Input type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={formLoading} autoComplete="new-password" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Rol de usuario</Label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  disabled={formLoading}
                  className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{formError}</div>}
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={formLoading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6">
                <Plus size={14} />
                {formLoading ? 'Creando...' : 'Crear Usuario'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
