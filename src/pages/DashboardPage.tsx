// src/pages/DashboardPage.tsx - Fixed Grid usage
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid, // Fixed Grid import
  Button,
  Alert,
  CircularProgress,
  Chip,
  Badge,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Inventory2 as PackageIcon,
  AssignmentReturn,
  Inventory,
  LocalShipping,
  Search,
  Add,
  TrendingUp,
  TrendingDown,
  CheckCircle,
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
    itemsNeedingSerialNumbers: 0,        // ADD THIS
    serialNumbersAssignedToday: 0,       // ADD THIS
    returnedItemsToday: 0,
    weeklyTrend: {
      received: [0,0,0,0,0,0,0],
      dispatched: [0,0,0,0,0,0,0],
      returns: [0,0,0,0,0,0,0],
      serialNumbersAssigned: [0,0,0,0,0,0,0],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [
          packageStats,
          inventoryStats,
          pendingReturns,
        ] = await Promise.all([
          packageService.getTodayStats(),
          inventoryService.getInventoryStats(),
          returnService.getPendingReturns(),
        ]);

        const combinedStats: DashboardStats = {
          todayReceived: packageStats?.received || 0,
          readyForDispatch: packageStats?.ready || 0,
          todayDispatched: packageStats?.dispatched || 0,
          totalPackages: packageStats?.total || 0,
          totalInventoryItems: inventoryStats?.totalAvailableItems || 0,
          pendingReturnItems: pendingReturns?.length || 0,
          pendingReturns: pendingReturns?.length || 0,
          itemsNeedingSerialNumbers: inventoryStats?.itemsWithoutSerialNumbers || 0,        // ADD THIS
          serialNumbersAssignedToday: 0,                                                     // ADD THIS
          returnedItemsToday: 0,
          weeklyTrend: {
            received: [12, 15, 8, 22, 18, 5, 3],
            dispatched: [8, 12, 6, 18, 15, 3, 2],
            returns: [2, 3, 1, 4, 2, 1, 0],
            serialNumbersAssigned: [5, 7, 3, 6, 4, 2, 1],
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          },
        };

        setStats(combinedStats);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load dashboard data. Please try refreshing.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const StatCard = ({ title, value, icon, color, onClick, badge }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
    onClick?: () => void;
    badge?: number;
  }) => (
    <Card 
      sx={{ cursor: onClick ? 'pointer' : 'default', '&:hover': onClick ? { boxShadow: 6 } : {} }}
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
          </Box>
          <Badge badgeContent={badge} color={color}>
            <Box
              sx={{ p: 2, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.main` }}
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Stats Cards with LIVE DATA */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}> {/* Fixed Grid usage */}
          <StatCard
            title="Today's Received"
            value={stats.todayReceived}
            icon={<PackageIcon fontSize="large" />} 
            color="primary"
            onClick={() => navigate('/packages')}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}> {/* Fixed Grid usage */}
          <StatCard
            title="Pending Returns"
            value={stats.pendingReturnItems}
            icon={<AssignmentReturn fontSize="large" />}
            color="warning"
            onClick={() => navigate('/returns')}
            badge={stats.pendingReturnItems > 0 ? stats.pendingReturnItems : undefined}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}> {/* Fixed Grid usage */}
          <StatCard
            title="Available Inventory"
            value={stats.totalInventoryItems}
            icon={<Inventory fontSize="large" />}
            color="success"
            onClick={() => navigate('/inventory')}
          />
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}> {/* Fixed Grid usage */}
          <StatCard
            title="Today's Dispatched"
            value={stats.todayDispatched}
            icon={<LocalShipping fontSize="large" />}
            color="info"
            onClick={() => navigate('/delivery')}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;