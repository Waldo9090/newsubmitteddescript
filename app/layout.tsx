import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import type React from "react"
import { AuthProvider } from "@/context/auth-context"
import { SearchProvider } from '@/src/context/search-context'
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Descript AI Summarizer & Meeting Recorder",
  description: "Descript AI Summarizer & Meeting Recorder quickly summarizes key insights from text, articles, and meetings, making it the ultimate AI summarizer & meeting recorder.",
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Descript AI Summarizer & Meeting Recorder',
    description: 'Descript AI Summarizer & Meeting Recorder quickly summarizes key insights from text, articles, and meetings.',
    url: 'https://aisummarizer-descript.com',
    siteName: 'Descript AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Descript AI Summarizer & Meeting Recorder',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Descript AI Summarizer & Meeting Recorder',
    description: 'Descript AI Summarizer & Meeting Recorder quickly summarizes key insights from text, articles, and meetings.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <SearchProvider>
              {children}
            </SearchProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
