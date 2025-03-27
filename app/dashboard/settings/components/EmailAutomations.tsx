"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailAutomation } from "@/app/types/automations";

interface EmailAutomationsProps {
  onSave?: (config: any) => void;
  onCancel?: () => void;
  savedConfig?: {
    recipients?: string[];
    subject?: string;
    includeNotes?: boolean;
    includeTranscript?: boolean;
  };
}

export default function EmailAutomations({ onSave, onCancel, savedConfig }: EmailAutomationsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(true);
  const [recipients, setRecipients] = useState(savedConfig?.recipients?.join(", ") || "");
  const [subject, setSubject] = useState(savedConfig?.subject || "Meeting Notes");
  const [includeNotes, setIncludeNotes] = useState(savedConfig?.includeNotes !== false);
  const [includeTranscript, setIncludeTranscript] = useState(savedConfig?.includeTranscript || false);

  const handleSave = async () => {
    if (!recipients.trim()) {
      toast.error('Please enter at least one recipient email');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter an email subject');
      return;
    }

    // Parse recipients string into array
    const recipientList = recipients
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientList.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email format: ${invalidEmails.join(', ')}`);
      return;
    }

    const config = {
      enabled,
      recipients: recipientList,
      subject,
      includeNotes,
      includeTranscript
    };

    if (onSave) {
      onSave(config);
    } else {
      // If no onSave prop, save directly to Firestore
      await saveToFirestore(config);
    }
  };

  const saveToFirestore = async (config: Omit<EmailAutomation, 'id'>) => {
    if (!user?.email) return;

    setIsLoading(true);
    try {
      const db = getFirebaseDb();
      const userDocRef = doc(db, 'users', user.email);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const existingAutomations = userDoc.data().emailAutomations || [];
        
        // Check if we're updating an existing automation
        const automationIndex = existingAutomations.findIndex(
          (automation: EmailAutomation) => automation.subject === config.subject
        );
        
        let updatedAutomations;
        if (automationIndex >= 0) {
          // Update existing
          updatedAutomations = [...existingAutomations];
          updatedAutomations[automationIndex] = {
            ...updatedAutomations[automationIndex],
            ...config
          };
        } else {
          // Add new
          updatedAutomations = [
            ...existingAutomations,
            {
              id: Date.now().toString(),
              ...config
            }
          ];
        }
        
        await setDoc(userDocRef, { emailAutomations: updatedAutomations }, { merge: true });
        toast.success('Email automation saved successfully');
      } else {
        // Create new user document with automations
        await setDoc(userDocRef, {
          emailAutomations: [{
            id: Date.now().toString(),
            ...config
          }]
        });
        toast.success('Email automation saved successfully');
      }
    } catch (error) {
      console.error('Error saving email automation:', error);
      toast.error('Failed to save email automation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Email Automation</CardTitle>
        <CardDescription>
          Set up automated emails to be sent after meetings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enable email automation</Label>
              <Switch 
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div>
              <Label htmlFor="recipients">Recipients (comma separated)</Label>
              <Input
                id="recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email@example.com, another@example.com"
              />
            </div>

            <div>
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Meeting Notes"
              />
            </div>

            <div className="space-y-2">
              <Label>Include in Email</Label>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="includeNotes" 
                  checked={includeNotes}
                  onCheckedChange={(checked) => setIncludeNotes(checked as boolean)}
                />
                <label
                  htmlFor="includeNotes"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Meeting Notes
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="includeTranscript" 
                  checked={includeTranscript}
                  onCheckedChange={(checked) => setIncludeTranscript(checked as boolean)}
                />
                <label
                  htmlFor="includeTranscript"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Meeting Transcript
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 