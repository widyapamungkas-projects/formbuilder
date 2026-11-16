import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import NewFormWizard from './NewFormWizard'

type Status = 'draft' | 'published' | 'archived'
type Filter = 'all' | Status
type FormRow = {
  id: number
  name: string
  description: string | null
  status: Status
  storage_type: string
  storage_folder: string | null
  owner: string | null
  updated_at: string
}

const STORAGE_LABEL: Record<string, string> = { default: 'Server default', nextcloud: 'Nextcloud', s3: 'S3 bucket' }

export default function Dashboard() {
  const { user } = useAuth()
  const [rows, setRows] = useState<FormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [reload, setReload] = useState(0)
  const [dialog, setDialog] = useState<FormRow | 'new' | null>(null)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: FormRow } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (filter !== 'all') params.set('status', filter)
    const qs = params.toString()
    api<FormRow[]>(`/forms${qs ? `?${qs}` : ''}`)
      .then((data) => {
        if (cancelled) return
        setRows(data)
        setError(null)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load forms.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, filter, reload])

  const refresh = () => setReload((n) => n + 1)

  async function setStatus(row: FormRow, status: Status) {
    try {
      await api(`/forms/${row.id}`, { method: 'PUT', body: { status } })
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Update failed.')
    }
  }

  async function remove(row: FormRow) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    try {
      await api(`/forms/${row.id}`, { method: 'DELETE' })
      refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Delete failed.')
    }
  }

  const isAdmin = user?.role === 'admin'

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Forms
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog('new')} sx={{ minHeight: 44 }}>
          New form
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3, alignItems: { md: 'center' } }}>
        <TextField
          label="Search forms"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          sx={{ width: { xs: '100%', md: 320 }, bgcolor: 'background.paper' }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, v: Filter | null) => v && setFilter(v)}
          aria-label="Filter by status"
        >
          <ToggleButton value="all" sx={{ minHeight: 40 }}>
            All
          </ToggleButton>
          <ToggleButton value="published" sx={{ minHeight: 40 }}>
            Published
          </ToggleButton>
          <ToggleButton value="draft" sx={{ minHeight: 40 }}>
            Draft
          </ToggleButton>
          <ToggleButton value="archived" sx={{ minHeight: 40 }}>
            Archived
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && rows.length === 0 && !error && (
        <Card>
          <CardContent>
            <Typography color="text.secondary">
              {search || filter !== 'all'
                ? 'No forms match your search.'
                : 'No forms yet. Click "New form" to create one.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Chip
                  size="small"
                  label={r.status}
                  color={r.status === 'published' ? 'primary' : 'default'}
                  variant={r.status === 'archived' ? 'outlined' : 'filled'}
                />
                <IconButton aria-label={`Actions for ${r.name}`} onClick={(e) => setMenu({ anchor: e.currentTarget, row: r })}>
                  <MoreVertIcon />
                </IconButton>
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                {r.name}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  minHeight: 40,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {r.description || 'No description'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Files: {STORAGE_LABEL[r.storage_type] ?? r.storage_type}
                {r.storage_folder ? ` · ${r.storage_folder}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated {new Date(r.updated_at).toLocaleDateString()}
                {isAdmin ? ` · ${r.owner ?? 'Unknown owner'}` : ''}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Menu anchorEl={menu?.anchor ?? null} open={menu !== null} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) setDialog(menu.row)
            setMenu(null)
          }}
        >
          Edit details
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) void setStatus(menu.row, menu.row.status === 'archived' ? 'draft' : 'archived')
            setMenu(null)
          }}
        >
          {menu?.row.status === 'archived' ? 'Restore' : 'Archive'}
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            if (menu) void remove(menu.row)
            setMenu(null)
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      {dialog === 'new' && (
        <NewFormWizard
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null)
            refresh()
          }}
        />
      )}

      {dialog && dialog !== 'new' && (
        <FormDialog
          target={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            refresh()
          }}
        />
      )}
    </>
  )
}

function FormDialog({
  target,
  onClose,
  onSaved,
}: {
  target: FormRow | 'new'
  onClose: () => void
  onSaved: () => void
}) {
  const existing = target === 'new' ? null : target
  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setErrors({})
    setFormError(null)
    try {
      const body = { name, description: description || null }
      if (existing) await api(`/forms/${existing.id}`, { method: 'PUT', body })
      else await api('/forms', { method: 'POST', body })
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
      <DialogTitle>{existing ? 'Edit form details' : 'New form'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Form name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name?.[0]}
            autoFocus
            fullWidth
          />
          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={!!errors.description}
            helperText={errors.description?.[0]}
            multiline
            minRows={2}
            fullWidth
          />
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
