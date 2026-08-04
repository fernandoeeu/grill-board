import {
  HeadContent,
  ScriptOnce,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { RouterProvider as AriaRouterProvider } from 'react-aria-components'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { AppSidebar } from '@/components/app-sidebar'
import { THEME_SCRIPT, ThemeProvider } from '@/components/theme-provider'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { topicsQueryOptions } from '@/lib/queries'

import appCss from '../styles.css?url'

import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'

interface GrillRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<GrillRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'color-scheme', content: 'light dark' },
      { title: 'Grill Board' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  // The sidebar lives in the shell, so its data is loaded once here and kept
  // fresh by the query's own poll interval.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(topicsQueryOptions())
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Paints the stored theme before hydration: no flash of the wrong one. */}
        <ScriptOnce>{THEME_SCRIPT}</ScriptOnce>
      </head>
      <body>
        <ThemeProvider>
          <AriaLinkBridge>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset className="min-w-0 ring-1 ring-stone-200">
                {/* The one trigger of the app: thin bar pinned to the top of
                    the inset card, on every route. */}
                <header className="sticky top-0 z-40 flex h-10 shrink-0 items-center gap-2 border-b border-stone-100 bg-background/85 px-3 backdrop-blur md:rounded-t-xl">
                  <SidebarTrigger className="text-stone-400" />
                </header>
                {children}
              </SidebarInset>
            </SidebarProvider>
            <Toaster
              position="bottom-center"
              // Clears the board's fixed action bar, like the prototype toast.
              offset="7rem"
              mobileOffset="7rem"
              duration={2200}
              visibleToasts={1}
              toastOptions={{
                unstyled: true,
                classNames: {
                  toast:
                    'fade pointer-events-none mx-auto flex w-fit items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg',
                },
              }}
            />
          </AriaLinkBridge>
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

/**
 * React Aria links (`<Link href>`, and every shadcn component built on it)
 * navigate with the router instead of reloading the document.
 */
function AriaLinkBridge({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <AriaRouterProvider
      navigate={(href) => {
        void router.navigate({ href })
      }}
    >
      {children}
    </AriaRouterProvider>
  )
}
