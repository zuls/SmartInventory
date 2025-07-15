// src/hooks/useAuth.ts - Fixed to prevent continuous logging
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
  }, []); // Remove the dependency array items that were causing re-renders

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

  // Only log the state once when it changes, not on every render
  const authState = {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
  };

  // Remove the continuous logging
  // console.log('useAuth: Current state -', authState);
  
  return authState;
};