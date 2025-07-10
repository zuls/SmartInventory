// src/pages/ReturnDetailPage.tsx
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
  Paper,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
} from '@mui/material';
import {
  ArrowBack,
  Inventory,
  Edit,
  Delete,
  Warning,
  Image as ImageIcon,
} from '@mui/icons-material';
import { returnService } from '../services/returnService';
import { Return, ReturnStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { format } from 'date-fns';

const DetailItem: React.FC<{ title: string; value?: React.ReactNode }> = ({ title, value }) => (
  <Grid size={{ xs: 12, sm: 6 }}>
    <Typography variant="caption" color="text.secondary" display="block">
      {title}
    </Typography>
    <Typography variant="body1" fontWeight="medium">
      {value || 'N/A'}
    </Typography>
  </Grid>
);

const ReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [returnData, setReturnData] = useState<Return | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadReturnData = useCallback(async () => {
    if (!id) {
      setError('Return ID is missing.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await returnService.getReturnById(id);
      if (data) {
        setReturnData(data);
      } else {
        setError('Return record not found.');
      }
    } catch (err) {
      console.error('Error loading return data:', err);
      setError('Failed to load return details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReturnData();
  }, [loadReturnData]);

  const handleMoveToInventory = async () => {
    if (!id || !user) return;
    setActionLoading(true);
    try {
      await returnService.moveReturnToInventory(id, user.uid);
      setConfirmOpen(false);
      await loadReturnData(); 
    } catch (err) {
      console.error('Error moving to inventory:', err);
      setError(err instanceof Error ? err.message : 'Failed to move item to inventory.');
    } finally {
      setActionLoading(false);
    }
  };
  
  // --- CORRECTED FUNCTION ---
  const getStatusChip = (status: ReturnStatus) => {
    switch (status) {
      case ReturnStatus.RECEIVED:
        return <Chip label="Received" color="warning" />;
      case ReturnStatus.PROCESSED:
        return <Chip label="Processed" color="info" />;
      case ReturnStatus.MOVED_TO_INVENTORY:
        return <Chip label="In Inventory" color="success" />;
    }
    // Fallback for any unexpected status values at runtime
    return <Chip label={(status as string).toUpperCase()} />;
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
  
  if (!returnData) {
    return null;
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/returns')} variant="outlined">
              Back to List
            </Button>
            <Typography variant="h4" fontWeight="bold">
              Return Details
            </Typography>
        </Box>
        <Box display="flex" gap={2}>
            <Button variant="outlined" startIcon={<Edit />}>
                Edit
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Inventory />}
              onClick={() => setConfirmOpen(true)}
              disabled={actionLoading || returnData.status === ReturnStatus.MOVED_TO_INVENTORY}
            >
              {actionLoading ? 'Moving...' : 'Move to Inventory'}
            </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
            <Card>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start">
                        <Typography variant="h5" gutterBottom sx={{ fontFamily: 'monospace' }}>
                            {returnData.lpnNumber}
                        </Typography>
                        {getStatusChip(returnData.status)}
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Grid container spacing={2}>
                        <DetailItem title="Product Name" value={returnData.productName} />
                        <DetailItem title="SKU" value={returnData.sku} />
                        <DetailItem title="Tracking Number" value={<Typography fontFamily="monospace">{returnData.trackingNumber}</Typography>} />
                        <DetailItem title="Condition" value={<Chip label={returnData.condition} size="small" />} />
                        <DetailItem title="Quantity" value={returnData.quantity} />
                        <DetailItem title="FBA/FBM" value={returnData.fbaFbm} />
                        <DetailItem title="Removal Order ID" value={returnData.removalOrderId} />
                        <DetailItem title="Serial Number" value={returnData.serialNumber} />
                        <DetailItem title="Received Date" value={format(new Date(returnData.receivedDate), 'PPpp')} />
                        <DetailItem title="Received By" value={returnData.receivedBy} />
                         {returnData.processedDate && (
                            <DetailItem title="Processed Date" value={format(new Date(returnData.processedDate), 'PPpp')} />
                        )}
                        <Grid size={{ xs: 12 }}>
                            <Typography variant="caption" color="text.secondary" display="block">Notes / Remarks</Typography>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="body2">{returnData.notes || 'No notes provided.'}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Attached Images
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      {returnData.driveFiles && returnData.driveFiles.length > 0 ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 1 }}>
                          {returnData.driveFiles.map((file) => (
                            <Link key={file.fileId} href={file.webViewLink} target="_blank" rel="noopener noreferrer">
                              <Box
                                component="img"
                                src={file.webViewLink.replace("view?usp=drivesdk", "uc?export=view")}
                                alt={file.fileName}
                                sx={{
                                  width: '100%',
                                  height: '100px',
                                  objectFit: 'cover',
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: 'divider',
                                  '&:hover': {
                                    opacity: 0.8,
                                  }
                                }}
                              />
                            </Link>
                          ))}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'text.secondary' }}>
                          <ImageIcon />
                          <Typography variant="body2">No images attached</Typography>
                        </Box>
                      )}
                    </Paper>
                </CardContent>
            </Card>
        </Grid>
      </Grid>
      
       <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Move to Inventory?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to move this item to the available inventory? This action will deduct {returnData.quantity} from the return stock and add it to the main inventory. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleMoveToInventory} variant="contained" color="primary" autoFocus disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : "Confirm & Move"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReturnDetailPage;