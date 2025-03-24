"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FigmaIcon as NotionLogo } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { integrationIcons } from "@/app/lib/integration-icons";

interface NotionPage {
  id: string;
  title: string;
  icon?: string;
  type: 'page' | 'database';
}

interface NotionWorkspace {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string;
  selectedPageId?: string;
  selectedPageTitle?: string;
  exportNotes?: boolean;
  exportActionItems?: boolean;
  accessToken?: string;
  botId?: string;
  templateId?: string;
}

interface NotionConnectionProps {
  isAutomationForm?: boolean;
  onSave?: (config: any) => Promise<void>;
  onClose?: () => void;
  forceStatus?: "loading" | "connected" | "disconnected";
}

export default function NotionConnection({ 
  isAutomationForm = false,
  onSave,
  onClose,
  forceStatus
}: NotionConnectionProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [workspace, setWorkspace] = useState<NotionWorkspace | null>(null);
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [isPageSelectorOpen, setIsPageSelectorOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string>("");
  const [exportOptions, setExportOptions] = useState({
    notes: true,
    actionItems: true
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Handle search params for OAuth callback
    const url = new URL(window.location.href);
    const success = url.searchParams.get('success');
    const error = url.searchParams.get('error');
    const errorMsg = url.searchParams.get('msg');
    
    if (success === 'notion_connected') {
      toast.success('Successfully connected to Notion');
      
      // Force a full refresh of the connection status
      setTimeout(() => {
        console.log('Force refreshing Notion connection status after successful connection');
        checkConnection();
      }, 500);
    } else if (error) {
      console.error(`Notion connection error: ${error}${errorMsg ? ` - ${errorMsg}` : ''}`);
      let errorMessage = 'Failed to connect to Notion';
      
      switch (error) {
        case 'notion_auth_failed':
          errorMessage = 'Notion authentication failed';
          break;
        case 'missing_params':
          errorMessage = 'Missing authentication parameters';
          break;
        case 'token_exchange_failed':
          errorMessage = 'Failed to exchange authorization code';
          break;
        case 'firestore_save_failed':
          errorMessage = 'Failed to save Notion connection data';
          break;
        default:
          errorMessage = `Connection error: ${errorMsg || error}`;
      }
      
      toast.error(errorMessage);
    }
  }, []);

  useEffect(() => {
    console.log('NotionConnection component rendered with forceStatus:', forceStatus);
    
    if (forceStatus) {
      console.log('Using forced status:', forceStatus);
      if (forceStatus === "connected") {
        setIsConnected(true);
        if (!workspace) {
          console.log('Force status is connected but no workspace data, checking connection');
          checkConnection();
        }
      } else if (forceStatus === "disconnected") {
        console.log('Force status is disconnected, resetting connection state');
        setIsConnected(false);
        setWorkspace(null);
        setPages([]);
        setIsLoading(false);
      } else if (forceStatus === "loading") {
        console.log('Force status is loading');
        setIsLoading(true);
      }
    } else {
      console.log('No forced status, checking connection normally');
      checkConnection();
    }
  }, [forceStatus, user?.email]);

  const checkConnection = async () => {
    if (!user?.email) {
      console.log('No user email found, cannot check connection');
      setIsLoading(false);
      setIsConnected(false);
      return;
    }

    try {
      console.log('Checking Notion connection for user:', user.email);
      setIsLoading(true);
      
      // First try the debug endpoint
      try {
        console.log('Trying debug endpoint first');
        const debugResponse = await fetch(`/api/debug/notion-status?email=${encodeURIComponent(user.email)}`);
        const debugData = await debugResponse.json();
        
        console.log('Debug data:', debugData);
        
        if (debugData.hasNotionIntegration && debugData.notionIntegrationKeys?.includes('accessToken')) {
          console.log('Debug endpoint confirmed Notion is connected');
          const notionIntegration = debugData.fullUserDocument.notionIntegration;
          setIsConnected(true);
          setWorkspace({
            workspaceId: notionIntegration.workspaceId,
            workspaceName: notionIntegration.workspaceName,
            workspaceIcon: notionIntegration.workspaceIcon,
            selectedPageId: notionIntegration.selectedPageId,
            selectedPageTitle: notionIntegration.selectedPageTitle,
            exportNotes: notionIntegration.exportNotes,
            exportActionItems: notionIntegration.exportActionItems,
            accessToken: notionIntegration.accessToken,
            botId: notionIntegration.botId,
            templateId: notionIntegration.templateId
          });
          await fetchPages();
          setIsLoading(false);
          return;
        } else {
          console.log('Debug endpoint showed Notion is not connected');
        }
      } catch (debugError) {
        console.error('Error using debug endpoint:', debugError);
      }
      
      // Even create a test user document if needed for debugging
      try {
        console.log('Creating test user document as a diagnostic step');
        const testResponse = await fetch(`/api/debug/test-user?email=${encodeURIComponent(user.email)}`);
        const testData = await testResponse.json();
        console.log('Test user document response:', testData);
      } catch (testError) {
        console.error('Error creating test user document:', testError);
      }
      
      // Fall back to direct Firestore access
      const db = getFirebaseDb();
      console.log('Getting user document from Firestore');
      const userDoc = await getDoc(doc(db, 'users', user.email));
      const userData = userDoc.data();
      console.log('User data from Firestore:', userData ? 'exists' : 'does not exist');
      
      if (userData) {
        const notionIntegration = userData.notionIntegration;
        console.log('Notion integration data:', notionIntegration ? 'exists' : 'does not exist');
        
        if (notionIntegration?.accessToken) {
          console.log('Notion access token found, setting connected state');
          setIsConnected(true);
          setWorkspace({
            workspaceId: notionIntegration.workspaceId || '',
            workspaceName: notionIntegration.workspaceName || '',
            workspaceIcon: notionIntegration.workspaceIcon || null,
            selectedPageId: notionIntegration.selectedPageId || '',
            selectedPageTitle: notionIntegration.selectedPageTitle || '',
            exportNotes: notionIntegration.exportNotes || true,
            exportActionItems: notionIntegration.exportActionItems || true,
            accessToken: notionIntegration.accessToken,
            botId: notionIntegration.botId || '',
            templateId: notionIntegration.templateId || ''
          });
          await fetchPages();
        } else {
          console.log('No Notion access token found, setting disconnected state');
          setIsConnected(false);
          setWorkspace(null);
        }
      } else {
        console.log('No user data found, setting disconnected state');
        setIsConnected(false);
        setWorkspace(null);
      }
    } catch (error) {
      console.error('Error checking Notion connection:', error);
      setIsConnected(false);
      setWorkspace(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPages = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch('/api/notion/pages', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      const data = await response.json();

      if (data.pages) {
        setPages(data.pages);
      }
    } catch (error) {
      console.error('Error fetching Notion pages:', error);
      toast.error('Failed to fetch Notion pages');
    }
  };

  const handleConnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Notion');
      return;
    }

    try {
      console.log('Initiating Notion connection for user:', user.email);
      setIsConnecting(true);
      
      const response = await fetch('/api/notion/auth', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get authorization URL');
      }

      const data = await response.json();
      console.log('Received auth response:', { hasUrl: !!data.url });
      
      if (data.url) {
        // The user email should be included as state in the URL
        // from the auth endpoint, but let's check and add it if not
        const authUrl = new URL(data.url);
        if (!authUrl.searchParams.has('state')) {
          console.log('Adding state parameter with user email');
          authUrl.searchParams.append('state', user.email);
        }
        
        // Log the final URL we're redirecting to
        console.log('Redirecting to Notion OAuth URL');
        window.location.href = authUrl.toString();
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error connecting to Notion:', error);
      setIsConnecting(false);
      toast.error(error instanceof Error ? error.message : "Failed to connect to Notion");
    }
  };

  const handleDisconnect = async () => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        notionIntegration: null
      }, { merge: true });
      
      setIsConnected(false);
      setWorkspace(null);
      setPages([]);
      toast.success('Successfully disconnected from Notion');
    } catch (error) {
      console.error('Error disconnecting from Notion:', error);
      toast.error('Failed to disconnect from Notion');
    }
  };

  const handleSave = async () => {
    if (!user?.email || !workspace || !selectedPage) {
      toast.error('Please select a page first');
      return;
    }

    try {
      const selectedPageData = pages.find(page => page.id === selectedPage);
      if (!selectedPageData) {
        throw new Error('Selected page not found');
      }

      const notionConfig = {
        pageId: selectedPage,
        pageTitle: selectedPageData.title,
        workspaceIcon: workspace.workspaceIcon || "",
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.workspaceName,
        exportNotes: exportOptions.notes,
        exportActionItems: exportOptions.actionItems,
        accessToken: workspace.accessToken,
        botId: workspace.botId,
        templateId: workspace.templateId
      };

      if (isAutomationForm && onSave) {
        // Save to automation configuration
        await onSave(notionConfig);
        toast.success('Successfully added Notion step');
      } else {
        // Save to integratedAutomations collection
        const db = getFirebaseDb();
        const automationRef = doc(db, 'integratedautomations', user.email);
        const automationsCollection = collection(automationRef, 'automations');
        const notionAutomationRef = doc(automationsCollection, 'notion-integration');
        
        await setDoc(notionAutomationRef, {
          id: 'notion',
          type: 'notion',
          ...notionConfig,
          updatedAt: new Date().toISOString()
        });

        // Also update user's Notion integration settings
        await setDoc(doc(db, 'users', user.email), {
          notionIntegration: {
            ...workspace,
            selectedPageId: selectedPage,
            selectedPageTitle: selectedPageData.title,
            exportNotes: exportOptions.notes,
            exportActionItems: exportOptions.actionItems,
            updatedAt: new Date().toISOString()
          }
        }, { merge: true });

        toast.success('Successfully saved Notion preferences');
      }

      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving Notion configuration:', error);
      toast.error('Failed to save Notion configuration');
    }
  };

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="h-9 w-24 bg-muted rounded animate-pulse" />
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                {integrationIcons.notion.icon}
              </div>
              <div>
                <h4 className="text-sm font-medium">Notion</h4>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? `Connected to ${workspace?.workspaceName}` : "Not connected"}
                </p>
              </div>
            </div>
            <Button
              onClick={isConnected ? handleDisconnect : handleConnect}
              variant={isConnected ? "outline" : "default"}
              disabled={isConnecting}
              className="rounded-full"
            >
              {isConnecting ? "Connecting..." : isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>

          {!isConnected && (
            <div className="text-sm text-muted-foreground">
              Connect your Notion workspace to automatically export meeting notes and action items.
            </div>
          )}

          {/* Keep the hidden form elements for maintaining functionality */}
          {isConnected && (
            <div className="hidden">
              <Select
                value={selectedPage}
                onValueChange={setSelectedPage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a page..." />
                </SelectTrigger>
                <SelectContent>
                  {pages.map(page => (
                    <SelectItem key={page.id} value={page.id}>
                      {page.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Switch
                checked={exportOptions.notes}
                onCheckedChange={(checked) =>
                  setExportOptions(prev => ({ ...prev, notes: checked }))
                }
              />
              <Switch
                checked={exportOptions.actionItems}
                onCheckedChange={(checked) =>
                  setExportOptions(prev => ({ ...prev, actionItems: checked }))
                }
              />
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button onClick={handleSave}>
                Save
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 