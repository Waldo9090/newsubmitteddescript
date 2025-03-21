import { createBot, leaveBot } from '@/lib/attendee';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';

interface Meeting {
  id: string;
  title: string;
  start: string;
  end: string;
  meetingLink: string;
}

interface AutoJoinSettings {
  meetings: {
    [key: string]: {
      autoJoin: boolean;
      botId?: string;
    };
  };
}

export class MeetingAutoJoiner {
  private static instance: MeetingAutoJoiner;
  private checkInterval: NodeJS.Timeout | null = null;
  private userEmail: string | null = null;
  private autoJoinSettings: AutoJoinSettings = { meetings: {} };

  private constructor() {}

  static getInstance(): MeetingAutoJoiner {
    if (!MeetingAutoJoiner.instance) {
      MeetingAutoJoiner.instance = new MeetingAutoJoiner();
    }
    return MeetingAutoJoiner.instance;
  }

  async start(userEmail: string) {
    this.userEmail = userEmail;
    await this.loadSettings();

    // Check every minute
    this.checkInterval = setInterval(() => this.checkMeetings(), 60000);

    // Initial check
    await this.checkMeetings();
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async loadSettings() {
    if (!this.userEmail) return;

    try {
      const settingsRef = doc(getFirebaseDb(), 'users', this.userEmail, 'settings', 'auto_join');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        this.autoJoinSettings = settingsSnap.data() as AutoJoinSettings;
      }
    } catch (error) {
      console.error('Error loading auto-join settings:', error);
    }
  }

  private async saveSettings() {
    if (!this.userEmail) return;

    try {
      const settingsRef = doc(getFirebaseDb(), 'users', this.userEmail, 'settings', 'auto_join');
      await setDoc(settingsRef, this.autoJoinSettings);
    } catch (error) {
      console.error('Error saving auto-join settings:', error);
    }
  }

  async setAutoJoin(meetingId: string, autoJoin: boolean) {
    if (!this.userEmail) return;

    this.autoJoinSettings.meetings[meetingId] = {
      autoJoin,
      botId: this.autoJoinSettings.meetings[meetingId]?.botId
    };

    await this.saveSettings();
  }

  getAutoJoinStatus(meetingId: string): boolean {
    return this.autoJoinSettings.meetings[meetingId]?.autoJoin || false;
  }

  private async checkMeetings() {
    if (!this.userEmail) return;
    
    console.log("Backend auto-check invoked. Frequency: every 1 minute.");
    console.log(`Checking meetings at: ${new Date().toISOString()}`);
 
    try {
      // Fetch upcoming meetings
      const response = await fetch(`/api/calendar/events?email=${encodeURIComponent(this.userEmail)}`);
      const data = await response.json();
      console.log("Calendar events response: ", data);
      const meetings: Meeting[] = data.events || [];

      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);
      console.log("Current time: " + now.toISOString());
      console.log("Meeting join threshold (5 minutes from now): " + fiveMinutesFromNow.toISOString());

      for (const meeting of meetings) {
        console.log(`Evaluating meeting: ${meeting.title} with start time: ${new Date(meeting.start).toISOString()}`);
        const meetingStart = new Date(meeting.start);
        const meetingEnd = new Date(meeting.end);
        const settings = this.autoJoinSettings.meetings[meeting.id];

        // Skip if auto-join is disabled
        if (!settings?.autoJoin) continue;

        // Check if meeting is about to start
        if (meetingStart <= fiveMinutesFromNow && meetingStart > now && !settings.botId) {
          console.log(`Meeting "${meeting.title}" qualifies for auto-join. Proceeding to create bot...`);
          try {
            console.log(`Auto-joining meeting: ${meeting.title}`);
            console.log("Meeting start time: " + new Date(meeting.start).toISOString());
            const bot = await createBot(meeting.meetingLink);
            console.log(`Started bot for meeting: ${meeting.title} at ${new Date().toISOString()}`);
            this.autoJoinSettings.meetings[meeting.id].botId = bot.id;
            await this.saveSettings();
          } catch (error) {
            console.error('Error auto-joining meeting:', error);
          }
        }
        // Check if meeting has ended
        else if (meetingEnd <= now && settings.botId) {
          try {
            console.log(`Auto-leaving meeting: ${meeting.title}`);
            await leaveBot(settings.botId);
            delete this.autoJoinSettings.meetings[meeting.id].botId;
            await this.saveSettings();
          } catch (error) {
            console.error('Error leaving meeting:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking meetings:', error);
    }
  }
}