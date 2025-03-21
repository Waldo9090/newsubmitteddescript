'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Get Firebase auth and Google provider
  const auth = getFirebaseAuth();
  const googleProvider = getGoogleProvider();

  // Handle redirect result on mount
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        setLoading(true);
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setUser(result.user);
          router.push('/dashboard');
        }
      } catch (error: any) {
        console.error('Redirect sign-in error:', error);
        setError('Failed to complete sign-in. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Only run if we're not already authenticated
    if (!user) {
      handleRedirectResult();
    }
  }, [user, router, auth]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      setUser(user);
      setLoading(false);
      setError(null);

      // Redirect to login if not authenticated and on a protected route
      if (!user && typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
        router.push('/login');
      }
    }, (error: any) => {
      console.error('Auth state change error:', error);
      setError('Authentication error occurred. Please try again.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, auth]);

  const handleSignInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Configure the sign-in with minimal parameters
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Try popup first
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          setUser(result.user);
          router.push('/dashboard');
        }
      } catch (popupError: any) {
        console.error('Popup sign-in error:', popupError);
        
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.code === 'auth/cancelled-popup-request') {
          console.log('Popup blocked or closed, falling back to redirect...');
          
          // For redirect, ensure we're using the correct configuration
          googleProvider.setCustomParameters({
            prompt: 'select_account'
          });
          
          await signInWithRedirect(auth, googleProvider);
          // The redirect result will be handled by the useEffect above
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error('Sign-in error:', error);
      setError('Failed to sign in. Please try again.');
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Sign out from Firebase first
      await auth.signOut();
      setUser(null);
      
      // Clear any cached credentials
      if (typeof window !== 'undefined') {
        // Clear local storage and session storage
        window.localStorage.clear();
        window.sessionStorage.clear();
        
        // Clear cookies related to authentication
        document.cookie.split(';').forEach(cookie => {
          document.cookie = cookie
            .replace(/^ +/, '')
            .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
        });

        // Force a full page reload to the home page
        window.location.href = '/';
      }
    } catch (error: any) {
      console.error('Sign-out error:', error);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
