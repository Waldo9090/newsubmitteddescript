import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Image from "next/image";

interface HubSpotConfig {
  contacts: boolean;
  deals: boolean;
  includeMeetingNotes: boolean;
  includeActionItems: boolean;
}

export default function HubSpotConnection() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [config, setConfig] = useState<HubSpotConfig>({
    contacts: true,
    deals: false,
    includeMeetingNotes: true,
    includeActionItems: true
  });

  useEffect(() => {
    checkConnection();
  }, [user?.email]);

  const checkConnection = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const hubspotData = userDoc.data()?.hubspotIntegration;

      if (hubspotData?.accessToken) {
        setIsConnected(true);
        setConfig(hubspotData.config || config);
      }
    } catch (error) {
      console.error('Error checking HubSpot connection:', error);
      toast.error('Failed to check HubSpot connection status');
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
        console.error('HubSpot auth response error:', errorText);
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      console.log('HubSpot auth response:', data);

      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.url) {
        const authUrl = new URL(data.url);
        authUrl.searchParams.append('state', user.email);
        window.location.href = authUrl.toString();
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to HubSpot:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect to HubSpot');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        hubspotIntegration: {
          config,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      toast.success('HubSpot settings updated');
      setShowConfigDialog(false);
    } catch (error) {
      console.error('Error saving HubSpot config:', error);
      toast.error('Failed to save settings');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect HubSpot</CardTitle>
        <CardDescription>
          Sync meetings and action items with your HubSpot workspace
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-lg bg-[#ff7a59] flex items-center justify-center">
              <Image
                src="/icons/integrations/hubspot.svg"
                alt="HubSpot"
                width={24}
                height={24}
                className="text-white"
              />
            </div>
            <div>
              <h4 className="text-sm font-medium">HubSpot</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          <Button
            onClick={isConnected ? () => setShowConfigDialog(true) : handleConnect}
            variant={isConnected ? "outline" : "default"}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : isConnected ? "Configure" : "Connect"}
          </Button>
        </div>
      </CardContent>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update HubSpot</DialogTitle>
            <DialogDescription>
              Choose what you would like to have updated in HubSpot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-base">What to update</Label>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Contacts</Label>
                      <p className="text-sm text-muted-foreground">
                        Log a meeting for matching contacts.
                      </p>
                    </div>
                    <Switch
                      checked={config.contacts}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, contacts: checked }))}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Deals</Label>
                      <p className="text-sm text-muted-foreground">
                        Log a meeting for deals with matching contacts.
                      </p>
                    </div>
                    <Switch
                      checked={config.deals}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, deals: checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base">What to include</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Meeting notes</Label>
                  <Switch
                    checked={config.includeMeetingNotes}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, includeMeetingNotes: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Action items</Label>
                  <Switch
                    checked={config.includeActionItems}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, includeActionItems: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 