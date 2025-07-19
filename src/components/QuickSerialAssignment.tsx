// src/components/QuickSerialAssignment.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Assignment,
  Save,
  AutoMode,
  Delete,
  Speed,
} from '@mui/icons-material';
import { SerialNumberItem, InventoryBatch } from '../types';
import { inventoryService } from '../services/inventoryService';
import { useAuth } from '../hooks/useAuth';

interface QuickSerialAssignmentProps {
  open: boolean;
  onClose: () => void;
  batch: InventoryBatch | null;
  onSuccess: () => void;
}

const QuickSerialAssignment: React.FC<QuickSerialAssignmentProps> = ({
  open,
  onClose,
  batch,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [unassignedItems, setUnassignedItems] = useState<SerialNumberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load items that need serial numbers
  useEffect(() => {
    if (open && batch) {
      loadUnassignedItems();
    }
  }, [open, batch]);

  const loadUnassignedItems = async () => {
    if (!batch) return;
    
    setLoading(true);
    setError(null);
    try {
      const allItems = await inventoryService.getItemsByBatchId(batch.id);
      const needingSerial = allItems.filter(item => !item.serialNumber);
      setUnassignedItems(needingSerial);
      
      // Initialize empty serial numbers array
      setSerialNumbers(new Array(needingSerial.length).fill(''));
      setBulkInput('');
    } catch (err) {
      setError('Failed to load items');
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle individual serial number change
  const handleSerialChange = (index: number, value: string) => {
    const newSerials = [...serialNumbers];
    newSerials[index] = value;
    setSerialNumbers(newSerials);
  };

  // Auto-generate serial numbers
  const autoGenerate = () => {
    const timestamp = Date.now().toString().slice(-6);
    const sku = batch?.sku.replace(/[^A-Z0-9]/g, '').substring(0, 4) || 'ITEM';
    
    const generated = unassignedItems.map((_, index) => 
      `${sku}${timestamp}${String(index + 1).padStart(3, '0')}`
    );
    
    setSerialNumbers(generated);
  };

  // Handle bulk import from textarea
  const handleBulkImport = () => {
    const lines = bulkInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');
    
    const newSerials = [...serialNumbers];
    lines.forEach((line, index) => {
      if (index < newSerials.length) {
        newSerials[index] = line;
      }
    });
    
    setSerialNumbers(newSerials);
    setBulkInput('');
  };

  // Clear all serial numbers
  const clearAll = () => {
    setSerialNumbers(new Array(unassignedItems.length).fill(''));
    setBulkInput('');
  };

  // Save serial number assignments
  const handleSave = async () => {
    if (!user || !batch) return;

    // Get only filled serial numbers
    const assignments = unassignedItems
      .map((item, index) => ({
        itemId: item.id,
        serialNumber: serialNumbers[index]?.trim() || '',
      }))
      .filter(assignment => assignment.serialNumber !== '');

    if (assignments.length === 0) {
      setError('Please enter at least one serial number');
      return;
    }

    // Check for duplicates
    const serials = assignments.map(a => a.serialNumber);
    const duplicates = serials.filter((serial, index) => serials.indexOf(serial) !== index);
    if (duplicates.length > 0) {
      setError(`Duplicate serial numbers found: ${duplicates.join(', ')}`);
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      const bulkForm = {
        batchId: batch.id,
        serialNumbers: assignments,
        assignedBy: user.uid,
        notes: `Bulk assignment of ${assignments.length} serial numbers`,
      };

      const result = await inventoryService.bulkAssignSerialNumbers(bulkForm);
      
      if (result.successful > 0) {
        onSuccess();
        onClose();
      } else {
        setError(`Failed to assign serial numbers: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      setError('Failed to save serial numbers');
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const filledCount = serialNumbers.filter(sn => sn.trim() !== '').length;

  if (!batch) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Assignment />
          <Box>
            <Typography variant="h6">Assign Serial Numbers</Typography>
            <Typography variant="body2" color="text.secondary">
              {batch.productName} • {unassignedItems.length} items need serial numbers
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Progress */}
            <Alert severity={filledCount === unassignedItems.length ? 'success' : 'info'} sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>{filledCount} of {unassignedItems.length}</strong> serial numbers assigned
              </Typography>
            </Alert>

            {/* Quick Actions */}
            <Box display="flex" gap={2} mb={3}>
              <Button
                variant="outlined"
                startIcon={<Speed />}
                onClick={autoGenerate}
                disabled={unassignedItems.length === 0}
              >
                Auto-Generate All
              </Button>
              <Button
                variant="outlined"
                onClick={clearAll}
                disabled={filledCount === 0}
              >
                Clear All
              </Button>
            </Box>

            {/* Bulk Import Section */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Bulk Import (Optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="Paste serial numbers here, one per line:&#10;SN001&#10;SN002&#10;SN003"
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                sx={{ mb: 1 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleBulkImport}
                disabled={!bulkInput.trim()}
              >
                Import from Text
              </Button>
            </Paper>

            {/* Individual Serial Number Inputs */}
            <Typography variant="subtitle2" gutterBottom>
              Individual Items
            </Typography>
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', p: 1 }}>
              <List dense>
                {unassignedItems.map((item, index) => (
                  <ListItem key={item.id}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip
                            label={`#${index + 1}`}
                            size="small"
                            color={serialNumbers[index]?.trim() ? 'success' : 'default'}
                          />
                          <TextField
                            size="small"
                            label={`Serial Number ${index + 1}`}
                            value={serialNumbers[index] || ''}
                            onChange={(e) => handleSerialChange(index, e.target.value)}
                            placeholder={`SN${String(index + 1).padStart(3, '0')}`}
                            sx={{ flex: 1 }}
                          />
                          {serialNumbers[index]?.trim() && (
                            <IconButton
                              size="small"
                              onClick={() => handleSerialChange(index, '')}
                            >
                              <Delete />
                            </IconButton>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>

            {/* Summary */}
            {filledCount > 0 && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">
                  Ready to assign {filledCount} serial numbers
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={filledCount === 0 || saving}
          startIcon={saving ? <CircularProgress size={20} /> : <Save />}
        >
          {saving ? 'Saving...' : `Assign ${filledCount} Serial Numbers`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickSerialAssignment;