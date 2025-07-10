import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Chip,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
} from '@mui/icons-material';
import { packageService } from '../services/packageService';
import { Package, PackageStatus } from '../types';
import { format } from 'date-fns';

// A reusable component to display detail items neatly
const DetailItem: React.FC<{ title: string; value?: React.ReactNode }> = ({ title, value }) => {
  return (
    <>
      <Typography variant="caption" color="text.secondary" display="block">
        {title}
      </Typography>
      <Typography variant="body1" fontWeight="medium">
        {value || 'N/A'}
      </Typography>
    </>
  );
};

const PackageDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPackageData = useCallback(async () => {
    if (!id) {
      setError('Package ID is missing from the URL.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await packageService.getPackageById(id);
      if (data) {
        setPkg(data);
      } else {
        setError('Package record not found.');
      }
    } catch (err) {
      console.error('Error loading package data:', err);
      setError('Failed to load package details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPackageData();
  }, [loadPackageData]);

  const getStatusChip = (status: PackageStatus) => {
    switch (status) {
      case PackageStatus.RECEIVED:
        return <Chip label="Received" color="info" />;
      case PackageStatus.LABELED:
        return <Chip label="Labeled" color="secondary" />;
      case PackageStatus.READY:
        return <Chip label="Ready for Dispatch" color="warning" />;
      case PackageStatus.DISPATCHED:
        return <Chip label="Dispatched" color="success" />;
      default:
        return <Chip label={(status as string).toUpperCase()} />;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  
  if (!pkg) {
    return null;
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/packages')} variant="outlined">
              Back to List
            </Button>
            <Typography variant="h4" fontWeight="bold">
              Package Details
            </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Edit />}>
            Edit
        </Button>
      </Box>

      <Card>
          <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="start">
                  <Typography variant="h5" gutterBottom sx={{ fontFamily: 'monospace' }}>
                      {pkg.trackingNumber}
                  </Typography>
                  {getStatusChip(pkg.status)}
              </Box>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailItem title="Product Name" value={pkg.productName} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailItem title="Carrier" value={pkg.carrier} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailItem title="SKU" value={pkg.sku} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailItem title="Barcode" value={pkg.barcode} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailItem title="Received Date" value={pkg.receivedDate ? format(new Date(pkg.receivedDate), 'PPpp') : 'N/A'} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <DetailItem title="Received By" value={pkg.receivedBy} />
                  </Grid>
                  <Grid size={12}>
                    <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                    <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, mt: 1 }}>
                        <Typography variant="body2">{pkg.notes || 'No notes provided.'}</Typography>
                    </Box>
                  </Grid>
              </Grid>
          </CardContent>
      </Card>
    </Box>
  );
};

export default PackageDetailPage;