"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { PlusCircle, MoreHorizontal, Mail } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from "next/image"

const teamMembers = [
  {
    id: 1,
    name: "John Doe",
    email: "john@example.com",
    role: "Admin",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane@example.com",
    role: "Member",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: 3,
    name: "Mike Johnson",
    email: "mike@example.com",
    role: "Member",
    avatar: "/placeholder.svg?height=40&width=40",
  },
]

export default function TeamSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Team configuration</h2>
        <p className="text-muted-foreground mb-6">
          Teams allow you to share meetings and automations, search across shared conversations, and
          more.
        </p>

        <Button variant="secondary">Create team</Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold">Slack</h2>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <p className="text-muted-foreground mb-6">
          Connect your team's Slack workspace. 
        </p>

        <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
          <div className="flex items-center gap-3">
            <Image src="/placeholder.svg?height=32&width=32" alt="Slack" width={32} height={32} />
            <div className="font-medium">Slack</div>
          </div>
          <Button>Connect</Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium">Team Members</h3>
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>

        <div className="space-y-4">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarImage src={member.avatar} alt={member.name} />
                  <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant={member.role === "Admin" ? "default" : "outline"}>{member.role}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Change role</DropdownMenuItem>
                    <DropdownMenuItem>Resend invitation</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Pending Invitations</h3>
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarFallback>
                <Mail className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">alex@example.com</p>
              <p className="text-sm text-muted-foreground">Invited 2 days ago</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              Resend
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive">
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

