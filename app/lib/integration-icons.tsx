import Image from 'next/image';

export interface IntegrationIcon {
  name: string;
  icon: React.ReactNode;
  color: string;
}

export const integrationIcons: { [key: string]: IntegrationIcon } = {
  slack: {
    name: 'Slack',
    icon: (
      <Image
        src="/icons/integrations/slack.svg"
        alt="Slack"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#E01E5A'
  },
  notion: {
    name: 'Notion',
    icon: (
      <Image
        src="/icons/integrations/notion.svg"
        alt="Notion"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#000000'
  },
  linear: {
    name: 'Linear',
    icon: (
      <Image
        src="/icons/integrations/linear.svg"
        alt="Linear"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#5E6AD2'
  },
  hubspot: {
    name: 'HubSpot',
    icon: (
      <Image
        src="/icons/integrations/hubspot.svg"
        alt="HubSpot"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#FF7A59'
  },
  salesforce: {
    name: 'Salesforce',
    icon: (
      <Image
        src="/icons/integrations/salesforce.svg"
        alt="Salesforce"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#00A1E0'
  },
  attio: {
    name: 'Attio',
    icon: (
      <Image
        src="/icons/integrations/attio.svg"
        alt="Attio"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#000000'
  },
  'google-calendar': {
    name: 'Google Calendar',
    icon: (
      <Image
        src="/icons/integrations/google-calendar.svg"
        alt="Google Calendar"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#4285F4'
  },
  'microsoft-teams': {
    name: 'Microsoft Teams',
    icon: (
      <Image
        src="/icons/integrations/microsoft-teams.svg"
        alt="Microsoft Teams"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#6264A7'
  },
  jira: {
    name: 'Jira',
    icon: (
      <Image
        src="/icons/integrations/jira.svg"
        alt="Jira"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#0052CC'
  },
  asana: {
    name: 'Asana',
    icon: (
      <Image
        src="/icons/integrations/asana.svg"
        alt="Asana"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#F06A6A'
  },
  monday: {
    name: 'Monday',
    icon: (
      <Image
        src="/icons/integrations/monday.svg"
        alt="Monday"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#0073EA'
  },
  'ai-insights': {
    name: 'AI Insights',
    icon: (
      <Image
        src="/icons/integrations/ai-insights.svg"
        alt="AI Insights"
        width={24}
        height={24}
        className="rounded-sm"
      />
    ),
    color: '#6366F1'
  }
}; 