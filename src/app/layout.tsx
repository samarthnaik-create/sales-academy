import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })
// Brand font for the "Sales Academy" name (Tailwind class: font-brand)
const montserrat = Montserrat({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-montserrat' })

export const metadata: Metadata = {
  title: 'Sales Academy',
  description: 'Employee Sales Training Platform',
  icons: { icon: '/icon.png', shortcut: '/icon.png', apple: '/icon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${montserrat.variable}`}>
      <body className={`${inter.className} h-full bg-white antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
