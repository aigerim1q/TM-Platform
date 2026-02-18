import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import '@/styles/org-chart.css'
import { ThemeProvider } from "@/components/theme-provider"
import { TaskProvider } from '@/components/task-provider';
import AIBubble from '@/components/ai-bubble';

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'The Qurylys',
  description: 'Construction management platform',
  generator: 'v0.app',
  icons: {
    icon: '/apartment-icon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TaskProvider>
            {children}
            <AIBubble />
          </TaskProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
