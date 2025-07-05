// src/pages/GlobalSearchPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import { MenuItem } from '@mui/material';

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
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { packageService } from '../services/packageService';
import { returnService } from '../services/returnService';
import { inventoryService } from '../services/inventoryService';
import { SearchResult, SearchFilters } from '../types';
import { format } from 'date-fns';
import { debounce } from 'lodash';

const GlobalSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    type: 'all',
    status: '',
    dateRange: { start: '', end: '' },
  });

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Search across all modules
        const [packages, returns, inventory, delivered] = await Promise.all([
          packageService.searchPackages(term),
          returnService.searchReturns(term),
          inventoryService.searchInventory(term),
          inventoryService.searchDeliveredItems(term),
        ]);

        // Convert to SearchResult format
        const results: SearchResult[] = [
          ...packages.map(pkg => ({
            id: pkg.id,
            type: 'package' as const,
            title: `Package ${pkg.trackingNumber}`,
            subtitle: pkg.productName,
            status: pkg.status,
            date: pkg.receivedDate,
            relevanceScore: calculateRelevance(term, pkg.trackingNumber + ' ' + pkg.productName),
          })),
          ...returns.map(ret => ({
            id: ret.id,
            type: 'return' as const,
            title: `Return ${ret.trackingNumber}`,
            subtitle: `LPN: ${ret.lpnNumber}`,
            status: ret.status,
            date: ret.receivedDate,
            relevanceScore: calculateRelevance(term, ret.trackingNumber + ' ' + ret.lpnNumber),
          })),
          ...inventory.map(inv => ({
            id: inv.id,
            type: 'inventory' as const,
            title: `Inventory ${inv.sku}`,
            subtitle: inv.productName,
            status: `${inv.availableQuantity} available`,
            date: inv.receivedDate,
            relevanceScore: calculateRelevance(term, inv.sku + ' ' + inv.productName),
          })),
          ...delivered.map(del => ({
            id: del.id,
            type: 'delivered' as const,
            title: `Delivered ${del.sku}`,
            subtitle: del.productName,
            status: 'Delivered',
            date: del.deliveryDate,
            relevanceScore: calculateRelevance(term, del.sku + ' ' + del.productName),
          })),
        ];

        // Sort by relevance score
        results.sort((a, b) => b.relevanceScore - a.relevanceScore);

        setSearchResults(results);
        
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

  // Calculate relevance score for search results
  const calculateRelevance = (searchTerm: string, text: string): number => {
    const term = searchTerm.toLowerCase();
    const content = text.toLowerCase();
    
    let score = 0;
    
    // Exact match gets highest score
    if (content.includes(term)) {
      score += 100;
    }
    
    // Word matches
    const searchWords = term.split(' ');
    const contentWords = content.split(' ');
    
    searchWords.forEach(searchWord => {
      contentWords.forEach(contentWord => {
        if (contentWord.includes(searchWord)) {
          score += 50;
        }
      });
    });
    
    return score;
  };

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // Handle search result click
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'package':
        navigate(`/packages/${result.id}`);
        break;
      case 'return':
        navigate(`/returns/${result.id}`);
        break;
      case 'inventory':
        navigate(`/inventory/${result.id}`);
        break;
      case 'delivered':
        navigate(`/delivery/history/${result.id}`);
        break;
    }
  };

  // Get icon for result type
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'package':
        return <Inventory2 />;
      case 'return':
        return <AssignmentReturn />;
      case 'inventory':
        return <Inventory />;
      case 'delivered':
        return <LocalShipping />;
      default:
        return <Search />;
    }
  };

  // Get color for result type
  const getResultColor = (type: string) => {
    switch (type) {
      case 'package':
        return 'primary';
      case 'return':
        return 'warning';
      case 'inventory':
        return 'success';
      case 'delivered':
        return 'info';
      default:
        return 'default';
    }
  };

  // Filter results based on selected tab
  const filteredResults = searchResults.filter(result => {
    if (tabValue === 0) return true; // All
    if (tabValue === 1) return result.type === 'package';
    if (tabValue === 2) return result.type === 'return';
    if (tabValue === 3) return result.type === 'inventory';
    if (tabValue === 4) return result.type === 'delivered';
    return true;
  });

  // Get result counts by type
  const getResultCounts = () => {
    const counts = {
      total: searchResults.length,
      packages: searchResults.filter(r => r.type === 'package').length,
      returns: searchResults.filter(r => r.type === 'return').length,
      inventory: searchResults.filter(r => r.type === 'inventory').length,
      delivered: searchResults.filter(r => r.type === 'delivered').length,
    };
    return counts;
  };

  const counts = getResultCounts();

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
          Global Search
        </Typography>
      </Box>

      {/* Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search packages, returns, inventory, or deliveries..."
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
                    <IconButton size="small" title="Scan barcode">
                      <QrCodeScanner />
                    </IconButton>
                    {searchTerm && (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSearchTerm('');
                          setSearchResults([]);
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

          {/* Advanced Filters */}
          <Collapse in={showFilters}>
            <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
              <Typography variant="subtitle2" gutterBottom>
                Advanced Filters
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    select
                    label="Status"
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    size="small"
                  >
                    <MenuItem value="">All Statuses</MenuItem>
                    <MenuItem value="received">Received</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Start Date"
                    value={filters.dateRange?.start}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, start: e.target.value } 
                    }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="End Date"
                    value={filters.dateRange?.end}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { ...prev.dateRange, end: e.target.value } 
                    }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setFilters({ type: 'all', status: '', dateRange: { start: '', end: '' } })}
                    size="small"
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Search Results */}
        <Grid size={{ xs: 12, md: 8 }}>
          {searchTerm.length > 0 && (
            <Card>
              <CardContent>
                {/* Results Tabs */}
                <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
                  <Tab label={
                    <Badge badgeContent={counts.total} color="primary">
                      All Results
                    </Badge>
                  } />
                  <Tab label={
                    <Badge badgeContent={counts.packages} color="primary">
                      Packages
                    </Badge>
                  } />
                  <Tab label={
                    <Badge badgeContent={counts.returns} color="warning">
                      Returns
                    </Badge>
                  } />
                  <Tab label={
                    <Badge badgeContent={counts.inventory} color="success">
                      Inventory
                    </Badge>
                  } />
                  <Tab label={
                    <Badge badgeContent={counts.delivered} color="info">
                      Delivered
                    </Badge>
                  } />
                </Tabs>

                {/* Loading State */}
                {loading && (
                  <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Searching...</Typography>
                  </Box>
                )}

                {/* Results List */}
                {!loading && (
                  <List>
                    {filteredResults.length === 0 ? (
                      <Box textAlign="center" py={4}>
                        <Typography variant="body1" color="text.secondary">
                          {searchTerm.length < 2 
                            ? 'Enter at least 2 characters to search' 
                            : 'No results found for your search'
                          }
                        </Typography>
                      </Box>
                    ) : (
                      filteredResults.map((result, index) => (
                        <React.Fragment key={`${result.type}-${result.id}`}>
                          <ListItem
                            button
                            onClick={() => handleResultClick(result)}
                            sx={{
                              borderRadius: 1,
                              mb: 1,
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: `${getResultColor(result.type)}.light` }}>
                                {getResultIcon(result.type)}
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Typography variant="subtitle1" fontWeight="medium">
                                    {result.title}
                                  </Typography>
                                  <Chip
                                    label={result.type}
                                    color={getResultColor(result.type) as any}
                                    size="small"
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    {result.subtitle}
                                  </Typography>
                                  <Box display="flex" alignItems="center" gap={2} mt={0.5}>
                                    <Chip
                                      label={result.status}
                                      size="small"
                                      variant="outlined"
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                      {format(new Date(result.date), 'MMM dd, yyyy')}
                                    </Typography>
                                  </Box>
                                </Box>
                              }
                            />
                            <IconButton size="small" title="Open in new tab">
                              <OpenInNew />
                            </IconButton>
                          </ListItem>
                          {index < filteredResults.length - 1 && <Divider />}
                        </React.Fragment>
                      ))
                    )}
                  </List>
                )}

                {/* Show More Button */}
                {filteredResults.length > 10 && (
                  <Box textAlign="center" mt={2}>
                    <Button variant="outlined" startIcon={<ExpandMore />}>
                      Show More Results
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {searchTerm.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Search sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Universal Search
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Search across all your packages, returns, inventory, and deliveries in one place.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try searching for tracking numbers, SKUs, product names, or serial numbers.
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Search Tips */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Search Tips
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Tracking Numbers"
                    secondary="Search by full or partial tracking numbers"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="SKUs & Product Names"
                    secondary="Find inventory and products by SKU or name"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Serial Numbers"
                    secondary="Track specific items by serial number"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="LPN Numbers"
                    secondary="Search returns by LPN or removal order ID"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Searches
                </Typography>
                <List dense>
                  {recentSearches.map((search, index) => (
                    <ListItem
                      key={index}
                      button
                      onClick={() => {
                        setSearchTerm(search);
                        debouncedSearch(search);
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'grey.100' }}>
                          <History />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={search} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Stats
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Package color="primary" />
                    <Typography variant="body2">Active Packages</Typography>
                  </Box>
                  <Chip label="24" color="primary" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <AssignmentReturn color="warning" />
                    <Typography variant="body2">Pending Returns</Typography>
                  </Box>
                  <Chip label="8" color="warning" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Inventory color="success" />
                    <Typography variant="body2">Available Items</Typography>
                  </Box>
                  <Chip label="156" color="success" size="small" />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <LocalShipping color="info" />
                    <Typography variant="body2">Recent Deliveries</Typography>
                  </Box>
                  <Chip label="12" color="info" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GlobalSearchPage;