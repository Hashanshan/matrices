import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/contexts/auth-context'
import { CartProvider } from '@/lib/contexts/cart-context'
import AuthGuard from '@/components/auth-guard'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Matrices',
  // description: 'Matrices: Your gateway to premium tech products with stunning visuals, advanced filtering, and seamless shopping experience',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased text-foreground min-h-screen bg-[#f8fafc] relative">
        
        {/* Background elements mimicking the exact sample design */}
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-[#f4f7fa]">
          {/* Main Diagonal dark blue shape (Top Right) */}
          <div className="absolute top-[0%] right-[-10%] w-[100%] h-[150%] bg-[#1c2c4d] origin-top-right -rotate-[35deg] transform translate-x-[20%] translate-y-[-40%]" />
          
          {/* Diagonal lighter shape (Middle/Left overlapping) */}
          <div className="absolute bottom-[0%] left-[-20%] w-[100%] h-[100%] bg-gradient-to-t from-[#8da0bd] to-[#b3c1d6] origin-bottom-left -rotate-[35deg] transform -translate-x-[10%] translate-y-[20%] opacity-20" />
          
          {/* Bottom left dark blue shape */}
          <div className="absolute bottom-[-20%] left-[-20%] w-[80%] h-[100%] bg-[#1c2c4d] origin-bottom-left -rotate-[35deg] transform -translate-x-[20%] translate-y-[30%]" />

          {/* Subtle overlay */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-sm" />
        </div>

        <div className="relative z-0 min-h-screen">
          <AuthProvider>
            <CartProvider>
              <AuthGuard>
                {children}
                {process.env.NODE_ENV === 'production' && <Analytics />}
              </AuthGuard>
            </CartProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  )
}
