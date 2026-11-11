import { useEffect, useState } from 'react'

type ApiState = 'checking' | 'ok' | 'down'

// Phase 1 smoke test only: proves frontend -> Vite proxy -> nginx -> Laravel works.
// The MUI theme and real screens arrive in the next phases.
export default function App() {
  const [api, setApi] = useState<ApiState>('checking')

  useEffect(() => {
    fetch('/up')
      .then((res) => setApi(res.ok ? 'ok' : 'down'))
      .catch(() => setApi('down'))
  }, [])

  return (
    <main>
      <h1>opnForm</h1>
      <p>API status: {api}</p>
    </main>
  )
}
