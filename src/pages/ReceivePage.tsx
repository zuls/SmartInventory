// src/pages/ReceivePage.tsx - Updated with Bulk Product Support
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  MenuItem,
  Grid,
  CircularProgress,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  Badge,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Inventory,
  QrCodeScanner,
  Save,
  ArrowBack,
  Add,
  Remove,
  CheckCircle,
  Warning,
  Info,
  ExpandMore,
  Edit,
  Delete,
  Assignment,
  Visibility,
  FlashOn,
  FlashOff,
} from '@mui/icons-material';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { inventoryService } from '../services/inventoryService';
import { ReceivePackageForm, Carrier, SerialNumberItem } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { format } from 'date-fns';

const carriers = Object.values(Carrier);

// Updated validation schema for bulk receiving
const schema = yup.object().shape({
  trackingNumber: yup.string().required('Tracking number is required'),
  carrier: yup.mixed<Carrier>().oneOf(Object.values(Carrier)).required('Carrier is required'),
  productName: yup.string().required('Product name is required'),
  sku: yup.string().required('SKU is required'),
  quantity: yup.number().min(1, 'Quantity must be at least 1').max(10000, 'Quantity cannot exceed 10,000').required('Quantity is required'),
  notes: yup.string().optional(),
  // Optional serial numbers array
  serialNumbers: yup.array().of(yup.string()).optional(),
});

interface CreatedInventoryResult {
  batchId: string;
  itemIds: string[];
  assignedSerialNumbers: number;
  unassignedSerialNumbers: number;
}

const ReceivePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Form and UI states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanType, setScanType] = useState<'tracking' | 'barcode'>('tracking');

  // Bulk receiving states
  const [previewMode, setPreviewMode] = useState(false);
  const [createdInventory, setCreatedInventory] = useState<CreatedInventoryResult | null>(null);
  const [serialNumbersInput, setSerialNumbersInput] = useState<string[]>([]);
  const [serialNumberMode, setSerialNumberMode] = useState<'none' | 'partial' | 'bulk'>('none');
  const [showSerialNumberDialog, setShowSerialNumberDialog] = useState(false);

  // Recent packages for reference
  const [recentPackages, setRecentPackages] = useState<any[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReceivePackageForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      trackingNumber: '',
      carrier: Carrier.FEDEX,
      productName: '',
      sku: '',
      quantity: 1,
      notes: '',
      serialNumbers: [],
    },
  });

  const watchedQuantity = watch('quantity');
  const watchedSku = watch('sku');
  const watchedProductName = watch('productName');

  // Load recent packages for reference
  useEffect(() => {
    const loadRecentPackages = async () => {
      try {
        const packages = await packageService.getAllPackages();
        setRecentPackages(packages.slice(0, 5)); // Last 5 packages
      } catch (err) {
        console.error('Error loading recent packages:', err);
      }
    };
    loadRecentPackages();
  }, []);

  // Update serial numbers array when quantity changes
  useEffect(() => {
    if (serialNumberMode === 'bulk' && watchedQuantity) {
      const currentSerialNumbers = serialNumbersInput;
      const newLength = watchedQuantity;

      if (currentSerialNumbers.length !== newLength) {
        const updatedSerialNumbers = Array(newLength).fill('').map((_, index) =>
          currentSerialNumbers[index] || ''
        );
        setSerialNumbersInput(updatedSerialNumbers);
      }
    }
  }, [watchedQuantity, serialNumberMode]);

  // Form submission handler
  const onSubmit = async (data: ReceivePackageForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Prepare serial numbers if provided
      const validSerialNumbers = serialNumbersInput.filter(sn => sn.trim() !== '');
      const formDataWithSerials = {
        ...data,
        serialNumbers: validSerialNumbers.length > 0 ? validSerialNumbers : undefined,
      };

      console.log('📦 Creating package with bulk inventory:', {
        ...formDataWithSerials,
        quantity: data.quantity,
        serialNumbersProvided: validSerialNumbers.length,
      });

      // Create package and inventory
      const result = await inventoryService.createInventoryFromPackage(
        formDataWithSerials,
        data.quantity,
        user.uid,
        validSerialNumbers
      );

      // Also create package record
      await packageService.createPackage(formDataWithSerials, user.uid);

      setCreatedInventory({
        batchId: result.batchId,
        itemIds: result.itemIds,
        assignedSerialNumbers: validSerialNumbers.length,
        unassignedSerialNumbers: data.quantity - validSerialNumbers.length,
      });

      setSuccess(true);
      setActiveStep(2); // Move to success step

      // Reset form after delay
      setTimeout(() => {
        reset();
        setSerialNumbersInput([]);
        setSerialNumberMode('none');
        setCreatedInventory(null);
        setActiveStep(0);
        setSuccess(false);
      }, 5000);

    } catch (err) {
      console.error('Error creating package:', err);
      setError(err instanceof Error ? err.message : 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  // Barcode scanning handlers
  const handleScanBarcode = (type: 'tracking' | 'barcode') => {
    setScanType(type);
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    if (scanType === 'tracking') {
      setValue('trackingNumber', scannedCode);
    } else {
      setValue('sku', scannedCode);
    }
    setScannerOpen(false);
  };

  // Serial number management
  const handleSerialNumberChange = (index: number, value: string) => {
    const updated = [...serialNumbersInput];
    updated[index] = value;
    setSerialNumbersInput(updated);
  };

  const handleSerialNumberModeChange = (mode: 'none' | 'partial' | 'bulk') => {
    setSerialNumberMode(mode);
    if (mode === 'bulk') {
      setSerialNumbersInput(Array(watchedQuantity || 1).fill(''));
    } else if (mode === 'partial') {
      setSerialNumbersInput(Array(Math.min(watchedQuantity || 1, 10)).fill(''));
    } else {
      setSerialNumbersInput([]);
    }
  };

  // Auto-generate SKU based on product name
  const generateSKU = () => {
    if (watchedProductName) {
      const sku = watchedProductName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 20);
      setValue('sku', sku);
    }
  };

  // Load product info from recent packages
  const loadFromRecentPackage = (pkg: any) => {
    setValue('productName', pkg.productName);
    setValue('sku', pkg.sku || '');
    setValue('carrier', pkg.carrier);
    setValue('notes', pkg.notes || '');
  };

  // Stepper steps
  const steps = [
    {
      label: 'Product Information',
      description: 'Enter basic product details',
    },
    {
      label: 'Quantity & Serial Numbers',
      description: 'Set quantity and optional serial numbers',
    },
    {
      label: 'Review & Create',
      description: 'Review and create inventory',
    },
  ];

  // Step content renderer
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Product Information
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="trackingNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Tracking Number *"
                      error={!!errors.trackingNumber}
                      helperText={errors.trackingNumber?.message}
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => handleScanBarcode('tracking')} edge="end">
                            <QrCodeScanner />
                          </IconButton>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="carrier"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      fullWidth
                      label="Carrier *"
                      error={!!errors.carrier}
                      helperText={errors.carrier?.message}
                    >
                      {carriers.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="productName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Product Name *"
                      error={!!errors.productName}
                      helperText={errors.productName?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={8}>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="SKU (Stock Keeping Unit) *"
                      error={!!errors.sku}
                      helperText={errors.sku?.message}
                      placeholder="e.g., MON-DELL-24-BLK"
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => handleScanBarcode('barcode')} edge="end">
                            <QrCodeScanner />
                          </IconButton>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Button
                  variant="outlined"
                  onClick={generateSKU}
                  disabled={!watchedProductName}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Auto-Generate SKU
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Notes"
                      placeholder="e.g., Box was slightly damaged, items appear okay."
                    />
                  )}
                />
              </Grid>
            </Grid>

            <Box mt={3} display="flex" justifyContent="space-between">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outlined"
                startIcon={<ArrowBack />}
              >
                Back to Dashboard
              </Button>
              <Button
                onClick={() => setActiveStep(1)}
                variant="contained"
                disabled={!watchedProductName || !watchedSku}
              >
                Next: Quantity & Serial Numbers
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Quantity & Serial Numbers
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="quantity"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Quantity *"
                      type="number"
                      error={!!errors.quantity}
                      helperText={errors.quantity?.message || 'Number of items in this shipment'}
                      InputProps={{
                        inputProps: { min: 1, max: 10000 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  label="Serial Number Assignment"
                  value={serialNumberMode}
                  onChange={(e) => handleSerialNumberModeChange(e.target.value as any)}
                  helperText="Choose when to assign serial numbers"
                >
                  <MenuItem value="none">Assign Later</MenuItem>
                  <MenuItem value="partial">Assign Some Now</MenuItem>
                  <MenuItem value="bulk">Assign All Now</MenuItem>
                </TextField>
              </Grid>

              {/* Serial Number Input Section */}
              {serialNumberMode !== 'none' && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Serial Numbers
                        </Typography>
                        <Chip
                          label={`${serialNumbersInput.filter(sn => sn.trim()).length} / ${watchedQuantity} assigned`}
                          color={serialNumbersInput.filter(sn => sn.trim()).length === watchedQuantity ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>

                      <Grid container spacing={2}>
                        {serialNumbersInput.map((serialNumber, index) => (
                          <Grid item xs={12} sm={6} md={4} key={index}>
                            <TextField
                              fullWidth
                              size="small"
                              label={`Serial Number ${index + 1}`}
                              value={serialNumber}
                              onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                              placeholder={`SN${String(index + 1).padStart(3, '0')}`}
                              InputProps={{
                                startAdornment: (
                                  <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                                    #{index + 1}
                                  </Typography>
                                ),
                              }}
                            />
                          </Grid>
                        ))}
                      </Grid>

                      <Box mt={2} display="flex" gap={2}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setShowSerialNumberDialog(true)}
                        >
                          Bulk Import
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setSerialNumbersInput(Array(watchedQuantity || 1).fill(''))}
                        >
                          Clear All
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Information Cards */}
              <Grid item xs={12}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Serial Numbers:</strong> You can assign serial numbers now or later.
                    Items without serial numbers can be assigned during delivery or through the inventory management page.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>

            <Box mt={3} display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(0)}
                variant="outlined"
              >
                Back
              </Button>
              <Button
                onClick={() => setActiveStep(2)}
                variant="contained"
              >
                Next: Review & Create
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review & Create Inventory
            </Typography>

            {/* Summary Card */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Package Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Product:</Typography>
                    <Typography variant="body1">{watchedProductName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">SKU:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watchedSku}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Tracking:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('trackingNumber')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Carrier:</Typography>
                    <Typography variant="body1">{watch('carrier')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Total Items:</Typography>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      {watchedQuantity}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Serial Numbers:</Typography>
                    <Box display="flex" gap={1}>
                      <Chip
                        label={`${serialNumbersInput.filter(sn => sn.trim()).length} assigned`}
                        color="success"
                        size="small"
                      />
                      <Chip
                        label={`${watchedQuantity - serialNumbersInput.filter(sn => sn.trim()).length} unassigned`}
                        color="warning"
                        size="small"
                      />
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* What will be created */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  What will be created:
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      1 Package record for tracking
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      1 Inventory batch for the product
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      {watchedQuantity} Individual inventory items
                    </Typography>
                  </Box>
                  {serialNumbersInput.filter(sn => sn.trim()).length > 0 && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="body2">
                        Serial numbers assigned to {serialNumbersInput.filter(sn => sn.trim()).length} items
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>

            <Box mt={3} display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(1)}
                variant="outlined"
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit(onSubmit)}
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              >
                {loading ? 'Creating...' : 'Create Package & Inventory'}
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
          Receive New Package
        </Typography>
        <Chip
          label="Bulk Receiving"
          color="primary"
          icon={<Inventory />}
          variant="outlined"
        />
      </Box>

      {/* Success Alert */}
      {success && createdInventory && (
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
                onClick={() => navigate('/packages')}
              >
                View Packages
              </Button>
            </Box>
          }
        >
          <Typography variant="body1" fontWeight="bold">
            Package and inventory created successfully!
          </Typography>
          <Typography variant="body2">
            Created {createdInventory.itemIds.length} inventory items • {createdInventory.assignedSerialNumbers} with serial numbers • {createdInventory.unassignedSerialNumbers} pending assignment
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
        <Grid item xs={12} md={8}>
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
        <Grid item xs={12} md={4}>
          {/* Guidelines */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bulk Receiving Guidelines
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Quantity:</strong> Enter the total number of items in the shipment (1-10,000).
                  </Typography>
                </Alert>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2">
                    <strong>Serial Numbers:</strong> Can be assigned now or later during delivery.
                  </Typography>
                </Alert>
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2">
                    <strong>SKU:</strong> Use consistent SKU format for better inventory management.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>

          {/* Recent Packages */}
          {recentPackages.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Packages
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Click to load product information
                </Typography>
                {recentPackages.map((pkg, index) => (
                  <Card
                    key={pkg.id}
                    variant="outlined"
                    sx={{ mb: 1, cursor: 'pointer' }}
                    onClick={() => loadFromRecentPackage(pkg)}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {pkg.productName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        SKU: {pkg.sku} • {pkg.carrier}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Bulk Serial Number Import Dialog */}
      <Dialog
        open={showSerialNumberDialog}
        onClose={() => setShowSerialNumberDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Bulk Import Serial Numbers</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Enter serial numbers separated by new lines or commas
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={10}
            placeholder="SN001&#10;SN002&#10;SN003&#10;..."
            onChange={(e) => {
              const values = e.target.value
                .split(/[\n,]/)
                .map(s => s.trim())
                .filter(s => s !== '')
                .slice(0, watchedQuantity);

              const updated = Array(watchedQuantity).fill('');
              values.forEach((value, index) => {
                if (index < updated.length) {
                  updated[index] = value;
                }
              });
              setSerialNumbersInput(updated);
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSerialNumberDialog(false)}>Cancel</Button>
          <Button onClick={() => setShowSerialNumberDialog(false)} variant="contained">
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        title={scanType === 'tracking' ? 'Scan Tracking Barcode' : 'Scan Product Barcode'}
      />
    </Box>
  );
};

export default ReceivePage;