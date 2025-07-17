// src/pages/DeliveryPage.tsx - Updated with Serial Number Assignment Support
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Divider,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Avatar,
  Badge,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemButton,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  LocalShipping,
  ArrowBack,
  QrCodeScanner,
  Save,
  CheckCircle,
  Warning,
  Info,
  Search,
  Add,
  Delete,
  Edit,
  Assignment,
  Inventory,
  Person,
  LocationOn,
  Schedule,
  ExpandMore,
  FlashOn,
  FlashOff,
  Speed,
  NewReleases,
  Visibility,
  ErrorOutline,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ObjectSchema } from 'yup';
import { useAuth } from '../hooks/useAuth';
import { inventoryService } from '../services/inventoryService';
import { 
  DeliveryForm, 
  Carrier, 
  InventoryBatch, 
  SerialNumberItem,
  InventoryItemStatus,
  DeliveryWithSerialNumber,
  ShippingLabelData,
  CustomerInfo,
} from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { format } from 'date-fns';

const carriers = [
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'Other', label: 'Other' },
];

const schema = yup.object().shape({
  inventoryBatchId: yup.string().required('Inventory batch selection is required'),
  selectedItemId: yup.string().optional(),
  productSerialNumber: yup.string().optional(),
  shippingLabelData: yup.object().shape({
    labelNumber: yup.string().required('Label number is required'),
    carrier: yup.string().required('Carrier is required'),
    trackingNumber: yup.string().optional(),
    destination: yup.string().required('Destination is required'),
    weight: yup.string().optional(),
    dimensions: yup.string().optional(),
    serviceType: yup.string().optional(),
  }).required(),
  customerInfo: yup.object().shape({
    name: yup.string().optional(),
    address: yup.string().optional(),
    email: yup.string().email('Invalid email format').optional(),
    phone: yup.string().optional(),
  }).required(),
  deliveryTracking: yup.string().optional(),
}) as ObjectSchema<DeliveryForm>;

const DeliveryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Get SKU from URL params if navigated from inventory
  const urlParams = new URLSearchParams(location.search);
  const preSelectedSKU = urlParams.get('sku');
  
  // Form and UI states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [deliveryResult, setDeliveryResult] = useState<DeliveryWithSerialNumber | null>(null);
  
  // Inventory states
  const [availableInventory, setAvailableInventory] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [availableItems, setAvailableItems] = useState<SerialNumberItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SerialNumberItem | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  
  // Serial number states
  const [serialNumberMode, setSerialNumberMode] = useState<'assign_now' | 'use_existing' | 'select_item'>('select_item');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [serialNumberValidation, setSerialNumberValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [serialNumberLoading, setSerialNumberLoading] = useState(false);
  
  // Scanner states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanType, setScanType] = useState<'label' | 'tracking' | 'serial'>('label');
  
  // Dialog states
  const [batchSelectionOpen, setBatchSelectionOpen] = useState(false);
  const [itemSelectionOpen, setItemSelectionOpen] = useState(false);
  const [showItemDetails, setShowItemDetails] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  
  // Search states
  const [searchSKU, setSearchSKU] = useState(preSelectedSKU || '');
  const [quickDeliveryMode, setQuickDeliveryMode] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DeliveryForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      inventoryBatchId: '',
      selectedItemId: '',
      productSerialNumber: '',
      shippingLabelData: {
        labelNumber: '',
        carrier: 'FedEx' as Carrier,
        trackingNumber: '',
        destination: '',
        weight: '',
        dimensions: '',
        serviceType: 'Standard',
      },
      customerInfo: {
        name: '',
        address: '',
        email: '',
        phone: '',
      },
      deliveryTracking: '',
    },
  });

  const watchedBatchId = watch('inventoryBatchId');
  const watchedItemId = watch('selectedItemId');

  // Load available inventory
  useEffect(() => {
    const loadAvailableInventory = async () => {
      try {
        setInventoryLoading(true);
        if (searchSKU) {
          const inventory = await inventoryService.getAvailableInventoryForSKU(searchSKU);
          setAvailableInventory(inventory);
        } else {
          const summary = await inventoryService.getInventorySummaryBySKU();
          setAvailableInventory(summary.filter(item => item.totalAvailable > 0));
        }
      } catch (err) {
        console.error('Error loading inventory:', err);
        setError('Failed to load available inventory');
      } finally {
        setInventoryLoading(false);
      }
    };

    loadAvailableInventory();
  }, [searchSKU]);

  // Load available items when batch changes
  useEffect(() => {
    if (watchedBatchId) {
      const loadBatchItems = async () => {
        try {
          setInventoryLoading(true);
          const [batch, items] = await Promise.all([
            inventoryService.getInventoryBatchById(watchedBatchId),
            inventoryService.getAvailableItemsForDelivery(selectedBatch?.sku || ''),
          ]);
          
          setSelectedBatch(batch);
          const batchItems = items.filter(item => item.batchId === watchedBatchId);
          setAvailableItems(batchItems);
          
          // Auto-select first item if only one available
          if (batchItems.length === 1) {
            setSelectedItem(batchItems[0]);
            setValue('selectedItemId', batchItems[0].id);
          }
        } catch (err) {
          console.error('Error loading batch items:', err);
          setError('Failed to load batch items');
        } finally {
          setInventoryLoading(false);
        }
      };
      loadBatchItems();
    }
  }, [watchedBatchId, selectedBatch?.sku]);

  // Update selected item when item ID changes
  useEffect(() => {
    if (watchedItemId) {
      const item = availableItems.find(i => i.id === watchedItemId);
      setSelectedItem(item || null);
      
      // Determine serial number mode based on item
      if (item) {
        if (item.serialNumber) {
          setSerialNumberMode('use_existing');
          setValue('productSerialNumber', item.serialNumber);
        } else {
          setSerialNumberMode('assign_now');
          setValue('productSerialNumber', '');
        }
      }
    }
  }, [watchedItemId, availableItems]);

  // Validate serial number
  const validateSerialNumber = async (serialNumber: string) => {
    if (!serialNumber.trim()) {
      setSerialNumberValidation(null);
      return;
    }

    setSerialNumberLoading(true);
    try {
      const validation = await inventoryService.validateSerialNumber(serialNumber);
      
      if (validation.exists) {
        setSerialNumberValidation({
          valid: false,
          error: 'Serial number already exists in system'
        });
      } else {
        setSerialNumberValidation({ valid: true });
      }
    } catch (error) {
      setSerialNumberValidation({
        valid: false,
        error: 'Failed to validate serial number'
      });
    } finally {
      setSerialNumberLoading(false);
    }
  };

  // Handle serial number changes
  useEffect(() => {
    if (serialNumberMode === 'assign_now' && newSerialNumber) {
      const timeoutId = setTimeout(() => {
        validateSerialNumber(newSerialNumber);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [newSerialNumber, serialNumberMode]);

  // Form submission
  const onSubmit = async (data: DeliveryForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    if (!selectedItem) {
      setError('Please select an item for delivery');
      return;
    }

    // Validate serial number requirement
    if (serialNumberMode === 'assign_now' && !newSerialNumber) {
      setError('Please assign a serial number before delivery');
      return;
    }

    if (serialNumberMode === 'assign_now' && serialNumberValidation && !serialNumberValidation.valid) {
      setError('Please fix serial number validation errors');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('🚚 Processing delivery:', {
        itemId: selectedItem.id,
        serialNumber: serialNumberMode === 'assign_now' ? newSerialNumber : selectedItem.serialNumber,
        customer: data.customerInfo.name,
        destination: data.shippingLabelData.destination,
      });

      // Prepare delivery data
      const deliveryData = {
        ...data,
        selectedItemId: selectedItem.id,
        productSerialNumber: serialNumberMode === 'assign_now' ? newSerialNumber : selectedItem.serialNumber,
      };

      // Process delivery
      const result = await inventoryService.deliverItemWithSerialNumber(deliveryData, user.uid);
      
      console.log('✅ Delivery processed successfully:', result);
      
      setDeliveryResult(result);
      setSuccess(true);
      setActiveStep(4); // Move to success step
      
      // Reset form after success
      setTimeout(() => {
        reset();
        setSelectedBatch(null);
        setSelectedItem(null);
        setAvailableItems([]);
        setNewSerialNumber('');
        setSerialNumberValidation(null);
        setActiveStep(0);
        setSuccess(false);
        setDeliveryResult(null);
      }, 5000);
      
    } catch (error) {
      console.error('Error processing delivery:', error);
      setError(error instanceof Error ? error.message : 'Failed to process delivery');
    } finally {
      setLoading(false);
    }
  };

  // Barcode scanning
  const handleScanBarcode = (type: 'label' | 'tracking' | 'serial') => {
    setScanType(type);
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    switch (scanType) {
      case 'label':
        setValue('shippingLabelData.labelNumber', scannedCode);
        break;
      case 'tracking':
        setValue('shippingLabelData.trackingNumber', scannedCode);
        break;
      case 'serial':
        setNewSerialNumber(scannedCode);
        setValue('productSerialNumber', scannedCode);
        break;
    }
    setScannerOpen(false);
  };

  // Handle batch selection
  const handleBatchSelection = (batch: InventoryBatch) => {
    setValue('inventoryBatchId', batch.id);
    setSelectedBatch(batch);
    setBatchSelectionOpen(false);
    setActiveStep(1);
  };

  // Handle item selection
  const handleItemSelection = (item: SerialNumberItem) => {
    setValue('selectedItemId', item.id);
    setSelectedItem(item);
    setItemSelectionOpen(false);
    setActiveStep(2);
  };

  // Auto-assign serial number
  const autoAssignSerialNumber = () => {
    if (selectedBatch) {
      const timestamp = Date.now().toString().slice(-6);
      const sku = selectedBatch.sku.replace(/[^A-Z0-9]/g, '').substring(0, 4);
      const autoSerial = `${sku}${timestamp}`;
      setNewSerialNumber(autoSerial);
      setValue('productSerialNumber', autoSerial);
    }
  };

  // Steps configuration
  const steps = [
    {
      label: 'Select Product',
      description: 'Choose product batch for delivery',
    },
    {
      label: 'Select Item',
      description: 'Choose specific item to deliver',
    },
    {
      label: 'Assign Serial Number',
      description: 'Assign or verify serial number',
    },
    {
      label: 'Shipping Details',
      description: 'Enter shipping information',
    },
    {
      label: 'Complete Delivery',
      description: 'Review and process delivery',
    },
  ];

  // Step content renderer
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Product for Delivery
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Search by SKU"
                  value={searchSKU}
                  onChange={(e) => setSearchSKU(e.target.value)}
                  placeholder="Enter SKU to filter products"
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1 }} />,
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  variant="outlined"
                  onClick={() => setBatchSelectionOpen(true)}
                  disabled={availableInventory.length === 0 || inventoryLoading}
                  startIcon={inventoryLoading ? <CircularProgress size={20} /> : <Add />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {inventoryLoading ? 'Loading...' : 'Select from Available Products'}
                </Button>
              </Grid>
            </Grid>

            {/* Selected Batch Display */}
            {selectedBatch && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Selected Product
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={4}>
                      <Typography variant="body2" color="text.secondary">Product:</Typography>
                      <Typography variant="body1">{selectedBatch.productName}</Typography>
                    </Grid>
                    <Grid size={4}>
                      <Typography variant="body2" color="text.secondary">SKU:</Typography>
                      <Typography variant="body1" fontFamily="monospace">{selectedBatch.sku}</Typography>
                    </Grid>
                    <Grid size={4}>
                      <Typography variant="body2" color="text.secondary">Available:</Typography>
                      <Typography variant="body1" color="success.main" fontWeight="bold">
                        {selectedBatch.availableQuantity}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            <Box display="flex" justifyContent="space-between" gap={2}>
              <Button
                variant="outlined"
                onClick={() => navigate('/inventory')}
                startIcon={<ArrowBack />}
              >
                Back to Inventory
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!selectedBatch}
                startIcon={<Inventory />}
              >
                Continue to Item Selection
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Specific Item
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Choose a specific item from the selected batch. Items with serial numbers are ready for immediate delivery.
              </Typography>
            </Alert>

            {/* Available Items List */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Available Items ({availableItems.length})
                </Typography>
                
                {availableItems.length === 0 ? (
                  <Alert severity="warning">
                    <Typography variant="body2">
                      No items available for delivery in this batch.
                    </Typography>
                  </Alert>
                ) : (
                  <List>
                    {availableItems.map((item, index) => (
                      <ListItem key={item.id} disablePadding>
                        <ListItemButton
                          onClick={() => handleItemSelection(item)}
                          selected={selectedItem?.id === item.id}
                          sx={{
                            border: selectedItem?.id === item.id ? '2px solid' : '1px solid',
                            borderColor: selectedItem?.id === item.id ? 'primary.main' : 'divider',
                            borderRadius: 1,
                            mb: 1,
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ bgcolor: item.serialNumber ? 'success.light' : 'warning.light' }}>
                              {item.serialNumber ? <CheckCircle /> : <Warning />}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body1">
                                  Item #{index + 1}
                                </Typography>
                                <Chip
                                  label={item.serialNumber ? 'Has Serial Number' : 'Needs Serial Number'}
                                  color={item.serialNumber ? 'success' : 'warning'}
                                  size="small"
                                />
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Serial Number: {item.serialNumber || 'Not assigned'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Created: {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>

            <Box display="flex" justifyContent="space-between" gap={2}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(0)}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
                disabled={!selectedItem}
                startIcon={<Assignment />}
              >
                Continue to Serial Number
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Serial Number Assignment
            </Typography>
            
            {selectedItem && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Selected Item
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">Product:</Typography>
                      <Typography variant="body1">{selectedBatch?.productName}</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">Current Serial:</Typography>
                      <Typography variant="body1" fontFamily="monospace">
                        {selectedItem.serialNumber || 'Not assigned'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Serial Number Mode Selection */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Serial Number Options
                </Typography>
                
                {selectedItem?.serialNumber ? (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Item already has serial number:</strong> {selectedItem.serialNumber}
                      </Typography>
                    </Alert>
                    <Typography variant="body2">
                      This item is ready for delivery with its existing serial number.
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Serial number required:</strong> This item needs a serial number before delivery.
                      </Typography>
                    </Alert>
                    
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 8 }}>
                        <TextField
                          fullWidth
                          label="Assign Serial Number *"
                          value={newSerialNumber}
                          onChange={(e) => setNewSerialNumber(e.target.value)}
                          placeholder="Enter or scan serial number"
                          error={serialNumberValidation && !serialNumberValidation.valid}
                          helperText={
                            serialNumberValidation?.error ||
                            (serialNumberValidation?.valid ? 'Serial number is valid' : 'Enter a unique serial number')
                          }
                          InputProps={{
                            startAdornment: (
                              <IconButton onClick={() => handleScanBarcode('serial')} edge="start">
                                <QrCodeScanner />
                              </IconButton>
                            ),
                            endAdornment: serialNumberLoading ? (
                              <CircularProgress size={20} />
                            ) : undefined,
                          }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Button
                          variant="outlined"
                          onClick={autoAssignSerialNumber}
                          fullWidth
                          sx={{ height: '56px' }}
                          startIcon={<FlashOn />}
                        >
                          Auto-Generate
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box display="flex" justifyContent="space-between" gap={2}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(1)}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(3)}
                disabled={!selectedItem?.serialNumber && !newSerialNumber}
                startIcon={<LocalShipping />}
              >
                Continue to Shipping Details
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Shipping Information
            </Typography>
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="shippingLabelData.labelNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Shipping Label Number *"
                      error={!!errors.shippingLabelData?.labelNumber}
                      helperText={errors.shippingLabelData?.labelNumber?.message}
                      placeholder="LABEL123456"
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => handleScanBarcode('label')} size="small">
                            <QrCodeScanner />
                          </IconButton>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="shippingLabelData.carrier"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      fullWidth
                      label="Carrier *"
                      error={!!errors.shippingLabelData?.carrier}
                      helperText={errors.shippingLabelData?.carrier?.message}
                    >
                      {carriers.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="shippingLabelData.trackingNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Tracking Number"
                      placeholder="1Z999AA1234567890"
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => handleScanBarcode('tracking')} size="small">
                            <QrCodeScanner />
                          </IconButton>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="shippingLabelData.destination"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Destination *"
                      error={!!errors.shippingLabelData?.destination}
                      helperText={errors.shippingLabelData?.destination?.message}
                      placeholder="City, State, ZIP"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="shippingLabelData.weight"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Weight"
                      placeholder="2.5 lbs"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="shippingLabelData.dimensions"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Dimensions"
                      placeholder="12x8x6 inches"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Customer Information (Optional)
                </Typography>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="customerInfo.name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Customer Name"
                      placeholder="John Doe"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="customerInfo.email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Email"
                      type="email"
                      error={!!errors.customerInfo?.email}
                      helperText={errors.customerInfo?.email?.message}
                      placeholder="customer@example.com"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="customerInfo.phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Phone"
                      placeholder="(555) 123-4567"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="deliveryTracking"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Internal Delivery Tracking"
                      placeholder="Internal reference number"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="customerInfo.address"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Customer Address"
                      placeholder="123 Main St, City, State, ZIP"
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Box display="flex" justifyContent="space-between" gap={2} mt={3}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(2)}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(4)}
                startIcon={<CheckCircle />}
              >
                Review & Complete
              </Button>
            </Box>
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Complete Delivery
            </Typography>
            
            {/* Delivery Summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Delivery Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Product:</Typography>
                    <Typography variant="body1">{selectedBatch?.productName}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">SKU:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{selectedBatch?.sku}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Serial Number:</Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedItem?.serialNumber || newSerialNumber}
                    </Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Label Number:</Typography>
                    <Typography variant="body1">{watch('shippingLabelData.labelNumber')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Carrier:</Typography>
                    <Typography variant="body1">{watch('shippingLabelData.carrier')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Destination:</Typography>
                    <Typography variant="body1">{watch('shippingLabelData.destination')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Customer:</Typography>
                    <Typography variant="body1">{watch('customerInfo.name') || 'Not specified'}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Tracking:</Typography>
                    <Typography variant="body1">{watch('shippingLabelData.trackingNumber') || 'Not provided'}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Action Summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  What will happen:
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      Item will be marked as delivered
                    </Typography>
                  </Box>
                  {serialNumberMode === 'assign_now' && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="body2">
                        Serial number "{newSerialNumber}" will be assigned
                      </Typography>
                    </Box>
                  )}
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      Inventory will be reduced by 1
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      Delivery record will be created
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      Complete history will be tracked
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Box display="flex" justifyContent="space-between" gap={2}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(3)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <LocalShipping />}
              >
                {loading ? 'Processing...' : 'Complete Delivery'}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Process Delivery
        </Typography>
        <Chip
          label="Serial Number Required"
          color="primary"
          icon={<Assignment />}
          variant="outlined"
        />
      </Box>

      {/* Success Alert */}
      {success && deliveryResult && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          action={
            <Box display="flex" gap={1}>
              <Button
                color="inherit"
                size="small"
                onClick={() => navigate('/inventory')}
              >
                View Inventory
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => navigate('/delivery')}
              >
                New Delivery
              </Button>
            </Box>
          }
        >
          <Typography variant="body1" fontWeight="bold">
            Delivery processed successfully!
          </Typography>
          <Typography variant="body2">
            Item {deliveryResult.serialNumber} delivered to {deliveryResult.customerInfo.name || 'customer'}
          </Typography>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Stepper activeStep={activeStep} orientation="vertical">
                {steps.map((step, index) => (
                  <Step key={step.label}>
                    <StepLabel>{step.label}</StepLabel>
                    <StepContent>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {step.description}
                      </Typography>
                      {renderStepContent(index)}
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Delivery Guidelines */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Delivery Guidelines
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Serial Numbers:</strong> All items must have serial numbers before delivery.
                  </Typography>
                </Alert>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2">
                    <strong>Auto-Assignment:</strong> System can auto-generate serial numbers if needed.
                  </Typography>
                </Alert>
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2">
                    <strong>Inventory Deduction:</strong> Completing delivery will reduce available inventory.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>

          {/* Current Selection */}
          {(selectedBatch || selectedItem) && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Selection
                </Typography>
                
                {selectedBatch && (
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Product:</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedBatch.productName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">SKU:</Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedBatch.sku}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Available:</Typography>
                    <Typography variant="body1" color="success.main" fontWeight="bold">
                      {selectedBatch.availableQuantity}
                    </Typography>
                  </Box>
                )}

                {selectedItem && (
                  <Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" color="text.secondary">Selected Item:</Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight="bold">
                        Item {availableItems.findIndex(i => i.id === selectedItem.id) + 1}
                      </Typography>
                      <Chip
                        label={selectedItem.serialNumber ? 'Has Serial' : 'Needs Serial'}
                        color={selectedItem.serialNumber ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                    {selectedItem.serialNumber && (
                      <Typography variant="body2" fontFamily="monospace">
                        SN: {selectedItem.serialNumber}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                variant="outlined"
                startIcon={<Inventory />}
                onClick={() => navigate('/inventory')}
              >
                View Inventory
              </Button>
              <Button
                variant="outlined"
                startIcon={<Assignment />}
                onClick={() => navigate('/inventory')}
              >
                Assign Serial Numbers
              </Button>
              <Button
                variant="outlined"
                startIcon={<LocalShipping />}
                onClick={() => window.location.reload()}
              >
                New Delivery
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>

    {/* Inventory Selection Dialog */}
    <Dialog open={batchSelectionOpen} maxWidth="md" fullWidth>
      <DialogTitle>Select Product Batch</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Choose a product batch to process for delivery
        </Typography>
        
        <TableContainer sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Available</TableCell>
                <TableCell>With Serial Numbers</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {availableInventory.map((item) => (
                item.batches?.map((batch: InventoryBatch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{batch.productName}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{batch.sku}</TableCell>
                    <TableCell>
                      <Typography color="success.main" fontWeight="bold">
                        {batch.availableQuantity}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">
                          {batch.serialNumbersAssigned}
                        </Typography>
                        <Chip
                          label={`${batch.serialNumbersAssigned}/${batch.totalQuantity}`}
                          color={batch.serialNumbersAssigned === batch.totalQuantity ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={batch.source === 'new_arrival' ? 'New' : 'Return'}
                        color={batch.source === 'new_arrival' ? 'success' : 'secondary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleBatchSelection(batch)}
                        disabled={batch.availableQuantity === 0}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setBatchSelectionOpen(false)}>Cancel</Button>
      </DialogActions>
    </Dialog>

    {/* Barcode Scanner */}
    <BarcodeScanner
      open={scannerOpen}
      onClose={() => setScannerOpen(false)}
      onScan={handleScanResult}
      title={`Scan ${scanType === 'label' ? 'Label' : scanType === 'tracking' ? 'Tracking' : 'Serial Number'}`}
    />
  </Box>
);
};

export default DeliveryPage;