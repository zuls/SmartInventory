// src/pages/ReturnsPage.tsx - Updated with Enhanced Serial Number Management
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
  Grid2 as Grid, // <-- CHANGE HERE
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
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  Stepper,
  Step,
  StepLabel,
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
  QrCodeScanner,
  MoreVert,
  History,
  Assignment,
  ErrorOutline,
  ThumbUp,
  ThumbDown,
  ExpandMore,
  PlayArrow,
  Pause,
  Stop,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { returnService } from '../services/returnService';
import { inventoryService } from '../services/inventoryService';
import {
  Return,
  ReturnStatus,
  ReturnCondition,
  SerialNumberValidation,
  InventoryItemStatus,
} from '../types';
import { format } from 'date-fns';

// Quick Serial Number Scanner Component
const QuickSerialScanner: React.FC<{
  open: boolean;
  onClose: () => void;
  onScanResult: (serialNumber: string, validation: SerialNumberValidation) => void;
}> = ({ open, onClose, onScanResult }) => {
  const [serialNumber, setSerialNumber] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<SerialNumberValidation | null>(null);

  const validateSerial = async (sn: string) => {
    if (!sn.trim()) {
      setValidation(null);
      return;
    }

    setValidating(true);
    try {
      const result = await returnService.validateSerialNumberForReturn(sn);
      setValidation(result);
    } catch (error) {
      setValidation({ exists: false });
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (serialNumber) {
      const timeoutId = setTimeout(() => validateSerial(serialNumber), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [serialNumber]);

  const handleSubmit = () => {
    if (validation) {
      onScanResult(serialNumber, validation);
      setSerialNumber('');
      setValidation(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Quick Serial Number Lookup</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Serial Number"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          placeholder="Scan or enter serial number"
          sx={{ mt: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <QrCodeScanner />
              </InputAdornment>
            ),
            endAdornment: validating ? (
              <CircularProgress size={20} />
            ) : undefined,
          }}
        />

        {validation && (
          <Alert
            severity={validation.exists ? 'success' : 'warning'}
            sx={{ mt: 2 }}
          >
            {validation.exists ? (
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  Serial number found: {validation.batch?.productName}
                </Typography>
                <Typography variant="caption">
                  Current Status: {validation.currentStatus} • SKU: {validation.batch?.sku}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2">
                Serial number not found - will create new product
              </Typography>
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!serialNumber.trim() || validating}
        >
          {validation?.exists ? 'Process Return' : 'Create New Product'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Return Decision Component
const ReturnDecisionDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  returnItem: Return | null;
  onDecision: (decision: 'move_to_inventory' | 'keep_in_returns', notes?: string) => void;
  loading?: boolean;
}> = ({ open, onClose, returnItem, onDecision, loading = false }) => {
  const [decision, setDecision] = useState<'move_to_inventory' | 'keep_in_returns'>('move_to_inventory');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    onDecision(decision, notes);
    setNotes('');
  };

  if (!returnItem) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Make Return Decision</DialogTitle>
      <DialogContent>
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            {returnItem.productName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Serial Number: {returnItem.serialNumber} • LPN: {returnItem.lpnNumber}
          </Typography>
          <Chip
            label={returnItem.condition}
            color={
              returnItem.condition === ReturnCondition.INTACT ? 'success' :
              returnItem.condition === ReturnCondition.OPENED ? 'warning' : 'error'
            }
            size="small"
            sx={{ mt: 1 }}
          />
        </Box>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Decision</InputLabel>
          <Select
            value={decision}
            label="Decision"
            onChange={(e) => setDecision(e.target.value as any)}
          >
            <MenuItem value="move_to_inventory">
              <Box display="flex" alignItems="center" gap={1}>
                <Inventory color="success" />
                <Box>
                  <Typography variant="body2">Move to Inventory</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Make available for delivery
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
            <MenuItem value="keep_in_returns">
              <Box display="flex" alignItems="center" gap={1}>
                <AssignmentReturn color="warning" />
                <Box>
                  <Typography variant="body2">Keep in Returns</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Keep in returns section
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Decision Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why are you making this decision?"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Processing...' : 'Apply Decision'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ReturnsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data states
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [tabValue, setTabValue] = useState(0);

  // Dialog states
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);

  // Statistics state
  const [stats, setStats] = useState({
    totalReturns: 0,
    pendingDecisions: 0,
    movedToInventory: 0,
    keptInReturns: 0,
    returnsWithImages: 0,
    returnsWithSerialNumbers: 0,
    returnsByCondition: {
      [ReturnCondition.INTACT]: 0,
      [ReturnCondition.OPENED]: 0,
      [ReturnCondition.DAMAGED]: 0,
    },
    todayReturns: 0,
  });

  // Load returns data
  const loadReturns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [allReturns, returnStats] = await Promise.all([
        returnService.getAllReturns(),
        returnService.getReturnStatistics(),
      ]);

      setReturns(allReturns);
      setStats(returnStats);
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

  // Filter returns based on current filters
  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = searchTerm === '' ||
      returnItem.lpnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.sku && returnItem.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (returnItem.serialNumber && returnItem.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (returnItem.removalOrderId && returnItem.removalOrderId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || returnItem.status === statusFilter;
    const matchesCondition = conditionFilter === 'all' || returnItem.condition === conditionFilter;
    const matchesDecision = decisionFilter === 'all' ||
      (decisionFilter === 'pending' && returnItem.returnDecision === 'pending') ||
      (decisionFilter === 'decided' && returnItem.returnDecision !== 'pending');

    return matchesSearch && matchesStatus && matchesCondition && matchesDecision;
  });

  // Get returns by tab
  const getReturnsByTab = () => {
    switch (tabValue) {
      case 0: return filteredReturns; // All
      case 1: return filteredReturns.filter(r => r.returnDecision === 'pending'); // Pending Decisions
      case 2: return filteredReturns.filter(r => r.returnDecision === 'move_to_inventory'); // Moved to Inventory
      case 3: return filteredReturns.filter(r => r.returnDecision === 'keep_in_returns'); // Kept in Returns
      default: return filteredReturns;
    }
  };

  const displayedReturns = getReturnsByTab();

  // Handle serial number scan result
  const handleSerialScanResult = (serialNumber: string, validation: SerialNumberValidation) => {
    if (validation.exists) {
      // Navigate to add return page with pre-filled serial number
      navigate(`/returns/new?serial=${serialNumber}`);
    } else {
      // Navigate to add return page for new product
      navigate(`/returns/new?serial=${serialNumber}&new=true`);
    }
  };

  // Handle return decision
  const handleReturnDecision = async (decision: 'move_to_inventory' | 'keep_in_returns', notes?: string) => {
    if (!selectedReturn || !user) return;

    setActionLoading(true);
    try {
      await returnService.makeReturnDecision(selectedReturn.id, decision, user.uid, notes);
      await loadReturns(); // Refresh data
      setDecisionDialogOpen(false);
      setSelectedReturn(null);
    } catch (err) {
      console.error('Error making return decision:', err);
      setError(err instanceof Error ? err.message : 'Failed to process return decision');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle bulk operations
  const handleBulkMoveToInventory = async () => {
    const pendingReturns = returns.filter(r => r.returnDecision === 'pending');

    if (pendingReturns.length === 0) {
      setError('No pending returns to process');
      return;
    }

    if (!confirm(`Move ${pendingReturns.length} pending returns to inventory?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await Promise.all(
        pendingReturns.map(ret =>
          returnService.makeReturnDecision(ret.id, 'move_to_inventory', user!.uid, 'Bulk operation')
        )
      );
      await loadReturns();
    } catch (err) {
      setError('Failed to process bulk operation');
    } finally {
      setActionLoading(false);
    }
  };

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
      case ReturnStatus.KEPT_IN_RETURNS:
        return {
          label: 'Kept in Returns',
          color: 'secondary' as const,
          icon: <AssignmentReturn fontSize="small" />
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
        return { color: 'success' as const, icon: <CheckCircle fontSize="small" /> };
      case ReturnCondition.OPENED:
        return { color: 'warning' as const, icon: <Warning fontSize="small" /> };
      case ReturnCondition.DAMAGED:
        return { color: 'error' as const, icon: <ErrorOutline fontSize="small" /> };
      default:
        return { color: 'default' as const, icon: undefined };
    }
  };

  // Get decision indicator
  const getDecisionIndicator = (returnItem: Return) => {
    if (returnItem.returnDecision === 'pending') {
      return <Chip label="Pending Decision" color="warning" size="small" icon={<Schedule />} />;
    } else if (returnItem.returnDecision === 'move_to_inventory') {
      return <Chip label="Moved to Inventory" color="success" size="small" icon={<ThumbUp />} />;
    } else if (returnItem.returnDecision === 'keep_in_returns') {
      return <Chip label="Kept in Returns" color="secondary" size="small" icon={<ThumbDown />} />;
    }
    return null;
  };

  // Handle action menu
  const handleActionMenu = (event: React.MouseEvent<HTMLElement>, returnItem: Return) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedReturn(returnItem);
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setSelectedReturn(null);
  };

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
              Process returns with serial number scanning and decision workflow
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<QrCodeScanner />}
            onClick={() => setScannerOpen(true)}
          >
            Quick Scan
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/returns/new')}
            sx={{ borderRadius: 25 }}
          >
            Add Return
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Total Returns
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalReturns}
                  </Typography>
                </Box>
                <AssignmentReturn color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Pending Decisions
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.pendingDecisions}
                  </Typography>
                </Box>
                <Badge badgeContent={stats.pendingDecisions} color="warning">
                  <Schedule color="warning" fontSize="large" />
                </Badge>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    In Inventory
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.movedToInventory}
                  </Typography>
                </Box>
                <CheckCircle color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    With Serial #
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.returnsWithSerialNumbers}
                  </Typography>
                </Box>
                <Assignment color="info" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={2.4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    With Images
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.returnsWithImages}
                  </Typography>
                </Box>
                <ImageIcon color="secondary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by LPN, Serial #, Product, SKU..."
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
            <Grid xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value={ReturnStatus.RECEIVED}>Received</MenuItem>
                  <MenuItem value={ReturnStatus.MOVED_TO_INVENTORY}>In Inventory</MenuItem>
                  <MenuItem value={ReturnStatus.KEPT_IN_RETURNS}>Kept in Returns</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Condition</InputLabel>
                <Select
                  value={conditionFilter}
                  label="Condition"
                  onChange={(e) => setConditionFilter(e.target.value)}
                >
                  <MenuItem value="all">All Conditions</MenuItem>
                  <MenuItem value={ReturnCondition.INTACT}>Intact</MenuItem>
                  <MenuItem value={ReturnCondition.OPENED}>Opened</MenuItem>
                  <MenuItem value={ReturnCondition.DAMAGED}>Damaged</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Decision</InputLabel>
                <Select
                  value={decisionFilter}
                  label="Decision"
                  onChange={(e) => setDecisionFilter(e.target.value)}
                >
                  <MenuItem value="all">All Decisions</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="decided">Decided</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={2}>
              {stats.pendingDecisions > 0 && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={handleBulkMoveToInventory}
                  disabled={actionLoading}
                  sx={{ height: '56px' }}
                >
                  Bulk Process
                </Button>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Returns Table with Tabs */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">
              Return Items
            </Typography>
            <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
              <Tab
                label={
                  <Badge badgeContent={filteredReturns.length} color="primary">
                    All Returns
                  </Badge>
                }
              />
              <Tab
                label={
                  <Badge badgeContent={stats.pendingDecisions} color="warning">
                    Pending Decisions
                  </Badge>
                }
              />
              <Tab
                label={
                  <Badge badgeContent={stats.movedToInventory} color="success">
                    In Inventory
                  </Badge>
                }
              />
              <Tab
                label={
                  <Badge badgeContent={stats.keptInReturns} color="secondary">
                    Kept in Returns
                  </Badge>
                }
              />
            </Tabs>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>LPN / Serial Number</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Condition</TableCell>
                  <TableCell>Status & Decision</TableCell>
                  <TableCell>Images</TableCell>
                  <TableCell>Received Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {searchTerm || statusFilter !== 'all' || conditionFilter !== 'all' || decisionFilter !== 'all'
                          ? 'No returns match your filters'
                          : tabValue === 1
                            ? 'No pending decisions - great job!'
                            : 'No returns found. Click "Add Return" to get started.'
                        }
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedReturns.map((returnItem) => {
                    const statusConfig = getStatusChip(returnItem.status);
                    const conditionConfig = getConditionChip(returnItem.condition);

                    return (
                      <TableRow
                        key={returnItem.id}
                        hover
                        sx={{
                          backgroundColor: returnItem.status === ReturnStatus.MOVED_TO_INVENTORY
                            ? 'success.light'
                            : returnItem.returnDecision === 'pending'
                              ? 'warning.light'
                              : 'inherit',
                          opacity: returnItem.status === ReturnStatus.MOVED_TO_INVENTORY ? 0.8 : 1,
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold" fontFamily="monospace">
                              {returnItem.lpnNumber}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Track: {returnItem.trackingNumber}
                            </Typography>
                            {returnItem.serialNumber && (
                              <Typography variant="caption" display="block" color="primary.main" fontFamily="monospace">
                                SN: {returnItem.serialNumber}
                              </Typography>
                            )}
                          </Box>
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
                            icon={conditionConfig.icon}
                          />
                        </TableCell>
                        <TableCell>
                          <Box display="flex" flexDirection="column" gap={1}>
                            <Chip
                              label={statusConfig.label}
                              color={statusConfig.color}
                              size="small"
                              icon={statusConfig.icon}
                            />
                            {getDecisionIndicator(returnItem)}
                          </Box>
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
                                onClick={() => navigate(`/returns/${returnItem.id}`)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>

                            {returnItem.returnDecision === 'pending' && (
                              <Tooltip title="Make Decision">
                                <IconButton
                                  size="small"
                                  color="warning"
                                  onClick={() => {
                                    setSelectedReturn(returnItem);
                                    setDecisionDialogOpen(true);
                                  }}
                                >
                                  <Assignment />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title="Edit Return">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/returns/${returnItem.id}/edit`)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>

                            <IconButton
                              size="small"
                              onClick={(e) => handleActionMenu(e, returnItem)}
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
        aria-label="add return"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={() => navigate('/returns/new')}
      >
        <Add />
      </Fab>

      {/* Quick Action Panel for Pending Decisions */}
      {stats.pendingDecisions > 0 && (
        <Card sx={{ position: 'fixed', bottom: 100, right: 24, width: 300 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Pending Decisions
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                {stats.pendingDecisions} returns need decisions
              </Typography>
            </Alert>
            <Box display="flex" gap={1}>
              <Button
                fullWidth
                variant="contained"
                size="small"
                startIcon={<Assignment />}
                onClick={() => setTabValue(1)}
              >
                Review All
              </Button>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<PlayArrow />}
                onClick={handleBulkMoveToInventory}
                disabled={actionLoading}
              >
                Bulk Process
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Quick Serial Scanner Dialog */}
      <QuickSerialScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanResult={handleSerialScanResult}
      />

      {/* Return Decision Dialog */}
      <ReturnDecisionDialog
        open={decisionDialogOpen}
        onClose={() => setDecisionDialogOpen(false)}
        returnItem={selectedReturn}
        onDecision={handleReturnDecision}
        loading={actionLoading}
      />

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={closeActionMenu}
      >
        <MenuItem onClick={() => {
          if (selectedReturn) {
            navigate(`/returns/${selectedReturn.id}`);
          }
          closeActionMenu();
        }}>
          <ListItemIcon><Visibility fontSize="small" /></ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => {
          if (selectedReturn) {
            navigate(`/returns/${selectedReturn.id}/edit`);
          }
          closeActionMenu();
        }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Return</ListItemText>
        </MenuItem>

        {selectedReturn?.returnDecision === 'pending' && (
          <MenuItem onClick={() => {
            setDecisionDialogOpen(true);
            closeActionMenu();
          }}>
            <ListItemIcon><Assignment fontSize="small" /></ListItemIcon>
            <ListItemText>Make Decision</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={() => {
          if (selectedReturn?.serialNumber) {
            navigate(`/search?q=${selectedReturn.serialNumber}`);
          }
          closeActionMenu();
        }}>
          <ListItemIcon><Search fontSize="small" /></ListItemIcon>
          <ListItemText>Search Serial Number</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => {
          // View history functionality
          closeActionMenu();
        }}>
          <ListItemIcon><History fontSize="small" /></ListItemIcon>
          <ListItemText>View History</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem onClick={() => {
          if (selectedReturn && confirm('Are you sure you want to delete this return?')) {
            // Delete functionality
          }
          closeActionMenu();
        }}>
          <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
          <ListItemText>Delete Return</ListItemText>
        </MenuItem>
      </Menu>

      {/* Enhanced Return Detail Dialog */}
      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Return Details</Typography>
            {selectedReturn && (
              <Box display="flex" gap={1}>
                {getStatusChip(selectedReturn.status) && (
                  <Chip
                    label={getStatusChip(selectedReturn.status).label}
                    color={getStatusChip(selectedReturn.status).color}
                    icon={getStatusChip(selectedReturn.status).icon}
                  />
                )}
                {getDecisionIndicator(selectedReturn)}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReturn && (
            <Grid container spacing={3}>
              {/* Return Information */}
              <Grid xs={12}>
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Return Information
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">LPN Number</Typography>
                        <Typography variant="body1" fontFamily="monospace" fontWeight="bold">
                          {selectedReturn.lpnNumber}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Tracking Number</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {selectedReturn.trackingNumber}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Serial Number</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {selectedReturn.serialNumber || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Product Name</Typography>
                        <Typography variant="body1">{selectedReturn.productName}</Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">SKU</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {selectedReturn.sku || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Condition</Typography>
                        <Chip
                          label={selectedReturn.condition}
                          color={getConditionChip(selectedReturn.condition).color}
                          size="small"
                          icon={getConditionChip(selectedReturn.condition).icon}
                        />
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Quantity</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {selectedReturn.quantity}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">FBA/FBM</Typography>
                        <Typography variant="body1">{selectedReturn.fbaFbm || 'Not specified'}</Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Removal Order ID</Typography>
                        <Typography variant="body1" fontFamily="monospace">
                          {selectedReturn.removalOrderId || 'Not provided'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Received Date</Typography>
                        <Typography variant="body1">
                          {format(new Date(selectedReturn.receivedDate), 'PPpp')}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography variant="caption" color="text.secondary">Received By</Typography>
                        <Typography variant="body1">{selectedReturn.receivedBy}</Typography>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>

              {/* Decision Information */}
              {selectedReturn.returnDecision !== 'pending' && (
                <Grid xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Decision Information
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid xs={6}>
                          <Typography variant="caption" color="text.secondary">Decision</Typography>
                          <Typography variant="body1">
                            {selectedReturn.returnDecision === 'move_to_inventory' ? 'Moved to Inventory' : 'Kept in Returns'}
                          </Typography>
                        </Grid>
                        <Grid xs={6}>
                          <Typography variant="caption" color="text.secondary">Decision Date</Typography>
                          <Typography variant="body1">
                            {selectedReturn.returnDecisionDate
                              ? format(new Date(selectedReturn.returnDecisionDate), 'PPpp')
                              : 'Not available'
                            }
                          </Typography>
                        </Grid>
                        <Grid xs={6}>
                          <Typography variant="caption" color="text.secondary">Decision By</Typography>
                          <Typography variant="body1">{selectedReturn.returnDecisionBy || 'Not available'}</Typography>
                        </Grid>
                        <Grid xs={12}>
                          <Typography variant="caption" color="text.secondary">Decision Notes</Typography>
                          <Typography variant="body1">
                            {selectedReturn.returnDecisionNotes || 'No notes provided'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              )}

              {/* Remarks/Notes */}
              {selectedReturn.notes && (
                <Grid xs={12}>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Remarks & Notes
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="body2">{selectedReturn.notes}</Typography>
                      </Paper>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              )}

              {/* Images Section */}
              <Grid xs={12}>
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Product Images ({selectedReturn.driveFiles?.length || 0})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', minHeight: 200 }}>
                      {selectedReturn.driveFiles && selectedReturn.driveFiles.length > 0 ? (
                        <Grid container spacing={2}>
                          {selectedReturn.driveFiles.map((file, index) => (
                            <Grid xs={3} key={file.fileId}>
                              <Card sx={{ cursor: 'pointer' }}>
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
                  </AccordionDetails>
                </Accordion>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          {selectedReturn && selectedReturn.returnDecision === 'pending' && (
            <Button
              variant="contained"
              startIcon={<Assignment />}
              onClick={() => {
                setDetailDialogOpen(false);
                setDecisionDialogOpen(true);
              }}
            >
              Make Decision
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