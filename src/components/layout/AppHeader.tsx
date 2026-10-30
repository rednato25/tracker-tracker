// src/components/layout/AppHeader.tsx

"use client"

import { BookIcon, GitHubIcon, HamburgerIcon, PlusIcon, PowerIcon, XIcon } from "@icons"
import clsx from "clsx"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AddTrackerDialog } from "@/components/AddTrackerDialog"
import { ChangelogDialog } from "@/components/layout/ChangelogDialog"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { Button } from "@/components/ui"
import { useUpdateCheck } from "@/hooks/useUpdateCheck"
import { DOCS_URL } from "@/lib/constants"

const REPO_URL = "https://github.com/jordanlambrecht/tracker-tracker"
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", match: (path: string) => path === "/" || path.startsWith("/trackers") },
  { href: "/pathways", label: "Pathways", match: (path: string) => path.startsWith("/pathways") },
  { href: "/settings", label: "Settings", match: (path: string) => path.startsWith("/settings") },
] as const

function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { latestVersion, updateAvailable } = useUpdateCheck()

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger, so we intentionally close on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
  }

  const navLinks = NAV_ITEMS.map((item) => {
    const active = item.match(pathname)
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "flex min-h-11 items-center border-b-2 px-1 py-1 font-cond text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150 md:min-h-9",
          active
            ? "border-accent text-primary"
            : "border-transparent text-secondary hover:border-border-emphasis hover:text-primary"
        )}
      >
        {item.label}
      </Link>
    )
  })

  return (
    <>
      <header className="z-40 shrink-0 border-b border-border bg-base/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
        <div className="mx-auto flex min-h-[58px] w-full max-w-[1600px] items-center gap-3 px-4 md:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Tracker Tracker dashboard">
            <span className="flex h-8 w-8 items-center justify-center rounded-nm-sm bg-accent-fill font-mono text-xs font-semibold text-on-accent">
              TT
            </span>
            <span className="hidden font-cond text-sm font-semibold tracking-[-0.01em] text-primary sm:block">
              Tracker Tracker
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-4 md:flex" aria-label="Main">
            {navLinks}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              className="hidden h-9 sm:inline-flex"
              leftIcon={<PlusIcon width="13" height="13" />}
              onClick={() => setAddOpen(true)}
            >
              Add tracker
            </Button>
            <ThemeToggle />
            <details className="relative hidden md:block">
              <summary className="flex h-9 cursor-pointer list-none items-center rounded-nm-sm border border-transparent px-2 text-xs text-secondary transition-colors duration-150 hover:border-border hover:text-primary [&::-webkit-details-marker]:hidden">
                More
              </summary>
              <div className="absolute top-full right-0 z-50 mt-1 w-56 rounded-nm-sm border border-border bg-raised p-1 shadow-[0_12px_32px_rgb(0_0_0_/_0.18)]">
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-nm-sm px-2 py-2 text-xs text-secondary hover:bg-elevated hover:text-primary"
                >
                  <BookIcon width="14" height="14" /> Documentation
                </a>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-nm-sm px-2 py-2 text-xs text-secondary hover:bg-elevated hover:text-primary"
                >
                  <GitHubIcon width="14" height="14" /> GitHub
                </a>
                <button
                  type="button"
                  onClick={() => setChangelogOpen(true)}
                  className="flex w-full items-center gap-2 rounded-nm-sm px-2 py-2 text-left text-xs text-secondary hover:bg-elevated hover:text-primary"
                >
                  v{process.env.NEXT_PUBLIC_APP_VERSION}
                </button>
                {updateAvailable && latestVersion && (
                  <a
                    href={`${REPO_URL}/releases/tag/v${latestVersion}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-nm-sm px-2 py-2 text-xs text-warn hover:bg-elevated"
                  >
                    Update available: v{latestVersion}
                  </a>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-nm-sm px-2 py-2 text-left text-xs text-secondary hover:bg-elevated hover:text-primary"
                >
                  <PowerIcon width="14" height="14" /> Log out
                </button>
              </div>
            </details>
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-nm-sm text-secondary hover:bg-elevated hover:text-primary md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <XIcon width="18" height="18" /> : <HamburgerIcon width="18" height="18" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-border bg-base px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Main">
              {navLinks}
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-2 px-1 py-2 text-left text-xs text-secondary hover:text-primary"
              >
                <PlusIcon width="13" height="13" /> Add tracker
              </button>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-1 py-2 text-xs text-secondary hover:text-primary"
              >
                Documentation
              </a>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-2 px-1 py-2 text-left text-xs text-secondary hover:text-primary"
              >
                <PowerIcon width="13" height="13" /> Log out
              </button>
            </nav>
          </div>
        )}
      </header>

      <AddTrackerDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(id) => {
          setAddOpen(false)
          router.push(`/trackers/${id}`)
        }}
      />
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  )
}

export { AppHeader }
