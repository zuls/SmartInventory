// src/components/SimpleImageUpload.tsx
import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Alert,
  Paper,
  Chip,
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Image as ImageIcon,
  Add,
  PhotoCamera,
} from '@mui/icons-material';
import { DriveFileReference } from '../types';

interface SimpleImageUploadProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  maxImages?: number;
  title?: string;
  description?: string;
}

const SimpleImageUpload: React.FC<SimpleImageUploadProps> = ({
  images,
  onImagesChange,
  maxImages = 10,
  title = "Product Images",
  description = "Upload photos of the product",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      addFiles(Array.from(files));
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add new files to existing images
  const addFiles = (newFiles: File[]) => {
    setError(null);

    // Validate file types
    const validFiles = newFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not a valid image file`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    // Check total count
    const totalFiles = images.length + validFiles.length;
    if (totalFiles > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    // Add valid files
    onImagesChange([...images, ...validFiles]);
  };

  // Remove image
  const removeImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    onImagesChange(updatedImages);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  // Create image preview URL
  const getImagePreview = (file: File): string => {
    return URL.createObjectURL(file);
  };

  // Convert files to DriveFileReference format (for compatibility)
  const convertToFileReferences = (): DriveFileReference[] => {
    return images.map((file, index) => ({
      fileId: `local_${Date.now()}_${index}`,
      fileName: file.name,
      webViewLink: getImagePreview(file),
      fileType: 'image' as const,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'current-user',
    }));
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description} ({images.length}/{maxImages})
          </Typography>
        </Box>
        <Chip
          label={`${images.length} images`}
          color={images.length > 0 ? 'success' : 'default'}
          icon={<ImageIcon />}
        />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Drop Zone */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          mb: 2,
          textAlign: 'center',
          border: dragOver ? '2px dashed' : '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'grey.300',
          bgcolor: dragOver ? 'primary.light' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'primary.light',
          },
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="h6" gutterBottom>
          Drop images here or click to select
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Supports JPG, PNG, GIF up to 10MB each
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          sx={{ mt: 2 }}
          disabled={images.length >= maxImages}
        >
          Select Images
        </Button>
      </Paper>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Selected Images
          </Typography>
          <Grid container spacing={2}>
            {images.map((file, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={index}>
                <Card>
                  <CardMedia
                    component="img"
                    height="120"
                    image={getImagePreview(file)}
                    alt={file.name}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" noWrap sx={{ flex: 1, mr: 1 }}>
                        {file.name}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeImage(index)}
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Add More Button */}
      {images.length > 0 && images.length < maxImages && (
        <Box textAlign="center" mt={2}>
          <Button
            variant="outlined"
            startIcon={<PhotoCamera />}
            onClick={() => fileInputRef.current?.click()}
          >
            Add More Images
          </Button>
        </Box>
      )}

      {/* Helper Text */}
      <Box mt={2}>
        <Typography variant="caption" color="text.secondary">
          💡 Tip: You can drag and drop multiple images at once, or click to select files.
          Images are stored locally until you save the form.
        </Typography>
      </Box>
    </Box>
  );
};

export default SimpleImageUpload;

// Helper function to convert File[] to DriveFileReference[] for backward compatibility
export const convertFilesToDriveReferences = (files: File[], userId: string): DriveFileReference[] => {
  return files.map((file, index) => ({
    fileId: `local_${Date.now()}_${index}`,
    fileName: file.name,
    webViewLink: URL.createObjectURL(file),
    fileType: 'image' as const,
    uploadedAt: new Date().toISOString(),
    uploadedBy: userId,
  }));
};