// src/pages/InventoryPage.tsx - Updated with Simple Serial Number Management
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  LinearProgress,
  Fab,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Inventory,
  Add,
  ArrowBack,
  Search,
  LocalShipping,
  Info,
  Warning,
  TrendingUp,
  Assignment,
  Visibility,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Speed,
  MoreVert,
  History,
  SaveAlt,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { inventoryService } from '../services/inventoryService';
import { 
  InventoryBatch, 
  InventorySource, 
  SerialNumberItem,
  InventoryItemStatus,
  InventoryStats,
} from '../types';
import { format } from 'date-fns';
import QuickSerialAssignment from '../components/QuickSerialAssignment';

const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Data states
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<InventoryStats>({
    totalBatches: 0,
    totalItems: 0,
    totalAvailableItems: 0,
    totalReservedItems: 0,
    totalDeliveredItems: 0,
    totalReturnedItems: 0,
    newArrivals: 0,
    fromReturns: 0,
    uniqueSKUs: 0,
    itemsWithSerialNumbers: 0,
    itemsWithoutSerialNumbers: 0,
    serialNumberAssignmentRate: 0,
  });

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [serialNumberFilter, setSerialNumberFilter] = useState<string>('all');

  // Dialog and action states
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [showSerialAssignmentDialog, setShowSerialAssignmentDialog] = useState(false);
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [batchItems, setBatchItems] = useState<SerialNumberItem[]>([]);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedForAction, setSelectedForAction] = useState<any>(null);

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

  // Filter inventory based on current filters
  const filteredInventory = inventorySummary.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = sourceFilter === 'all' || 
      (sourceFilter === 'new' && item.sources.newArrivals > 0) ||
      (sourceFilter === 'returns' && item.sources.fromReturns > 0);

    const matchesSerialFilter = serialNumberFilter === 'all' ||
      (serialNumberFilter === 'with_serial' && item.itemsWithSerialNumbers > 0) ||
      (serialNumberFilter === 'without_serial' && item.itemsWithoutSerialNumbers > 0) ||
      (serialNumberFilter === 'partial' && item.itemsWithSerialNumbers > 0 && item.itemsWithoutSerialNumbers > 0);
    
    return matchesSearch && matchesSource && matchesSerialFilter;
  });

  // Handle serial number assignment
  const handleAssignSerialNumbers = (batch: any) => {
    // Convert the summary item to a proper InventoryBatch
    const inventoryBatch: InventoryBatch = {
      id: batch.batches[0]?.id || '',
      sku: batch.sku,
      productName: batch.productName,
      totalQuantity: batch.totalItems || batch.totalAvailable,
      availableQuantity: batch.totalAvailable,
      reservedQuantity: batch.totalReserved || 0,
      deliveredQuantity: batch.totalDelivered || 0,
      returnedQuantity: batch.totalReturned || 0,
      source: batch.batches[0]?.source || InventorySource.NEW_ARRIVAL,
      sourceReference: batch.batches[0]?.sourceReference || '',
      receivedDate: batch.batches[0]?.receivedDate || new Date().toISOString(),
      receivedBy: batch.batches[0]?.receivedBy || '',
      batchNotes: batch.batches[0]?.batchNotes || '',
      serialNumbersAssigned: batch.itemsWithSerialNumbers || 0,
      serialNumbersUnassigned: batch.itemsWithoutSerialNumbers || 0,
    };
    
    setSelectedBatch(inventoryBatch);
    setShowSerialAssignmentDialog(true);
  };

  // Handle delivery navigation
  const handleDelivery = (sku: string) => {
    navigate(`/delivery?sku=${sku}`);
  };

  // View batch details
  const viewBatchDetails = async (batch: any) => {
    try {
      const batchId = batch.batches[0]?.id;
      if (!batchId) return;
      
      const items = await inventoryService.getItemsByBatchId(batchId);
      setBatchItems(items);
      setSelectedBatch(batch.batches[0]);
      setShowBatchDetails(true);
    } catch (err) {
      console.error('Error loading batch details:', err);
      setError('Failed to load batch details');
    }
  };

  // Handle action menu
  const handleActionMenu = (event: React.MouseEvent<HTMLElement>, item: any) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedForAction(item);
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setSelectedForAction(null);
  };

  // Get source indicator
  const getSourceIndicator = (sources: { newArrivals: number; fromReturns: number }) => {
    if (sources.newArrivals > 0 && sources.fromReturns > 0) {
      return <Chip label="Mixed" color="info" size="small" />;
    } else if (sources.newArrivals > 0) {
      return <Chip label="New" color="success" size="small" icon={<Add />} />;
    } else if (sources.fromReturns > 0) {
      return <Chip label="Returns" color="secondary" size="small" icon={<Schedule />} />;
    }
    return null;
  };

  // Get serial number assignment progress
  const getSerialNumberProgress = (item: any) => {
    const total = item.totalItems || item.totalAvailable;
    const assigned = item.itemsWithSerialNumbers || 0;
    const percentage = total > 0 ? (assigned / total) * 100 : 0;

    return {
      percentage,
      color: percentage === 100 ? 'success' : percentage > 0 ? 'warning' : 'error',
      text: `${assigned}/${total} assigned`,
    };
  };

  // Get status for items needing attention
  const getAttentionStatus = (item: any) => {
    const needsSerial = item.itemsWithoutSerialNumbers > 0;
    const hasAvailable = item.totalAvailable > 0;
    const lowStock = item.totalAvailable <= 5;

    if (needsSerial && hasAvailable) {
      return { type: 'serial', icon: <Assignment />, color: 'warning', text: 'Needs Serial Numbers' };
    } else if (lowStock && hasAvailable) {
      return { type: 'stock', icon: <Warning />, color: 'error', text: 'Low Stock' };
    } else if (hasAvailable) {
      return { type: 'ready', icon: <CheckCircle />, color: 'success', text: 'Ready for Delivery' };
    } else {
      return { type: 'empty', icon: <ErrorIcon />, color: 'default', text: 'Out of Stock' };
    }
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
              Manage stock levels and serial numbers
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/receive')}
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
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Items
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalItems}
                  </Typography>
                </Box>
                <Inventory color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Available
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {stats.totalAvailableItems}
                  </Typography>
                </Box>
                <CheckCircle color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Delivered
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalDeliveredItems}
                  </Typography>
                </Box>
                <LocalShipping color="info" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    With Serial #
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {stats.itemsWithSerialNumbers}
                  </Typography>
                </Box>
                <Assignment color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Need Serial #
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {stats.itemsWithoutSerialNumbers}
                  </Typography>
                </Box>
                <Badge badgeContent={stats.itemsWithoutSerialNumbers} color="warning">
                  <Warning color="warning" fontSize="large" />
                </Badge>
              </Box>
              <LinearProgress
                variant="determinate"
                value={stats.serialNumberAssignmentRate}
                color={stats.serialNumberAssignmentRate > 80 ? 'success' : 'warning'}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
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
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={sourceFilter}
                  label="Source"
                  onChange={(e) => setSourceFilter(e.target.value)}
                >
                  <MenuItem value="all">All Sources</MenuItem>
                  <MenuItem value="new">New Arrivals</MenuItem>
                  <MenuItem value="returns">From Returns</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Serial Numbers</InputLabel>
                <Select
                  value={serialNumberFilter}
                  label="Serial Numbers"
                  onChange={(e) => setSerialNumberFilter(e.target.value)}
                >
                  <MenuItem value="all">All Items</MenuItem>
                  <MenuItem value="with_serial">With Serial Numbers</MenuItem>
                  <MenuItem value="without_serial">Need Serial Numbers</MenuItem>
                  <MenuItem value="partial">Partially Assigned</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredInventory.length} of {inventorySummary.length} products
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Inventory Summary Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Inventory by Product (SKU)
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Serial Numbers</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {searchTerm || sourceFilter !== 'all' || serialNumberFilter !== 'all'
                          ? 'No inventory items match your filters' 
                          : 'No inventory items found'
                        }
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory.map((item) => {
                    const progress = getSerialNumberProgress(item);
                    const status = getAttentionStatus(item);
                    
                    return (
                      <TableRow key={item.sku} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {item.productName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                              SKU: {item.sku}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" color="success.main" fontWeight="bold">
                              {item.totalAvailable}
                            </Typography>
                            {item.totalAvailable <= 5 && item.totalAvailable > 0 && (
                              <Tooltip title="Low stock warning">
                                <Warning color="warning" fontSize="small" />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={1}>
                              <Typography variant="body2" color={`${progress.color}.main`} fontWeight="bold">
                                {progress.text}
                              </Typography>
                              {item.itemsWithoutSerialNumbers > 0 && (
                                <Chip
                                  label="Needs Assignment"
                                  color="warning"
                                  size="small"
                                  icon={<Assignment />}
                                />
                              )}
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={progress.percentage}
                              color={progress.color as any}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          {getSourceIndicator(item.sources)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={status.text}
                            color={status.color as any}
                            size="small"
                            icon={status.icon}
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            {/* Assign Serial Numbers Button */}
                            {item.itemsWithoutSerialNumbers > 0 && (
                              <Tooltip title="Assign Serial Numbers">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => handleAssignSerialNumbers(item)}
                                >
                                  <Assignment />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            {/* Process Delivery Button */}
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
                            
                            {/* View Details Button */}
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => viewBatchDetails(item)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            
                            {/* More Actions Menu */}
                            <IconButton
                              size="small"
                              onClick={(e) => handleActionMenu(e, item)}
                            >
                              <MoreVert />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add inventory"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => navigate('/receive')}
      >
        <Add />
      </Fab>

      {/* Serial Number Assignment Dialog */}
      <QuickSerialAssignment
        open={showSerialAssignmentDialog}
        onClose={() => setShowSerialAssignmentDialog(false)}
        batch={selectedBatch}
        onSuccess={() => {
          loadInventoryData();
          setShowSerialAssignmentDialog(false);
        }}
      />

      {/* Batch Details Dialog */}
      <Dialog open={showBatchDetails} onClose={() => setShowBatchDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Batch Details: {selectedBatch?.productName}
        </DialogTitle>
        <DialogContent>
          {selectedBatch && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">SKU:</Typography>
                  <Typography variant="body1" fontFamily="monospace">{selectedBatch.sku}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Total Items:</Typography>
                  <Typography variant="body1" fontWeight="bold">{selectedBatch.totalQuantity}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Available:</Typography>
                  <Typography variant="body1" color="success.main" fontWeight="bold">
                    {selectedBatch.availableQuantity}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Delivered:</Typography>
                  <Typography variant="body1">{selectedBatch.deliveredQuantity}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Serial Numbers:</Typography>
                  <Typography variant="body1">
                    {selectedBatch.serialNumbersAssigned} / {selectedBatch.totalQuantity} assigned
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Source:</Typography>
                  <Chip
                    label={selectedBatch.source === InventorySource.NEW_ARRIVAL ? 'New Arrival' : 'From Return'}
                    color={selectedBatch.source === InventorySource.NEW_ARRIVAL ? 'success' : 'secondary'}
                    size="small"
                  />
                </Grid>
              </Grid>

              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Individual Items ({batchItems.length})
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item #</TableCell>
                      <TableCell>Serial Number</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>#{index + 1}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {item.serialNumber || (
                              <Chip label="Not assigned" color="warning" size="small" />
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.status}
                            color={
                              item.status === InventoryItemStatus.AVAILABLE ? 'success' :
                              item.status === InventoryItemStatus.DELIVERED ? 'info' :
                              item.status === InventoryItemStatus.RETURNED ? 'secondary' :
                              'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">
                            {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowBatchDetails(false)}>Close</Button>
          {selectedBatch && selectedBatch.serialNumbersUnassigned > 0 && (
            <Button
              variant="contained"
              startIcon={<Assignment />}
              onClick={() => {
                setShowBatchDetails(false);
                setShowSerialAssignmentDialog(true);
              }}
            >
              Assign Serial Numbers
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={closeActionMenu}
      >
        <MenuItem onClick={() => {
          if (selectedForAction) {
            viewBatchDetails(selectedForAction);
          }
          closeActionMenu();
        }}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          if (selectedForAction) {
            handleDelivery(selectedForAction.sku);
          }
          closeActionMenu();
        }}>
          <ListItemIcon><LocalShipping fontSize="small" /></ListItemIcon>
          <ListItemText>Process Delivery</ListItemText>
        </MenuItem>
        
        {selectedForAction?.itemsWithoutSerialNumbers > 0 && (
          <MenuItem onClick={() => {
            if (selectedForAction) {
              handleAssignSerialNumbers(selectedForAction);
            }
            closeActionMenu();
          }}>
            <ListItemIcon><Assignment fontSize="small" /></ListItemIcon>
            <ListItemText>Assign Serial Numbers</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem onClick={() => {
          if (selectedForAction) {
            navigate(`/inventory/history/${selectedForAction.sku}`);
          }
          closeActionMenu();
        }}>
          <ListItemIcon><History fontSize="small" /></ListItemIcon>
          <ListItemText>View History</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => {
          // Export functionality
          closeActionMenu();
        }}>
          <ListItemIcon><SaveAlt fontSize="small" /></ListItemIcon>
          <ListItemText>Export Data</ListItemText>
        </MenuItem>
      </Menu>

      {/* Quick Actions Panel for Items Needing Serial Numbers */}
      {stats.itemsWithoutSerialNumbers > 0 && (
        <Card sx={{ position: 'fixed', bottom: 100, right: 24, width: 300 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Action Required
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                {stats.itemsWithoutSerialNumbers} items need serial numbers
              </Typography>
            </Alert>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Assignment />}
              onClick={async () => {
                // Find first batch with unassigned serial numbers
                const batchWithUnassigned = inventorySummary.find(item => 
                  item.itemsWithoutSerialNumbers > 0
                );
                if (batchWithUnassigned) {
                  handleAssignSerialNumbers(batchWithUnassigned);
                }
              }}
            >
              Assign Serial Numbers
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default InventoryPage;