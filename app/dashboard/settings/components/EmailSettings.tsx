"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function EmailSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Sending preferences</h2>
        <p className="text-muted-foreground mb-6">
          Choose who should automatically receive an email after each meeting.
        </p>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Myself</div>
              <div className="text-sm text-muted-foreground">Send me an email with the notes</div>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Everyone invited</div>
              <div className="text-sm text-muted-foreground">
                Send everyone who was invited to the calendar event an email with the notes
              </div>
            </div>
            <Switch />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Invitee access</h2>
        <p className="text-muted-foreground mb-6">
          Choose what's included in emails sent to meeting invitees. Notes are included by default.
        </p>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Recording and transcript</div>
            <div className="text-sm text-muted-foreground">
              Include a link to view the meeting notes, recording, and transcript
            </div>
          </div>
          <Switch />
        </div>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Notification Settings</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="meeting-summary">Meeting summary emails</Label>
            <Switch id="meeting-summary" defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="action-items">Action item reminders</Label>
            <Switch id="action-items" defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="weekly-digest">Weekly meeting digest</Label>
            <Switch id="weekly-digest" />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="product-updates">Product updates and announcements</Label>
            <Switch id="product-updates" />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Email Format</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="summary-format">Meeting summary format</Label>
            <Select defaultValue="detailed">
              <SelectTrigger id="summary-format">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="bullet">Bullet points only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Label htmlFor="email-frequency">Email frequency</Label>
            <Select defaultValue="immediate">
              <SelectTrigger id="email-frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Button>Save Changes</Button>
    </div>
  )
}

