// src/pages/AddReturnPage.tsx - Updated with Serial Number Scanning Support
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
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  AssignmentReturn,
  ArrowBack,
  Save,
  QrCodeScanner,
  AddAPhoto,
  Delete,
  Google,
  CloudUpload,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Search,
  Visibility,
  Edit,
  ExpandMore,
  History,
  Inventory,
  LocalShipping,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ObjectSchema } from 'yup';
import { useAuth } from '../hooks/useAuth';
import { returnService } from '../services/returnService';
import { driveService } from '../services/driveService';
import { 
  ReturnForm, 
  ReturnCondition, 
  DriveFileReference, 
  SerialNumberValidation,
  ReturnWithSerialNumber,
  InventoryItemStatus,
  DeliveryWithSerialNumber,
} from '../types';
import BarcodeScanner from '../components/BarcodeScanner';
import { format } from 'date-fns';

const returnConditions = Object.values(ReturnCondition);
const fbaFbmOptions = ['FBA', 'FBM'] as const;

const schema: ObjectSchema<ReturnForm> = yup.object({
  serialNumber: yup.string().required('Serial number is required'),
  lpnNumber: yup.string().required('LPN number is required'),
  trackingNumber: yup.string().required('Tracking number is required'),
  productName: yup.string().required('Product name is required'),
  sku: yup.string().optional().default(''),
  condition: yup.mixed<ReturnCondition>().oneOf(Object.values(ReturnCondition)).required('Condition is required'),
  reason: yup.string().optional().default(''),
  notes: yup.string().optional().default(''),
  quantity: yup.number().min(1, 'Quantity must be at least 1').required('Quantity is required'),
  removalOrderId: yup.string().optional().default(''),
  fbaFbm: yup.mixed<'FBA' | 'FBM'>().oneOf(fbaFbmOptions).optional().default('FBA'),
  returnDecision: yup.mixed<'move_to_inventory' | 'keep_in_returns'>().optional(),
  returnDecisionNotes: yup.string().optional().default(''),
});

const AddReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
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
  const [returnInfo, setReturnInfo] = useState<ReturnWithSerialNumber | null>(null);
  
  // Image states
  const [images, setImages] = useState<File[]>([]);
  const [driveStatus, setDriveStatus] = useState({
    isInitialized: false,
    isSignedIn: false,
    error: null as string | null,
    isLoading: false,
    details: 'Not initialized'
  });
  const [driveLoading, setDriveLoading] = useState(false);
  
  // Dialog states
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryWithSerialNumber[]>([]);
  
  const MAX_IMAGES = 20;

  // Check Drive status periodically
  useEffect(() => {
    const checkDriveStatus = () => {
      const status = driveService.getStatus();
      setDriveStatus({
        isInitialized: status.isInitialized,
        isSignedIn: status.isSignedIn,
        error: status.error,
        isLoading: false,
        details: status.details
      });
    };

    checkDriveStatus();
    const interval = setInterval(checkDriveStatus, 3000);
    return () => clearInterval(interval);
  }, []);

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
      serialNumber: '',
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
      returnDecision: 'move_to_inventory',
      returnDecisionNotes: '',
    },
  });

  const watchedSerialNumber = watch('serialNumber');

  // Validate serial number when it changes
  useEffect(() => {
    if (watchedSerialNumber && watchedSerialNumber.length > 3) {
      validateSerialNumber(watchedSerialNumber);
    } else {
      setSerialNumberValidation(null);
      setReturnInfo(null);
      setIsNewProduct(false);
    }
  }, [watchedSerialNumber]);

  // Validate serial number
  const validateSerialNumber = async (serialNumber: string) => {
    setSerialNumberLoading(true);
    setError(null);
    
    try {
      // Check if serial number exists
      const validation = await returnService.validateSerialNumberForReturn(serialNumber);
      setSerialNumberValidation(validation);
      
      if (validation.exists && validation.item) {
        // Check if item can be returned
        const canReturn = await returnService.canSerialNumberBeReturned(serialNumber);
        
        if (canReturn.canReturn) {
          // Get return information
          const returnInfo = await returnService.getReturnInfoBySerialNumber(serialNumber);
          setReturnInfo(returnInfo);
          
          // Pre-fill form with product information
          if (returnInfo?.originalProductInfo) {
            setValue('productName', returnInfo.originalProductInfo.productName);
            setValue('sku', returnInfo.originalProductInfo.sku);
          }
          
          setIsNewProduct(false);
        } else {
          setError(canReturn.reason || 'This item cannot be returned');
          setReturnInfo(null);
        }
      } else {
        // Serial number doesn't exist - new product
        setIsNewProduct(true);
        setReturnInfo(null);
        
        // Clear pre-filled data
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

    console.log('📝 Starting return submission...');
    console.log('📊 Return data:', data);
    console.log('🔍 Is new product:', isNewProduct);
    console.log('🖼️ Images to upload:', images.length);

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let driveFileReferences: DriveFileReference[] = [];
      
      // Upload images if available
      if (images.length > 0) {
        if (driveStatus.isSignedIn) {
          console.log('🔄 Uploading images...');
          try {
            driveFileReferences = await driveService.signInAndUpload(images, user.uid);
            console.log('✅ Files uploaded successfully:', driveFileReferences);
          } catch (uploadError) {
            console.error('❌ Upload error:', uploadError);
            setError('Failed to upload images. You can try again or save without images.');
            setLoading(false);
            return;
          }
        } else {
          console.log('⚠️ Images present but not signed in to Google Drive');
          setError('Images will not be saved because Google Drive is not connected. Connect Google Drive or remove images to continue.');
          setLoading(false);
          return;
        }
      }

      // Create return based on whether it's a new product or existing
      let result;
      if (isNewProduct) {
        console.log('🆕 Creating return for new product');
        result = await returnService.createReturnForNewProduct(data, user.uid, driveFileReferences);
      } else {
        console.log('🔄 Creating return for existing product');
        result = await returnService.createReturnWithSerialNumber(data, user.uid, driveFileReferences);
      }

      console.log('✅ Return created successfully:', result);
      
      setSuccess(true);
      setActiveStep(3); // Move to success step
      
      // Reset form after success
      setTimeout(() => {
        reset();
        setImages([]);
        setSerialNumberValidation(null);
        setReturnInfo(null);
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
  const handleScanBarcode = (type: 'serial' | 'tracking' | 'lpn') => {
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    setValue('serialNumber', scannedCode);
    setScannerOpen(false);
  };

  // Image handling
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      const newImages = [...images, ...filesArray].slice(0, MAX_IMAGES);
      setImages(newImages);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Google Drive handling
  const handleGoogleSignIn = async () => {
    setDriveLoading(true);
    setError(null);
    try {
      await driveService.mockSignIn();
      const status = driveService.getStatus();
      setDriveStatus({
        isInitialized: status.isInitialized,
        isSignedIn: status.isSignedIn,
        error: status.error,
        isLoading: false,
        details: status.details
      });
    } catch (error) {
      console.error('Sign-in failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in to Google Drive';
      setError(`Google Drive connection failed: ${errorMessage}`);
    } finally {
      setDriveLoading(false);
    }
  };

  // View delivery history
  const viewDeliveryHistory = async () => {
    if (returnInfo?.originalDeliveryId) {
      setShowHistoryDialog(true);
      // In a real implementation, you would load the delivery history
      // For now, we'll show mock data
      setDeliveryHistory([]);
    }
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
      label: 'Serial Number Validation',
      description: 'Scan or enter serial number',
    },
    {
      label: 'Return Details',
      description: 'Enter return information',
    },
    {
      label: 'Images & Decision',
      description: 'Add images and make decision',
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
              Serial Number Validation
            </Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Start with Serial Number:</strong> Scan or enter the serial number of the returned item. 
                The system will check if it exists and load product information automatically.
              </Typography>
            </Alert>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
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
                          <IconButton onClick={() => handleScanBarcode('serial')} edge="start">
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
              <Grid size={{ xs: 12 }}>
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
              {serialNumberValidation?.exists && returnInfo?.originalProductInfo && (
                <Grid size={{ xs: 12 }}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Product Information
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={6}>
                          <Typography variant="body2" color="text.secondary">Product:</Typography>
                          <Typography variant="body1">{returnInfo.originalProductInfo.productName}</Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="body2" color="text.secondary">SKU:</Typography>
                          <Typography variant="body1" fontFamily="monospace">{returnInfo.originalProductInfo.sku}</Typography>
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="body2" color="text.secondary">Status:</Typography>
                          <Chip
                            label={serialNumberValidation.currentStatus}
                            color={serialNumberValidation.currentStatus === InventoryItemStatus.DELIVERED ? 'success' : 'default'}
                            size="small"
                          />
                        </Grid>
                        <Grid size={6}>
                          <Typography variant="body2" color="text.secondary">Last Delivery:</Typography>
                          <Typography variant="body1">
                            {returnInfo.originalProductInfo.deliveryDate 
                              ? format(new Date(returnInfo.originalProductInfo.deliveryDate), 'MMM dd, yyyy')
                              : 'Not delivered'
                            }
                          </Typography>
                        </Grid>
                        {returnInfo.originalProductInfo.customerInfo?.name && (
                          <Grid size={12}>
                            <Typography variant="body2" color="text.secondary">Last Customer:</Typography>
                            <Typography variant="body1">{returnInfo.originalProductInfo.customerInfo.name}</Typography>
                          </Grid>
                        )}
                      </Grid>
                      
                      <Box mt={2} display="flex" gap={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={viewDeliveryHistory}
                          startIcon={<History />}
                        >
                          View History
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setShowProductDialog(true)}
                          startIcon={<Visibility />}
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
                <Grid size={{ xs: 12 }}>
                  <Alert severity="warning">
                    <Typography variant="body2">
                      <strong>New Product:</strong> This serial number doesn't exist in the system. 
                      You'll need to enter product information manually. The system will create a new product record.
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
                disabled={!watchedSerialNumber || serialNumberLoading}
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
              Return Details
            </Typography>
            
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
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
                      InputProps={{
                        endAdornment: (
                          <IconButton onClick={() => handleScanBarcode('lpn')} edge="end">
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

              <Grid size={{ xs: 12 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="fbaFbm"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select fullWidth label="FBA/FBM">
                      {fbaFbmOptions.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="removalOrderId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Removal Order ID" />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Return Reason" />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
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
                Next: Images & Decision
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Images & Return Decision
            </Typography>
            
            <Grid container spacing={3}>
              {/* Image Upload Section */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Product Images ({images.length}/{MAX_IMAGES})
                    </Typography>

                    {/* Drive Status */}
                    <Alert 
                      severity={driveStatus.isSignedIn ? 'success' : 'warning'} 
                      sx={{ mb: 2 }}
                      icon={driveStatus.isSignedIn ? <CheckCircle /> : <Warning />}
                    >
                      <Typography variant="body2">
                        Google Drive: {driveStatus.isSignedIn ? 'Connected' : 'Not Connected'}
                      </Typography>
                    </Alert>

                    {/* Images Preview */}
                    <Paper variant="outlined" sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, minHeight: 150 }}>
                      {images.map((image, index) => (
                        <Box key={index} sx={{ position: 'relative' }}>
                          <img 
                            src={URL.createObjectURL(image)} 
                            alt={`preview ${index}`} 
                            style={{ 
                              width: '100%', 
                              height: 'auto', 
                              aspectRatio: '1 / 1', 
                              objectFit: 'cover', 
                              borderRadius: 4 
                            }} 
                          />
                          <IconButton 
                            size="small" 
                            onClick={() => handleRemoveImage(index)} 
                            sx={{ 
                              position: 'absolute', 
                              top: -5, 
                              right: -5, 
                              bgcolor: 'rgba(255,255,255,0.9)', 
                              '&:hover': { bgcolor: 'white' }
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                    </Paper>

                    {/* Add Images Button */}
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      component="label" 
                      startIcon={<AddAPhoto />} 
                      sx={{ mt: 2 }} 
                      disabled={images.length >= MAX_IMAGES}
                    >
                      Add Images
                      <input 
                        type="file" 
                        hidden 
                        multiple 
                        accept="image/*" 
                        onChange={handleImageChange} 
                      />
                    </Button>

                    {/* Google Drive Connection */}
                    {!driveStatus.isSignedIn && (
                      <Button 
                        fullWidth 
                        variant="contained" 
                        startIcon={driveLoading ? <CircularProgress size={20} /> : <Google />} 
                        onClick={handleGoogleSignIn}
                        disabled={driveLoading}
                        sx={{ mt: 2 }}
                      >
                        {driveLoading ? 'Connecting...' : 'Connect Google Drive'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Return Decision Section */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      Return Decision
                    </Typography>

                    <Controller
                      name="returnDecision"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          select
                          fullWidth
                          label="What to do with this return?"
                          sx={{ mb: 2 }}
                        >
                          <MenuItem value="move_to_inventory">
                            <Box display="flex" alignItems="center" gap={1}>
                              <Inventory color="success" />
                              <Box>
                                <Typography variant="body2">Move to Inventory</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Item will be available for delivery
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
                                  Item stays in returns section
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        </TextField>
                      )}
                    />

                    <Controller
                      name="returnDecisionNotes"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          multiline
                          rows={3}
                          label="Decision Notes"
                          placeholder="Why are you making this decision?"
                        />
                      )}
                    />

                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Note:</strong> You can change this decision later from the returns management page.
                      </Typography>
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

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
              Review & Submit Return
            </Typography>
            
            {/* Review Summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Return Summary
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Serial Number:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('serialNumber')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">LPN Number:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('lpnNumber')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Product:</Typography>
                    <Typography variant="body1">{watch('productName')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">SKU:</Typography>
                    <Typography variant="body1" fontFamily="monospace">{watch('sku')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Condition:</Typography>
                    <Chip label={watch('condition')} size="small" />
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Quantity:</Typography>
                    <Typography variant="body1" fontWeight="bold">{watch('quantity')}</Typography>
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Decision:</Typography>
                    <Chip 
                      label={watch('returnDecision') === 'move_to_inventory' ? 'Move to Inventory' : 'Keep in Returns'} 
                      color={watch('returnDecision') === 'move_to_inventory' ? 'success' : 'warning'}
                      size="small" 
                    />
                  </Grid>
                  <Grid size={6}>
                    <Typography variant="body2" color="text.secondary">Images:</Typography>
                    <Typography variant="body1">{images.length} images attached</Typography>
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
                      {images.length} images will be uploaded to Google Drive
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2">
                      {watch('returnDecision') === 'move_to_inventory' 
                        ? 'Item will be moved to inventory for future delivery'
                        : 'Item will remain in returns section'
                      }
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
          {/* Return Process Guidelines */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Return Process Guidelines
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2">
                    <strong>Serial Number First:</strong> Always start by scanning or entering the serial number.
                  </Typography>
                </Alert>
                <Alert severity="success" icon={<CheckCircle />}>
                  <Typography variant="body2">
                    <strong>Auto-Fill:</strong> If the serial number exists, product details will be loaded automatically.
                  </Typography>
                </Alert>
                <Alert severity="warning" icon={<Warning />}>
                  <Typography variant="body2">
                    <strong>New Products:</strong> If the serial number doesn't exist, you'll create a new product record.
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
                        Current Status: {serialNumberValidation.currentStatus}
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
                  startIcon={<Inventory />}
                  onClick={() => navigate('/inventory')}
                >
                  View Inventory
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Search />}
                  onClick={() => navigate('/search')}
                >
                  Global Search
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
          {returnInfo?.originalProductInfo && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {returnInfo.originalProductInfo.productName}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">SKU:</Typography>
                  <Typography variant="body1" fontFamily="monospace">{returnInfo.originalProductInfo.sku}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Batch ID:</Typography>
                  <Typography variant="body1" fontFamily="monospace">{returnInfo.originalProductInfo.batchId}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Delivery Date:</Typography>
                  <Typography variant="body1">
                    {returnInfo.originalProductInfo.deliveryDate 
                      ? format(new Date(returnInfo.originalProductInfo.deliveryDate), 'PPpp')
                      : 'Not delivered'
                    }
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="body2" color="text.secondary">Customer:</Typography>
                  <Typography variant="body1">
                    {returnInfo.originalProductInfo.customerInfo?.name || 'Not available'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProductDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delivery History Dialog */}
      <Dialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Delivery History</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Complete delivery history for serial number {watchedSerialNumber}
          </Typography>
          
          {deliveryHistory.length === 0 ? (
            <Alert severity="info">
              <Typography variant="body2">
                No delivery history available for this serial number.
              </Typography>
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Carrier</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveryHistory.map((delivery) => (
                    <TableRow key={delivery.deliveryId}>
                      <TableCell>
                        {format(new Date(delivery.deliveryDate), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>{delivery.customerInfo.name || 'N/A'}</TableCell>
                      <TableCell>{delivery.shippingLabelData.carrier}</TableCell>
                      <TableCell>
                        <Chip label={delivery.status} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistoryDialog(false)}>Close</Button>
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