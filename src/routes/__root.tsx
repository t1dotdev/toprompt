import { useEffect, useState } from 'react'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Toaster } from 'sonner'

import appCss from '../styles.css?url'

// The stylesheet already defines a full `.dark` palette; this is what turns it
// on. Inline and blocking so the class lands before first paint — a deferred
// module would flash the light theme on a dark device.
//
// A stored choice wins over the OS, and the absence of one is itself a state:
// until the toggle is used the app keeps following `prefers-color-scheme` live.
const themeScript = `
try {
  var stored = localStorage.getItem('theme')
  var m = matchMedia('(prefers-color-scheme: dark)')
  var apply = function (dark) { document.documentElement.classList.toggle('dark', dark) }
  apply(stored ? stored === 'dark' : m.matches)
  m.addEventListener('change', function (e) {
    if (!localStorage.getItem('theme')) apply(e.matches)
  })
} catch (e) {}
`

// Registered purely so the app is installable: Chrome will not offer "Add to
// home screen" without a service worker that has a fetch handler. It caches
// nothing on purpose — the queue is server state, and a cached shell would show
// yesterday's prompts after a deploy.
const swScript = `
if ('serviceWorker' in navigator) {
  addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {})
  })
}
`

const DESCRIPTION =
  'A pocket queue for your AI prompts. Stash them now, paste them later.'

// Every scraper needs absolute URLs — X and Slack drop a relative og:image
// outright. Set VITE_SITE_URL to the deployed origin; the fallback exists so
// local link previews resolve to something.
const SITE = (import.meta.env.VITE_SITE_URL ?? 'http://localhost:3100').replace(
  /\/$/,
  '',
)
const OG_IMAGE = `${SITE}/og.png`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        name: 'description',
        content: DESCRIPTION,
      },
      {
        title: 'toprompt',
      },

      // Open Graph — read by Facebook, LinkedIn, Discord, Slack, Mastodon and
      // Bluesky. Keyed on `property`, not `name`.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'toprompt' },
      { property: 'og:title', content: 'toprompt' },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      {
        property: 'og:image:alt',
        content: 'toprompt — a pocket queue for your AI prompts',
      },

      // X reads og:* as a fallback but not the card type, which is what turns
      // the thumbnail into a full-width image.
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'toprompt' },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:url', content: SITE },
      { name: 'twitter:image', content: OG_IMAGE },
      {
        name: 'twitter:image:alt',
        content: 'toprompt — a pocket queue for your AI prompts',
      },

      // Standalone launch from the home screen. black-translucent lets the page
      // paint under the status bar, which the safe-area insets already handle.
      { name: 'application-name', content: 'toprompt' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'toprompt' },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      // The SVG carries both palettes and swaps itself on prefers-color-scheme;
      // the .ico is only there for browsers that still ignore SVG favicons.
      {
        rel: 'icon',
        href: '/favicon.svg',
        type: 'image/svg+xml',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: '48x48',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/site.webmanifest',
      },
    ],
  }),
  shellComponent: RootDocument,
})

/**
 * Sonner does its own `prefers-color-scheme` lookup, so leaving it on "system"
 * would keep painting dark toasts over a manually-lightened app. Watching the
 * class instead of taking the theme as a prop means this stays correct whoever
 * changed it — the toggle or the OS.
 */
function ThemedToaster() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useEffect(() => {
    const read = () =>
      setTheme(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      )
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <Toaster
      position="bottom-center"
      theme={theme}
      mobileOffset="calc(1rem + env(safe-area-inset-bottom))"
    />
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The theme script adds a class before hydration, so the server and client
    // markup differ here by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/*
          Paints the mobile browser chrome to match the app instead of leaving a
          white bar above a dark page. Rendered here rather than through the head
          API because that one keys meta by name and would keep only the last of
          these two, dropping the light-scheme colour.
        */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#ffffff"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0a0a0a"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body>
        {children}
        {/* Bottom-center keeps the Undo action inside thumb reach on a phone. */}
        <ThemedToaster />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
