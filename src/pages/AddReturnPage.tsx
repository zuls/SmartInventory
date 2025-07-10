// src/pages/AddReturnPage.tsx
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
  const [isDriveReady, setIsDriveReady] = useState(driveService.isSignedIn());
  const MAX_IMAGES = 20;

  useEffect(() => {
    const interval = setInterval(() => {
      const signedIn = driveService.isSignedIn();
      if (signedIn !== isDriveReady) {
        setIsDriveReady(signedIn);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isDriveReady]);

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
    if (images.length > 0 && !isDriveReady) {
        setError('Please sign in to Google Drive to upload images.');
        return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let driveFileReferences: DriveFileReference[] = [];
      if (images.length > 0) {
        driveFileReferences = await driveService.uploadFiles(images, user.uid);
      }
      
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
  
  const handleGoogleSignIn = () => {
      driveService.signIn();
  }

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          variant="outlined"
        >
          Back
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

                {!isDriveReady && images.length > 0 &&
                    <Alert severity="warning" sx={{mb: 2}}>Please sign in to Google to upload images.</Alert>
                }

                <Paper variant="outlined" sx={{ p: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, minHeight: 150 }}>
                  {images.map((image, index) => (
                    <Box key={index} sx={{ position: 'relative' }}>
                      <img src={URL.createObjectURL(image)} alt={`preview ${index}`} style={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 1 }} />
                      <IconButton size="small" onClick={() => handleRemoveImage(index)} sx={{ position: 'absolute', top: -5, right: -5, bgcolor: 'rgba(255,255,255,0.7)', '&:hover': { bgcolor: 'white' }}}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Paper>
                <Button fullWidth variant="outlined" component="label" startIcon={<AddAPhoto />} sx={{ mt: 2 }} disabled={images.length >= MAX_IMAGES}>
                  Add Images
                  <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
                </Button>
              </CardContent>
            </Card>
            
            <Card sx={{ mt: 3 }}>
              <CardContent>
                {!isDriveReady ? (
                    <Button fullWidth variant="contained" startIcon={<Google />} onClick={handleGoogleSignIn}>
                        Sign In with Google
                    </Button>
                ) : (
                    <Typography textAlign="center" color="text.secondary" variant="body2">
                        Signed in to Google Drive ✅
                    </Typography>
                )}
                <Divider sx={{ my: 2 }} />
                 <Button type="submit" fullWidth variant="contained" size="large" startIcon={loading ? <CircularProgress size={20} /> : <Save />} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Return'}
                  </Button>
                  <Button fullWidth variant="outlined" onClick={() => { reset(); setImages([]); }} disabled={loading} sx={{ mt: 2 }}>
                    Clear Form
                  </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>
      
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScanResult} title="Scan Tracking Barcode" />
    </Box>
  );
};

export default AddReturnPage;