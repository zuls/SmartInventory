// Option 1: Update src/hooks/useAuth.ts to include logout function

import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const { user, loading, setUser, setLoading, setError } = useAuthStore();

  useEffect(() => {
    console.log('useAuth: Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('useAuth: Auth state changed -', firebaseUser ? `Logged in: ${firebaseUser.email}` : 'Logged out');
      
      setUser(firebaseUser);
      setLoading(false);
      
      if (firebaseUser) {
        console.log('useAuth: User authenticated, stopping loading');
      }
    });

    return () => {
      console.log('useAuth: Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // Add logout function
  const logout = async () => {
    try {
      await signOut(auth);
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error instanceof Error ? error.message : 'Sign out failed');
    }
  };

  const authState = {
    user,
    loading,
    isAuthenticated: !!user,
    logout, // ← Add logout function here
  };

  console.log('useAuth: Current state -', authState);
  return authState;
};

// ===================================================

// Option 2: Alternative - Update Layout.tsx to use the AuthContext instead

// In Layout.tsx, replace the useAuth import:
