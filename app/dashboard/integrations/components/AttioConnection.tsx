"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import Image from "next/image";

interface AttioWorkspace {
  id: string;
  name: string;
  icon?: string;
}

interface AttioConnectionProps {
  onSave?: (config: any) => Promise<void>;
  onClose?: () => void;
  forceStatus?: "loading" | "connected" | "disconnected";
}

export default function AttioConnection({ 
  onSave,
  onClose,
  forceStatus
}: AttioConnectionProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [workspaces, setWorkspaces] = useState<AttioWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<AttioWorkspace | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (!user?.email) {
      console.log('No user email found, skipping connection check');
      return;
    }
    
    try {
      console.log('Checking Attio connection status for user:', user.email);
      const response = await fetch('/api/attio/status', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      const data = await response.json();
      console.log('Attio status response:', data);
      
      if (data.connected) {
        console.log('Attio is connected, updating state');
        setIsConnected(true);
        setWorkspaces(data.workspaces || []);
        setSelectedWorkspace(data.selectedWorkspace || null);
      } else {
        console.log('Attio is not connected');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking Attio connection:', error);
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Attio connection process');
      
      const response = await fetch('/api/attio/auth', {
        headers: {
          'Authorization': `Bearer ${user?.email}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to get auth URL:', error);
        throw new Error(error.message || 'Failed to get auth URL');
      }
      
      const { url } = await response.json();
      console.log('Received Attio auth URL:', url);
      
      // Store the current URL to return to after authorization
      localStorage.setItem('attioReturnUrl', window.location.href);
      
      // Redirect to Attio
      console.log('Redirecting to Attio...');
      window.location.href = url;
    } catch (error) {
      console.error('Error connecting to Attio:', error);
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/attio/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (response.ok) {
        setIsConnected(false);
        setWorkspaces([]);
        setSelectedWorkspace(null);
      }
    } catch (error) {
      console.error('Error disconnecting from Attio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorkspaceSelect = async (workspace: AttioWorkspace) => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/attio/workspaces/select', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.email}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workspaceId: workspace.id })
      });
      
      if (response.ok) {
        setSelectedWorkspace(workspace);
        if (onSave) {
          await onSave({
            workspaceId: workspace.id,
            workspaceName: workspace.name
          });
        }
      }
    } catch (error) {
      console.error('Error selecting workspace:', error);
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
            <p className="text-sm text-muted-foreground">Sync your meeting contacts with Attio CRM</p>
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

      {isConnected && (
        <div className="space-y-6">
          {!selectedWorkspace ? (
            <div>
              <h4 className="font-medium mb-4">Select a workspace</h4>
              <div className="grid gap-4">
                {workspaces.map((workspace) => (
                  <Button
                    key={workspace.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleWorkspaceSelect(workspace)}
                    disabled={isLoading}
                  >
                    {workspace.icon && (
                      <Image
                        src={workspace.icon}
                        alt={workspace.name}
                        width={24}
                        height={24}
                        className="mr-2"
                      />
                    )}
                    {workspace.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Connected to {selectedWorkspace.name}
            </div>
          )}
        </div>
      )}
    </Card>
  );
} 