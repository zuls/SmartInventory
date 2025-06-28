// src/hooks/useAuth.ts
import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../stores/authStore';

export const useAuth = () => {
  const { user, loading, setUser, setLoading, setError } = useAuthStore();

  useEffect(() => {
    console.log('useAuth: Setting up auth listener');
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('useAuth: Auth state changed -', firebaseUser ? `Logged in: ${firebaseUser.email}` : 'Logged out');
      
      setUser(firebaseUser);
      setLoading(false); // Always set loading to false after auth check
      
      if (firebaseUser) {
        console.log('useAuth: User authenticated, stopping loading');
      }
    });

    return () => {
      console.log('useAuth: Cleaning up auth listener');
      unsubscribe();
    };
  }, []); // Remove dependencies to prevent loops

  const authState = {
    user,
    loading,
    isAuthenticated: !!user,
  };

  console.log('useAuth: Current state -', authState);
  return authState;
};