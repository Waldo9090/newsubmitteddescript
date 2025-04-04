"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MondayBoard {
  id: string;
  name: string;
}

interface MondayGroup {
  id: string;
  title: string;
}

interface MondayConnectionProps {
  onSave?: (config: any) => Promise<void>;
  onClose?: () => void;
  onCancel?: () => void;
  forceStatus?: "loading" | "connected" | "disconnected";
  savedConfig?: any;
}

// Direct links for installation and authorization - we'll get these from the API
// const MONDAY_INSTALL_URL = "https://auth.monday.com/oauth2/authorize?client_id=9ae3e86e3d7b4b28d319ad66477fdb23&response_type=install&redirect_uri=https://www.aisummarizer-descript.com/api/monday/callback";
// const MONDAY_AUTH_URL = "https://auth.monday.com/oauth2/authorize?client_id=9ae3e86e3d7b4b28d319ad66477fdb23&redirect_uri=https://www.aisummarizer-descript.com/api/monday/callback";

export default function MondayConnection({ 
  onSave,
  onClose,
  onCancel,
  forceStatus,
  savedConfig
}: MondayConnectionProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [boards, setBoards] = useState<MondayBoard[]>([]);
  const [groups, setGroups] = useState<MondayGroup[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [selectedBoardName, setSelectedBoardName] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"install" | "connect">("install");
  const [redirectUrl, setRedirectUrl] = useState("");

  // State for URLs
  const [installUrl, setInstallUrl] = useState("");
  const [authUrl, setAuthUrl] = useState("");

  // Check connection status on component mount
  useEffect(() => {
    if (forceStatus) {
      handleForceStatus();
    } else {
      checkConnection();
    }
  }, [forceStatus, user?.email]);

  // Check if we have saved configuration
  useEffect(() => {
    if (savedConfig && savedConfig.board) {
      setSelectedBoard(savedConfig.board);
      setSelectedBoardName(savedConfig.boardName || '');
      if (savedConfig.group) {
        setSelectedGroup(savedConfig.group);
        setSelectedGroupName(savedConfig.groupName || '');
      }
      // Load boards and groups based on saved config
      fetchBoards().then(() => {
        if (savedConfig.board) {
          fetchGroups(savedConfig.board);
        }
      });
    }
  }, [savedConfig]);

  const handleForceStatus = () => {
    if (forceStatus === "connected") {
      setIsConnected(true);
      setIsLoading(false);
    } else if (forceStatus === "disconnected") {
      setIsConnected(false);
      setIsLoading(false);
    } else if (forceStatus === "loading") {
      setIsLoading(true);
    }
  }

  const checkConnection = async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log('Checking Monday.com connection for user:', user.email);
      
      // Check if the user has a Monday.com integration in the user document
      const userDoc = await getDoc(doc(db, 'users', user.email));
      
      if (userDoc.exists()) {
        console.log('User document found, checking for Monday integration');
        const userData = userDoc.data();
        
        if (userData.mondayIntegration && 
            userData.mondayIntegration.connected && 
            userData.mondayIntegration.accessToken) {
          
          // Log partial token for debugging
          const tokenPreview = userData.mondayIntegration.accessToken.substring(0, 8) + '...';
          console.log('Monday integration found with access token:', tokenPreview);
          
          // Validate all required fields are present
          const hasRequiredFields = 
            userData.mondayIntegration.accountId && 
            userData.mondayIntegration.userId;
            
          if (!hasRequiredFields) {
            console.warn('Monday integration missing required fields');
            setIsConnected(false);
            return;
          }
          
          setIsConnected(true);
          
          // Log connection details
          console.log('Monday.com connection details:', {
            connected: userData.mondayIntegration.connected,
            accountName: userData.mondayIntegration.accountName,
            accountId: userData.mondayIntegration.accountId,
            userName: userData.mondayIntegration.userName,
            connectedAt: userData.mondayIntegration.connectedAt
          });
          
          // Fetch boards
          await fetchBoards();
          
          // Set previously selected board and group if available
          const mondayData = userData.mondayIntegration;
          if (mondayData.board) {
            setSelectedBoard(mondayData.board);
            setSelectedBoardName(mondayData.boardName || '');
            
            // Fetch groups for this board
            await fetchGroups(mondayData.board);
            
            if (mondayData.group) {
              setSelectedGroup(mondayData.group);
              setSelectedGroupName(mondayData.groupName || '');
            }
          }

          // Try to verify the token actually works
          const isTokenValid = await verifyAccessToken(userData.mondayIntegration.accessToken);
          if (!isTokenValid) {
            console.warn('Monday.com token verification failed - token may be invalid or expired');
            // We'll still proceed with the connection since the token exists,
            // but log the warning for debugging
          }
        } else {
          // Log specifically what's missing
          if (!userData.mondayIntegration) {
            console.log('No mondayIntegration object found');
          } else if (!userData.mondayIntegration.connected) {
            console.log('Monday integration exists but not connected');
          } else if (!userData.mondayIntegration.accessToken) {
            console.log('Monday integration exists but missing access token');
          }
          
          console.log('No valid Monday integration found');
          setIsConnected(false);
        }
      } else {
        console.log('User document not found');
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error checking Monday.com connection:', error);
      toast.error('Failed to check Monday.com connection');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch boards from Monday.com API
  const fetchBoards = async () => {
    if (!user?.email) return;
    
    try {
      const response = await fetch('/api/monday/boards', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch boards');
      }
      
      const data = await response.json();
      
      if (data.boards) {
        setBoards(data.boards);
      }
    } catch (error) {
      console.error('Error fetching Monday.com boards:', error);
      toast.error('Failed to fetch Monday.com boards');
    }
  };

  // Fetch groups for a specific board
  const fetchGroups = async (boardId: string) => {
    if (!user?.email || !boardId) return;
    
    try {
      const response = await fetch(`/api/monday/groups?boardId=${boardId}`, {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      
      const data = await response.json();
      
      if (data.groups) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error('Error fetching Monday.com groups:', error);
      toast.error('Failed to fetch Monday.com groups');
    }
  };

  // Verify access token with a test API call
  const verifyAccessToken = async (accessToken: string): Promise<boolean> => {
    if (!accessToken) return false;
    
    try {
      console.log('Verifying Monday.com access token...');
      const response = await fetch('/api/monday/verify-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.email}`
        },
        body: JSON.stringify({ accessToken })
      });
      
      if (!response.ok) {
        console.error('Token verification failed with status:', response.status);
        return false;
      }
      
      const data = await response.json();
      console.log('Token verification result:', data.valid);
      return data.valid;
    } catch (error) {
      console.error('Error verifying Monday.com token:', error);
      return false;
    }
  };

  // Handle board selection
  const handleBoardSelection = async (boardId: string) => {
    const selectedBoardData = boards.find(board => board.id === boardId);
    setSelectedBoard(boardId);
    setSelectedBoardName(selectedBoardData?.name || '');
    setSelectedGroup(""); // Reset group selection
    setSelectedGroupName("");
    await fetchGroups(boardId);
  };

  // Handle group selection
  const handleGroupSelection = (groupId: string) => {
    const selectedGroupData = groups.find(group => group.id === groupId);
    setSelectedGroup(groupId);
    setSelectedGroupName(selectedGroupData?.title || '');
  };

  // Check for OAuth callback with success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    
    if (success === 'monday_connected' || (success === 'true' && params.get('provider') === 'monday')) {
      toast.success('Successfully connected to Monday.com');
      // Remove the query parameters from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.toString());
      
      // Force refresh connection status
      checkConnection();
    } else if (error) {
      if (error.startsWith('monday_') || error === 'token_exchange_failed' || error === 'app_not_installed' || error === 'no_user_email') {
        toast.error(`Failed to connect to Monday.com: ${decodeURIComponent(error)}`);
      }
      
      // Remove the query parameters from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Get API URLs when the dialog opens
  const getApiUrls = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Monday.com');
      return false;
    }

    try {
      // Get the authorization URL from our API
      const response = await fetch('/api/monday/auth', {
        headers: {
          'Authorization': `Bearer ${user.email}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get authorization URL');
      }
      
      const { url } = await response.json();
      
      // Set for Connect button
      setAuthUrl(url);
      
      // Create install URL by adding response_type=install
      const installUrlObj = new URL(url);
      installUrlObj.searchParams.set('response_type', 'install');
      setInstallUrl(installUrlObj.toString());
      
      console.log('Got URLs from API:', { authUrl: url, installUrl: installUrlObj.toString() });
      return true;
    } catch (error) {
      console.error('Error getting Monday.com URLs:', error);
      toast.error('Failed to get Monday.com connection information');
      return false;
    }
  };

  // Show installation dialog
  const handleOpenInstallDialog = async () => {
    setDialogStep("install");
    setIsDialogOpen(true);
    
    // Get the proper URLs
    await getApiUrls();
  };

  // Handle app installation
  const handleInstallApp = () => {
    if (!installUrl) {
      toast.error('Failed to get installation URL. Please try again.');
      return;
    }
    
    // Open the installation URL in a new window
    window.open(installUrl, '_blank');
    
    // Now switch to the connect step
    setDialogStep("connect");
    toast.info('After installing the app in Monday.com, return here and click Connect');
  };

  // Handle connection after installation
  const handleConnectAfterInstall = () => {
    if (!authUrl) {
      toast.error('Failed to get authorization URL. Please try again.');
      return;
    }
    
    // Use the redirect URL from our API (with proper state/cookies setup)
    window.location.href = authUrl;
    setIsDialogOpen(false);
  };

  // Initiate Monday.com OAuth flow with dialog
  const handleConnect = () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Monday.com');
      return;
    }
    
    handleOpenInstallDialog();
  };

  // Disconnect from Monday.com
  const handleDisconnect = async () => {
    if (!user?.email) return;

    try {
      // Update user document to remove Monday.com integration
      await setDoc(doc(db, 'users', user.email), {
        mondayIntegration: {
          connected: false,
          disconnectedAt: new Date().toISOString()
        }
      }, { merge: true });
      
      setIsConnected(false);
      setSelectedBoard("");
      setSelectedBoardName("");
      setSelectedGroup("");
      setSelectedGroupName("");
      setBoards([]);
      setGroups([]);
      toast.success('Successfully disconnected from Monday.com');
    } catch (error) {
      console.error('Error disconnecting from Monday.com:', error);
      toast.error('Failed to disconnect from Monday.com');
    }
  };

  // Save selected board and group
  const handleSave = async () => {
    if (!user?.email || !selectedBoard || !selectedGroup) {
      toast.error('Please select both a board and a group');
      return;
    }

    setIsSaving(true);
    
    try {
      const configData = {
        board: selectedBoard,
        boardName: selectedBoardName,
        group: selectedGroup,
        groupName: selectedGroupName
      };
      
      if (onSave) {
        // Save to automation configuration
        await onSave(configData);
        toast.success('Successfully added Monday.com step');
        
        // Use either onClose or onCancel depending on which is provided
        if (onClose) {
          onClose();
        } else if (onCancel) {
          onCancel();
        }
      } else {
        // Save to user document directly under mondayIntegration
        const userDoc = await getDoc(doc(db, 'users', user.email));
        const currentIntegration = userDoc.exists() ? userDoc.data().mondayIntegration || {} : {};
        
        await setDoc(doc(db, 'users', user.email), {
          mondayIntegration: {
            ...currentIntegration,
            ...configData,
            updatedAt: new Date().toISOString()
          }
        }, { merge: true });
        
        toast.success('Monday.com configuration saved');
      }
    } catch (error) {
      console.error('Error saving Monday.com configuration:', error);
      toast.error('Failed to save Monday.com configuration');
    } finally {
      setIsSaving(false);
    }
  };

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
                src="/icons/integrations/monday.svg" 
                alt="Monday.com" 
                width={24} 
                height={24} 
              />
            </div>
            <div>
              <h4 className="text-sm font-medium">Monday.com</h4>
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          
          {isConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
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
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>

        {/* Configuration UI - Hidden unless needed */}
        {isConnected && onSave && (
          <div className="hidden space-y-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Board</h4>
              <Select 
                value={selectedBoard}
                onValueChange={handleBoardSelection}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a board..." />
                </SelectTrigger>
                <SelectContent>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBoard && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Group</h4>
                <Select
                  value={selectedGroup}
                  onValueChange={handleGroupSelection}
                  disabled={groups.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={groups.length === 0 ? "Loading groups..." : "Choose a group..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedBoard && selectedGroup && (
              <Button
                onClick={handleSave}
                disabled={isSaving || !selectedBoard || !selectedGroup}
                className="w-full"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Monday.com Connection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <Image 
                src="/icons/integrations/monday.svg" 
                alt="Monday.com Logo" 
                width={24} 
                height={24} 
              />
              <DialogTitle>
                {dialogStep === "install" ? "Install Monday.com App" : "Connect to Monday.com"}
              </DialogTitle>
            </div>
            <DialogDescription>
              {dialogStep === "install" 
                ? "First, you need to install the app in your Monday.com workspace."
                : "Now, authorize Descript to connect with your Monday.com account."
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            {dialogStep === "install" ? (
              <div className="space-y-4">
                <p className="text-sm">
                  Click the button below to install the Descript app in your Monday.com workspace.
                  You'll need to have admin permissions in your workspace.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm">
                  After installing the app, connect your Monday.com account to create items from meeting action items.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            
            {dialogStep === "install" ? (
              <Button 
                onClick={handleInstallApp}
                className="bg-black hover:bg-gray-800 text-white"
              >
                Install App
              </Button>
            ) : (
              <Button 
                onClick={handleConnectAfterInstall}
                className="bg-black hover:bg-gray-800 text-white"
              >
                Connect Account
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 