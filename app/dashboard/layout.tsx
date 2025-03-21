import { Metadata } from 'next';
import DashboardLayout from './layout-client';

export const metadata: Metadata = {
  title: 'Dashboard | DescriptAI',
  description: 'View and manage your meetings, action items, and insights.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
} 