// src/components/BarcodeScanner.tsx
import React, { useRef, useEffect, useState } from 'react';
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
} from '@mui/material';
import { Close, CameraAlt } from '@mui/icons-material';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  open,
  onClose,
  onScan,
  title = 'Scan Barcode'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Cleanup function
  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setError(null);
    setLoading(false);
    setIsScanning(false);
  };

  // Start camera
  const startCamera = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Checking camera support...');
      
      // Check if device supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      console.log('Requesting camera permission...');
      
      // Try different camera constraints
      let mediaStream;
      
      try {
        // First try: back camera with specific constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: 'environment' },
            width: { min: 320, ideal: 640, max: 1920 },
            height: { min: 240, ideal: 480, max: 1080 }
          }
        });
      } catch (backCameraError) {
        console.log('Back camera failed, trying any camera:', backCameraError);
        
        try {
          // Second try: any camera
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { min: 320, ideal: 640 },
              height: { min: 240, ideal: 480 }
            }
          });
        } catch (anyCameraError) {
          console.log('Any camera failed, trying basic video:', anyCameraError);
          
          // Third try: most basic video request
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }

      console.log('Camera access granted!');
      setStream(mediaStream);
      
      // Log stream details for debugging
      console.log('Stream details:', {
        active: mediaStream.active,
        tracks: mediaStream.getVideoTracks().length,
        trackStates: mediaStream.getVideoTracks().map(track => ({
          enabled: track.enabled,
          readyState: track.readyState,
          settings: track.getSettings()
        }))
      });
    } catch (err: any) {
      console.error('Camera access error:', err);
      
      // More specific error messages
      let errorMessage = 'Cannot access camera. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Permission denied. Please allow camera access and refresh the page.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera does not support the requested settings.';
      } else {
        errorMessage += `Error: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Capture and process frame
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for processing
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // In a real implementation, you would use a barcode detection library here
    // For now, we'll simulate barcode detection
    simulateBarcodeDetection(imageData);
  };

  // Simulate barcode detection (replace with actual library)
  const simulateBarcodeDetection = (imageData: ImageData) => {
    // This is a placeholder - in production you would use:
    // - ZXing-js for web barcode detection
    // - QuaggaJS for barcode scanning
    // - Or a native solution
    
    // For demo purposes, generate a random barcode after 2 seconds
    setTimeout(() => {
      const simulatedBarcode = `${Date.now()}`.slice(-12);
      onScan(simulatedBarcode);
      handleClose();
    }, 2000);
  };

  // Manual barcode entry
  const handleManualEntry = () => {
    const barcode = prompt('Enter barcode manually:');
    if (barcode && barcode.trim()) {
      onScan(barcode.trim());
      handleClose();
    }
  };

  // Handle dialog close
  const handleClose = () => {
    cleanup();
    onClose();
  };

  // Start scanning
  const handleStartScan = async () => {
    setIsScanning(true);
    
    // Start continuous scanning
    const interval = setInterval(() => {
      if (!isScanning) {
        clearInterval(interval);
        return;
      }
      captureFrame();
    }, 500); // Scan every 500ms

    // Auto-stop after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
      setIsScanning(false);
    }, 30000);
  };

  // Initialize camera when dialog opens
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      cleanup();
    }

    return cleanup;
  }, [open]);

  // Separate effect to handle video stream assignment
  useEffect(() => {
    if (stream && videoRef.current && open) {
      console.log('Assigning stream to video element');
      const video = videoRef.current;
      
      video.srcObject = stream;
      
      const playVideo = async () => {
        try {
          await video.play();
          console.log('Video playing successfully');
        } catch (error) {
          console.error('Video play failed:', error);
          // Try again after a short delay
          setTimeout(async () => {
            try {
              await video.play();
              console.log('Video playing on retry');
            } catch (retryError) {
              console.error('Video play retry failed:', retryError);
            }
          }, 100);
        }
      };

      video.onloadedmetadata = playVideo;
      
      // If metadata is already loaded, play immediately
      if (video.readyState >= 1) {
        playVideo();
      }
    }
  }, [stream, open]);

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <CameraAlt color="primary" />
          {title}
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={60} />
            <Typography sx={{ mt: 2 }}>Starting camera...</Typography>
          </Box>
        )}

        {!loading && !error && (
          <Box>
            {/* Camera Preview */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                maxWidth: 400,
                mx: 'auto',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'black',
                aspectRatio: '4/3',
              }}
            >
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                autoPlay
                playsInline
                muted
                controls={false}
                onLoadedData={() => console.log('Video data loaded')}
                onError={(e) => console.error('Video error:', e)}
              />
              
              {/* Scanning overlay */}
              {isScanning && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '80%',
                    height: '20%',
                    border: '2px solid #4caf50',
                    borderRadius: 1,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      bgcolor: '#4caf50',
                      animation: 'scan 2s linear infinite',
                    },
                    '@keyframes scan': {
                      '0%': { transform: 'translateY(0)' },
                      '100%': { transform: 'translateY(calc(100% - 2px))' },
                    },
                  }}
                />
              )}
            </Box>

            {/* Hidden canvas for image processing */}
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />

            {/* Instructions */}
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 2 }}>
              {isScanning 
                ? 'Scanning for barcodes...' 
                : 'Position the barcode within the camera view and tap "Start Scanning"'
              }
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={handleClose} variant="outlined">
          Cancel
        </Button>
        
        <Button onClick={handleManualEntry} variant="outlined">
          Enter Manually
        </Button>
        
        {!loading && !error && !isScanning && (
          <Button 
            onClick={handleStartScan} 
            variant="contained"
            startIcon={<CameraAlt />}
          >
            Start Scanning
          </Button>
        )}
        
        {isScanning && (
          <Button 
            onClick={() => setIsScanning(false)} 
            variant="contained"
            color="secondary"
          >
            Stop Scanning
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BarcodeScanner;