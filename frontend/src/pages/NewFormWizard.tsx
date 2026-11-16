import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { api, ApiError } from '../api'

type StorageType = 'default' | 'nextcloud'
type Options = { nextcloud: { enabled: boolean; base_folder: string | null } }

const STEPS = ['Details', 'File storage', 'Review']

export default function NewFormWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [storage, setStorage] = useState<StorageType>('default')
  const [options, setOptions] = useState<Options | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Options>('/storage/options')
      .then(setOptions)
      .catch(() => setOptions({ nextcloud: { enabled: false, base_folder: null } }))
  }, [])

  function goNext() {
    if (step === 0 && !name.trim()) {
      setError('Enter a form name.')
      return
    }
    setError(null)
    setStep((s) => s + 1)
  }

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await api('/forms', {
        method: 'POST',
        body: { name: name.trim(), description: description.trim() || null, storage_type: storage },
      })
      onCreated()
    } catch (e) {
      if (e instanceof ApiError) {
        setError(Object.values(e.errors)[0]?.[0] ?? e.message)
      } else {
        setError('Cannot reach the server.')
      }
    } finally {
      setBusy(false)
    }
  }

  const ncEnabled = options?.nextcloud.enabled ?? false
  const base = options?.nextcloud.base_folder ?? '/Forms'

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New form</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3, mt: 1 }}>
          {STEPS.map((s) => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 0 && (
          <Stack spacing={2}>
            <TextField label="Form name" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
            <TextField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Where should files uploaded to this form be saved?
            </Typography>
            <RadioGroup value={storage} onChange={(e) => setStorage(e.target.value as StorageType)}>
              <FormControlLabel value="default" control={<Radio />} label="Server default" />
              <FormControlLabel
                value="nextcloud"
                control={<Radio />}
                disabled={!ncEnabled}
                label={ncEnabled ? 'Nextcloud' : 'Nextcloud (not configured on the server)'}
              />
            </RadioGroup>
            {storage === 'nextcloud' && (
              <Alert severity="info">
                Files will be saved in Nextcloud under {base}/&lt;form name&gt;-&lt;id&gt;. The folder is created automatically.
              </Alert>
            )}
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Name
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              File storage
            </Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {storage === 'nextcloud' ? `Nextcloud (${base}/...)` : 'Server default'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
              The form starts as a draft. You can add fields once the builder is ready.
            </Typography>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        {step > 0 && (
          <Button onClick={() => setStep((s) => s - 1)} color="inherit">
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button variant="contained" onClick={goNext}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={() => void create()} disabled={busy}>
            {busy ? 'Creating...' : 'Create form'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
