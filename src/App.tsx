// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import theme from './theme';

// Import pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReceivePackagePage from './pages/ReceivePage';
import PackageListPage from './pages/PackageListPage';
import PackageDetailPage from './pages/PackageDetailPage'; // Ensure this is imported
import ReturnsPage from './pages/ReturnsPage';
import AddReturnPage from './pages/AddReturnPage';
import ReturnDetailPage from './pages/ReturnDetailPage';
import InventoryPage from './pages/InventoryPage';
import DeliveryPage from './pages/DeliveryPage';
import GlobalSearchPage from './pages/GlobalSearchPage';
import StockLogPage from './pages/StockLogPage';
import SettingsPage from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={
            user ? <Navigate to="/dashboard" replace /> : <LoginPage />
          } 
        />
        
        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            
            {/* Package Management */}
            <Route path="receive" element={<ReceivePackagePage />} />
            <Route path="packages" element={<PackageListPage />} />
            <Route path="packages/:id" element={<PackageDetailPage />} />
            
            {/* Returns Management */}
            <Route path="returns" element={<ReturnsPage />} />
            <Route path="returns/new" element={<AddReturnPage />} />
            <Route path="returns/:id" element={<ReturnDetailPage />} />
            
            {/* Inventory Management */}
            <Route path="inventory" element={<InventoryPage />} />
            
            {/* --- CORRECTED ROUTE --- */}
            {/* This now correctly points to the page for receiving new packages/inventory */}
            <Route path="inventory/new" element={<ReceivePackagePage />} />
            
            {/* Delivery Management */}
            <Route path="delivery" element={<DeliveryPage />} />
            
            {/* Search */}
            <Route path="search" element={<GlobalSearchPage />} />
            
            {/* Stock Management */}
            <Route path="stock" element={<StockLogPage />} />
            
            {/* Settings */}
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;