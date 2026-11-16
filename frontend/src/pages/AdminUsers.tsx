import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutline from '@mui/icons-material/Delete'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'

type Role = 'admin' | 'user'
type Row = { id: number; name: string; email: string; role: Role; is_active: boolean; created_at: string }
type FormState = { name: string; email: string; password: string; role: Role; is_active: boolean }

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Row | 'new' | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await api<Row[]>('/admin/users'))
      setError(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(row: Row) {
    if (!window.confirm(`Delete ${row.email}? This cannot be undone.`)) return
    try {
      await api(`/admin/users/${row.id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Delete failed.')
    }
  }

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Users
        </Typography>
        <Button variant="contained" onClick={() => setEditing('new')} sx={{ minHeight: 44 }}>
          Add user
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>
                  <Chip size="small" label={r.role} color={r.role === 'admin' ? 'primary' : 'default'} />
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={r.is_active ? 'Active' : 'Inactive'} />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <IconButton aria-label={`Edit ${r.email}`} onClick={() => setEditing(r)}>
                    <EditOutlined />
                  </IconButton>
                  <IconButton aria-label={`Delete ${r.email}`} onClick={() => void remove(r)}>
                    <DeleteOutline />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary">No users.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {editing && (
        <UserDialog
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
    </>
  )
}

function UserDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Row | 'new'
  onClose: () => void
  onSaved: () => void
}) {
  const { user: me } = useAuth()
  const existing = target === 'new' ? null : target
  const isSelf = existing !== null && existing.id === me?.id

  const [form, setForm] = useState<FormState>(
    existing
      ? { name: existing.name, email: existing.email, password: '', role: existing.role, is_active: existing.is_active }
      : { name: '', email: '', password: '', role: 'user', is_active: true },
  )
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  async function save() {
    setBusy(true)
    setErrors({})
    setFormError(null)
    try {
      if (existing) {
        const body: Partial<FormState> = {
          name: form.name,
          email: form.email,
          role: form.role,
          is_active: form.is_active,
        }
        if (form.password) body.password = form.password
        await api(`/admin/users/${existing.id}`, { method: 'PUT', body })
      } else {
        await api('/admin/users', {
          method: 'POST',
          body: { name: form.name, email: form.email, password: form.password, role: form.role },
        })
      }
      onSaved()
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.errors)
        setFormError(Object.keys(e.errors).length ? null : e.message)
      } else {
        setFormError('Cannot reach the server.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{existing ? 'Edit user' : 'Add user'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name?.[0]}
            fullWidth
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            error={!!errors.email}
            helperText={errors.email?.[0]}
            fullWidth
          />
          <TextField
            label={existing ? 'New password (leave empty to keep)' : 'Password (min 10 characters)'}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            error={!!errors.password}
            helperText={errors.password?.[0]}
            fullWidth
          />
          <TextField
            select
            label="Role"
            value={form.role}
            onChange={(e) => set('role', e.target.value as Role)}
            disabled={isSelf}
            helperText={isSelf ? 'You cannot change your own role.' : errors.role?.[0]}
            error={!!errors.role}
            fullWidth
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          {existing && (
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => set('is_active', e.target.checked)}
                    disabled={isSelf}
                  />
                }
                label="Active"
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
