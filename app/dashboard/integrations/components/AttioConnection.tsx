"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AttioWorkspace {
  id: string;
  name: string;
  logo?: string | null;
}

interface AttioConnectionProps {
  onSave?: (config: any) => Promise<void>;
  onClose?: () => void;
  onCancel?: () => void;
  forceStatus?: "loading" | "connected" | "disconnected";
  savedConfig?: any;
}

export default function AttioConnection({ 
  onSave, 
  onClose,
  onCancel,
  forceStatus,
  savedConfig 
}: AttioConnectionProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [workspace, setWorkspace] = useState<AttioWorkspace | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  useEffect(() => {
    if (forceStatus) {
      handleForceStatus();
    } else {
      checkConnectionStatus();
    }
  }, [forceStatus, user?.email]);

  const handleForceStatus = () => {
    if (forceStatus === "connected") {
      setIsConnected(true);
      setIsLoading(false);
      if (savedConfig?.workspace) {
        setWorkspace({
          id: savedConfig.workspace.id || "",
          name: savedConfig.workspace.name || "",
          logo: savedConfig.workspace.logo || null
        });
      }
    } else if (forceStatus === "disconnected") {
      setIsConnected(false);
      setIsLoading(false);
    } else if (forceStatus === "loading") {
      setIsLoading(true);
    }
  }

  // Check if we're already connected to Attio
  const checkConnectionStatus = async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

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
    } finally {
      setIsLoading(false);
    }
  };

  // Initiate OAuth flow
  const handleConnect = async () => {
    if (!user?.email) {
      setError('You must be logged in to connect with Attio');
      toast.error('You must be logged in to connect with Attio');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
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
      toast.error('Failed to connect with Attio');
      setIsConnecting(false);
    }
  };

  // Handle disconnect confirmation dialog
  const openDisconnectConfirmation = () => {
    setIsConfirmDialogOpen(true);
  };

  // Disconnect from Attio
  const handleDisconnect = async () => {
    if (!user?.email) return;

    setIsLoading(true);
    setError(null);
    setIsConfirmDialogOpen(false);

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

      setIsConnected(false);
      setWorkspace(null);
      toast.success('Successfully disconnected from Attio');
    } catch (err) {
      console.error('Error disconnecting from Attio:', err);
      setError('Failed to disconnect from Attio');
      toast.error('Failed to disconnect from Attio');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for OAuth callback with success or error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const provider = params.get('provider');
    
    if (success === 'true' && provider === 'attio') {
      toast.success('Successfully connected to Attio');
      // Remove the query parameters from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.toString());
      
      // Force refresh connection status
      checkConnectionStatus();
    } else if (error && provider === 'attio') {
      toast.error(`Failed to connect to Attio: ${decodeURIComponent(error)}`);
      
      // Remove the query parameters from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 bg-card p-6 rounded-lg border border-border flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <Image 
                src="/icons/integrations/attio.svg" 
                alt="Attio Logo" 
                width={24} 
                height={24} 
              />
            </div>
            <div>
              <h4 className="text-sm font-medium">Attio</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected && workspace 
                  ? `Connected to ${workspace.name}` 
                  : 'Not connected'}
              </p>
            </div>
          </div>

          {isConnected ? (
            <Button
              variant="outline"
              onClick={openDisconnectConfirmation}
              disabled={isLoading}
              className="rounded-full"
            >
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="rounded-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected && workspace && workspace.logo && (
          <div className="hidden">
            <p className="text-sm font-medium">Connected Workspace</p>
            <div className="flex items-center mt-2">
              <Image
                src={workspace.logo}
                alt={workspace.name}
                width={24}
                height={24}
                className="rounded-sm mr-2"
              />
              <p className="text-sm text-muted-foreground">{workspace.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect from Attio</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect from Attio? This will remove access to your Attio workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setIsConfirmDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDisconnect}
              variant="destructive"
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 