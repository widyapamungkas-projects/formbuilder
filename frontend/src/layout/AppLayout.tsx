import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined'
import PeopleOutline from '@mui/icons-material/People'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../auth'

const WIDTH = 240

export default function AppLayout() {
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const items = [
    { to: '/', label: 'Forms', icon: <DescriptionOutlined /> },
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'Users', icon: <PeopleOutline /> }] : []),
  ]

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: 'secondary.main', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Form Builder
        </Typography>
      </Toolbar>
      <List sx={{ px: 1 }}>
        {items.map((i) => (
          <ListItemButton
            key={i.to}
            component={NavLink}
            to={i.to}
            end={i.to === '/'}
            onClick={() => setOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              color: 'inherit',
              '&.active': { bgcolor: 'primary.main' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>{i.icon}</ListItemIcon>
            <ListItemText primary={i.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)' }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" noWrap>
          {user?.name}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', opacity: 0.75 }}>
          {user?.email}
        </Typography>
        <Button
          startIcon={<LogoutIcon />}
          color="inherit"
          size="small"
          sx={{ mt: 1, minHeight: 44 }}
          onClick={async () => {
            await logout()
            navigate('/login', { replace: true })
          }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {desktop ? (
        <Drawer
          variant="permanent"
          sx={{ width: WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: WIDTH, border: 0 } }}
        >
          {drawer}
        </Drawer>
      ) : (
        <>
          <AppBar position="fixed" color="secondary" elevation={0}>
            <Toolbar>
              <IconButton color="inherit" edge="start" aria-label="Open menu" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Form Builder
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer
            open={open}
            onClose={() => setOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: WIDTH, border: 0 } }}
          >
            {drawer}
          </Drawer>
        </>
      )}
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 4 }, pt: { xs: 10, md: 4 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
