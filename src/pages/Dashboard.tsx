// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Badge,
  IconButton,
  Paper,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Package,
  AssignmentReturn,
  Inventory,
  LocalShipping,
  Search,
  Add,
  TrendingUp,
  TrendingDown,
  Remove,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { returnService } from '../services/returnService';
import { inventoryService } from '../services/inventoryService';
import { DashboardStats } from '../types';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    todayReceived: 0,
    readyForDispatch: 0,
    todayDispatched: 0,
    pendingReturns: 0,
    totalPackages: 0,
    totalInventoryItems: 0,
    pendingReturnItems: 0,
    weeklyTrend: {
      received: [0, 0, 0, 0, 0, 0, 0],
      dispatched: [0, 0, 0, 0, 0, 0, 0],
      returns: [0, 0, 0, 0, 0, 0, 0],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load all statistics in parallel
        const [
          packageStats,
          returnStats,
          inventoryStats,
          pendingReturns,
        ] = await Promise.all([
          packageService.getTodayStats(),
          returnService.getTodayReturnStats(),
          inventoryService.getInventoryStats(),
          returnService.getPendingReturns(),
        ]);

        // Combine all stats
        const combinedStats: DashboardStats = {
          todayReceived: packageStats?.received || 0,
          readyForDispatch: packageStats?.ready || 0,
          todayDispatched: packageStats?.dispatched || 0,
          pendingReturns: returnStats?.received || 0,
          totalPackages: packageStats?.total || 0,
          totalInventoryItems: inventoryStats?.totalAvailableItems || 0,
          pendingReturnItems: pendingReturns?.length || 0,
          weeklyTrend: {
            received: [12, 15, 8, 22, 18, 5, 3],
            dispatched: [8, 12, 6, 18, 15, 3, 2],
            returns: [2, 3, 1, 4, 2, 1, 0],
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          },
        };

        setStats(combinedStats);

        // Set recent activities (mock data for now)
        setRecentActivities([
          { id: 1, type: 'package', action: 'received', item: 'Package #1234', time: new Date() },
          { id: 2, type: 'return', action: 'reviewed', item: 'Return #5678', time: new Date() },
          { id: 3, type: 'inventory', action: 'moved', item: 'LPN789', time: new Date() },
        ]);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    color, 
    trend, 
    onClick, 
    badge 
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
    trend?: number;
    onClick?: () => void;
    badge?: number;
  }) => (
    <Card 
      sx={{ 
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { elevation: 4 } : {},
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value.toLocaleString()}
            </Typography>
            {trend !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {trend > 0 ? (
                  <TrendingUp color="success" fontSize="small" />
                ) : trend < 0 ? (
                  <TrendingDown color="error" fontSize="small" />
                ) : (
                  <Remove color="disabled" fontSize="small" />
                )}
                <Typography
                  variant="caption"
                  color={trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary'}
                  sx={{ ml: 0.5 }}
                >
                  {trend > 0 ? '+' : ''}{trend}%
                </Typography>
              </Box>
            )}
          </Box>
          <Badge badgeContent={badge} color={color}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: `${color}.light`,
                color: `${color}.main`,
              }}
            >
              {icon}
            </Box>
          </Badge>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back, {user?.displayName || user?.email}
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Search />}
            onClick={() => navigate('/search')}
          >
            Global Search
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/receive')}
          >
            Receive Package
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today's Received"
            value={stats.todayReceived}
            icon={<Package fontSize="large" />}
            color="primary"
            trend={12}
            onClick={() => navigate('/packages')}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Pending Returns"
            value={stats.pendingReturnItems}
            icon={<AssignmentReturn fontSize="large" />}
            color="warning"
            trend={-5}
            onClick={() => navigate('/returns')}
            badge={stats.pendingReturnItems > 0 ? stats.pendingReturnItems : undefined}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Available Inventory"
            value={stats.totalInventoryItems}
            icon={<Inventory fontSize="large" />}
            color="success"
            trend={8}
            onClick={() => navigate('/inventory')}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Today's Dispatched"
            value={stats.todayDispatched}
            icon={<LocalShipping fontSize="large" />}
            color="info"
            trend={3}
            onClick={() => navigate('/delivery')}
          />
        </Grid>
      </Grid>

      {/* Secondary Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ready for Dispatch
              </Typography>
              <Typography variant="h3" color="success.main" fontWeight="bold">
                {stats.readyForDispatch}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(stats.readyForDispatch / (stats.totalPackages || 1)) * 100}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {Math.round((stats.readyForDispatch / (stats.totalPackages || 1)) * 100)}% of total packages
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Return Processing
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Chip
                  label={`${stats.pendingReturns} Received`}
                  color="warning"
                  size="small"
                />
                <Chip
                  label={`${stats.pendingReturnItems} Pending`}
                  color="error"
                  size="small"
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Average processing time: 2.5 days
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Health
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <CheckCircle color="success" fontSize="small" />
                <Typography variant="body2">All systems operational</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Last updated: {format(new Date(), 'HH:mm:ss')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions & Recent Activity */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Package />}
                    onClick={() => navigate('/receive')}
                    sx={{ py: 2 }}
                  >
                    Receive Package
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AssignmentReturn />}
                    onClick={() => navigate('/returns/new')}
                    sx={{ py: 2 }}
                  >
                    Add Return
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Inventory />}
                    onClick={() => navigate('/inventory')}
                    sx={{ py: 2 }}
                  >
                    Manage Inventory
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<LocalShipping />}
                    onClick={() => navigate('/delivery')}
                    sx={{ py: 2 }}
                  >
                    Process Delivery
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Box>
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => (
                    <Box key={activity.id} mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {activity.type === 'package' && <Package fontSize="small" />}
                        {activity.type === 'return' && <AssignmentReturn fontSize="small" />}
                        {activity.type === 'inventory' && <Inventory fontSize="small" />}
                        <Typography variant="body2">
                          {activity.item} {activity.action}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {format(activity.time, 'HH:mm')}
                      </Typography>
                      {activity.id < recentActivities.length && <Divider sx={{ mt: 1 }} />}
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent activity
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;