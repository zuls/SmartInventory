// src/pages/AddReturnPage.tsx - Simplified with Serial Number Focus
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Paper,
  IconButton,
  Tooltip,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AssignmentReturn,
  ArrowBack,
  Save,
  QrCodeScanner,
  CheckCircle,
  Warning,
  Info,
  Search,
  Add,
  CloudUpload,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ObjectSchema } from 'yup';
import { useAuth } from '../hooks/useAuth';
import { returnService } from '../services/returnService';
import {
  ReturnForm,
  ReturnCondition,
  SerialNumberValidation,
  InventoryItemStatus,
} from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import SimpleImageUpload, { convertFilesToDriveReferences } from '../components/SimpleImageUpload';
import { format } from 'date-fns';

const returnConditions = Object.values(ReturnCondition);

const schema: ObjectSchema<ReturnForm> = yup.object({
  serialNumber: yup.string().required('Serial number is required'),
  lpnNumber: yup.string().required('LPN number is required'),
  trackingNumber: yup.string().required('Tracking number is required'),
  productName: yup.string().required('Product name is required'),
  sku: yup.string().optional().default(''),
  condition: yup.mixed<ReturnCondition>().oneOf(Object.values(ReturnCondition)).required('Condition is required'),
  reason: yup.string().optional().default(''),
  notes: yup.string().optional().default(''),
  quantity: yup.number().min(1).required('Quantity is required'),
  removalOrderId: yup.string().optional().default(''),
  fbaFbm: yup.mixed<'FBA' | 'FBM'>().oneOf(['FBA', 'FBM']).optional().default('FBA'),
});

const AddReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Form states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Serial number states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [serialNumberValidation, setSerialNumberValidation] = useState<SerialNumberValidation | null>(null);
  const [serialNumberLoading, setSerialNumberLoading] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);

  // Image states
  const [images, setImages] = useState<File[]>([]);

  // Product details dialog
  const [showProductDialog, setShowProductDialog] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReturnForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      serialNumber: searchParams.get('serial') || '',
      lpnNumber: '',
      trackingNumber: '',
      productName: '',
      sku: '',
      condition: ReturnCondition.INTACT,
      reason: '',
      notes: '',
      quantity: 1,
      removalOrderId: '',
      fbaFbm: 'FBA',
    },
  });

  const watchedSerialNumber = watch('serialNumber');

  // Validate serial number when it changes
  useEffect(() => {
    if (watchedSerialNumber && watchedSerialNumber.length > 3) {
      validateSerialNumber(watchedSerialNumber);
    } else {
      setSerialNumberValidation(null);
      setIsNewProduct(false);
    }
  }, [watchedSerialNumber]);

  // Pre-fill from URL params if coming from scanning
  useEffect(() => {
    if (searchParams.get('serial')) {
      setValue('serialNumber', searchParams.get('serial')!);
    }
    if (searchParams.get('new') === 'true') {
      setIsNewProduct(true);
    }
  }, [searchParams, setValue]);

  // Validate serial number
  const validateSerialNumber = async (serialNumber: string) => {
    setSerialNumberLoading(true);
    setError(null);

    try {
      const validation = await returnService.validateSerialNumberForReturn(serialNumber);
      setSerialNumberValidation(validation);

      if (validation.exists && validation.item) {
        // Check if item can be returned
        const canReturn = await returnService.canSerialNumberBeReturned(serialNumber);

        if (canReturn.canReturn) {
          // Pre-fill form with product information
          if (validation.batch) {
            setValue('productName', validation.batch.productName);
            setValue('sku', validation.batch.sku);
          }
          setIsNewProduct(false);
        } else {
          setError(canReturn.reason || 'This item cannot be returned');
        }
      } else {
        // Serial number doesn't exist - new product
        setIsNewProduct(true);
        setValue('productName', '');
        setValue('sku', '');
      }
    } catch (err) {
      console.error('Error validating serial number:', err);
      setError('Failed to validate serial number');
    } finally {
      setSerialNumberLoading(false);
    }
  };

  // Form submission
  const onSubmit = async (data: ReturnForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Convert images to drive file references
      const driveFileReferences = convertFilesToDriveReferences(images, user.uid);

      let result;
      if (isNewProduct) {
        // Create return for new product
        result = await returnService.createReturnForNewProduct(data, user.uid, driveFileReferences);
      } else {
        // Create return for existing product
        result = await returnService.createReturnWithSerialNumber(data, user.uid, driveFileReferences);
      }

      setSuccess(true);
      setActiveStep(3); // Move to success step

      // Reset form after success
      setTimeout(() => {
        reset();
        setImages([]);
        setSerialNumberValidation(null);
        setIsNewProduct(false);
        setActiveStep(0);
        navigate('/returns');
      }, 3000);

    } catch (err) {
      console.error('Error creating return:', err);
      setError(err instanceof Error ? err.message : 'Failed to create return');
    } finally {
      setLoading(false);
    }
  };

  // Barcode scanning
  const handleScanBarcode = () => {
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    setValue('serialNumber', scannedCode);
    setScannerOpen(false);
  };

  // Get status display for serial number validation
  const getSerialNumberStatus = () => {
    if (serialNumberLoading) {
      return {
        icon: <CircularProgress size={20} />,
        text: 'Validating...',
        color: 'info',
      };
    }

    if (!serialNumberValidation) {
      return {
        icon: <Search />,
        text: 'Enter serial number to validate',
        color: 'default',
      };
    }

    if (serialNumberValidation.exists) {
      if (serialNumberValidation.currentStatus === InventoryItemStatus.DELIVERED) {
        return {
          icon: <CheckCircle />,
          text: 'Serial number found - Can be returned',
          color: 'success',
        };
      } else {
        return {
          icon: <Warning />,
          text: 'Serial number found - Cannot be returned',
          color: 'warning',
        };
      }
    } else {
      return {
        icon: <Info />,
        text: 'Serial number not found - Will create new product',
        color: 'info',
      };
    }
  };

  const statusDisplay = getSerialNumberStatus();

  // Stepper steps
  const steps = [
    {
      label: 'Serial Number Scan',
      description: 'Scan or enter the serial number',
    },
    {
      label: 'Return Details',
      description: 'Enter return information',
    },
    {
      label: 'Images & Notes',
      description: 'Add photos and notes',
    },
    {
      label: 'Complete',
      description: 'Review and submit',
    },
  ];

  // Step content renderer
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Scan Serial Number
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Start here:</strong> Scan or enter the serial number of the returned item.
                The system will check if it exists and load product information automatically.
              </Typography>
            </Alert>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="serialNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Serial Number *"
                      error={!!errors.serialNumber}
                      helperText={errors.serialNumber?.message}
                      placeholder="Scan or enter serial number"
                      InputProps={{
                        startAdornment: (
                          <IconButton onClick={handleScanBarcode} edge="start">
                            <QrCodeScanner />
                          </IconButton>
                        ),
                        endAdornment: serialNumberLoading ? (
                          <CircularProgress size={20} />
                        ) : undefined,
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Serial Number Status */}
              <Grid item xs={12}>
                <Alert
                  severity={statusDisplay.color as any}
                  icon={statusDisplay.icon}
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2">
                    {statusDisplay.text}
                  </Typography>
                </Alert>
              </Grid>

              {/* Product Information Display */}
              {serialNumberValidation?.exists && serialNumberValidation.batch && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Found Product Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Product:</Typography>
                          <Typography variant="body1">{serialNumberValidation.batch.productName}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">SKU:</Typography>
                          <Typography variant="body1" fontFamily="monospace">{serialNumberValidation.batch.sku}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Status:</Typography>
                          <Chip
                            label={serialNumberValidation.currentStatus}
                            color={serialNumberValidation.currentStatus === InventoryItemStatus.DELIVERED ? 'success' : 'default'}
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="text.secondary">Source:</Typography>
                          <Typography variant="body1">{serialNumberValidation.batch.source}</Typography>
                        </Grid>
                      </Grid>

                      <Box mt={2} display="flex" gap={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setShowProductDialog(true)}
                          startIcon={<Search />}
                        >
                          View Details
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* New Product Notice */}
              {isNewProduct && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    <Typography variant="body2">
                      <strong>New Product:</strong> This serial number doesn't exist in the system.
                      You'll need to enter product information manually.
                    </Typography>
                  </Alert>
                </Grid>
              )}
            </Grid>

            <Box mt={3} display="flex" justifyContent="space-between">
              <Button
                onClick={() => navigate('/returns')}
                variant="outlined"
                startIcon={<ArrowBack />}
              >
                Back to Returns
              </Button>
              <Button
                onClick={() => setActiveStep(1)}
                variant="contained"
                disabled={!watchedSerialNumber || serialNumberLoading || !!error}
              >
                Next: Return Details
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Return Information
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Controller
                  name="lpnNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="LPN Number *"
                      error={!!errors.lpnNumber}
                      helperText={errors.lpnNumber?.message}
                      placeholder="License Plate Number"
                    />
                  )}
                />
              </Grid>

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
                      placeholder="Return shipping tracking"
                    />
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
                      disabled={!isNewProduct && serialNumberValidation?.exists}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="SKU"
                      disabled={!isNewProduct && serialNumberValidation?.exists}
                    />
                  )}
                />
              </Grid>

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
                      helperText={errors.quantity?.message}
                      InputProps={{
                        inputProps: { min: 1 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="condition"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select fullWidth label="Condition *">
                      {returnConditions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="fbaFbm"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select fullWidth label="FBA/FBM">
                      <MenuItem value="FBA">FBA</MenuItem>
                      <MenuItem value="FBM">FBM</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="removalOrderId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Removal Order ID" />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Return Reason" />
                  )}
                />
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
                      label="Notes / Remarks"
                      placeholder="Additional notes about the return condition..."
                    />
                  )}
                />
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
                Next: Images & Notes
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Product Images & Additional Notes
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              Add photos of the returned product to document its condition. You can also add them later if needed.
            </Typography>

            <SimpleImageUpload
              images={images}
              onImagesChange={setImages}
              maxImages={10}
              title="Return Product Images"
              description="Take photos showing the product condition"
            />

            <Box mt={3} display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(1)}
                variant="outlined"
              >
                Back
              </Button>
              <Button
                onClick={() => setActiveStep(3)}
                variant="contained"
              >
                Next: Review & Submit
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Return Information
            </Typography>

            {/* Review Summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Return Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Serial Number:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('serialNumber')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">LPN Number:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('lpnNumber')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Product:</Typography>
                    <Typography variant="body1">{watch('productName')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">SKU:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('sku')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Condition:</Typography>
                    <Chip label={watch('condition')} size="small" />
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Quantity:</Typography>
                    <Typography variant="body1" fontWeight="bold">{watch('quantity')}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Images:</Typography>
                    <Typography variant="body1">{images.length} images attached</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Product Type:</Typography>
                    <Chip
                      label={isNewProduct ? 'New Product' : 'Existing Product'}
                      color={isNewProduct ? 'warning' : 'success'}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* What will happen */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  What will happen:
                </Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      Return record will be created with serial number {watch('serialNumber')}
                    </Typography>
                  </Box>
                  {isNewProduct ? (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="body2">
                        New product will be created in the system
                      </Typography>
                    </Box>
                  ) : (
                    <Box display="flex" alignItems="center" gap={1}>
                      <CheckCircle color="success" fontSize="small" />
                      <Typography variant="body2">
                        Item status will be updated to "Returned"
                      </Typography>
                    </Box>
                  )}
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      {images.length} images will be stored with the return
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      Return will be pending decision (move to inventory or keep in returns)
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Box mt={3} display="flex" justifyContent="space-between">
              <Button
                onClick={() => setActiveStep(2)}
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
                {loading ? 'Processing...' : 'Submit Return'}
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
          Process Return
        </Typography>
        <Chip
          label="Serial Number Based"
          color="primary"
          icon={<QrCodeScanner />}
          variant="outlined"
        />
      </Box>

      {/* Success Alert */}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/returns')}
            >
              View Returns
            </Button>
          }
        >
          <Typography variant="body1" fontWeight="bold">
            Return processed successfully!
          </Typography>
          <Typography variant="body2">
            {isNewProduct ? 'New product created and ' : ''}Return record created with serial number {watch('serialNumber')}
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
          {/* Return Process Guidelines */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Return Process
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Serial Number First:</strong> Always start by scanning the serial number.
                  </Typography>
                </Alert>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2">
                    <strong>Auto-Fill:</strong> Product details load automatically if found.
                  </Typography>
                </Alert>
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2">
                    <strong>New Products:</strong> Enter details manually for unknown serial numbers.
                  </Typography>
                </Alert>
              </Box>
            </CardContent>
          </Card>

          {/* Current Serial Number Status */}
          {watchedSerialNumber && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current Serial Number
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" fontFamily="monospace">
                      {watchedSerialNumber}
                    </Typography>
                    <Chip
                      label={isNewProduct ? 'New Product' : 'Existing Product'}
                      color={isNewProduct ? 'warning' : 'success'}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Paper>

                  {serialNumberValidation?.exists && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Status: {serialNumberValidation.currentStatus}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Product: {serialNumberValidation.batch?.productName}
                      </Typography>
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
                  startIcon={<AssignmentReturn />}
                  onClick={() => navigate('/returns')}
                >
                  View All Returns
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Search />}
                  onClick={() => navigate('/search')}
                >
                  Global Search
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<QrCodeScanner />}
                  onClick={handleScanBarcode}
                >
                  Scan Serial Number
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Product Details Dialog */}
      <Dialog open={showProductDialog} onClose={() => setShowProductDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Product Details</DialogTitle>
        <DialogContent>
          {serialNumberValidation?.batch && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {serialNumberValidation.batch.productName}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Available:</Typography>
                  <Typography variant="body1" color="success.main" fontWeight="bold">
                    {serialNumberValidation.batch.availableQuantity}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Source:</Typography>
                  <Typography variant="body1">{serialNumberValidation.batch.source}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Received Date:</Typography>
                  <Typography variant="body1">
                    {format(new Date(serialNumberValidation.batch.receivedDate), 'PPpp')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Notes:</Typography>
                  <Typography variant="body1">{serialNumberValidation.batch.batchNotes || 'No notes'}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProductDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        title="Scan Serial Number"
        description="Position the serial number barcode within the frame"
      />
    </Box>
  );
};

export default AddReturnPage;