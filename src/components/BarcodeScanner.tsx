// src/components/BarcodeScanner.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  IconButton,
  TextField,
} from '@mui/material';
import {
  Close,
  CameraAlt,
  FlashOn,
  FlashOff,
  CenterFocusStrong,
} from '@mui/icons-material';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  open,
  onClose,
  onScan,
  title = 'Scan Barcode',
  description = 'Position the barcode within the frame',
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start camera when dialog opens
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    try {
      setError(null);
      setIsScanning(true);
      
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      streamRef.current = stream;
      setHasPermission(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning after video loads
        videoRef.current.onloadedmetadata = () => {
          startBarcodeDetection();
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setHasPermission(false);
      setError('Camera access denied or not available');
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsScanning(false);
  };

  const startBarcodeDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // Simple barcode detection simulation
    // In a real implementation, you would use libraries like:
    // - @zxing/library
    // - quagga2
    // - ml5.js
    
    // scanIntervalRef.current = setInterval(() => {
    //   if (videoRef.current && canvasRef.current) {
    //     const canvas = canvasRef.current;
    //     const context = canvas.getContext('2d');
    //     const video = videoRef.current;
        
    //     if (context && video.videoWidth && video.videoHeight) {
    //       canvas.width = video.videoWidth;
    //       canvas.height = video.videoHeight;
          
    //       // Draw current frame
    //       context.drawImage(video, 0, 0, canvas.width, canvas.height);
          
    //       // Simulate barcode detection
    //       // In reality, you'd process the image data here
    //       const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          
    //       // Mock barcode detection (remove in real implementation)
    //       if (Math.random() > 0.95) { // 5% chance to "detect" a barcode
    //         const mockBarcode = generateMockBarcode();
    //         handleBarcodeDetected(mockBarcode);
    //       }
    //     }
    //   }
    // }, 100);
  };

  const generateMockBarcode = (): string => {
    // Generate a mock barcode for testing
    const types = ['tracking', 'sku', 'serial'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    switch (type) {
      case 'tracking':
        return '1Z999AA1' + Math.random().toString().slice(2, 11);
      case 'sku':
        return 'SKU' + Math.random().toString().slice(2, 8);
      case 'serial':
        return 'SN' + Math.random().toString().slice(2, 12);
      default:
        return Math.random().toString().slice(2, 12);
    }
  };

  const handleBarcodeDetected = (code: string) => {
    if (code && code.length > 3) {
      onScan(code);
      stopCamera();
      onClose();
    }
  };

  const toggleFlash = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && 'torch' in track.getCapabilities()) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !flashEnabled }],
          });
          setFlashEnabled(!flashEnabled);
        } catch (err) {
          console.error('Flash control not supported:', err);
        }
      }
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      setShowManualInput(false);
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setShowManualInput(false);
    setManualCode('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {description}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Camera View */}
        {hasPermission && !showManualInput && (
          <Box position="relative" mb={2}>
            <Paper
              elevation={3}
              sx={{
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'black',
                minHeight: 300,
              }}
            >
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                playsInline
                muted
              />
              
              {/* Scanning Overlay */}
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                display="flex"
                alignItems="center"
                justifyContent="center"
                sx={{
                  background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.5) 50%, transparent 80%)',
                }}
              >
                <Box
                  sx={{
                    width: 250,
                    height: 150,
                    border: '2px solid white',
                    borderRadius: 2,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CenterFocusStrong sx={{ color: 'white', fontSize: 40 }} />
                  
                  {/* Scanning Animation */}
                  {isScanning && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        bgcolor: 'primary.main',
                        animation: 'scan 2s linear infinite',
                        '@keyframes scan': {
                          '0%': { transform: 'translateY(0)' },
                          '100%': { transform: 'translateY(146px)' },
                        },
                      }}
                    />
                  )}
                </Box>
              </Box>
              
              {/* Camera Controls */}
              <Box
                position="absolute"
                top={16}
                right={16}
                display="flex"
                gap={1}
              >
                <IconButton
                  onClick={toggleFlash}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.7)',
                    },
                  }}
                  size="small"
                >
                  {flashEnabled ? <FlashOn /> : <FlashOff />}
                </IconButton>
              </Box>
            </Paper>
            
            {/* Scanning Status */}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              mt={2}
              gap={1}
            >
              {isScanning && <CircularProgress size={20} />}
              <Typography variant="body2" color="text.secondary">
                {isScanning ? 'Scanning for barcode...' : 'Camera loading...'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Manual Input Mode */}
        {showManualInput && (
          <Box mt={2}>
            <TextField
              fullWidth
              label="Enter barcode manually"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Type or paste barcode here"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleManualSubmit();
                }
              }}
              autoFocus
            />
          </Box>
        )}

        {/* Permission Denied */}
        {hasPermission === false && (
          <Box textAlign="center" py={4}>
            <CameraAlt sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              Camera access is required to scan barcodes
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Please enable camera permission in your browser settings
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setShowManualInput(true)}
            >
              Enter Code Manually
            </Button>
          </Box>
        )}

        {/* Hidden canvas for barcode processing */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        
        {hasPermission && !showManualInput && (
          <Button
            onClick={() => setShowManualInput(true)}
            variant="outlined"
          >
            Enter Manually
          </Button>
        )}
        
        {showManualInput && (
          <>
            <Button
              onClick={() => {
                setShowManualInput(false);
                setManualCode('');
                if (hasPermission) {
                  startCamera();
                }
              }}
              variant="outlined"
            >
              Use Camera
            </Button>
            <Button
              onClick={handleManualSubmit}
              variant="contained"
              disabled={!manualCode.trim()}
            >
              Submit
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BarcodeScanner;