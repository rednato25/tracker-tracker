// src/components/settings/SettingsSection.tsx

import { H2 } from "@typography"
import clsx from "clsx"
import type { ReactNode } from "react"
import { Card } from "@/components/ui/Card"
import { InfoTip } from "@/components/ui/InfoTip"
import { Notice } from "@/components/ui/Notice"

interface SettingsSectionProps {
  id: string
  title: string
  tooltip?: string
  docs?: { href: string; description?: string }
  headingClassName?: string
  cardClassName?: string
  notice?: { label: string; message: string }
  children: ReactNode
}

export function SettingsSection({
  id,
  title,
  tooltip,
  docs,
  headingClassName,
  cardClassName,
  notice,
  children,
}: SettingsSectionProps) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <span className="h-3.5 w-0.5 shrink-0 bg-accent" aria-hidden="true" />
        <H2 id={`${id}-heading`} className={clsx("flex items-center gap-2", headingClassName)}>
          {title}
          {tooltip && <InfoTip content={tooltip} docs={docs} />}
        </H2>
      </div>
      {notice && (
        <div className="mb-4">
          <Notice variant="warn" box header={notice.label} message={notice.message} />
        </div>
      )}
      <Card elevation="raised" className={clsx("p-4 md:p-5", cardClassName)}>
        {children}
      </Card>
    </section>
  )
}
