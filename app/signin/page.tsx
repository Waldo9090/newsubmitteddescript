'use client';

import { useRouter } from "next/navigation";
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from "@/context/auth-context";

// Google icon component
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function SignIn() {
  const router = useRouter();
  const { user, loading, error: authError, signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Set mounted state to true when component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to dashboard if user is already signed in
  useEffect(() => {
    if (mounted && user) {
      console.log('User already signed in, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [user, router, mounted]);

  // Update error state when auth error changes
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSignIn = async () => {
    try {
      console.log("Sign in button clicked");
      setIsSigningIn(true);
      setError(null);
      setDebugInfo("Initializing sign-in process...");
      
      setDebugInfo("Opening Google sign-in popup...");
      console.log("Opening Google sign-in popup");
      
      await signInWithGoogle();
      
      setDebugInfo("Sign-in successful, redirecting...");
    } catch (error: any) {
      console.error("Google sign in error:", error);
      
      setDebugInfo(`Error: ${error.message}`);
      
      if (error.code === "auth/cancelled-popup-request") {
        console.warn("Popup sign in cancelled by user.");
        setError("Sign-in was cancelled. Please try again.");
      } else if (error.code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else if (error.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed. Please try again.");
      } else {
        setError(error.message || "Failed to sign in with Google");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // Prevent hydration errors by not rendering until mounted
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md p-8 bg-card rounded-lg shadow-sm border border-border">
          <h1 className="text-2xl font-bold mb-8 text-foreground">Sign In</h1>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md p-8 bg-card rounded-lg shadow-sm border border-border">
        <h1 className="text-2xl font-bold mb-8 text-foreground">Sign In</h1>
        
        {user ? (
          <div className="text-green-500 p-3 bg-green-50 rounded-md mb-4">
            Already signed in as {user.displayName} ({user.email})
          </div>
        ) : (
          <Button
            onClick={handleSignIn}
            className="flex items-center gap-2 px-6 py-5 w-full justify-center"
            disabled={isSigningIn || loading}
          >
            {isSigningIn ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Sign in with Google</span>
              </>
            )}
          </Button>
        )}
        
        {error && (
          <div className="mt-4 text-red-500 p-3 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        
        {debugInfo && (
          <div className="mt-4 text-xs text-blue-500 p-2 bg-blue-50 rounded-md text-left">
            <p className="font-bold">Debug Info:</p>
            <p>{debugInfo}</p>
          </div>
        )}
        
        <div className="mt-6 text-sm text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Make sure popups are allowed for this site.</p>
          <p>If you're having trouble, try disabling popup blockers.</p>
        </div>
        
        <div className="mt-4 text-xs">
          <a href="/test-firebase.html" className="text-blue-500 hover:underline">
            Try the standalone test page
          </a>
        </div>
      </div>
    </div>
  );
} 