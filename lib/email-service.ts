import { EmailAutomation } from '@/app/types/automations';
import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

class EmailService {
  private static instance: EmailService;
  private brevoAPIKey = process.env.BREVO_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY;
  private fromEmail = 'support@descriptai.online';
  private fromName = 'Descript';

  private constructor() {
    if (!this.brevoAPIKey) {
      console.warn('No Brevo API key found in environment variables');
    }
    console.log('DEBUG: Email service initialized with Brevo API');
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendAutomatedEmails(notes: string, transcript: string | null, meetingTitle?: string, userEmail?: string) {
    try {
      if (!userEmail) {
        console.log('DEBUG: No user email provided, skipping automated emails');
        return;
      }

      // Get automations from Firestore
      const userDocRef = doc(getFirebaseDb(), 'users', userEmail);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists() || !userDoc.data().emailAutomations) {
        console.log('DEBUG: No email automations found for user');
        return;
      }

      const automations: EmailAutomation[] = userDoc.data().emailAutomations;
      const enabledAutomations = automations.filter(a => a.enabled);
      
      console.log(`DEBUG: Found ${enabledAutomations.length} enabled automations for email sending.`);

      for (const automation of enabledAutomations) {
        console.log('DEBUG: Processing automation:', automation);

        const emailSubject = meetingTitle ? 
          `Meeting Notes: ${meetingTitle}` : 
          automation.subject;

        await this.sendEmailViaBrevo(
          automation.recipients,
          emailSubject,
          automation.includeNotes ? notes : null,
          automation.includeTranscript ? transcript : null
        );
      }
    } catch (error) {
      console.error('Error sending automated emails:', error);
    }
  }

  private async sendEmailViaBrevo(
    recipients: string[],
    subject: string,
    notes: string | null,
    transcript: string | null
  ) {
    if (!this.brevoAPIKey) {
      console.error('Cannot send email: No Brevo API key configured');
      return;
    }

    if (!recipients || recipients.length === 0) {
      console.error('Cannot send email: No recipients provided');
      return;
    }

    console.log(`DEBUG: Preparing email with subject: ${subject} for recipients:`, recipients);

    const plainTextContent = this.createEmailContent(notes, transcript, false);
    const htmlContent = this.createEmailContent(notes, transcript, true);

    for (const recipient of recipients) {
      if (!this.isValidEmail(recipient)) {
        console.error(`Invalid email address: ${recipient}`);
        continue;
      }

      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.brevoAPIKey,
          },
          body: JSON.stringify({
            sender: { email: this.fromEmail, name: this.fromName },
            to: [{ email: recipient }],
            subject,
            htmlContent,
            textContent: plainTextContent,
            attachment: [
              ...(notes ? [{
                content: await this.createPDFBase64('Meeting Notes', this.formatContentForPDF(notes)),
                name: 'MeetingNotes.pdf'
              }] : []),
              ...(transcript ? [{
                content: await this.createPDFBase64('Transcript', this.formatContentForPDF(transcript)),
                name: 'Transcript.pdf'
              }] : [])
            ]
          })
        });

        if (response.ok) {
          console.log(`DEBUG: Email sent successfully to ${recipient}`);
        } else {
          const errorData = await response.json();
          console.error(`Failed to send email to ${recipient}:`, errorData);
        }
      } catch (error) {
        console.error(`Error sending email to ${recipient}:`, error);
      }
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private createEmailContent(notes: string | null, transcript: string | null, isHtml: boolean): string {
    const parts = [
      isHtml ? '<p>Hello,</p>' : 'Hello,\n\n',
      isHtml ? '<p>Please find attached:' : 'Please find attached:',
      notes ? (isHtml ? '<br>- Meeting Notes (PDF)' : '\n- Meeting Notes (PDF)') : '',
      transcript ? (isHtml ? '<br>- Full Transcript (PDF)' : '\n- Full Transcript (PDF)') : '',
      isHtml ? '</p>' : '\n',
      isHtml 
        ? '<p>Download our app: <a href="https://apps.apple.com/us/app/descript-talk-to-text-ai-note/id6741746042">Descript - Talk to Text AI Note</a></p>' 
        : '\nDownload our app: https://apps.apple.com/us/app/descript-talk-to-text-ai-note/id6741746042',
      isHtml 
        ? '<p>Best regards,<br>Descript Bot</p>'
        : '\n\nBest regards,\nDescript Bot'
    ];
    return parts.join('');
  }

  private formatContentForPDF(content: string): string {
    // Add proper formatting for PDF content
    const title = 'Meeting Summary';
    const date = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    return `${title}\nGenerated on: ${date} at ${time}\n\n${content}`;
  }

  private async createPDFBase64(title: string, content: string): Promise<string> {
    // For now, we'll return a simple base64 encoded string
    // In a production environment, you would want to use a proper PDF generation library
    const pdfContent = `${title}\n\n${content}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(pdfContent);
    return btoa(String.fromCharCode(...new Uint8Array(data)));
  }
}

export const emailService = EmailService.getInstance(); 