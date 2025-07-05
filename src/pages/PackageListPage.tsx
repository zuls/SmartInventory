// src/pages/PackageListPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
} from '@mui/material';
import {
  Search,
  Visibility,
  Edit,
  LocalShipping,
  ArrowBack,
} from '@mui/icons-material';
import { packageService } from '../services/packageService';
import { Package, PackageStatus } from '../types';
import { format } from 'date-fns';

const PackageListPage: React.FC = () => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadPackages = async () => {
      try {
        const allPackages = await packageService.getAllPackages();
        setPackages(allPackages);
      } catch (error) {
        console.error('Error loading packages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPackages();
  }, []);

  const filteredPackages = packages.filter(pkg =>
    pkg.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pkg.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: PackageStatus) => {
    switch (status) {
      case PackageStatus.RECEIVED: return 'info';
      case PackageStatus.LABELED: return 'warning';
      case PackageStatus.READY: return 'success';
      case PackageStatus.DISPATCHED: return 'default';
      default: return 'default';
    }
  };

  if (loading) return <div>Loading packages...</div>;

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
          Package Management
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box mb={3}>
            <TextField
              fullWidth
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tracking Number</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Carrier</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Received Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
  {filteredPackages.map((pkg) => (
    <TableRow key={pkg.id}>
      {/* FIX 1: Use the 'sx' prop for custom styling */}
      <TableCell sx={{ fontFamily: 'monospace' }}>
        {pkg.trackingNumber}
      </TableCell>
      <TableCell>{pkg.productName}</TableCell>
      <TableCell>{pkg.carrier}</TableCell>

      {/* FIX 2: Correctly close each TableCell before starting the next */}
      <TableCell>
        <Chip
          label={pkg.status}
          color={getStatusColor(pkg.status)}
          size="small"
        />
      </TableCell>
      <TableCell>
        {format(new Date(pkg.receivedDate), 'MMM dd, yyyy')}
      </TableCell>
      <TableCell>
        <Box display="flex" gap={1}>
          <IconButton
            size="small"
            onClick={() => navigate(`/packages/${pkg.id}`)}
          >
            <Visibility />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => navigate(`/packages/${pkg.id}/edit`)}
          >
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              // Handle dispatch
            }}
          >
            <LocalShipping />
          </IconButton>
        </Box>
      </TableCell>
    </TableRow>
  ))}
</TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};