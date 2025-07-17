// src/pages/InventoryPage.tsx - Updated with Serial Number Management
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  Tabs,
  Tab,
  Divider,
  LinearProgress,
  Fab,
  Menu,
  ListItemIcon,
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
  Assignment,
  Edit,
  Visibility,
  QrCodeScanner,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Speed,
  Delete,
  MoreVert,
  History,
  SaveAlt,
  CloudUpload,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { inventoryService } from '../services/inventoryService';
import { 
  InventoryBatch, 
  InventorySource, 
  SerialNumberItem,
  InventoryItemStatus,
  InventoryStats,
  BulkSerialNumberForm,
} from '../types';
import { format } from 'date-fns';

// Serial Number Assignment Component
const SerialNumberAssignmentDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  items: SerialNumberItem[];
  onAssign: (assignments: Array<{ itemId: string; serialNumber: string }>) => void;
  loading?: boolean;
}> = ({ open, onClose, items, onAssign, loading = false }) => {
  const [assignments, setAssignments] = useState<Array<{ itemId: string; serialNumber: string }>>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setAssignments(items.map(item => ({ itemId: item.id, serialNumber: '' })));
      setBulkInput('');
      setValidationErrors({});
    }
  }, [open, items]);

  const handleSerialNumberChange = (itemId: string, serialNumber: string) => {
    setAssignments(prev => prev.map(assignment => 
      assignment.itemId === itemId ? { ...assignment, serialNumber } : assignment
    ));
    
    // Clear validation error for this item
    if (validationErrors[itemId]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    }
  };

  const handleBulkImport = () => {
    const serialNumbers = bulkInput
      .split(/[\n,]/)
      .map(sn => sn.trim())
      .filter(sn => sn !== '');

    setAssignments(prev => prev.map((assignment, index) => ({
      ...assignment,
      serialNumber: serialNumbers[index] || assignment.serialNumber
    })));
  };

  const validateAssignments = () => {
    const errors: Record<string, string> = {};
    const usedSerialNumbers = new Set<string>();
    
    assignments.forEach(assignment => {
      if (!assignment.serialNumber.trim()) {
        errors[assignment.itemId] = 'Serial number is required';
      } else if (usedSerialNumbers.has(assignment.serialNumber)) {
        errors[assignment.itemId] = 'Duplicate serial number';
      } else {
        usedSerialNumbers.add(assignment.serialNumber);
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (validateAssignments()) {
      const validAssignments = assignments.filter(a => a.serialNumber.trim() !== '');
      onAssign(validAssignments);
    }
  };

  const autoGenerateSerialNumbers = () => {
    const timestamp = Date.now().toString().slice(-6);
    setAssignments(prev => prev.map((assignment, index) => ({
      ...assignment,
      serialNumber: `SN${timestamp}${String(index + 1).padStart(3, '0')}`
    })));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Assign Serial Numbers ({items.length} items)
      </DialogTitle>
      <DialogContent>
        <Box mb={3}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Assign serial numbers to inventory items. Each serial number must be unique.
          </Typography>
          
          <Box display="flex" gap={2} mb={2}>
            <Button
              variant="outlined"
              onClick={autoGenerateSerialNumbers}
              startIcon={<Speed />}
              size="small"
            >
              Auto-Generate All
            </Button>
            <Button
              variant="outlined"
              onClick={() => setBulkInput('')}
              size="small"
            >
              Clear All
            </Button>
          </Box>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle2">Bulk Import Serial Numbers</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="Enter serial numbers separated by new lines or commas&#10;SN001&#10;SN002&#10;SN003"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="outlined"
                onClick={handleBulkImport}
                disabled={!bulkInput.trim()}
                size="small"
              >
                Import Serial Numbers
              </Button>
            </AccordionDetails>
          </Accordion>
        </Box>

        <List>
          {items.map((item, index) => {
            const assignment = assignments.find(a => a.itemId === item.id);
            const error = validationErrors[item.id];
            
            return (
              <ListItem key={item.id}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: error ? 'error.light' : 'primary.light' }}>
                    {index + 1}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <TextField
                      fullWidth
                      size="small"
                      label={`Serial Number ${index + 1}`}
                      value={assignment?.serialNumber || ''}
                      onChange={(e) => handleSerialNumberChange(item.id, e.target.value)}
                      error={!!error}
                      helperText={error}
                      placeholder={`SN${String(index + 1).padStart(3, '0')}`}
                    />
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      Item ID: {item.id.slice(0, 8)}... • Created: {format(new Date(item.createdAt), 'MMM dd')}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || assignments.every(a => !a.serialNumber.trim())}
          startIcon={loading ? <CircularProgress size={20} /> : <Assignment />}
        >
          {loading ? 'Assigning...' : 'Assign Serial Numbers'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

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
  const [tabValue, setTabValue] = useState(0);

  // Dialog and action states
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [batchItems, setBatchItems] = useState<SerialNumberItem[]>([]);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showBatchDetails, setShowBatchDetails] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
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

  // Handle delivery navigation
  const handleDelivery = (sku: string) => {
    navigate(`/delivery?sku=${sku}`);
  };

  // Handle serial number assignment
  const handleAssignSerialNumbers = async (batchId: string) => {
    try {
      const items = await inventoryService.getItemsByBatchId(batchId);
      const itemsWithoutSerial = items.filter(item => !item.serialNumber);
      
      if (itemsWithoutSerial.length === 0) {
        setError('All items in this batch already have serial numbers');
        return;
      }

      setBatchItems(itemsWithoutSerial);
      setShowAssignmentDialog(true);
    } catch (err) {
      console.error('Error loading batch items:', err);
      setError('Failed to load batch items');
    }
  };

  // Process serial number assignments
  const processSerialNumberAssignments = async (assignments: Array<{ itemId: string; serialNumber: string }>) => {
    if (!user) return;

    setAssignmentLoading(true);
    try {
      const bulkForm: BulkSerialNumberForm = {
        batchId: selectedBatch?.id || '',
        serialNumbers: assignments,
        assignedBy: user.uid,
        notes: 'Bulk assignment from inventory management',
      };

      const result = await inventoryService.bulkAssignSerialNumbers(bulkForm);
      
      if (result.successful > 0) {
        await loadInventoryData(); // Reload data
        setShowAssignmentDialog(false);
        
        if (result.failed > 0) {
          setError(`Assigned ${result.successful} serial numbers. ${result.failed} failed: ${result.errors.join(', ')}`);
        } else {
          setError(null);
        }
      } else {
        setError(`Failed to assign serial numbers: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      console.error('Error assigning serial numbers:', err);
      setError('Failed to assign serial numbers');
    } finally {
      setAssignmentLoading(false);
    }
  };

  // View batch details
  const viewBatchDetails = async (batch: InventoryBatch) => {
    try {
      const items = await inventoryService.getItemsByBatchId(batch.id);
      setSelectedBatch(batch);
      setBatchItems(items);
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
      return <Chip label="New" color="success" size="small" icon={<NewReleases />} />;
    } else if (sources.fromReturns > 0) {
      return <Chip label="Returns" color="secondary" size="small" icon={<Replay />} />;
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
              Manage stock levels, serial numbers, and item tracking
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
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
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
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Assignment Rate
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {Math.round(stats.serialNumberAssignmentRate)}%
                  </Typography>
                </Box>
                <TrendingUp color={stats.serialNumberAssignmentRate > 80 ? 'success' : 'warning'} fontSize="large" />
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
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Inventory by Product (SKU)
            </Typography>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab label="Summary View" />
              <Tab label="Serial Number Focus" />
            </Tabs>
          </Box>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Source</TableCell>
                  {tabValue === 1 && <TableCell>Serial Number Progress</TableCell>}
                  <TableCell>Total Items</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tabValue === 1 ? 7 : 6} align="center" sx={{ py: 4 }}>
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
                    const needsSerialNumbers = item.itemsWithoutSerialNumbers > 0;
                    
                    return (
                      <TableRow key={item.sku} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {item.productName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontWeight="bold">
                            {item.sku}
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
                        {tabValue === 1 && (
                          <TableCell>
                            <Box>
                              <Box display="flex" alignItems="center" gap={1} mb={1}>
                                <Typography variant="body2" color={`${progress.color}.main`} fontWeight="bold">
                                  {progress.text}
                                </Typography>
                                {needsSerialNumbers && (
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
                        )}
                        <TableCell>
                          <Typography variant="body2">
                            {item.totalItems || item.totalAvailable}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.batches.length} batches
                          </Typography>
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
                            
                            {needsSerialNumbers && (
                              <Tooltip title="Assign Serial Numbers">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => {
                                    setSelectedBatch(item.batches[0]);
                                    handleAssignSerialNumbers(item.batches[0].id);
                                  }}
                                >
                                  <Assignment />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => viewBatchDetails(item.batches[0])}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            
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
      <SerialNumberAssignmentDialog
        open={showAssignmentDialog}
        onClose={() => setShowAssignmentDialog(false)}
        items={batchItems}
        onAssign={processSerialNumberAssignments}
        loading={assignmentLoading}
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
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary">Received Date:</Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedBatch.receivedDate), 'PPpp')}
                  </Typography>
                </Grid>
                <Grid size={12}>
                  <Typography variant="body2" color="text.secondary">Notes:</Typography>
                  <Typography variant="body1">{selectedBatch.batchNotes || 'No notes'}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />
              
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
                      <TableCell>Assigned Date</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Typography variant="body2">#{index + 1}</Typography>
                        </TableCell>
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
                            {item.assignedDate 
                              ? format(new Date(item.assignedDate), 'MMM dd, yyyy')
                              : 'Not assigned'
                            }
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            {!item.serialNumber && (
                              <Tooltip title="Assign Serial Number">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setBatchItems([item]);
                                    setShowBatchDetails(false);
                                    setShowAssignmentDialog(true);
                                  }}
                                >
                                  <Assignment />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="View History">
                              <IconButton size="small">
                                <History />
                              </IconButton>
                            </Tooltip>
                          </Box>
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
                handleAssignSerialNumbers(selectedBatch.id);
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
            viewBatchDetails(selectedForAction.batches[0]);
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
              setSelectedBatch(selectedForAction.batches[0]);
              handleAssignSerialNumbers(selectedForAction.batches[0].id);
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

      {/* Quick Actions Panel */}
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
                try {
                  const itemsNeedingSerial = await inventoryService.getItemsNeedingSerialNumbers(50);
                  if (itemsNeedingSerial.length > 0) {
                    setBatchItems(itemsNeedingSerial);
                    setShowAssignmentDialog(true);
                  }
                } catch (err) {
                  setError('Failed to load items needing serial numbers');
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