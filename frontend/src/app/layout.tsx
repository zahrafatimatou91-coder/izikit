import type { Metadata, Viewport } from 'next';
import { DM_Sans, Space_Grotesk, Montserrat, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { THEME_STORAGE_KEY } from '@/lib/theme-storage-key';

// Runs before hydration so the correct theme applies on first paint — avoids
// a flash of the wrong theme. Reads the same localStorage key ThemeContext
// writes to; 'system' (or no stored value) leaves data-theme unset so the
// prefers-color-scheme media query in globals.css takes over.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

// Brand-only faces — used exclusively by the <BrandLogo> wordmark
// ("Chaque" in Montserrat, "Franc" in Playfair Display), not the app body.
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Chaque Franc',
  description: 'Budget par enveloppes pour étudiants — planifie, dépense intelligemment, épargne.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f2' },
    { media: '(prefers-color-scheme: dark)', color: '#16130d' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${dmSans.variable} ${spaceGrotesk.variable} ${montserrat.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${dmSans.className} bg-background text-foreground`}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <AnnouncementBanner />
              {children}
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
