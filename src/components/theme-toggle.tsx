import { MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/theme-provider'

/**
 * Single ghost button that flips light <-> dark.
 * React Aria base: the press handler is `onPress`, not `onClick`.
 * Both icons are always mounted; the `dark:` variants cross-fade them, so the
 * button never disagrees with the class the no-flash script wrote on `<html>`.
 */
export function ThemeToggle() {
  const { toggleTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onPress={toggleTheme}
      className="relative cursor-pointer"
    >
      <SunIcon className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
