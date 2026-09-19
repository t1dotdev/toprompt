import React from 'react'
import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, Menu01Icon } from '@hugeicons/core-free-icons'
import { navLinks } from '@/components/header'
import { Portal, PortalBackdrop } from '@/components/portal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="md:hidden">
      <Button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label="Toggle menu"
        className="md:hidden"
        onClick={() => setOpen(!open)}
        size="icon"
        variant="outline"
      >
        {open ? (
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        ) : (
          <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
        )}
      </Button>
      {open && (
        <Portal className="top-14" id="mobile-menu">
          <PortalBackdrop />
          <div
            className={cn(
              'data-[slot=open]:zoom-in-97 ease-out data-[slot=open]:animate-in',
              'size-full p-4',
            )}
            data-slot={open ? 'open' : 'closed'}
          >
            <div className="grid gap-y-2">
              {navLinks.map((link) => (
                <Button
                  className="justify-start"
                  key={link.label}
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  render={<a href={link.href} />}
                >
                  {link.label}
                </Button>
              ))}
            </div>
            <div className="mt-12">
              <Button
                className="w-full"
                render={<Link to="/login" />}
              >
                Sign in
              </Button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
