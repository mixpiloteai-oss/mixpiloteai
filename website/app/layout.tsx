import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Neurotek AI — AI-Powered Music Production Studio',
  description: 'Generate beats, melodies, and full arrangements with one click. Professional-grade DAW for the underground tekno scene. Free to download.',
  keywords: 'AI music production, DAW, beat maker, AI producer, hardtek, tekno, VST, piano roll, MIDI',
  metadataBase: new URL('https://neurotek.ai'),
  openGraph: {
    title: 'Neurotek AI — AI-Powered Music Production Studio',
    description: 'Generate beats, melodies, and full arrangements with AI.',
    url: 'https://neurotek.ai',
    siteName: 'Neurotek AI',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Neurotek AI' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Neurotek AI',
    description: 'AI-Powered Music Production Studio',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-nt-bg text-nt-text font-sans antialiased">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
