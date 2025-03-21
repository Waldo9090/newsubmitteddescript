import { Metadata } from 'next';
import DashboardLayout from './layout-client';

export const metadata: Metadata = {
  title: "Dashboard - Descript AI",
  description: "Manage your meetings and notes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
} 