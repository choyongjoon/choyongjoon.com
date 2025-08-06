/// <reference types="vite/client" />

import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { PostHogProvider } from 'posthog-js/react';
import type * as React from 'react';
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary';
import { NavBar } from '~/components/NavBar';
import { NotFound } from '~/components/NotFound';
import appCss from '~/styles/app.css?url';
import { seo } from '~/utils/seo';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title: '잔점 | 카페 음료 모든 것을 한곳에!',
        description: '카페 음료 모든 것을 한곳에!',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: '2025-05-24',
        capture_exceptions: true,
        debug: import.meta.env.MODE === 'development',
      }}
    >
      <ClerkProvider>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <html lang="ko">
            <head>
              <HeadContent />
            </head>
            <body>
              <NavBar />
              {children}
              <TanStackRouterDevtools position="bottom-right" />
              <Scripts />
            </body>
          </html>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </PostHogProvider>
  );
}
