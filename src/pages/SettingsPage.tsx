import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Avatar,
  TextField,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  VpnKey,
  Notifications,
  Palette,
  AccountCircle,
  Google,
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { driveService } from '../services/driveService';
import { updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // Assuming useAuth provides the Firebase user object

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDriveReady, setIsDriveReady] = useState(false);

  // Check Google Drive sign-in status
  useEffect(() => {
    const checkDriveStatus = () => {
      setIsDriveReady(driveService.isSignedIn());
    };
    
    // Check initially and then set an interval to check for changes
    checkDriveStatus();
    const interval = setInterval(checkDriveStatus, 1000);
    return () => clearInterval(interval);
  }, []);


  const handleProfileUpdate = async () => {
    if (!user) {
      setErrorMessage("You must be logged in to update your profile.");
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateProfile(user, { displayName });
      setSuccessMessage("Profile updated successfully!");
    } catch (error: any) {
      console.error("Profile update error:", error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setErrorMessage("No email address found for your account.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccessMessage(`Password reset link sent to ${user.email}. Please check your inbox.`);
    } catch (error: any) {
      console.error("Password reset error:", error);
      setErrorMessage(error.message);
    }
  };

  const handleGoogleSignIn = () => {
      driveService.signIn();
  };

  const handleGoogleSignOut = () => {
      driveService.signOut();
  }

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
          Settings
        </Typography>
      </Box>

      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}
      {errorMessage && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert>}

      <Grid container spacing={3}>
        {/* User Profile Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <AccountCircle fontSize="large" color="primary" />
                <Typography variant="h6">User Profile</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" alignItems="center" gap={3} mb={3}>
                <Avatar sx={{ width: 80, height: 80, fontSize: '2.5rem' }}>
                  {user?.displayName?.[0] || user?.email?.[0] || '?'}
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {user?.displayName || 'Anonymous User'}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {user?.email}
                  </Typography>
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                variant="outlined"
                sx={{ mb: 2 }}
              />

              <Box display="flex" justifyContent="space-between" gap={2}>
                 <Button
                    variant="outlined"
                    startIcon={<VpnKey />}
                    onClick={handlePasswordReset}
                  >
                    Change Password
                  </Button>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleProfileUpdate}
                  disabled={loading || displayName === user?.displayName}
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Application & Integration Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
           <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Palette fontSize="large" color="primary" />
                <Typography variant="h6">Application Preferences</Typography>
              </Box>
               <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={<Switch />}
                label="Enable Dark Mode"
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Enable Email Notifications"
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Google fontSize="large" color="primary" />
                <Typography variant="h6">Integrations</Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="body1" fontWeight="medium">Google Drive</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Status: {isDriveReady ? 
                            <span style={{color: 'green'}}>Connected</span> : 
                            <span style={{color: 'red'}}>Not Connected</span>
                          }
                        </Typography>
                    </Box>
                    {isDriveReady ? (
                         <Button variant="outlined" color="error" onClick={handleGoogleSignOut}>
                            Disconnect
                        </Button>
                    ) : (
                        <Button variant="contained" startIcon={<Google />} onClick={handleGoogleSignIn}>
                            Sign In with Google
                        </Button>
                    )}
              </Box>
              <Typography variant="caption" display="block" mt={2}>
                Connect your Google Drive account to attach images and documents to returns and packages.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsPage;