// src/pages/ReceivePage.tsx
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
} from '@mui/material';
import {
  Inventory,
  QrCodeScanner,
  Save,
  ArrowBack,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { ReceivePackageForm, Carrier } from '../types';

const carriers = [
  { value: 'FedEx', label: 'FedEx' },
  { value: 'UPS', label: 'UPS' },
  { value: 'Amazon', label: 'Amazon' },
  { value: 'USPS', label: 'USPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'Other', label: 'Other' },
];

const ReceivePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReceivePackageForm>({
    defaultValues: {
      trackingNumber: '',
      carrier: 'FedEx' as Carrier,
      productName: '',
      sku: '',
      barcode: '',
      notes: '',
    },
  });

  const onSubmit = async (data: ReceivePackageForm) => {
    // Simple validation
    if (!data.trackingNumber.trim()) {
      setError('Tracking number is required');
      return;
    }
    if (!data.productName.trim()) {
      setError('Product name is required');
      return;
    }
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('Submitting package data:', data);
      const packageId = await packageService.createPackage(data, user.uid);
      console.log('Package created with ID:', packageId);
      
      setSuccess(true);
      reset(); // Clear form
      
      // Show success message for 2 seconds, then redirect
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error creating package:', error);
      setError(error instanceof Error ? error.message : 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = () => {
    // Placeholder for barcode scanning functionality
    alert('Barcode scanning will be implemented with camera integration');
  };

  return (
    <Box p={3}>
      {/* Header */}
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

      {/* Success Alert */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Package received successfully! Redirecting to dashboard...
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <Inventory color="primary" />
            <Typography variant="h6">Package Information</Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* First Row */}
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
                      helperText={errors.trackingNumber?.message || 'Enter package tracking number'}
                      placeholder="1Z999AA1234567890"
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
                      helperText={errors.carrier?.message || 'Select shipping carrier'}
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

              {/* Second Row */}
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
                      helperText={errors.productName?.message || 'Enter the product description'}
                      placeholder="Laptop Computer, Monitor, etc."
                    />
                  )}
                />
              </Grid>

              {/* Third Row */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="sku"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="SKU"
                      placeholder="Product SKU (optional)"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box display="flex" gap={1}>
                  <Controller
                    name="barcode"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Barcode"
                        placeholder="Scan or enter barcode"
                      />
                    )}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleScanBarcode}
                    sx={{ minWidth: 'auto', px: 2 }}
                  >
                    <QrCodeScanner />
                  </Button>
                </Box>
              </Grid>

              {/* Fourth Row */}
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
                      placeholder="Additional notes about the package (optional)"
                    />
                  )}
                />
              </Grid>

              {/* Submit Button */}
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
                    sx={{ minWidth: 150 }}
                  >
                    {loading ? 'Saving...' : 'Receive Package'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Box mt={3} p={2} bgcolor="grey.100" borderRadius={1}>
        <Typography variant="body2" color="text.secondary">
          Debug: User ID: {user?.uid}, Email: {user?.email}
        </Typography>
      </Box>
    </Box>
  );
};

export default ReceivePage;