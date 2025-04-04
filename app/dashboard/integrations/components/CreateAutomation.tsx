"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, ArrowRight, Pencil } from "lucide-react";
import { integrationIcons } from "@/app/lib/integration-icons";

interface AutomationStep {
  title: string;
  description: string;
  icon: string;
  action: string;
}

const automationOptions: AutomationStep[] = [
  {
    title: "Generate Insights with AI",
    description: "Automatically analyze meetings and generate insights",
    icon: "ai",
    action: "generate_insights"
  },
  {
    title: "Send Notes to Slack",
    description: "Post meeting notes to Slack channels",
    icon: "slack",
    action: "slack_notes"
  },
  {
    title: "Send to Notion",
    description: "Export meeting notes to Notion pages",
    icon: "notion",
    action: "notion_export"
  },
  {
    title: "Create Linear Issues",
    description: "Convert action items to Linear issues",
    icon: "linear",
    action: "linear_issues"
  },
  {
    title: "Update HubSpot",
    description: "Log meeting notes in HubSpot CRM",
    icon: "hubspot",
    action: "hubspot_sync"
  }
];

export default function CreateAutomation() {
  const [step, setStep] = useState<"initial" | "when" | "what" | "configure">("initial");
  const [title, setTitle] = useState("Untitled Integration");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log("Saving integration:", {
      title,
      trigger: "after_meeting",
      action: selectedAction
    });
    setStep("initial");
  };

  const handleActionSelect = (action: string) => {
    setSelectedAction(action);
    if (action === "generate_insights" || action === "email_automation") {
      setStep("configure");
    }
  };

  if (step === "initial") {
    return (
      <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setStep("when")}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PlusCircle className="h-5 w-5 mr-2" />
            Create Automation
          </CardTitle>
          <CardDescription>Set up a new automated workflow</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-4">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setIsEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditing(false)}
              autoFocus
              className="h-8 text-base font-medium bg-transparent focus-visible:ring-1"
              style={{ width: Math.max(200, title.length * 8) + 'px' }}
            />
          ) : (
            <div 
              className="flex items-center gap-2 group cursor-pointer" 
              onClick={() => setIsEditing(true)}
            >
              <h2 className="text-base font-medium">{title}</h2>
              <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStep("initial")}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!selectedAction}>
              Create
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === "when" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">When to run</h3>
            <p className="text-muted-foreground">This automation will run after a meeting ends</p>
            <Button onClick={() => setStep("what")} className="w-full">
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "what" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Choose what happens</h3>
            <div className="grid gap-4">
              {automationOptions.map((option) => (
                <Card
                  key={option.action}
                  className={`cursor-pointer transition-colors ${
                    selectedAction === option.action ? "border-primary" : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleActionSelect(option.action)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center">
                        {integrationIcons[option.icon]?.icon || 
                          <div className="h-5 w-5 bg-muted rounded" />}
                      </div>
                      <div>
                        <CardTitle className="text-base">{option.title}</CardTitle>
                        <CardDescription>{option.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === "configure" && selectedAction && (
          <div className="p-6 text-center">
            <p className="text-muted-foreground mb-4">This automation configuration has been removed.</p>
            <Button onClick={() => setStep("what")} variant="outline">
              Go Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 