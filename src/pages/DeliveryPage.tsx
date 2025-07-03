// src/pages/DeliveryPage.tsx
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
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../hooks/useAuth';
import { inventoryService } from '../services/inventoryService';
import { DeliveryForm, Carrier, InventoryBatch, ShippingLabelData } from '../types';
import { format } from 'date-fns';

const carriers = [
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'Other', label: 'Other' },
];

const schema = yup.object({
  inventoryBatchId: yup.string().required('Inventory batch selection is required'),
  productSerialNumber: yup.string(),
  shippingLabelData: yup.object({
    labelNumber: yup.string().required('Label number is required'),
    carrier: yup.string().required('Carrier is required'),
    trackingNumber: yup.string(),
    destination: yup.string().required('Destination is required'),
    weight: yup.string(),
    dimensions: yup.string(),
    serviceType: yup.string(),
  }),
  customerInfo: yup.object({
    name: yup.string(),
    address: yup.string(),
    email: yup.string().email('Invalid email format'),
    phone: yup.string(),
  }),
  deliveryTracking: yup.string(),
});

const DeliveryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Get SKU from URL params if navigated from inventory
  const urlParams = new URLSearchParams(location.search);
  const preSelectedSKU = urlParams.get('sku');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [availableInventory, setAvailableInventory] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [searchSKU, setSearchSKU] = useState(preSelectedSKU || '');
  const [batchSelectionOpen, setBatchSelectionOpen] = useState(false);

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

  // Load available inventory
  useEffect(() => {
    const loadAvailableInventory = async () => {
      try {
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
      }
    };

    loadAvailableInventory();
  }, [searchSKU]);

  // Update selected batch when batch ID changes
  useEffect(() => {
    if (watchedBatchId) {
      const loadBatchDetails = async () => {
        try {
          const batch = await inventoryService.getInventoryBatchById(watchedBatchId);
          setSelectedBatch(batch);
        } catch (err) {
          console.error('Error loading batch details:', err);
        }
      };
      loadBatchDetails();
    }
  }, [watchedBatchId]);

  const onSubmit = async (data: DeliveryForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('Processing delivery:', data);
      
      const deliveryId = await inventoryService.deliverItems(data, user.uid);
      console.log('Delivery processed with ID:', deliveryId);
      
      setSuccess(true);
      setActiveStep(3); // Move to success step
      
      // Reset form after success
      setTimeout(() => {
        reset();
        setSelectedBatch(null);
        setActiveStep(0);
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error processing delivery:', error);
      setError(error instanceof Error ? error.message : 'Failed to process delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSelection = (batch: InventoryBatch) => {
    setValue('inventoryBatchId', batch.id);
    setSelectedBatch(batch);
    setBatchSelectionOpen(false);
    setActiveStep(1);
  };

  const steps = [
    {
      label: 'Select Inventory',
      description: 'Choose items to deliver',
    },
    {
      label: 'Shipping Details',
      description: 'Enter shipping information',
    },
    {
      label: 'Customer Information',
      description: 'Add customer details',
    },
    {
      label: 'Complete Delivery',
      description: 'Review and confirm',
    },
  ];

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Inventory for Delivery
            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Search by SKU"
                  value={searchSKU}
                  onChange={(e) => setSearchSKU(e.target.value)}
                  placeholder="Enter SKU to filter inventory"
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1 }} />,
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  variant="outlined"
                  onClick={() => setBatchSelectionOpen(true)}
                  disabled={availableInventory.length === 0}
                  startIcon={<Add />}
                >
                  Select from Available Inventory
                </Button>
              </Grid>
            </Grid>

            {selectedBatch && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Selected Batch
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">Product:</Typography>
                      <Typography variant="body1">{selectedBatch.productName}</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">SKU:</Typography>
                      <Typography variant="body1" fontFamily="monospace">{selectedBatch.sku}</Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">Available:</Typography>
                      <Typography variant="body1" color="success.main" fontWeight="bold">
                        {selectedBatch.availableQuantity}
                      </Typography>
                    </Grid>
                    <Grid size={6}>
                      <Typography variant="body2" color="text.secondary">Source:</Typography>
                      <Chip
                        label={selectedBatch.source === 'new_arrival' ? 'New Arrival' : 'From Return'}
                        color={selectedBatch.source === 'new_arrival' ? 'success' : 'secondary'}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            )}

            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Button
                variant="contained"
                onClick={() => setActiveStep(1)}
                disabled={!selectedBatch}
                startIcon={<LocalShipping />}
              >
                Continue to Shipping
              </Button>
            </Box>
          </Box>
        );

      case 1:
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
                          <IconButton size="small" title="Scan label barcode">
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
                          <IconButton size="small" title="Scan tracking barcode">
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
                <Controller
                  name="productSerialNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Product Serial Number"
                      placeholder="Enter serial number if available"
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Box display="flex" justifyContent="space-between" gap={2} mt={3}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(0)}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(2)}
              >
                Continue to Customer Info
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Customer Information (Optional)
            </Typography>
            
            <Grid container spacing={3}>
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
                onClick={() => setActiveStep(1)}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={() => setActiveStep(3)}
              >
                Review & Complete
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Complete Delivery
            </Typography>
            
            {/* Review Summary */}
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
                </Grid>
              </CardContent>
            </Card>

            <Box display="flex" justifyContent="space-between" gap={2}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(2)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleSubmit(onSubmit)}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
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
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/inventory')}
          variant="outlined"
        >
          Back to Inventory
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Process Delivery
        </Typography>
      </Box>

      {/* Success Alert */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}>
          Delivery processed successfully! Item has been removed from inventory.
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

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Delivery Guidelines
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Serial Numbers:</strong> Enter product serial numbers when available for tracking.
                  </Typography>
                </Alert>
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2">
                    <strong>Inventory Deduction:</strong> Completing delivery will automatically reduce available inventory.
                  </Typography>
                </Alert>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2">
                    <strong>Tracking:</strong> Use barcode scanners for accurate label and tracking entry.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Inventory Selection Dialog */}
      <Dialog open={batchSelectionOpen} maxWidth="md" fullWidth>
        <DialogTitle>Select Inventory Batch</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Choose an inventory batch to process for delivery
          </Typography>
          
          <TableContainer sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Received</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {availableInventory.map((item) => (
                  item.batches?.map((batch: InventoryBatch) => (
                    <TableRow key={batch.id}>
                      <TableCell>{batch.productName}</TableCell>
                      <TableCell fontFamily="monospace">{batch.sku}</TableCell>
                      <TableCell>
                        <Typography color="success.main" fontWeight="bold">
                          {batch.availableQuantity}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={batch.source === 'new_arrival' ? 'New' : 'Return'}
                          color={batch.source === 'new_arrival' ? 'success' : 'secondary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {format(new Date(batch.receivedDate), 'MMM dd')}
                        </Typography>
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
    </Box>
  );
};

export default DeliveryPage;