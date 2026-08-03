import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Theme preference. `system` follows the OS setting.
 * The app default is `light` (spec ADDENDUM A1.1).
 */
export type Theme = 'light' | 'dark' | 'system'

/** The theme actually painted: `system` is resolved to one of these. */
export type ResolvedTheme = 'light' | 'dark'

/** localStorage key. UI preference only — never domain state (spec §2.3). */
export const THEME_STORAGE_KEY = 'grill-board-theme'

/** Light by default; the toggle opts into dark. */
export const DEFAULT_THEME: Theme = 'light'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStoredTheme(storageKey: string, fallback: Theme): Theme {
  try {
    const stored = localStorage.getItem(storageKey)
    return isTheme(stored) ? stored : fallback
  } catch {
    return fallback
  }
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Writes the Tailwind v4 dark variant class onto `<html>`.
 * `src/styles.css` declares `@custom-variant dark (&:is(.dark *))`, so the
 * class must live on the document element and nowhere else.
 */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

/**
 * NO-FLASH SNIPPET — owner of `src/routes/__root.tsx` (shell agent) must inject this
 * string as an inline script that runs BEFORE hydration, so the `dark` class is on
 * `<html>` in the very first paint. Import it, never copy-paste it.
 *
 *   import { ScriptOnce } from '@tanstack/react-router'
 *   import { THEME_SCRIPT, ThemeProvider } from '@/components/theme-provider'
 *
 *   <html lang="en" suppressHydrationWarning>
 *     <head>
 *       <HeadContent />
 *       <ScriptOnce>{THEME_SCRIPT}</ScriptOnce>
 *     </head>
 *     <body>
 *       <ThemeProvider>{children}</ThemeProvider>
 *       <Scripts />
 *     </body>
 *   </html>
 *
 * Equivalent if the shell prefers the route `head` API:
 *   head: () => ({ scripts: [{ children: THEME_SCRIPT }] })
 *
 * `suppressHydrationWarning` on `<html>` is required either way, because the script
 * mutates the class list before React hydrates.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${JSON.stringify(
  DEFAULT_THEME,
)}}var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(r);e.style.colorScheme=r}catch(e){}})()`

interface ThemeProviderState {
  /** The stored preference. */
  theme: Theme
  /** The theme currently painted. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Flips between light and dark, starting from what is painted now. */
  toggleTheme: () => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  // First render must match the server (always `defaultTheme`); the inline
  // THEME_SCRIPT already painted the right theme, so there is no flash.
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    defaultTheme === 'dark' ? 'dark' : 'light',
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setThemeState(readStoredTheme(storageKey, defaultTheme))
    setMounted(true)
  }, [defaultTheme, storageKey])

  useEffect(() => {
    if (!mounted) return
    const resolved = resolveTheme(theme)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [mounted, theme])

  useEffect(() => {
    if (!mounted || theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const resolved = resolveTheme('system')
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mounted, theme])

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        // Private mode or a full quota: the theme still applies for this session.
      }
      setThemeState(next)
    },
    [storageKey],
  )

  const toggleTheme = useCallback(() => {
    setTheme(resolveTheme(theme) === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  return (
    <ThemeProviderContext value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeProviderContext>
  )
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
