import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/**
 * Single voice for actions that can't be undone. Replaces `window.confirm`,
 * which can't be styled, blocks the main thread, and reads as a browser warning
 * rather than part of the app.
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  /** Omit when driving the dialog with `open` — e.g. from a menu item, which
   *  cannot be the trigger because closing the menu would unmount the dialog. */
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger render={trigger} />}
      {/* Type and targets grow on a phone, the 320px box does not: an alert is
          the one surface a narrow measure suits, and both answers still fit
          side by side at 44px tall. */}
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl md:text-lg">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base md:text-sm">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 md:h-9">Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="h-11 md:h-9"
            onClick={() => {
              setOpen(false)
              onConfirm()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
