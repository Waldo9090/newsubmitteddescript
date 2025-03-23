import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { integrationIcons } from "@/app/lib/integration-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

interface LinearWorkspace {
  userId: string;
  userName: string;
  userEmail: string;
  teams: LinearTeam[];
  selectedTeamId: string;
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
          userId: linearIntegration.userId,
          userName: linearIntegration.userName,
          userEmail: linearIntegration.userEmail,
          teams: linearIntegration.teams || [],
          selectedTeamId: linearIntegration.selectedTeamId
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

  const handleTeamSelect = async (teamId: string) => {
    if (!user?.email) return;

    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'users', user.email), {
        linearIntegration: {
          ...workspace,
          selectedTeamId: teamId
        }
      }, { merge: true });
      
      setWorkspace(prev => prev ? {
        ...prev,
        selectedTeamId: teamId
      } : null);
      
      toast.success('Team selection updated successfully');
    } catch (error) {
      console.error('Error updating team selection:', error);
      toast.error('Failed to update team selection');
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
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                {integrationIcons.linear.icon}
              </div>
              <div>
                <h4 className="text-sm font-medium">Linear</h4>
                <p className="text-sm text-muted-foreground">
                  {isConnected ? `Connected as ${workspace?.userName}` : "Not connected"}
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
              Connect your Linear workspace to create issues from meeting action items.
            </div>
          )}

          {isConnected && workspace && (
            <div className="hidden">
              <Select 
                value={workspace.selectedTeamId} 
                onValueChange={handleTeamSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {workspace.teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 