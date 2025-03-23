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
import { useAuth } from "@/context/auth-context"
import { useState } from "react"

export default function AccountSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 flex items-start gap-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
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
        
        <div className="space-y-4">
          <NotionConnection />
          <SlackConnection />
          <LinearConnection />
          <HubSpotConnection />
        </div>
      </div>
    </div>
  )
}

