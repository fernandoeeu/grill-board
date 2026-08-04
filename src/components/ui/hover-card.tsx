"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "react-aria-components"

import { cn } from "@/lib/utils"

type HoverCardContextValue = {
  triggerRef: React.RefObject<HTMLSpanElement | null>
  isOpen: boolean
  setOpen: (open: boolean) => void
  open: () => void
  close: () => void
  cancelClose: () => void
}

const HoverCardContext = React.createContext<HoverCardContextValue | null>(null)

function useHoverCard(component: string) {
  const context = React.useContext(HoverCardContext)
  if (!context) {
    throw new Error(`${component} must be used inside a <HoverCard>`)
  }
  return context
}

function HoverCard({
  openDelay = 300,
  closeDelay = 120,
  isOpen: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  openDelay?: number
  closeDelay?: number
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  children: React.ReactNode
}) {
  const triggerRef = React.useRef<HTMLSpanElement | null>(null)
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isOpen = controlledOpen ?? uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(next)
      }
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange]
  )

  const clear = React.useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current)
      timeout.current = null
    }
  }, [])

  React.useEffect(() => clear, [clear])

  const open = React.useCallback(() => {
    clear()
    timeout.current = setTimeout(() => setOpen(true), openDelay)
  }, [clear, openDelay, setOpen])

  const close = React.useCallback(() => {
    clear()
    timeout.current = setTimeout(() => setOpen(false), closeDelay)
  }, [clear, closeDelay, setOpen])

  const value = React.useMemo<HoverCardContextValue>(
    () => ({ triggerRef, isOpen, setOpen, open, close, cancelClose: clear }),
    [clear, close, isOpen, open, setOpen]
  )

  return (
    <HoverCardContext.Provider value={value}>
      {children}
    </HoverCardContext.Provider>
  )
}

function HoverCardTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  const { triggerRef, open, close } = useHoverCard("HoverCardTrigger")

  return (
    <span
      data-slot="hover-card-trigger"
      ref={triggerRef}
      className={cn("block", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return
        open()
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return
        close()
      }}
      onFocus={open}
      onBlur={close}
      {...props}
    >
      {children}
    </span>
  )
}

function HoverCardContent({
  className,
  placement = "right",
  offset = 8,
  crossOffset = 0,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof PopoverPrimitive>,
  "children" | "className" | "triggerRef" | "isOpen" | "onOpenChange"
> & {
  className?: string
  children?: React.ReactNode
}) {
  const { triggerRef, isOpen, setOpen, cancelClose, close } =
    useHoverCard("HoverCardContent")

  return (
    <PopoverPrimitive
      data-slot="hover-card-content"
      triggerRef={triggerRef}
      isOpen={isOpen}
      onOpenChange={setOpen}
      isNonModal
      shouldCloseOnInteractOutside={() => true}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      className={cn(
        "fade z-50 w-72 origin-(--trigger-anchor-point) rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 dark:ring-white/10 outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
        className
      )}
      onPointerEnter={cancelClose}
      onPointerLeave={close}
      {...props}
    >
      {children}
    </PopoverPrimitive>
  )
}

export { HoverCard, HoverCardTrigger, HoverCardContent }
