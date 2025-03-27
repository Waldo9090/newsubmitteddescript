import { useState, useEffect } from "react";
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

interface SalesforceConfig {
  contacts: boolean;
  opportunities: boolean;
  includeMeetingNotes: boolean;
  includeActionItems: boolean;
}

export default function SalesforceConnection() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [config, setConfig] = useState<SalesforceConfig>({
    contacts: true,
    opportunities: false,
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
      const salesforceData = userDoc.data()?.salesforceIntegration;

      if (salesforceData?.accessToken) {
        setIsConnected(true);
        setConfig(salesforceData.config || config);
      }
    } catch (error) {
      console.error('Error checking Salesforce connection:', error);
      toast.error('Failed to check Salesforce connection status');
    }
  };

  const handleConnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Salesforce');
      return;
    }

    try {
      setIsConnecting(true);
      const response = await fetch('/api/salesforce/auth', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Salesforce auth response error:', errorText);
        throw new Error('Failed to get authorization URL');
      }

      const data = await response.json();
      console.log('Salesforce auth response:', data);

      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Salesforce:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Salesforce');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      
      await setDoc(doc(db, 'users', user.email), {
        salesforceIntegration: null
      }, { merge: true });
      
      setIsConnected(false);
      toast.success('Successfully disconnected from Salesforce');
    } catch (error) {
      console.error('Error disconnecting from Salesforce:', error);
      toast.error('Failed to disconnect from Salesforce');
    }
  };

  const handleSaveConfig = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        salesforceIntegration: {
          config,
          updatedAt: new Date().toISOString()
        }
      }, { merge: true });

      toast.success('Salesforce settings updated');
      setShowConfigDialog(false);
    } catch (error) {
      console.error('Error saving Salesforce config:', error);
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="space-y-6 bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-8 w-8 rounded-lg bg-[#00A1E0] flex items-center justify-center">
            <Image
              src="/icons/integrations/salesforce.svg"
              alt="Salesforce"
              width={24}
              height={24}
              className="text-white"
            />
          </div>
          <div>
            <h4 className="text-sm font-medium">Salesforce</h4>
            <p className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
        {isConnected ? (
          <div className="flex space-x-2">
            <Button
              onClick={() => setShowConfigDialog(true)}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              Configure
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            variant="default"
            disabled={isConnecting}
            className="rounded-full"
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        )}
      </div>

      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Salesforce</DialogTitle>
            <DialogDescription>
              Choose what you would like to have updated in Salesforce.
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
                        Update matching contacts with a new note.
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
                      <Label>Opportunities</Label>
                      <p className="text-sm text-muted-foreground">
                        Update opportunities with matching contacts with a new note.
                      </p>
                    </div>
                    <Switch
                      checked={config.opportunities}
                      onCheckedChange={(checked) => 
                        setConfig(prev => ({ ...prev, opportunities: checked }))}
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
    </div>
  );
} 