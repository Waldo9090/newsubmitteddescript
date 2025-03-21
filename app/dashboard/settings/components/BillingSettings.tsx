"use client"

import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Link2 } from "lucide-react"

export default function BillingSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-2">Circleback for Individuals</h2>
        <p className="text-muted-foreground mb-6">Your free trial ends on March 14th, 2025.</p>
        <Button variant="secondary">Manage billing</Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="font-medium">Email receipts</div>
          <Switch />
        </div>
        <p className="text-sm text-muted-foreground">Send me the invoice and receipt for each payment</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Discounts</h2>
        <p className="text-muted-foreground mb-6">If you have a coupon code, apply it below.</p>

        <div className="flex gap-2">
          <Input placeholder="Coupon code" className="max-w-xs" />
          <Button variant="secondary">Apply</Button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Referrals</h2>
        <p className="text-muted-foreground mb-6">
          You earn a free month of Circleback for each person who joins through your referral link or meeting
          notes emails.
        </p>

        <Button variant="outline" className="gap-2">
          <Link2 className="h-4 w-4" />
          Copy referral link
        </Button>
      </div>
    </div>
  )
}

