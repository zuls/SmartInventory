import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Inventory,
  QrCodeScanner,
  Save,
  ArrowBack,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { ReceivePackageForm, Carrier } from '../types';
import BarcodeScanner from '../components/BarcodeScanner';

const carriers = Object.values(Carrier);

// Updated Validation Schema
const schema = yup.object().shape({
  inventoryBatchId: yup.string().required('Inventory batch selection is required'),
  productSerialNumber: yup.string().default(''),
  shippingLabelData: yup.object().shape({
    labelNumber: yup.string().required('Label number is required'),
    carrier: yup.string().required('Carrier is required'),
    trackingNumber: yup.string().default(''),
    destination: yup.string().required('Destination is required'),
    weight: yup.string().default(''),
    dimensions: yup.string().default(''),
    serviceType: yup.string().default('Standard'),
  }).required(),
  customerInfo: yup.object().shape({
    name: yup.string().default(''),
    address: yup.string().default(''),
    email: yup.string().email('Invalid email format').default(''),
    phone: yup.string().default(''),
  }).required(),
  deliveryTracking: yup.string().default(''),
});


const ReceivePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanType, setScanType] = useState<'tracking' | 'barcode'>('barcode');

  const {
  control,
  handleSubmit,
  reset,
  setValue,
  formState: { errors },
} = useForm<ReceivePackageForm>({
  // resolver: yupResolver(schema), // Comment this out temporarily
  defaultValues: {
    trackingNumber: '',
    carrier: Carrier.FEDEX,
    productName: '',
    sku: '',
    barcode: '',
    quantity: 1,
    notes: '',
  },
});

  const onSubmit = async (data: ReceivePackageForm) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // The packageService will now handle the quantity
      const packageId = await packageService.createPackage(data, user.uid);
      
      setSuccess(true);
      reset(); 
      
      setTimeout(() => {
        navigate('/inventory');
      }, 2000);
    } catch (err) {
      console.error('Error creating package:', err);
      setError(err instanceof Error ? err.message : 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = (type: 'tracking' | 'barcode') => {
    setScanType(type);
    setScannerOpen(true);
  };

  const handleScanResult = (scannedCode: string) => {
    if (scanType === 'tracking') {
      setValue('trackingNumber', scannedCode);
    } else {
      setValue('barcode', scannedCode);
    }
    setScannerOpen(false);
  };

  return (
    <Box p={3}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          variant="outlined"
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Receive New Package
        </Typography>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Package and inventory batch created successfully! Redirecting...
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
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
                        )
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
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
              
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="SKU (Stock Keeping Unit)"
                      placeholder="e.g., MON-DELL-24-BLK"
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
                        helperText={errors.quantity?.message || 'Number of items in this shipment'}
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
                      rows={3}
                      label="Notes"
                      placeholder="e.g., Box was slightly damaged, items appear okay."
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Box display="flex" gap={2} justifyContent="flex-end" mt={2}>
                  <Button
                    variant="outlined"
                    onClick={() => reset()}
                    disabled={loading}
                  >
                    Clear Form
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Receive Package'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>

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