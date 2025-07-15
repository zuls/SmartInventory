// src/pages/AddReturnPage.tsx - Updated with better Google Drive integration
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
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ObjectSchema } from 'yup';
import { useAuth } from '../hooks/useAuth';
import { returnService } from '../services/returnService';
import { driveService } from '../services/driveService';
import { ReturnForm, ReturnCondition, DriveFileReference } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';

const returnConditions = Object.values(ReturnCondition);
const fbaFbmOptions = ['FBA', 'FBM'] as const;

const schema: ObjectSchema<ReturnForm> = yup.object({
  lpnNumber: yup.string().required('LPN number is required'),
  trackingNumber: yup.string().required('Tracking number is required'),
  productName: yup.string().required('Product name is required'),
  sku: yup.string().optional().default(''),
  condition: yup.mixed<ReturnCondition>().oneOf(Object.values(ReturnCondition)).required('Condition is required'),
  reason: yup.string().optional().default(''),
  notes: yup.string().optional().default(''),
  quantity: yup.number().min(1, 'Quantity must be at least 1').required('Quantity is required'),
  removalOrderId: yup.string().optional().default(''),
  serialNumber: yup.string().optional().default(''),
  fbaFbm: yup.mixed<'FBA' | 'FBM'>().oneOf(fbaFbmOptions).optional().default('FBA'),
});

const AddReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [driveStatus, setDriveStatus] = useState({
    isInitialized: false,
    isSignedIn: false,
    error: null as string | null,
    isLoading: false,
    details: 'Not initialized'
  });
  const [driveLoading, setDriveLoading] = useState(false);
  const MAX_IMAGES = 20;

  // Check Drive status periodically
  useEffect(() => {
    const checkDriveStatus = () => {
      const status = driveService.getStatus();
      setDriveStatus({
        isInitialized: status.isInitialized,
        isSignedIn: status.isSignedIn,
        error: status.error,
        isLoading: false, // Simple service doesn't have complex loading states
        details: status.details
      });
    };

    // Check immediately
    checkDriveStatus();

    // Check again every few seconds
    const interval = setInterval(checkDriveStatus, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReturnForm>({
    resolver: yupResolver(schema),
    defaultValues: {
      lpnNumber: '',
      trackingNumber: '',
      productName: '',
      sku: '',
      condition: ReturnCondition.INTACT,
      reason: '',
      notes: '',
      quantity: 1,
      removalOrderId: '',
      serialNumber: '',
      fbaFbm: 'FBA',
    },
  });

  const onSubmit = async (data: ReturnForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    console.log('📝 Starting form submission...');
    console.log('📊 Current drive status:', driveStatus);
    console.log('🖼️ Images to upload:', images.length);

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let driveFileReferences: DriveFileReference[] = [];
      
      // Only upload if we have images and are signed in
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
          console.log('⚠️ Images present but not signed in to Google Drive - saving without images');
          setError('Images will not be saved because Google Drive is not connected. Connect Google Drive or remove images to continue.');
          setLoading(false);
          return;
        }
      }
      
      console.log('💾 Creating return with drive files:', driveFileReferences);
      await returnService.createReturn(data, user.uid, driveFileReferences);
      
      setSuccess(true);
      reset();
      setImages([]);

      setTimeout(() => {
        navigate('/returns');
      }, 2000);
    } catch (err) {
      console.error('Error creating return:', err);
      setError(err instanceof Error ? err.message : 'Failed to create return');
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = () => {
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    setValue('trackingNumber', scannedCode);
    setScannerOpen(false);
  };

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
  
  const handleGoogleSignIn = async () => {
    setDriveLoading(true);
    setError(null);
    try {
      // Simple mock sign-in for testing
      await driveService.mockSignIn();
      
      // Update status
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
      
      setDriveStatus(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        details: `Error: ${errorMessage}`
      }));
    } finally {
      setDriveLoading(false);
    }
  };

  const handleRetryConnection = async () => {
    setDriveLoading(true);
    setError(null);
    try {
      console.log('🔄 Retrying Google Drive connection...');
      driveService.reset();
      await driveService.initialize();
      
      const status = driveService.getStatus();
      setDriveStatus({
        isInitialized: status.isInitialized,
        isSignedIn: status.isSignedIn,
        error: status.error,
        isLoading: false,
        details: status.details
      });
    } catch (error) {
      console.error('Retry failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      setError(`Retry failed: ${errorMessage}`);
    } finally {
      setDriveLoading(false);
    }
  };

  // Get Drive status display
  const getDriveStatusDisplay = () => {
    if (driveStatus.error) {
      return { 
        text: 'Connection Failed', 
        color: 'error', 
        icon: <Warning />,
        details: driveStatus.error
      };
    }
    if (driveStatus.isSignedIn) {
      return { 
        text: 'Connected ✅', 
        color: 'success', 
        icon: <Google />,
        details: 'Ready to upload images'
      };
    }
    if (driveStatus.isInitialized) {
      return { 
        text: 'Ready to Connect', 
        color: 'info', 
        icon: <Google />,
        details: 'Click to connect your Google Drive account'
      };
    }
    if (driveStatus.isLoading) {
      return { 
        text: 'Initializing...', 
        color: 'info', 
        icon: <CircularProgress size={16} />,
        details: 'Setting up Google Drive connection...'
      };
    }
    return { 
      text: 'Click to Enable', 
      color: 'warning', 
      icon: <Google />,
      details: 'Click connect to enable file uploads'
    };
  };

  const statusDisplay = getDriveStatusDisplay();

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/returns')}
          variant="outlined"
        >
          Back to Returns
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Add New Return
        </Typography>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Return created successfully! Redirecting...
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Form Fields */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Return Details
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                              <IconButton onClick={handleScanBarcode} edge="end">
                                <QrCodeScanner />
                              </IconButton>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="removalOrderId"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} fullWidth label="Removal Order ID" />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="serialNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} fullWidth label="Serial Number on Item" />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Controller
                      name="sku"
                      control={control}
                      render={({ field }) => (
                        <TextField {...field} fullWidth label="SKU" />
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
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                        />
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
                          rows={4}
                          label="Remarks / Notes"
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Image Upload & Actions */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Product Images ({images.length}/{MAX_IMAGES})
                </Typography>

                {/* Drive Status */}
                <Alert 
                  severity={statusDisplay.color as any} 
                  sx={{ mb: 2 }}
                  icon={statusDisplay.icon}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      Google Drive: {statusDisplay.text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {driveStatus.details}
                    </Typography>
                    {driveStatus.isLoading && (
                      <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                        Please wait while we connect to Google Drive...
                      </Typography>
                    )}
                  </Box>
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

                {/* Warning for images without Drive */}
                {images.length > 0 && !driveStatus.isSignedIn && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Images will not be saved unless you connect to Google Drive.
                  </Alert>
                )}
              </CardContent>
            </Card>
            
            <Card sx={{ mt: 3 }}>
              <CardContent>
                {/* Google Drive Connection */}
                {!driveStatus.isSignedIn ? (
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Button 
                      fullWidth 
                      variant="contained" 
                      startIcon={driveLoading ? <CircularProgress size={20} /> : <Google />} 
                      onClick={handleGoogleSignIn}
                      disabled={driveLoading || driveStatus.isLoading}
                    >
                      {driveLoading ? 'Connecting...' : 
                       driveStatus.isLoading ? 'Initializing...' : 'Connect Google Drive'}
                    </Button>
                    
                    {(driveStatus.error || (driveStatus.isLoading && !driveStatus.isInitialized)) && (
                      <Button 
                        fullWidth 
                        variant="outlined" 
                        size="small"
                        onClick={handleRetryConnection}
                        disabled={driveLoading}
                      >
                        {driveStatus.error ? 'Retry Connection' : 'Force Initialize'}
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Alert severity="success" icon={<Google />}>
                    Google Drive Connected
                  </Alert>
                )}
                
                {driveStatus.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <Typography variant="caption" component="div">
                      <strong>Error:</strong> {driveStatus.error}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Check console for more details. Make sure your domain is authorized in Google Cloud Console.
                    </Typography>
                  </Alert>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                {/* Submit Button */}
                <Button 
                  type="submit" 
                  fullWidth 
                  variant="contained" 
                  size="large" 
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />} 
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Return'}
                </Button>
                
                <Button 
                  fullWidth 
                  variant="outlined" 
                  onClick={() => { reset(); setImages([]); }} 
                  disabled={loading} 
                  sx={{ mt: 2 }}
                >
                  Clear Form
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
      
      <BarcodeScanner 
        open={scannerOpen} 
        onClose={() => setScannerOpen(false)} 
        onScan={handleScanResult} 
        title="Scan Tracking Barcode" 
      />
    </Box>
  );
};

export default AddReturnPage;