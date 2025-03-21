export interface EmailAutomation {
  id: string;
  enabled: boolean;
  recipients: string[];
  subject: string;
  includeNotes: boolean;
  includeTranscript: boolean;
}

export interface AutomationFormData {
  enabled: boolean;
  recipients: string;
  subject: string;
  includeNotes: boolean;
  includeTranscript: boolean;
} 