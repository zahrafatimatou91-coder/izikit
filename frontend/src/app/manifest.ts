import type { MetadataRoute } from 'next';

// PWA manifest — served at /manifest.webmanifest, auto-linked by Next.
// Icons live in /public/brand/ (copied from the brand kit).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chaque Franc',
    short_name: 'Chaque Franc',
    description:
      'Budget par enveloppes pour étudiants — planifie, dépense intelligemment, épargne.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#1e6b45',
    icons: [
      { src: '/brand/chaque-franc-icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/chaque-franc-icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/brand/chaque-franc-icon-round-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/brand/chaque-franc-icon-round-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
