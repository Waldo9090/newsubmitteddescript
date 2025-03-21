"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PlusCircle, CheckCircle2, Circle, ChevronUp, ChevronRight, Info, Plus, X, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-context";
import { getFirebaseDb } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InsightConfig {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  frequency: "auto" | "one" | "multiple";
}

interface InsightAutomationsProps {
  onSave: (config: any) => void;
  onCancel: () => void;
  savedConfig?: {
    name?: string;
    description?: string;
    frequency?: "auto" | "one" | "multiple";
  };
}

export default function InsightAutomations({ onSave, onCancel, savedConfig }: InsightAutomationsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [insightName, setInsightName] = useState(savedConfig?.name || "");
  const [insightDescription, setInsightDescription] = useState(savedConfig?.description || "");
  const [insightCount, setInsightCount] = useState<"auto" | "one" | "multiple">(savedConfig?.frequency || "auto");

  const handleSave = () => {
    if (!insightName.trim()) {
      toast.error('Please enter an insight name');
      return;
    }

    if (!insightDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }

    onSave({
      name: insightName,
      description: insightDescription,
      frequency: insightCount
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure AI Insights</CardTitle>
        <CardDescription>
          Set up automated insights generation for your meetings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Insight Name</Label>
              <Input
                value={insightName}
                onChange={(e) => setInsightName(e.target.value)}
                placeholder="Enter a name for this insight"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={insightDescription}
                onChange={(e) => setInsightDescription(e.target.value)}
                placeholder="What should this insight analyze or look for?"
              />
            </div>

            <div>
              <Label>Generation Frequency</Label>
              <RadioGroup value={insightCount} onValueChange={(value: "auto" | "one" | "multiple") => setInsightCount(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auto" id="auto" />
                  <Label htmlFor="auto">Automatic</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="one" id="one" />
                  <Label htmlFor="one">One per meeting</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple" id="multiple" />
                  <Label htmlFor="multiple">Multiple per meeting</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {savedConfig ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 