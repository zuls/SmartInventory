// src/pages/DashboardPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  useTheme,
  CircularProgress,
} from '@mui/material';
import {
  Inventory,
  LocalShipping,
  AssignmentReturn,
  Add,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { auth } from '../lib/firebase';

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ReactElement;
  color: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, color }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: '50%',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              '& svg': {
                fontSize: 30,
              },
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const DashboardPage: React.FC = () => {
  // ALL HOOKS AT THE TOP
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State hooks
  const [stats, setStats] = useState({
    todayReceived: 0,
    readyForDispatch: 0,
    todayDispatched: 0,
  });
  const [loading, setLoading] = useState(true);

  // Effect hooks
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      try {
        const todayStats = await packageService.getTodayStats();
        if (mounted) {
          setStats({
            todayReceived: todayStats.received,
            readyForDispatch: todayStats.ready,
            todayDispatched: todayStats.dispatched,
          });
        }
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // Callback hooks
  const handleNavigateToReceive = useCallback(() => {
    console.log('Navigating to receive page...');
    navigate('/receive');
  }, [navigate]);

  const handleDispatchAlert = useCallback(() => {
    alert('Dispatch page coming soon!');
  }, []);

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
        <Typography sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  // Main render
  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Dashboard Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back, {user?.email}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleNavigateToReceive}
          sx={{ borderRadius: 25 }}
        >
          Receive Package
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Today's Received"
            value={stats.todayReceived}
            icon={<Inventory />}
            color={theme.palette.primary.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Ready for Dispatch"
            value={stats.readyForDispatch}
            icon={<LocalShipping />}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Today's Dispatched"
            value={stats.todayDispatched}
            icon={<LocalShipping />}
            color={theme.palette.warning.main}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatsCard
            title="Pending Returns"
            value={0}
            icon={<AssignmentReturn />}
            color={theme.palette.error.main}
          />
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Inventory />}
                  onClick={handleNavigateToReceive}
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  Receive New Package
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<LocalShipping />}
                  onClick={handleDispatchAlert}
                  sx={{ justifyContent: 'flex-start', p: 2 }}
                >
                  Process Dispatch
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>
              <Box p={2}>
                <Typography variant="body2" color="text.secondary">
                  • Firebase: Connected ✅
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Authentication: Active ✅
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Database: Ready ✅
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  User: {user?.email}
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => auth.signOut()}
                  sx={{ mt: 1 }}
                >
                  Logout
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Debug Info */}
      <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
        <Typography variant="body2" color="text.secondary">
          Debug: Stats loaded - Received: {stats.todayReceived}, Ready: {stats.readyForDispatch}, Dispatched: {stats.todayDispatched}
        </Typography>
      </Box>
    </Box>
  );
};

export default DashboardPage;