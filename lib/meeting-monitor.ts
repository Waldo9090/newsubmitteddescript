import { getFirebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createBot, leaveBot, getBotStatus } from '@/lib/attendee';

interface MeetingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  meetingLink: string;
}

interface MonitoredMeeting {
  id: string;
  autoJoin: boolean;
  botId?: string;
}

export class MeetingMonitor {
  private static instance: MeetingMonitor;
  private monitorInterval: NodeJS.Timeout | null = null;
  private activeMonitoredMeetings: Map<string, MonitoredMeeting> = new Map();

  private constructor() {}

  static getInstance(): MeetingMonitor {
    if (!MeetingMonitor.instance) {
      MeetingMonitor.instance = new MeetingMonitor();
    }
    return MeetingMonitor.instance;
  }

  async start(userEmail: string) {
    if (this.monitorInterval) {
      return;
    }

    // Load monitored meetings from Firestore
    await this.loadMonitoredMeetings(userEmail);

    // Check meetings every minute
    this.monitorInterval = setInterval(async () => {
      await this.checkMeetings(userEmail);
    }, 60000);

    // Initial check
    await this.checkMeetings(userEmail);
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.activeMonitoredMeetings.clear();
  }

  private async loadMonitoredMeetings(userEmail: string) {
    try {
      const monitoredRef = doc(getFirebaseDb(), 'users', userEmail, 'settings', 'monitored_meetings');
      const monitoredDoc = await getDoc(monitoredRef);
      
      if (monitoredDoc.exists()) {
        const data = monitoredDoc.data();
        Object.entries(data.meetings || {}).forEach(([id, meeting]: [string, any]) => {
          this.activeMonitoredMeetings.set(id, {
            id,
            autoJoin: meeting.autoJoin,
            botId: meeting.botId
          });
        });
      }
    } catch (error) {
      console.error('Error loading monitored meetings:', error);
    }
  }

  private async saveMonitoredMeetings(userEmail: string) {
    try {
      const monitoredRef = doc(getFirebaseDb(), 'users', userEmail, 'settings', 'monitored_meetings');
      const meetings = Object.fromEntries(this.activeMonitoredMeetings.entries());
      await setDoc(monitoredRef, { meetings }, { merge: true });
    } catch (error) {
      console.error('Error saving monitored meetings:', error);
    }
  }

  async setAutoJoin(userEmail: string, meetingId: string, autoJoin: boolean) {
    const meeting = this.activeMonitoredMeetings.get(meetingId) || { id: meetingId, autoJoin };
    meeting.autoJoin = autoJoin;
    this.activeMonitoredMeetings.set(meetingId, meeting);
    await this.saveMonitoredMeetings(userEmail);
  }

  getAutoJoinStatus(meetingId: string): boolean {
    return this.activeMonitoredMeetings.get(meetingId)?.autoJoin || false;
  }

  private async checkMeetings(userEmail: string) {
    try {
      // Fetch upcoming meetings
      const response = await fetch(`/api/calendar/events?email=${encodeURIComponent(userEmail)}`);
      const data = await response.json();
      const meetings: MeetingEvent[] = data.events || [];

      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000);

      for (const meeting of meetings) {
        const meetingStart = new Date(meeting.start);
        const meetingEnd = new Date(meeting.end);
        const monitoredMeeting = this.activeMonitoredMeetings.get(meeting.id);

        // Skip if auto-join is disabled
        if (!monitoredMeeting?.autoJoin) continue;

        // Check if meeting is about to start
        if (meetingStart <= fiveMinutesFromNow && meetingStart > now && !monitoredMeeting.botId) {
          // Join the meeting
          try {
            const bot = await createBot(meeting.meetingLink);
            monitoredMeeting.botId = bot.id;
            this.activeMonitoredMeetings.set(meeting.id, monitoredMeeting);
            await this.saveMonitoredMeetings(userEmail);
          } catch (error) {
            console.error('Error joining meeting:', error);
          }
        }
        // Check if meeting has ended
        else if (meetingEnd <= now && monitoredMeeting?.botId) {
          // Leave the meeting
          try {
            await leaveBot(monitoredMeeting.botId);
            monitoredMeeting.botId = undefined;
            this.activeMonitoredMeetings.set(meeting.id, monitoredMeeting);
            await this.saveMonitoredMeetings(userEmail);
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