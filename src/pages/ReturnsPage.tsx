// src/pages/ReturnsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
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
  Grid,
  Alert,
  CircularProgress,
  Badge,
  MenuItem,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
} from '@mui/material';
import {
  Add,
  ArrowBack,
  Search,
  FilterList,
  Visibility,
  Edit,
  Inventory,
  Delete,
  AssignmentReturn,
  Warning,
  CheckCircle,
  Schedule,
  Info,
  Image as ImageIcon,
  CloudUpload,
  LocalShipping,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { returnService } from '../services/returnService';
import { Return, ReturnStatus, ReturnCondition } from '../types';
import { format } from 'date-fns';

const ReturnsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Load returns data
  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allReturns = await returnService.getAllReturns();
      setReturns(allReturns);
    } catch (err) {
      console.error('Error loading returns:', err);
      setError('Failed to load returns data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  // Filter returns based on search term and status
  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = searchTerm === '' ||
      returnItem.lpnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.sku && returnItem.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (returnItem.removalOrderId && returnItem.removalOrderId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || returnItem.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get status chip styling
  const getStatusChip = (status: ReturnStatus) => {
    switch (status) {
      case ReturnStatus.RECEIVED:
        return {
          label: 'Received',
          color: 'warning' as const,
          icon: <Schedule fontSize="small" />
        };
      case ReturnStatus.PROCESSED:
        return {
          label: 'Processed',
          color: 'info' as const,
          icon: <Info fontSize="small" />
        };
      case ReturnStatus.MOVED_TO_INVENTORY:
        return {
          label: 'In Inventory',
          color: 'success' as const,
          icon: <CheckCircle fontSize="small" />
        };
      default:
        return {
          label: String(status).toUpperCase(),
          color: 'default' as const,
          icon: undefined
        };
    }
  };

  // Get condition chip styling
  const getConditionChip = (condition: ReturnCondition) => {
    switch (condition) {
      case ReturnCondition.INTACT:
        return { color: 'success' as const };
      case ReturnCondition.OPENED:
        return { color: 'warning' as const };
      case ReturnCondition.DAMAGED:
        return { color: 'error' as const };
      default:
        return { color: 'default' as const };
    }
  };

  // Handle moving return to inventory
  const handleMoveToInventory = async (returnItem: Return) => {
    if (!user) return;
    
    setActionLoading(true);
    try {
      await returnService.moveReturnToInventory(returnItem.id, user.uid);
      await loadReturns(); // Refresh the list
      setDetailDialogOpen(false);
      setSelectedReturn(null);
    } catch (err) {
      console.error('Error moving to inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to move item to inventory');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle viewing return details
  const handleViewDetails = (returnItem: Return) => {
    setSelectedReturn(returnItem);
    setDetailDialogOpen(true);
  };

  // Get statistics
  const getStats = () => {
    const total = returns.length;
    const received = returns.filter(r => r.status === ReturnStatus.RECEIVED).length;
    const processed = returns.filter(r => r.status === ReturnStatus.PROCESSED).length;
    const inInventory = returns.filter(r => r.status === ReturnStatus.MOVED_TO_INVENTORY).length;
    const withImages = returns.filter(r => r.driveFiles && r.driveFiles.length > 0).length;
    
    return { total, received, processed, inInventory, withImages };
  };

  const stats = getStats();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress size={60} />
        <Typography sx={{ ml: 2 }}>Loading returns...</Typography>
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
              Returns Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage returned products and track their status
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/returns/new')}
          sx={{ borderRadius: 25 }}
        >
          Add Return
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Returns
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.total}
                  </Typography>
                </Box>
                <AssignmentReturn color="primary" fontSize="large" />
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
                    Pending Review
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.received}
                  </Typography>
                </Box>
                <Badge badgeContent={stats.received} color="warning">
                  <Schedule color="warning" fontSize="large" />
                </Badge>
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
                    Processed
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.processed}
                  </Typography>
                </Box>
                <Info color="info" fontSize="large" />
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
                    In Inventory
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.inInventory}
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
                    With Images
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.withImages}
                  </Typography>
                </Box>
                <ImageIcon color="secondary" fontSize="large" />
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
                placeholder="Search by LPN, Tracking, Product, SKU, or Removal Order ID..."
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
              <TextField
                select
                fullWidth
                label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <FilterList />
                    </InputAdornment>
                  ),
                }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value={ReturnStatus.RECEIVED}>Received</MenuItem>
                <MenuItem value={ReturnStatus.PROCESSED}>Processed</MenuItem>
                <MenuItem value={ReturnStatus.MOVED_TO_INVENTORY}>In Inventory</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredReturns.length} of {returns.length} returns
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Returns Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Return Items
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>LPN Number</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Condition</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>FBA/FBM</TableCell>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Images</TableCell>
                  <TableCell>Received Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {searchTerm || statusFilter !== 'all' 
                          ? 'No returns match your filters' 
                          : 'No returns found. Click "Add Return" to get started.'
                        }
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReturns.map((returnItem) => {
                    const statusConfig = getStatusChip(returnItem.status);
                    const conditionConfig = getConditionChip(returnItem.condition);
                    
                    return (
                      <TableRow 
                        key={returnItem.id} 
                        hover
                        sx={{
                          backgroundColor: returnItem.status === ReturnStatus.MOVED_TO_INVENTORY 
                            ? 'success.light' 
                            : 'inherit',
                          opacity: returnItem.status === ReturnStatus.MOVED_TO_INVENTORY ? 0.8 : 1,
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                            {returnItem.lpnNumber}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Track: {returnItem.trackingNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {returnItem.productName}
                          </Typography>
                          {returnItem.sku && (
                            <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                              SKU: {returnItem.sku}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={returnItem.condition}
                            color={conditionConfig.color}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusConfig.label}
                            color={statusConfig.color}
                            size="small"
                            icon={statusConfig.icon}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={returnItem.fbaFbm || 'N/A'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {returnItem.quantity}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {returnItem.driveFiles && returnItem.driveFiles.length > 0 ? (
                              <Tooltip title={`${returnItem.driveFiles.length} images attached`}>
                                <Badge badgeContent={returnItem.driveFiles.length} color="primary">
                                  <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.light' }}>
                                    <ImageIcon fontSize="small" />
                                  </Avatar>
                                </Badge>
                              </Tooltip>
                            ) : (
                              <Tooltip title="No images attached">
                                <Avatar sx={{ width: 24, height: 24, bgcolor: 'grey.300' }}>
                                  <Warning fontSize="small" color="action" />
                                </Avatar>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {format(new Date(returnItem.receivedDate), 'MMM dd, yyyy')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(returnItem.receivedDate), 'p')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1}>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(returnItem)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Return">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/returns/${returnItem.id}/edit`)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Move to Inventory">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleMoveToInventory(returnItem)}
                                disabled={returnItem.status === ReturnStatus.MOVED_TO_INVENTORY || actionLoading}
                              >
                                <Inventory />
                              </IconButton>
                            </Tooltip>
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
        aria-label="add return"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => navigate('/returns/new')}
      >
        <Add />
      </Fab>

      {/* Return Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Return Details</Typography>
            {selectedReturn && (
              <Chip
                label={getStatusChip(selectedReturn.status).label}
                color={getStatusChip(selectedReturn.status).color}
                icon={getStatusChip(selectedReturn.status).icon}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReturn && (
            <Grid container spacing={3}>
              <Grid size={12}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">LPN Number</Typography>
                      <Typography variant="body1" fontFamily="monospace" fontWeight="bold">
                        {selectedReturn.lpnNumber}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Tracking Number</Typography>
                      <Typography variant="body1" fontFamily="monospace">
                        {selectedReturn.trackingNumber}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Product Name</Typography>
                      <Typography variant="body1">{selectedReturn.productName}</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">SKU</Typography>
                      <Typography variant="body1" fontFamily="monospace">
                        {selectedReturn.sku || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Condition</Typography>
                      <Chip
                        label={selectedReturn.condition}
                        color={getConditionChip(selectedReturn.condition).color}
                        size="small"
                      />
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Quantity</Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {selectedReturn.quantity}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">FBA/FBM</Typography>
                      <Typography variant="body1">{selectedReturn.fbaFbm || 'N/A'}</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Removal Order ID</Typography>
                      <Typography variant="body1" fontFamily="monospace">
                        {selectedReturn.removalOrderId || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Serial Number</Typography>
                      <Typography variant="body1" fontFamily="monospace">
                        {selectedReturn.serialNumber || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="caption" color="text.secondary">Received Date</Typography>
                      <Typography variant="body1">
                        {format(new Date(selectedReturn.receivedDate), 'PPpp')}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>

              {/* Remarks/Notes */}
              {selectedReturn.notes && (
                <Grid size={12}>
                  <Typography variant="subtitle2" gutterBottom>Remarks</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2">{selectedReturn.notes}</Typography>
                  </Paper>
                </Grid>
              )}

              {/* Images Section */}
              <Grid size={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Product Images ({selectedReturn.driveFiles?.length || 0})
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50', minHeight: 200 }}>
                  {selectedReturn.driveFiles && selectedReturn.driveFiles.length > 0 ? (
                    <Grid container spacing={2}>
                      {selectedReturn.driveFiles.map((file, index) => (
                        <Grid size={4} key={file.fileId}>
                          <Card sx={{ cursor: 'pointer' }}>
                            {/* Check if it's a mock file (starts with mock_file_) */}
                            {file.fileId.startsWith('mock_file_') ? (
                              <Box
                                sx={{
                                  width: '100%',
                                  height: 120,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  bgcolor: 'grey.200',
                                  borderRadius: 1,
                                  flexDirection: 'column'
                                }}
                              >
                                <ImageIcon sx={{ fontSize: 32, color: 'grey.500', mb: 1 }} />
                                <Typography variant="caption" color="text.secondary">
                                  Mock Image
                                </Typography>
                              </Box>
                            ) : (
                              <Box
                                component="img"
                                src={file.webViewLink.replace("view?usp=drivesdk", "uc?export=view")}
                                alt={file.fileName}
                                sx={{
                                  width: '100%',
                                  height: 120,
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                }}
                                onClick={() => window.open(file.webViewLink, '_blank')}
                                onError={(e) => {
                                  // If image fails to load, show placeholder
                                  const target = e.target as HTMLElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                      <div style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background-color: #f5f5f5; border-radius: 4px; flex-direction: column;">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="#999">
                                          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                        </svg>
                                        <span style="font-size: 12px; color: #999; margin-top: 4px;">Image not available</span>
                                      </div>
                                    `;
                                  }
                                }}
                              />
                            )}
                            <CardContent sx={{ p: 1 }}>
                              <Typography variant="caption" noWrap>
                                {file.fileName}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary">
                                {file.fileId.startsWith('mock_file_') ? 'Mock Upload' : 'Google Drive'}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      height={120}
                      color="text.secondary"
                    >
                      <ImageIcon sx={{ fontSize: 48, mb: 1 }} />
                      <Typography variant="body2">No images attached</Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          {selectedReturn && selectedReturn.status !== ReturnStatus.MOVED_TO_INVENTORY && (
            <Button
              variant="contained"
              startIcon={<Inventory />}
              onClick={() => selectedReturn && handleMoveToInventory(selectedReturn)}
              disabled={actionLoading}
            >
              {actionLoading ? 'Moving...' : 'Move to Inventory'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={() => {
              if (selectedReturn) {
                navigate(`/returns/${selectedReturn.id}/edit`);
              }
            }}
          >
            Edit Return
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReturnsPage;