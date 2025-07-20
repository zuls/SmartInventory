// src/pages/DeliveryPage.tsx - Simplified Delivery Process
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid, // <-- CHANGE HERE
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
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
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
} from '@mui/material';
import {
  LocalShipping,
  ArrowBack,
  Save,
  CheckCircle,
  Warning,
  Info,
  Search,
  Assignment,
  Inventory,
  Person,
  Speed,
  QrCodeScanner,
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
  inventoryBatchId: yup.string().required('Product selection is required'),
  selectedItemId: yup.string().optional(),
  productSerialNumber: yup.string().optional(),
  shippingLabelData: yup.object().shape({
    labelNumber: yup.string().required('Label number is required'),
    carrier: yup.string().required('Carrier is required'),
    destination: yup.string().required('Destination is required'),
    trackingNumber: yup.string().optional(),
  }).required(),
  customerInfo: yup.object().shape({
    name: yup.string().optional(),
    address: yup.string().optional(),
    email: yup.string().email('Invalid email format').optional(),
    phone: yup.string().optional(),
  }).required(),
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
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [availableItems, setAvailableItems] = useState<SerialNumberItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SerialNumberItem | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  // Serial number states
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [serialNumberValidation, setSerialNumberValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [serialNumberLoading, setSerialNumberLoading] = useState(false);

  // Scanner states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanType, setScanType] = useState<'label' | 'tracking' | 'serial'>('label');

  // Dialog states
  const [productSelectionOpen, setProductSelectionOpen] = useState(false);
  const [itemSelectionOpen, setItemSelectionOpen] = useState(false);

  // Search states
  const [searchSKU, setSearchSKU] = useState(preSelectedSKU || '');

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
      },
      customerInfo: {
        name: '',
        address: '',
        email: '',
        phone: '',
      },
    },
  });

  const watchedProductId = watch('inventoryBatchId');
  const watchedItemId = watch('selectedItemId');

  // Load available products
  useEffect(() => {
    loadAvailableProducts();
  }, [searchSKU]);

  // Load items when product changes
  useEffect(() => {
    if (watchedProductId && selectedProduct) {
      loadProductItems();
    }
  }, [watchedProductId, selectedProduct]);

  // Update selected item when item ID changes
  useEffect(() => {
    if (watchedItemId) {
      const item = availableItems.find(i => i.id === watchedItemId);
      setSelectedItem(item || null);

      if (item?.serialNumber) {
        setValue('productSerialNumber', item.serialNumber);
      } else {
        setValue('productSerialNumber', '');
        setNewSerialNumber('');
      }
    }
  }, [watchedItemId, availableItems]);

  const loadAvailableProducts = async () => {
    setInventoryLoading(true);
    try {
      let products;
      if (searchSKU) {
        products = await inventoryService.getAvailableInventoryForSKU(searchSKU);
      } else {
        const summary = await inventoryService.getInventorySummaryBySKU();
        products = summary.filter(item => item.totalAvailable > 0);
      }
      setAvailableProducts(products);

      // Auto-select if pre-selected SKU and only one result
      if (preSelectedSKU && products.length === 1) {
        handleProductSelection(products[0]);
      }
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load available products');
    } finally {
      setInventoryLoading(false);
    }
  };

  const loadProductItems = async () => {
    if (!selectedProduct) return;

    setInventoryLoading(true);
    try {
      const items = await inventoryService.getAvailableItemsForDelivery(selectedProduct.sku);
      setAvailableItems(items);

      // Auto-select first item if only one available
      if (items.length === 1) {
        setSelectedItem(items[0]);
        setValue('selectedItemId', items[0].id);
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load available items');
    } finally {
      setInventoryLoading(false);
    }
  };

  // Handle product selection
  const handleProductSelection = (product: any) => {
    setSelectedProduct(product);
    setValue('inventoryBatchId', product.batches?.[0]?.id || product.id);
    setProductSelectionOpen(false);
    setActiveStep(1);
  };

  // Handle item selection
  const handleItemSelection = (item: SerialNumberItem) => {
    setSelectedItem(item);
    setValue('selectedItemId', item.id);
    setItemSelectionOpen(false);

    if (item.serialNumber) {
      setValue('productSerialNumber', item.serialNumber);
      setActiveStep(2);
    } else {
      setActiveStep(2); // Go to serial number assignment
    }
  };

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
    if (newSerialNumber) {
      const timeoutId = setTimeout(() => {
        validateSerialNumber(newSerialNumber);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [newSerialNumber]);

  // Form submission
  const onSubmit = async (data: DeliveryForm) => {
    if (!user || !selectedItem) {
      setError('Missing required information');
      return;
    }

    // Check if serial number is required
    if (!selectedItem.serialNumber && !newSerialNumber) {
      setError('Please assign a serial number before delivery');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const deliveryData = {
        ...data,
        selectedItemId: selectedItem.id,
        productSerialNumber: selectedItem.serialNumber || newSerialNumber,
      };

      const result = await inventoryService.deliverItemWithSerialNumber(deliveryData, user.uid);

      setDeliveryResult(result);
      setSuccess(true);
      setActiveStep(4); // Move to success step

      // Reset form after delay
      setTimeout(() => {
        reset();
        setSelectedProduct(null);
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

  // Auto-assign serial number
  const autoAssignSerialNumber = () => {
    if (selectedProduct) {
      const timestamp = Date.now().toString().slice(-6);
      const sku = selectedProduct.sku?.replace(/[^A-Z0-9]/g, '').substring(0, 4) || 'ITEM';
      const autoSerial = `${sku}${timestamp}`;
      setNewSerialNumber(autoSerial);
      setValue('productSerialNumber', autoSerial);
    }
  };

  // Steps configuration
  const steps = [
    {
      label: 'Select Product',
      description: 'Choose product for delivery',
    },
    {
      label: 'Select Item',
      description: 'Choose specific item',
    },
    {
      label: 'Serial Number',
      description: 'Assign or verify serial number',
    },
    {
      label: 'Shipping Details',
      description: 'Enter delivery information',
    },
    {
      label: 'Complete',
      description: 'Process delivery',
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
              <Grid size={{ xs: 12, md: 8 }}>
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
              <Grid size={{ xs: 12, md: 4 }}>
                <Button
                  variant="outlined"
                  onClick={() => setProductSelectionOpen(true)}
                  disabled={availableProducts.length === 0 || inventoryLoading}
                  startIcon={inventoryLoading ? <CircularProgress size={20} /> : <Inventory />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {inventoryLoading ? 'Loading...' : 'Browse Products'}
                </Button>
              </Grid>
            </Grid>

            {/* Selected Product Display */}
            {selectedProduct && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Selected Product
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="body2" color="text.secondary">Product:</Typography>
                      <Typography variant="body1">{selectedProduct.productName}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="body2" color="text.secondary">SKU:</Typography>
                      <Typography variant="body1" fontFamily="monospace">{selectedProduct.sku}</Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="body2" color="text.secondary">Available:</Typography>
                      <Typography variant="body1" color="success.main" fontWeight="bold">
                        {selectedProduct.totalAvailable || selectedProduct.availableQuantity}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            <Box display="flex" justifyContent="space-between">
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
                disabled={!selectedProduct}
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
                Choose a specific item from the selected product. Items with serial numbers are ready for delivery.
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
                      No items available for delivery.
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

            <Box display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(0)}
                variant="outlined"
              >
                Back
              </Button>
              <Button
                onClick={() => setActiveStep(2)}
                variant="contained"
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
              Serial Number Management
            </Typography>

            {selectedItem && (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Selected Item
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Product:</Typography>
                      <Typography variant="body1">{selectedProduct?.productName}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Current Serial:</Typography>
                      <Typography variant="body1" fontFamily="monospace">
                        {selectedItem.serialNumber || 'Not assigned'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* Serial Number Assignment */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Serial Number Assignment
                </Typography>

                {selectedItem?.serialNumber ? (
                  <Box>
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        <strong>Ready for delivery:</strong> {selectedItem.serialNumber}
                      </Typography>
                    </Alert>
                    <Typography variant="body2">
                      This item already has a serial number and is ready for delivery.
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
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                          fullWidth
                          label="Assign Serial Number *"
                          value={newSerialNumber}
                          onChange={(e) => setNewSerialNumber(e.target.value)}
                          placeholder="Enter or scan serial number"
                          error={serialNumberValidation ? !serialNumberValidation.valid: false}
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
                      <Grid size={{ xs: 12, md: 3 }}>
                        <Button
                          variant="outlined"
                          onClick={autoAssignSerialNumber}
                          fullWidth
                          sx={{ height: '56px' }}
                          startIcon={<Speed />}
                        >
                          Auto-Generate
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(1)}
                variant="outlined"
              >
                Back
              </Button>
              <Button
                onClick={() => setActiveStep(3)}
                variant="contained"
                disabled={!selectedItem?.serialNumber && !newSerialNumber}
                startIcon={<LocalShipping />}
              >
                Continue to Shipping
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

              <Grid size={{ xs: 12 }}>
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
                onClick={() => setActiveStep(2)}
                variant="outlined"
              >
                Back
              </Button>
              <Button
                onClick={() => setActiveStep(4)}
                variant="contained"
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
                  <Grid size={{ xs: 6 }}>
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
                  {!selectedItem?.serialNumber && newSerialNumber && (
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
                </Box>
              </CardContent>
            </Card>

            <Box display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(3)}
                variant="outlined"
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit(onSubmit)}
                variant="contained"
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
          label="Simple Delivery"
          color="primary"
          icon={<LocalShipping />}
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
                onClick={() => window.location.reload()}
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
                Delivery Process
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Simple Process:</strong> Select product → Choose item → Assign serial number → Ship
                  </Typography>
                </Alert>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2">
                    <strong>Auto-Assignment:</strong> Serial numbers can be auto-generated if needed.
                  </Typography>
                </Alert>
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2">
                    <strong>Required:</strong> All items must have serial numbers before delivery.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>

          {/* Current Selection */}
          {(selectedProduct || selectedItem) && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Selection
                </Typography>

                {selectedProduct && (
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">Product:</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedProduct.productName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">SKU:</Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {selectedProduct.sku}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Available:</Typography>
                    <Typography variant="body1" color="success.main" fontWeight="bold">
                      {selectedProduct.totalAvailable || selectedProduct.availableQuantity}
                    </Typography>
                  </Box>
                )}

                {selectedItem && (
                  <Box>
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

      {/* Product Selection Dialog */}
      <Dialog open={productSelectionOpen} onClose={() => setProductSelectionOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Select Product for Delivery</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Choose a product that has available items for delivery
          </Typography>

          <TableContainer sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>With Serial Numbers</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableProducts.map((product) => (
                  <TableRow key={product.sku || product.id}>
                    <TableCell>{product.productName}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{product.sku}</TableCell>
                    <TableCell>
                      <Typography color="success.main" fontWeight="bold">
                        {product.totalAvailable || product.availableQuantity}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2">
                          {product.itemsWithSerialNumbers || 0}
                        </Typography>
                        <Chip
                          label={product.itemsWithSerialNumbers > 0 ? 'Ready' : 'Needs Serial'}
                          color={product.itemsWithSerialNumbers > 0 ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleProductSelection(product)}
                        disabled={(product.totalAvailable || product.availableQuantity) === 0}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductSelectionOpen(false)}>Cancel</Button>
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