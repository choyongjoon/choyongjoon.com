import type { Metadata } from 'next';
import { JetBrains_Mono, Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'choyongjoon.com',
  description: 'Personal website exploring ideas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${notoSansKR.variable} ${jetBrainsMono.variable} flex h-screen flex-col items-center justify-center antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
