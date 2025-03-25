"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
      console.log('Checking Monday.com connection for user:', user.email);
      setIsLoading(true);
      
      // Check if the user document has a mondayIntegration field
      const userDoc = await getDoc(doc(db, 'users', user.email));
      
      if (userDoc.exists() && userDoc.data().mondayIntegration?.accessToken) {
        console.log('Monday.com integration found in user document');
        setIsConnected(true);
        
        // Fetch boards
        await fetchBoards();
        
        // Set previously selected board and group if available
        const mondayData = userDoc.data().mondayIntegration;
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
      } else {
        console.log('No Monday.com integration found in user document');
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
      console.log('Fetching Monday.com boards');
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
        console.log('Fetched boards:', data.boards.length);
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
      console.log('Fetching groups for board:', boardId);
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
        console.log('Fetched groups:', data.groups.length);
        setGroups(data.groups);
      }
    } catch (error) {
      console.error('Error fetching Monday.com groups:', error);
      toast.error('Failed to fetch Monday.com groups');
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

  // Initiate Monday.com OAuth flow
  const handleConnect = async () => {
    if (!user?.email) {
      toast.error('Please sign in to connect Monday.com');
      return;
    }

    try {
      setIsConnecting(true);
      
      // Get the authorization URL
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
      
      // Redirect to Monday.com authorization page
      window.location.href = url;
    } catch (error) {
      console.error('Error connecting to Monday.com:', error);
      toast.error('Failed to connect to Monday.com');
      setIsConnecting(false);
    }
  };

  // Disconnect from Monday.com
  const handleDisconnect = async () => {
    if (!user?.email) return;

    try {
      // Update user document to remove Monday.com integration
      await setDoc(doc(db, 'users', user.email), {
        mondayIntegration: null
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
        // Save board and group to the mondayIntegration field in the user document
        const userDocRef = doc(db, 'users', user.email);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }
        
        const mondayIntegration = userDoc.data().mondayIntegration || {};
        
        await setDoc(userDocRef, {
          mondayIntegration: {
            ...mondayIntegration,
            board: selectedBoard,
            boardName: selectedBoardName,
            group: selectedGroup,
            groupName: selectedGroupName,
            updatedAt: new Date()
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

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    
    if (success === 'monday_connected') {
      toast.success('Successfully connected to Monday.com');
      // Remove the query parameters from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
      
      // Force refresh connection status
      checkConnection();
    } else if (error && error.startsWith('monday_')) {
      toast.error(`Failed to connect to Monday.com: ${decodeURIComponent(error)}`);
      // Remove the query parameters from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  if (isLoading) {
    return (
      <Card>
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Loading...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <Image 
              src="/icons/integrations/monday.svg" 
              alt="Monday.com Logo" 
              width={28} 
              height={28} 
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Monday.com</h3>
            <p className="text-sm text-muted-foreground">
              Create items from meeting action items
            </p>
          </div>
        </div>
        
        {isConnected ? (
          <Button
            variant="destructive"
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

      {!isConnected && (
        <div className="text-sm text-muted-foreground">
          Connect your Monday.com account to automatically create items from meeting action items.
        </div>
      )}

      {isConnected && (
        <div className="space-y-6 mt-4">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Board</h4>
            <p className="text-sm text-muted-foreground">
              Select the board to create items on.
            </p>
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
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Group</h4>
              <p className="text-sm text-muted-foreground">
                Select the group in {selectedBoardName} where you'd like to create items.
              </p>
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
            <div className="pt-4">
              <h4 className="text-sm font-medium">What will happen</h4>
              <p className="text-sm text-muted-foreground mb-6 mt-2">
                A new Monday.com item will be created on the selected board in
                the selected group for each meeting action item.
              </p>
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
            </div>
          )}
        </div>
      )}
    </Card>
  );
} 