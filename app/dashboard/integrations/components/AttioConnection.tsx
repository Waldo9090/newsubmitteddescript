"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AttioWorkspace {
  id: string;
  name: string;
  icon?: string;
}

interface AttioConnectionProps {
  onSave?: (config: any) => Promise<void>;
  onClose?: () => void;
}

export default function AttioConnection({ onSave, onClose }: AttioConnectionProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [workspace, setWorkspace] = useState<AttioWorkspace | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  // Check if we're already connected to Attio
  const checkConnectionStatus = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/attio/status', {
        headers: {
          'Authorization': `Bearer ${user.email}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.connected) {
        setIsConnected(true);
        setWorkspace(data.workspace || null);
      } else {
        setIsConnected(false);
        setWorkspace(null);
      }
    } catch (err) {
      console.error('Error checking Attio connection:', err);
      setError('Failed to check connection status');
    }
  };

  // Initiate OAuth flow
  const handleConnect = async () => {
    if (!user?.email) {
      setError('You must be logged in to connect with Attio');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Clear any existing tokens
      document.cookie = "attio_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "attio_workspace=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

      const response = await fetch('/api/attio/auth', {
        headers: {
          'Authorization': `Bearer ${user.email}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to initialize Attio connection');
      }

      const { url } = await response.json();
      
      // Store return URL for after OAuth
      localStorage.setItem('attioReturnUrl', window.location.href);
      
      // Redirect to Attio OAuth page
      window.location.href = url;
    } catch (err) {
      console.error('Error connecting to Attio:', err);
      setError('Failed to connect with Attio');
      setIsLoading(false);
    }
  };

  // Disconnect from Attio
  const handleDisconnect = async () => {
    if (!user?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/attio/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.email}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect from Attio');
      }

      // Clear cookies and local storage
      document.cookie = "attio_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "attio_workspace=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      localStorage.removeItem('attioReturnUrl');

      setIsConnected(false);
      setWorkspace(null);
    } catch (err) {
      console.error('Error disconnecting from Attio:', err);
      setError('Failed to disconnect from Attio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <Image 
              src="/icons/integrations/Attio.svg" 
              alt="Attio Logo" 
              width={28} 
              height={28} 
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Attio</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Attio workspace to sync contacts and manage relationships
            </p>
          </div>
        </div>

        {isConnected ? (
          <Button
            variant="destructive"
            onClick={handleDisconnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect with Attio'
            )}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isConnected && workspace && (
        <div className="mt-4 p-4 bg-secondary rounded-lg">
          <p className="text-sm font-medium">Connected Workspace</p>
          <p className="text-sm text-muted-foreground">{workspace.name}</p>
        </div>
      )}
    </Card>
  );
} 