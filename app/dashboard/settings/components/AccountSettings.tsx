"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera } from "lucide-react"
import SlackConnection from "../../integrations/components/SlackConnection"
import NotionConnection from "../../integrations/components/NotionConnection"
import LinearConnection from "../../integrations/components/LinearConnection"
import HubSpotConnection from "../../integrations/components/HubSpotConnection"
import MondayConnection from "../../integrations/components/MondayConnection"
import AttioConnection from "../../integrations/components/AttioConnection"
import { useAuth } from "@/context/auth-context"
import { useState } from "react"
import { toast } from "sonner"

export default function AccountSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    // Function for backward compatibility with components expecting onBack
  };

  const handleClose = () => {
    // Empty function for components expecting onClose
  };

  const handleSave = async (config: any) => {
    toast.success("Settings saved successfully");
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              variant="outline"
              className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              defaultValue={user?.displayName || ""}
              className="max-w-[400px]"
            />
            <p className="text-sm text-muted-foreground">
              This is the name that will be displayed on your profile and in emails.
            </p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <p className="text-muted-foreground mb-6">Connect your accounts to external services.</p>
        
        <div className="space-y-6">
          <NotionConnection onClose={handleClose} />
          
          <SlackConnection onBack={handleBack} />
          
          <LinearConnection />
          
          <HubSpotConnection />
          
          <AttioConnection onSave={handleSave} onClose={handleClose} />
          
          <MondayConnection onCancel={handleBack} onClose={handleClose} onSave={handleSave} />
        </div>
      </div>
    </div>
  )
}

