// Dynamic Open Graph / Twitter Card image for the homepage — Next.js
// picks this up automatically for any `og:image`/`twitter:image` tag on
// this route segment (no manual <meta> needed, no static asset to keep in
// sync with the brand). Colors match the real hero section in
// HomeClient.tsx exactly (same gradient, same cream text, same gold
// accent) so the link-preview card never looks like a different product
// than the page it points to.
import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

export const runtime = 'edge';
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: 'linear-gradient(160deg, #4a3c28 0%, #2e2417 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 4,
          color: '#f5c842',
          marginBottom: 28,
        }}
      >
        Chaque Franc
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          lineHeight: 1.2,
          color: '#faf7f2',
          maxWidth: 980,
        }}
      >
        Sais où part chaque franc, avant la fin du mois.
      </div>
      <div
        style={{
          marginTop: 36,
          fontSize: 28,
          color: 'rgba(250, 247, 242, 0.75)',
        }}
      >
        Budget par enveloppes pour étudiants africains
      </div>
    </div>,
    { ...size },
  );
}
