// src/pages/GlobalSearchPage.tsx - Enhanced Search Implementation
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
  Divider,
  Button,
  Paper,
  Badge,
  Tabs,
  Tab,
  Collapse,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
} from '@mui/material';
import {
  Search,
  ArrowBack,
  Inventory2,
  AssignmentReturn,
  Inventory,
  LocalShipping,
  Clear,
  FilterList,
  OpenInNew,
  QrCodeScanner,
  TrendingUp,
  History,
  Bookmark,
  ExpandMore,
  ExpandLess,
  Assignment,
  Visibility,
  GetApp,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { returnService } from '../services/returnService';
import { inventoryService } from '../services/inventoryService';
import { SearchResult, SearchFilters } from '../types';
import { format } from 'date-fns';
import debounce from 'lodash.debounce';
import BarcodeScanner from '../components/BarcodeScanner';

const GlobalSearchEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Core search state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Advanced search features
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<Array<{ term: string; date: string; results: number }>>([]);
  const [savedSearches, setSavedSearches] = useState<Array<{ id: string; name: string; query: string; filters: SearchFilters }>>([]);
  
  // UI state
  const [tabValue, setTabValue] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [quickActionDialog, setQuickActionDialog] = useState<SearchResult | null>(null);
  const [exportDialog, setExportDialog] = useState(false);
  
  // Advanced filters
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    status: '',
    dateRange: { start: '', end: '' },
    hasSerialNumber: undefined,
    inventorySource: undefined,
  });

  // Enhanced search categories
  const searchCategories = [
    { id: 'all', label: 'All Results', icon: Search },
    { id: 'packages', label: 'Packages', icon: Inventory2 },
    { id: 'returns', label: 'Returns', icon: AssignmentReturn },
    { id: 'inventory', label: 'Inventory', icon: Inventory },
    { id: 'delivered', label: 'Delivered', icon: LocalShipping },
    { id: 'serial_numbers', label: 'Serial Numbers', icon: Assignment },
  ];

  // Debounced search function with enhanced features
  const debouncedSearch = useCallback(
    debounce(async (term: string, currentFilters: SearchFilters) => {
      if (term.length < 2) {
        setSearchResults([]);
        setSuggestions([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Enhanced search with multiple data sources
        const [packages, returns, inventory, delivered, serialNumbers] = await Promise.all([
          packageService.searchPackages(term),
          returnService.searchReturns(term),
          inventoryService.searchInventory(term),
          inventoryService.searchDeliveredItems(term),
          searchSerialNumbers(term), // New function for serial number search
        ]);

        // Convert to unified SearchResult format with enhanced data
        const results: SearchResult[] = [
          ...packages.map(pkg => ({
            id: pkg.id,
            type: 'package' as const,
            title: `Package ${pkg.trackingNumber}`,
            subtitle: pkg.productName,
            status: pkg.status,
            date: pkg.receivedDate || new Date().toISOString(),
            relevanceScore: calculateRelevance(term, pkg.trackingNumber + ' ' + pkg.productName),
            serialNumber: pkg.sku,
            batchId: undefined,
          })),
          ...returns.map(ret => ({
            id: ret.id,
            type: 'return' as const,
            title: `Return ${ret.lpnNumber}`,
            subtitle: `${ret.productName} • ${ret.trackingNumber}`,
            status: ret.status,
            date: ret.receivedDate || new Date().toISOString(),
            relevanceScore: calculateRelevance(term, ret.lpnNumber + ' ' + ret.productName + ' ' + (ret.serialNumber || '')),
            serialNumber: ret.serialNumber,
            itemId: ret.originalItemId,
          })),
          ...inventory.map(inv => ({
            id: inv.id,
            type: 'inventory' as const,
            title: `Inventory ${inv.sku}`,
            subtitle: inv.productName,
            status: `${inv.availableQuantity} available`,
            date: inv.receivedDate || new Date().toISOString(),
            relevanceScore: calculateRelevance(term, inv.sku + ' ' + inv.productName),
            batchId: inv.id,
          })),
          ...delivered.map(del => ({
            id: del.id,
            type: 'delivered' as const,
            title: `Delivered ${del.serialNumber || del.sku || 'Item'}`,
            subtitle: del.productName || del.customerInfo?.name || 'Unknown',
            status: 'Delivered',
            date: del.deliveryDate || del.createdAt || new Date().toISOString(),
            relevanceScore: calculateRelevance(term, (del.sku || '') + ' ' + (del.productName || del.serialNumber || '')),
            serialNumber: del.serialNumber,
            itemId: del.itemId,
          })),
          ...serialNumbers.map(sn => ({
            id: sn.id,
            type: 'serial_number' as const,
            title: `Serial ${sn.serialNumber}`,
            subtitle: `${sn.productName} • Status: ${sn.status}`,
            status: sn.status,
            date: sn.lastUpdated || new Date().toISOString(),
            relevanceScore: calculateRelevance(term, sn.serialNumber + ' ' + sn.productName),
            serialNumber: sn.serialNumber,
            itemId: sn.itemId,
            batchId: sn.batchId,
          })),
        ];

        // Apply filters
        const filteredResults = applyFilters(results, currentFilters);

        // Sort by relevance
        filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        setSearchResults(filteredResults);
        
        // Update search history
        updateSearchHistory(term, filteredResults.length);
        
        // Generate suggestions
        generateSuggestions(term, filteredResults);
        
        // Add to recent searches
        if (term.length > 2) {
          setRecentSearches(prev => [
            term,
            ...prev.filter(search => search !== term).slice(0, 9)
          ]);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('Search failed. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Enhanced serial number search function
  const searchSerialNumbers = async (term: string) => {
    // This would be implemented in your inventory service
    // For now, return empty array
    return [];
  };

  // Apply advanced filters to results
  const applyFilters = (results: SearchResult[], currentFilters: SearchFilters): SearchResult[] => {
    return results.filter(result => {
      // Type filter
      if (currentFilters.type !== 'all' && result.type !== currentFilters.type) {
        return false;
      }

      // Status filter
      if (currentFilters.status && result.status !== currentFilters.status) {
        return false;
      }

      // Date range filter
      if (currentFilters.dateRange.start || currentFilters.dateRange.end) {
        const resultDate = new Date(result.date);
        if (currentFilters.dateRange.start && resultDate < new Date(currentFilters.dateRange.start)) {
          return false;
        }
        if (currentFilters.dateRange.end && resultDate > new Date(currentFilters.dateRange.end)) {
          return false;
        }
      }

      // Serial number filter
      if (currentFilters.hasSerialNumber !== undefined) {
        const hasSerial = !!result.serialNumber;
        if (currentFilters.hasSerialNumber !== hasSerial) {
          return false;
        }
      }

      return true;
    });
  };

  // Calculate relevance score with enhanced algorithm
  const calculateRelevance = (searchTerm: string, text: string): number => {
    const term = searchTerm.toLowerCase();
    const content = text.toLowerCase();
    
    let score = 0;
    
    // Exact match gets highest score
    if (content === term) {
      score += 1000;
    } else if (content.includes(term)) {
      score += 100;
    }
    
    // Word matches
    const searchWords = term.split(' ');
    const contentWords = content.split(' ');
    
    searchWords.forEach(searchWord => {
      contentWords.forEach(contentWord => {
        if (contentWord === searchWord) {
          score += 75; // Exact word match
        } else if (contentWord.includes(searchWord)) {
          score += 50; // Partial word match
        } else if (searchWord.includes(contentWord)) {
          score += 25; // Reverse partial match
        }
      });
    });
    
    // Boost score for serial numbers and tracking numbers
    if (term.length > 6 && /^[A-Z0-9-]+$/.test(term)) {
      score += 50;
    }
    
    return score;
  };

  // Generate smart suggestions
  const generateSuggestions = (term: string, results: SearchResult[]) => {
    const suggestions: string[] = [];
    
    // Add suggestions based on partial matches
    results.slice(0, 5).forEach(result => {
      if (result.serialNumber && result.serialNumber.toLowerCase().includes(term.toLowerCase())) {
        suggestions.push(result.serialNumber);
      }
      if (result.title.toLowerCase().includes(term.toLowerCase()) && !suggestions.includes(result.title)) {
        suggestions.push(result.title);
      }
    });
    
    setSuggestions(suggestions.slice(0, 5));
  };

  // Update search history
  const updateSearchHistory = (term: string, resultCount: number) => {
    setSearchHistory(prev => [
      { term, date: new Date().toISOString(), results: resultCount },
      ...prev.filter(h => h.term !== term).slice(0, 19)
    ]);
  };

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    
    // Update URL
    if (value) {
      setSearchParams({ q: value });
    } else {
      setSearchParams({});
    }
    
    debouncedSearch(value, filters);
  };

  // Handle barcode scan
  const handleScanResult = (scannedCode: string) => {
    setSearchTerm(scannedCode);
    setSearchParams({ q: scannedCode });
    debouncedSearch(scannedCode, filters);
    setScannerOpen(false);
  };

  // Handle quick actions
  const handleQuickAction = (result: SearchResult, action: string) => {
    switch (action) {
      case 'view':
        handleResultClick(result);
        break;
      case 'edit':
        navigate(`/${result.type}s/${result.id}/edit`);
        break;
      case 'track':
        if (result.serialNumber) {
          navigate(`/search?q=${result.serialNumber}`);
        }
        break;
      case 'history':
        if (result.serialNumber) {
          navigate(`/inventory/history/${result.serialNumber}`);
        }
        break;
    }
    setQuickActionDialog(null);
  };

  // Handle result click with enhanced navigation
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'package':
        navigate(`/packages/${result.id}`);
        break;
      case 'return':
        navigate(`/returns/${result.id}`);
        break;
      case 'inventory':
        navigate(`/inventory?sku=${result.subtitle}`);
        break;
      case 'delivered':
        navigate(`/delivery/history/${result.id}`);
        break;
      case 'serial_number':
        navigate(`/inventory/serial/${result.serialNumber}`);
        break;
    }
  };

  // Save current search
  const saveCurrentSearch = () => {
    const savedSearch = {
      id: Date.now().toString(),
      name: `Search: ${searchTerm}`,
      query: searchTerm,
      filters,
    };
    setSavedSearches(prev => [...prev, savedSearch]);
  };

  // Export search results
  const handleExport = (format: 'csv' | 'json') => {
    const data = searchResults.map(result => ({
      Type: result.type,
      Title: result.title,
      Description: result.subtitle,
      Status: result.status,
      Date: result.date,
      SerialNumber: result.serialNumber || '',
      ID: result.id,
    }));

    if (format === 'csv') {
      const csv = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${Date.now()}.csv`;
      a.click();
    } else {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${Date.now()}.json`;
      a.click();
    }
    
    setExportDialog(false);
  };

  // Filter results based on current tab
  const filteredResults = searchResults.filter(result => {
    if (tabValue === 0) return true; // All
    const category = searchCategories[tabValue];
    return category && result.type === category.id;
  });

  // Get result counts by type
  const getResultCounts = () => {
    const counts: Record<string, number> = {};
    searchCategories.forEach(category => {
      if (category.id === 'all') {
        counts[category.id] = searchResults.length;
      } else {
        counts[category.id] = searchResults.filter(r => r.type === category.id).length;
      }
    });
    return counts;
  };

  const counts = getResultCounts();

  // Initialize search from URL params
  useEffect(() => {
    const query = searchParams.get('q');
    if (query && query !== searchTerm) {
      setSearchTerm(query);
      debouncedSearch(query, filters);
    }
  }, [searchParams]);

  return (
    <Box p={3}>
      {/* Enhanced Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          variant="outlined"
        >
          Back to Dashboard
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Global Search
        </Typography>
        <Box display="flex" gap={2}>
          {searchResults.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={() => setExportDialog(true)}
            >
              Export Results
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<QrCodeScanner />}
            onClick={() => setScannerOpen(true)}
          >
            Scan
          </Button>
        </Box>
      </Box>

      {/* Enhanced Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search packages, returns, inventory, deliveries, or serial numbers..."
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => setShowFilters(!showFilters)}
                        color={showFilters ? 'primary' : 'default'}
                      >
                        <FilterList />
                      </IconButton>
                      <IconButton size="small" onClick={() => setScannerOpen(true)}>
                        <QrCodeScanner />
                      </IconButton>
                      {searchTerm && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSearchTerm('');
                            setSearchResults([]);
                            setSearchParams({});
                          }}
                        >
                          <Clear />
                        </IconButton>
                      )}
                    </Box>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1.1rem',
                  padding: '8px 14px',
                },
              }}
            />
            {searchTerm && (
              <Button variant="contained" onClick={saveCurrentSearch}>
                Save Search
              </Button>
            )}
          </Box>

          {/* Enhanced Filters */}
          <Collapse in={showFilters}>
            <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Filters
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filters.type}
                      label="Type"
                      onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="package">Packages</MenuItem>
                      <MenuItem value="return">Returns</MenuItem>
                      <MenuItem value="inventory">Inventory</MenuItem>
                      <MenuItem value="delivered">Delivered</MenuItem>
                      <MenuItem value="serial_number">Serial Numbers</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Serial Numbers</InputLabel>
                    <Select
                      value={filters.hasSerialNumber === undefined ? 'all' : filters.hasSerialNumber ? 'yes' : 'no'}
                      label="Serial Numbers"
                      onChange={(e) => {
                        const value = e.target.value === 'all' ? undefined : e.target.value === 'yes';
                        setFilters(prev => ({ ...prev, hasSerialNumber: value }));
                      }}
                    >
                      <MenuItem value="all">All Items</MenuItem>
                      <MenuItem value="yes">With Serial Numbers</MenuItem>
                      <MenuItem value="no">Without Serial Numbers</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, start: e.target.value } 
                    }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, end: e.target.value } 
                    }))}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilters({
                        type: 'all',
                        status: '',
                        dateRange: { start: '', end: '' },
                        hasSerialNumber: undefined,
                      });
                      debouncedSearch(searchTerm, {
                        type: 'all',
                        status: '',
                        dateRange: { start: '', end: '' },
                        hasSerialNumber: undefined,
                      });
                    }}
                    size="small"
                    fullWidth
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>

          {/* Suggestions */}
          {suggestions.length > 0 && !loading && (
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Suggestions:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {suggestions.map((suggestion, index) => (
                  <Chip
                    key={index}
                    label={suggestion}
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSearchTerm(suggestion);
                      setSearchParams({ q: suggestion });
                      debouncedSearch(suggestion, filters);
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Rest of the component remains the same... */}
      {/* Search Results with enhanced features would continue here */}

      {/* Barcode Scanner */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScanResult}
        title="Scan to Search"
        description="Scan any barcode, serial number, or QR code"
      />

      {/* Export Dialog */}
      <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
        <DialogTitle>Export Search Results</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Export {searchResults.length} search results
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialog(false)}>Cancel</Button>
          <Button onClick={() => handleExport('csv')} variant="outlined">
            Export CSV
          </Button>
          <Button onClick={() => handleExport('json')} variant="contained">
            Export JSON
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GlobalSearchEnhanced;