// src/components/Layout.tsx
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Chip,
  useTheme,
  useMediaQuery,
  Collapse,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Package,
  AssignmentReturn,
  Inventory,
  LocalShipping,
  Search,
  Assessment,
  Settings,
  AccountCircle,
  Logout,
  Notifications,
  Add,
  ExpandLess,
  ExpandMore,
  Home,
  Business,
  Storage,
  TrendingUp,
  Receipt,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';

const drawerWidth = 280;

interface NavigationItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  path?: string;
  badge?: number;
  children?: NavigationItem[];
}

const Layout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>(['operations']);

  // Navigation structure
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: <Dashboard />,
      path: '/dashboard',
    },
    {
      id: 'operations',
      title: 'Operations',
      icon: <Business />,
      children: [
        {
          id: 'receive',
          title: 'Receive Package',
          icon: <Add />,
          path: '/receive',
        },
        {
          id: 'packages',
          title: 'Packages',
          icon: <Package />,
          path: '/packages',
          badge: 12, // Mock badge count
        },
        {
          id: 'returns',
          title: 'Returns',
          icon: <AssignmentReturn />,
          path: '/returns',
          badge: 5, // Mock badge count
        },
        {
          id: 'inventory',
          title: 'Inventory',
          icon: <Inventory />,
          path: '/inventory',
        },
        {
          id: 'delivery',
          title: 'Delivery',
          icon: <LocalShipping />,
          path: '/delivery',
        },
      ],
    },
    {
      id: 'search',
      title: 'Global Search',
      icon: <Search />,
      path: '/search',
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: <Assessment />,
      children: [
        {
          id: 'stock',
          title: 'Stock Logs',
          icon: <Storage />,
          path: '/stock',
        },
        {
          id: 'analytics',
          title: 'Analytics',
          icon: <TrendingUp />,
          path: '/analytics',
        },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: <Settings />,
      path: '/settings',
    },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleMenuClose();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const isParentActive = (children: NavigationItem[]) => {
    return children.some(child => child.path && isActive(child.path));
  };

  const renderNavigationItem = (item: NavigationItem, level: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.id);
    const isItemActive = item.path ? isActive(item.path) : false;
    const isParentItemActive = hasChildren ? isParentActive(item.children!) : false;

    return (
      <React.Fragment key={item.id}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              if (hasChildren) {
                toggleExpanded(item.id);
              } else if (item.path) {
                handleNavigate(item.path);
              }
            }}
            selected={isItemActive || isParentItemActive}
            sx={{
              pl: 2 + level * 2,
              borderRadius: 1,
              mx: 1,
              mb: 0.5,
              '&.Mui-selected': {
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText',
                },
              },
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.title}
              primaryTypographyProps={{
                fontSize: level > 0 ? '0.875rem' : '1rem',
                fontWeight: isItemActive || isParentItemActive ? 'bold' : 'normal',
              }}
            />
            {item.badge && (
              <Badge
                badgeContent={item.badge}
                color="error"
                sx={{ mr: 1 }}
              />
            )}
            {hasChildren && (
              isExpanded ? <ExpandLess /> : <ExpandMore />
            )}
          </ListItemButton>
        </ListItem>
        
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {item.children!.map(child => renderNavigationItem(child, level + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Header */}
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Warehouse Pro
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Inventory Management
        </Typography>
      </Box>
      
      <Divider />
      
      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List sx={{ px: 1, py: 2 }}>
          {navigationItems.map(item => renderNavigationItem(item))}
        </List>
      </Box>
      
      {/* Footer */}
      <Box sx={{ p: 2, mt: 'auto' }}>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 32, height: 32 }}>
            {user?.displayName?.[0] || user?.email?.[0] || 'U'}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" fontWeight="bold">
              {user?.displayName || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={<Logout />}
          onClick={handleLogout}
          sx={{ mt: 2 }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {/* Dynamic title based on current route */}
            {(() => {
              const currentPath = location.pathname;
              if (currentPath === '/dashboard') return 'Dashboard';
              if (currentPath.startsWith('/packages')) return 'Package Management';
              if (currentPath.startsWith('/returns')) return 'Returns Management';
              if (currentPath.startsWith('/inventory')) return 'Inventory Management';
              if (currentPath.startsWith('/delivery')) return 'Delivery Management';
              if (currentPath.startsWith('/search')) return 'Global Search';
              if (currentPath.startsWith('/receive')) return 'Receive Package';
              if (currentPath.startsWith('/stock')) return 'Stock Management';
              if (currentPath.startsWith('/settings')) return 'Settings';
              return 'Warehouse Management';
            })()}
          </Typography>

          {/* Header Actions */}
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton color="inherit" title="Notifications">
              <Badge badgeContent={3} color="error">
                <Notifications />
              </Badge>
            </IconButton>
            
            <IconButton color="inherit" onClick={handleMenuClick}>
              <AccountCircle />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { handleNavigate('/settings'); handleMenuClose(); }}>
          <ListItemIcon><Settings fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar /> {/* Spacer for app bar */}
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;