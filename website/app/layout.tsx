import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Neurotek AI — AI-Powered DAW Workflow',
  description: 'Generate beats, melodies, and full arrangements with AI. Free to download.',
  keywords: 'AI music, DAW, beat maker, AI producer, hardtek, tekno, music production',
  openGraph: {
    title: 'Neurotek AI — AI-Powered DAW Workflow',
    description: 'Generate beats, melodies, and full arrangements with AI.',
    url: 'https://neurotek.ai',
    siteName: 'Neurotek AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Neurotek AI',
    description: 'AI-Powered DAW Workflow',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-nt-bg text-nt-text">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
