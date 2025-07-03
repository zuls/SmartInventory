// src/pages/InventoryPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Inventory,
  Add,
  ArrowBack,
  Search,
  FilterList,
  LocalShipping,
  Info,
  Warning,
  TrendingUp,
  TrendingDown,
  ExpandMore,
  NewReleases,
  Replay,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { inventoryService } from '../services/inventoryService';
import { InventoryBatch, InventorySource } from '../types';
import { format } from 'date-fns';

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalAvailableItems: 0,
    totalReservedItems: 0,
    newArrivals: 0,
    fromReturns: 0,
    uniqueSKUs: 0,
  });

  // Load inventory data
  const loadInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summary, inventoryStats] = await Promise.all([
        inventoryService.getInventorySummaryBySKU(),
        inventoryService.getInventoryStats(),
      ]);
      
      setInventorySummary(summary);
      setStats(inventoryStats);
    } catch (err) {
      console.error('Error loading inventory data:', err);
      setError('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  // Filter inventory based on search and source
  const filteredInventory = inventorySummary.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = sourceFilter === 'all' || 
      (sourceFilter === 'new' && item.sources.newArrivals > 0) ||
      (sourceFilter === 'returns' && item.sources.fromReturns > 0);
    
    return matchesSearch && matchesSource;
  });

  // Handle delivery navigation
  const handleDelivery = (sku: string) => {
    navigate(`/delivery?sku=${sku}`);
  };

  // Get source indicator
  const getSourceIndicator = (sources: { newArrivals: number; fromReturns: number }) => {
    if (sources.newArrivals > 0 && sources.fromReturns > 0) {
      return <Chip label="Mixed" color="info" size="small" />;
    } else if (sources.newArrivals > 0) {
      return <Chip label="New" color="success" size="small" icon={<NewReleases />} />;
    } else if (sources.fromReturns > 0) {
      return <Chip label="Returns" color="secondary" size="small" icon={<Replay />} />;
    }
    return null;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
        <Typography sx={{ ml: 2 }}>Loading inventory...</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard')}
            variant="outlined"
          >
            Back to Dashboard
          </Button>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Inventory Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage stock levels and track available items
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/inventory/new')}
          sx={{ borderRadius: 25 }}
        >
          Add Inventory
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Available
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalAvailableItems}
                  </Typography>
                </Box>
                <Inventory color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Reserved
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalReservedItems}
                  </Typography>
                </Box>
                <LocalShipping color="warning" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    New Arrivals
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.newArrivals}
                  </Typography>
                </Box>
                <TrendingUp color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    From Returns
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.fromReturns}
                  </Typography>
                </Box>
                <TrendingDown color="secondary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Unique SKUs
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.uniqueSKUs}
                  </Typography>
                </Box>
                <Badge badgeContent={stats.uniqueSKUs} color="info">
                  <Info color="info" fontSize="large" />
                </Badge>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Batches
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalBatches}
                  </Typography>
                </Box>
                <Inventory color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                placeholder="Search by SKU or product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Source Filter</InputLabel>
                <Select
                  value={sourceFilter}
                  label="Source Filter"
                  onChange={(e) => setSourceFilter(e.target.value)}
                  startAdornment={<FilterList sx={{ mr: 1 }} />}
                >
                  <MenuItem value="all">All Sources</MenuItem>
                  <MenuItem value="new">New Arrivals Only</MenuItem>
                  <MenuItem value="returns">From Returns Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredInventory.length} of {inventorySummary.length} items
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inventory Summary Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Inventory Summary by SKU
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>SKU</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Breakdown</TableCell>
                  <TableCell>Batches</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {searchTerm || sourceFilter !== 'all' 
                          ? 'No inventory items match your filters' 
                          : 'No inventory items found'
                        }
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((item, index) => (
                    <TableRow key={item.sku} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                          {item.sku}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {item.productName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6" color="success.main" fontWeight="bold">
                            {item.totalAvailable}
                          </Typography>
                          {item.totalAvailable <= 5 && (
                            <Tooltip title="Low stock warning">
                              <Warning color="warning" fontSize="small" />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {getSourceIndicator(item.sources)}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          {item.sources.newArrivals > 0 && (
                            <Chip
                              label={`${item.sources.newArrivals} new`}
                              color="success"
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {item.sources.fromReturns > 0 && (
                            <Chip
                              label={`${item.sources.fromReturns} returns`}
                              color="secondary"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${item.batches.length} batches`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1}>
                          <Tooltip title="Process Delivery">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleDelivery(item.sku)}
                              disabled={item.totalAvailable === 0}
                            >
                              <LocalShipping />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/inventory/${item.sku}`)}
                            >
                              <Info />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Detailed Batch Information (Expandable) */}
      {filteredInventory.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Detailed Batch Information
            </Typography>
            {filteredInventory.slice(0, 5).map((item) => (
              <Accordion key={item.sku}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                    <Typography variant="subtitle1" fontWeight="bold">
                      {item.sku} - {item.productName}
                    </Typography>
                    <Box display="flex" gap={1} mr={2}>
                      <Chip label={`${item.totalAvailable} available`} color="success" size="small" />
                      <Chip label={`${item.batches.length} batches`} size="small" />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Batch ID</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell>Available</TableCell>
                          <TableCell>Reserved</TableCell>
                          <TableCell>Received Date</TableCell>
                          <TableCell>Notes</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {item.batches.map((batch: InventoryBatch) => (
                          <TableRow key={batch.id}>
                            <TableCell>
                              <Typography variant="caption" fontFamily="monospace">
                                {batch.id.slice(0, 8)}...
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={batch.source === InventorySource.NEW_ARRIVAL ? 'New' : 'Return'}
                                color={batch.source === InventorySource.NEW_ARRIVAL ? 'success' : 'secondary'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="success.main" fontWeight="bold">
                                {batch.availableQuantity}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="warning.main">
                                {batch.reservedQuantity}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption">
                                {format(new Date(batch.receivedDate), 'MMM dd, yyyy')}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {batch.batchNotes || 'No notes'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ))}
            {filteredInventory.length > 5 && (
              <Box textAlign="center" mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Showing first 5 items. Use search to filter results.
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default InventoryPage;