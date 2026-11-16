import { Card, CardContent, Typography } from '@mui/material'

// Placeholder: the card grid, search and "New form" wizard come in phase 3.
export default function Dashboard() {
  return (
    <>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Forms
      </Typography>
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            No forms yet. The dashboard and the new-form wizard are built in the next phase.
          </Typography>
        </CardContent>
      </Card>
    </>
  )
}
