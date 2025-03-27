"use client"

import type React from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Home,
  Calendar,
  CheckSquare,
  Share2,
  BarChart2,
  Settings,
  Search,
  PlusCircle,
  Mic,
  Upload,
  UserPlus,
  CreditCard,
  LogOut,
  User,
  Bot,
  Send,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "../../../context/auth-context"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import dialogs to prevent them from being loaded during static rendering
const RecordDialog = dynamic(() => import("@/app/dialogs/RecordDialog"), { 
  ssr: false,
  loading: () => <div>Loading...</div>
});
const ImportDialog = dynamic(() => import("@/app/dialogs/ImportDialog"), { 
  ssr: false,
  loading: () => <div>Loading...</div>
});
const InviteDialog = dynamic(() => import("@/app/dialogs/InviteDialog"), { 
  ssr: false 
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [isRecordOpen, setIsRecordOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [aiInput, setAiInput] = useState("")
  const [isAiLoading, setIsAiLoading] = useState(false)

  const isIntegrationsPage = pathname.startsWith('/dashboard/integrations')

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    setIsAiLoading(true);
    // Add your AI chat logic here
    setAiInput("");
    setIsAiLoading(false);
  };

  const sidebarItems = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Calendar, label: "Meetings", href: "/dashboard/meetings" },
    { icon: CheckSquare, label: "Action Items", href: "/dashboard/action-items" },
    { icon: Share2, label: "Integrations", href: "/dashboard/integrations" },
    { icon: BarChart2, label: "Insights", href: "/dashboard/insights" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <Link href={"/" as any} className="flex items-center">
              <span className="text-xl font-bold">
                <span className="text-primary">Descript</span>
                <span className="text-foreground">AI</span>
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <div className="py-4">
              <SidebarMenu className="space-y-2 px-2">
                {sidebarItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href as any} legacyBehavior passHref>
                      <SidebarMenuButton asChild isActive={isActive(item.href)}>
                        <a>
                          <item.icon className="h-5 w-5 mr-3" />
                          <span className="font-medium">{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t mt-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                  <User className="mr-2 h-4 w-4" />
                  <span>Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Link href={"/dashboard/settings/billing" as any} className="flex items-center">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Manage billing</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href={"/" as any} className="flex items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="border-b border-border bg-background sticky top-0 z-10 w-full">
            <div className="h-16 px-6 flex items-center">
              <div className="flex items-center gap-4 flex-1">
                {!isIntegrationsPage && (
                  <>
                    <SidebarTrigger />
                    <div className="relative w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search or ask a question..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
              {!isIntegrationsPage && (
                <div className="flex-none ml-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New meeting
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsRecordOpen(true)}>
                        <Mic className="mr-2 h-4 w-4" />
                        <span>Record</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        <span>Import</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsInviteOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>Invite Descript</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* AI Assistant Section */}
            {!isIntegrationsPage && (
              <div className="px-6 py-3 border-t flex items-center gap-4 bg-muted/40">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm">AI Assistant</span>
                </div>
                <form onSubmit={handleAiSubmit} className="flex-1 flex gap-2">
                  <Input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask about your meetings..."
                    className="flex-1"
                    disabled={isAiLoading}
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={isAiLoading || !aiInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>

      {/* Dialog Components */}
      <Suspense fallback={<div>Loading...</div>}>
        <RecordDialog open={isRecordOpen} onOpenChange={setIsRecordOpen} />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
      </Suspense>
      <Suspense fallback={<div>Loading...</div>}>
        <InviteDialog open={isInviteOpen} onOpenChange={setIsInviteOpen} />
      </Suspense>
    </SidebarProvider>
  )
}

