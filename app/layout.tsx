import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '조각나침반 | 내 투자를 이해하는 가장 쉬운 방법',
  description: '조각투자 증권신고서를 AI가 읽고, 돈 버는 방식·묶이는 기간·돌려받는 방법·수수료를 같은 기준으로 비교해 쉬운 말로 설명해요.',
  openGraph: {
    title: '조각나침반',
    description: '조각투자 상품, 같은 기준으로 비교하고 쉬운 말로 이해하기',
    locale: 'ko_KR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#176447',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"
        />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='9' fill='%23176447'/><text x='16' y='22' font-size='16' text-anchor='middle' fill='white'>✳</text></svg>" />
      </head>
      <body style={{ ['--font-sans' as string]: "'DM Sans', 'Noto Sans KR'" }}>{children}</body>
    </html>
  );
}
