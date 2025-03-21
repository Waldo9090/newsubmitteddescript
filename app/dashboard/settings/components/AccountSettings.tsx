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
import { useAuth } from "@/context/auth-context"
import { useState } from "react"

export default function AccountSettings() {
  const { user } = useAuth();
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  
  const handleIntegrationCancel = () => {
    setSelectedIntegration(null);
  };
  
  const handleIntegrationSave = async (config: any) => {
    // This function is required by the integration components but 
    // not needed for the account settings page as individual integrations handle their own saving
    setSelectedIntegration(null);
    return Promise.resolve();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
        <p className="text-muted-foreground mb-6">Manage your account information and preferences.</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-6">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src="/placeholder.svg?height=80&width=80" alt="Profile" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="icon" className="absolute bottom-0 right-0 rounded-full h-8 w-8">
              <Camera className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <h3 className="text-lg font-medium">{user?.displayName || "User"}</h3>
            <p className="text-sm text-muted-foreground">{user?.email || "user@example.com"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">First name</Label>
              <Input id="first-name" defaultValue={user?.displayName?.split(' ')[0] || "John"} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input id="last-name" defaultValue={user?.displayName?.split(' ')[1] || "Doe"} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" defaultValue={user?.email || "john@example.com"} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input id="company" defaultValue="Acme Inc." />
          </div>
        </div>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <p className="text-muted-foreground mb-6">Connect your accounts to external services.</p>
        
        <div className="space-y-4">
          <NotionConnection 
            onSave={handleIntegrationSave}
            onCancel={handleIntegrationCancel}
          />
          
          <SlackConnection 
            onSave={handleIntegrationSave}
            onCancel={handleIntegrationCancel}
          />
          
          <LinearConnection />
        </div>
      </div>
    </div>
  )
}

