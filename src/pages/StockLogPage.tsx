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
  Paper,
  Chip,
  TextField,
  InputAdornment,
  Button,
  Grid,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import {
  Search,
  ArrowBack,
  FilterList,
  ArrowUpward,
  ArrowDownward,
  SyncAlt,
} from '@mui/icons-material';
import { format } from 'date-fns';

// TODO: Move this interface to your `src/types/index.ts` file
export interface StockLog {
  id: string;
  timestamp: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  sku: string;
  productName: string;
  quantityChange: number;
  newQuantity: number;
  user: string;
  notes: string;
  referenceId: string; // e.g., Package ID, Return ID, Delivery ID
}

// --- MOCK DATA GENERATION ---
// TODO: Replace this with a real service call (e.g., `inventoryService.getStockLogs()`)
const generateMockStockLogs = (count: number): StockLog[] => {
  const logs: StockLog[] = [];
  const products = [
    { sku: 'MON-DELL-24-BLK', name: 'Dell 24" Monitor' },
    { sku: 'KEY-LOGI-MX-GR', name: 'Logitech MX Keys' },
    { sku: 'MSE-LOGI-MX-BLK', name: 'Logitech MX Master 3' },
    { sku: 'CAM-LOGI-C920', name: 'Logitech C920 Webcam' },
  ];
  const types: StockLog['type'][] = ['IN', 'OUT', 'ADJUSTMENT'];

  for (let i = 0; i < count; i++) {
    const product = products[Math.floor(Math.random() * products.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    const quantityChange = Math.floor(Math.random() * (type === 'IN' ? 50 : 5)) + 1;

    logs.push({
      id: `log_${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      type,
      sku: product.sku,
      productName: product.name,
      quantityChange: type === 'OUT' ? -quantityChange : quantityChange,
      newQuantity: Math.floor(Math.random() * 200),
      user: `user${Math.floor(Math.random() * 3) + 1}@example.com`,
      notes: type === 'IN' ? `Received from package PKG${Math.floor(Math.random() * 1000)}` : `Dispatched for order ORD${Math.floor(Math.random() * 1000)}`,
      referenceId: `REF-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    });
  }
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};


const StockLogPage: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLogs(generateMockStockLogs(50));
      setLoading(false);
    }, 1000);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' ||
      log.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.referenceId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || log.type === filterType;

    return matchesSearch && matchesType;
  });

  const getLogTypeStyle = (type: StockLog['type']) => {
    switch (type) {
      case 'IN':
        return { color: 'success.main', icon: <ArrowUpward fontSize="inherit" /> };
      case 'OUT':
        return { color: 'error.main', icon: <ArrowDownward fontSize="inherit" /> };
      case 'ADJUSTMENT':
        return { color: 'warning.main', icon: <SyncAlt fontSize="inherit" /> };
    }
  };

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard')}
            variant="outlined"
          >
            Back to Dashboard
          </Button>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              Stock Activity Logs
            </Typography>
             <Typography variant="body1" color="text.secondary">
              Track all inventory movements and adjustments
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Filter and Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                placeholder="Search by SKU, Product Name, or Reference ID..."
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
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
               <TextField
                  select
                  fullWidth
                  label="Filter by Type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <FilterList />
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="IN">IN</MenuItem>
                  <MenuItem value="OUT">OUT</MenuItem>
                  <MenuItem value="ADJUSTMENT">ADJUSTMENT</MenuItem>
                </TextField>
            </Grid>
             <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="body2" color="text.secondary" textAlign="right">
                Showing {filteredLogs.length} of {logs.length} records
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent>
          {loading ? (
             <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
             </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Product Name</TableCell>
                    <TableCell>SKU</TableCell>
                    <TableCell align="center">Change</TableCell>
                    <TableCell align="center">New Qty</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Reference</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(log.timestamp), 'p')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getLogTypeStyle(log.type).icon}
                          label={log.type}
                          size="small"
                          sx={{
                            color: getLogTypeStyle(log.type).color,
                            borderColor: getLogTypeStyle(log.type).color,
                          }}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{log.productName}</TableCell>
                      <TableCell>
                        <Typography fontFamily="monospace">{log.sku}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight="bold" color={getLogTypeStyle(log.type).color}>
                           {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{log.newQuantity}</TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {log.referenceId}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default StockLogPage;