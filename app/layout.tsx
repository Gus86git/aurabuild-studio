import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AuraBuild | Architectural Precision',
  description: 'Advanced 3D visualization and real-time construction budgeting',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <title>AuraBuild | Architectural Precision</title>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Script src="https://cdn.botpress.cloud/webchat/v3.6/inject.js" strategy="afterInteractive" />
        <Script src="https://files.bpcontent.cloud/2026/06/18/05/20260618051051-WNP9GQ1Y.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
