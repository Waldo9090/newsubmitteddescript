import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import Image from "next/image";

interface HubSpotConfig {
  contacts: boolean;
  deals: boolean;
  includeMeetingNotes: boolean;
  includeActionItems: boolean;
}

interface HubSpotIntegration {
  accessToken: string;
  refreshToken: string;
  accountType: string;
  portalId: string;
  timezone: string;
  expiresAt: string;
  config: HubSpotConfig;
  updatedAt: string;
}

export default function HubSpotConnection() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [integration, setIntegration] = useState<HubSpotIntegration | null>(null);

  useEffect(() => {
    checkConnection();
  }, [user?.email]);

  const checkConnection = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const hubspotData = userDoc.data()?.hubspotIntegration;

      if (hubspotData?.accessToken && hubspotData?.portalId) {
        setIsConnected(true);
        setIntegration(hubspotData);
      } else {
        setIsConnected(false);
        setIntegration(null);
      }
    } catch (error) {
      console.error('Error checking HubSpot connection:', error);
      toast.error('Failed to check HubSpot connection status');
      setIsConnected(false);
      setIntegration(null);
    }
  };

  const handleConnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect HubSpot');
      return;
    }

    try {
      setIsConnecting(true);
      const response = await fetch('/api/hubspot/auth', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to HubSpot:', error);
      toast.error('Failed to connect to HubSpot');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to disconnect HubSpot');
      return;
    }

    try {
      setIsDisconnecting(true);
      const db = getFirebaseDb();
      
      await setDoc(doc(db, 'users', user.email), {
        hubspotIntegration: null
      }, { merge: true });

      setIsConnected(false);
      setIntegration(null);
      toast.success('Successfully disconnected from HubSpot');
    } catch (error) {
      console.error('Error disconnecting from HubSpot:', error);
      toast.error('Failed to disconnect from HubSpot');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 rounded-lg bg-[#ff7a59] flex items-center justify-center">
            <Image
              src="/icons/integrations/hubspot.svg"
              alt="HubSpot"
              width={24}
              height={24}
              className="rounded-sm"
            />
          </div>
          <div>
            <h4 className="text-sm font-medium">HubSpot</h4>
            <p className="text-sm text-muted-foreground">
              {isConnected && integration ? `Connected to portal ${integration.portalId}` : 'Not connected'}
            </p>
          </div>
        </div>
        <Button
          onClick={isConnected ? handleDisconnect : handleConnect}
          variant={isConnected ? "outline" : "default"}
          disabled={isConnecting || isDisconnecting}
          className="rounded-full"
        >
          {isDisconnecting ? "Disconnecting..." : isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>

      {!isConnected && (
        <div className="text-sm text-muted-foreground">
          Connect your HubSpot account to log meetings and action items.
        </div>
      )}
    </div>
  );
} 