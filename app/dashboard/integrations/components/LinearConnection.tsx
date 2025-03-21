import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { integrationIcons } from "@/app/lib/integration-icons";

interface LinearWorkspace {
  organizationId: string;
  organizationName: string;
  issuesEnabled?: boolean;
}

export default function LinearConnection() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [workspace, setWorkspace] = useState<LinearWorkspace | null>(null);

  useEffect(() => {
    checkConnection();
  }, [user?.email]);

  const checkConnection = async () => {
    if (!user?.email) return;

    try {
      setIsLoading(true);
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const linearIntegration = userDoc.data()?.linearIntegration;

      if (linearIntegration?.accessToken) {
        setIsConnected(true);
        setWorkspace({
          organizationId: linearIntegration.organizationId,
          organizationName: linearIntegration.organizationName,
          issuesEnabled: linearIntegration.issuesEnabled
        });
      }
    } catch (error) {
      console.error('Error checking Linear connection:', error);
      toast.error('Failed to check Linear connection status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Linear');
      return;
    }

    try {
      setIsConnecting(true);
      const response = await fetch('/api/linear/auth', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Linear:', error);
      toast.error('Failed to connect to Linear');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        linearIntegration: null
      }, { merge: true });
      
      setIsConnected(false);
      setWorkspace(null);
      toast.success('Successfully disconnected from Linear');
    } catch (error) {
      console.error('Error disconnecting from Linear:', error);
      toast.error('Failed to disconnect from Linear');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Linear</CardTitle>
        <CardDescription>
          Connect your Linear workspace to create issues from meeting action items
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
              {integrationIcons.linear.icon}
            </div>
            <div>
              <h4 className="text-sm font-medium">Linear</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected ? `Connected to ${workspace?.organizationName}` : "Not connected"}
              </p>
            </div>
          </div>
          <Button
            onClick={isConnected ? handleDisconnect : handleConnect}
            variant={isConnected ? "outline" : "default"}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 