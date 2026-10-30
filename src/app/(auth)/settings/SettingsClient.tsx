// src/app/(auth)/settings/SettingsClient.tsx
//
// Functions: SettingsClient

"use client"

import { H1 } from "@typography"
import { useState } from "react"
import { DownloadClients } from "@/components/DownloadClients"
import { NotificationTargets } from "@/components/NotificationTargets"
import { QbitmanageSettings } from "@/components/QbitmanageSettings"
import { AboutSection } from "@/components/settings/AboutSection"
import { AccountSection } from "@/components/settings/AccountSection"
import { BackupsSection } from "@/components/settings/BackupsSection"
import { CredentialVaultSection } from "@/components/settings/CredentialVaultSection"
import { DangerZoneSection } from "@/components/settings/DangerZoneSection"
import { DataSection } from "@/components/settings/DataSection"
import { DigestSection } from "@/components/settings/DigestSection"
import { EventsSection } from "@/components/settings/EventsSection"
import { PrivacySection } from "@/components/settings/PrivacySection"
import { ProxySection } from "@/components/settings/ProxySection"
import { SecurityPoliciesSection } from "@/components/settings/SecurityPoliciesSection"
import { TwoFactorSection } from "@/components/settings/TwoFactorSection"
import { TagGroups } from "@/components/TagGroups"
import { TabBar } from "@/components/ui/TabBar"
import type { QbitmanageTagConfig } from "@/types/api"

type SettingsTab = "general" | "clients" | "notifications" | "backups" | "events" | "about"

const SETTINGS_TABS: { key: SettingsTab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "clients", label: "Download Clients" },
  { key: "notifications", label: "Notifications" },
  { key: "backups", label: "Backups" },
  { key: "events", label: "Events" },
  { key: "about", label: "About" },
]

export interface SettingsData {
  storeUsernames: boolean
  username: string | null
  sessionTimeoutMinutes: number | null
  lockoutEnabled: boolean
  lockoutThreshold: number
  lockoutDurationMinutes: number
  snapshotRetentionDays: number | null
  trackerPollIntervalMinutes: number | null
  proxyEnabled: boolean
  proxyType: string
  proxyHost: string | null
  proxyPort: number | null
  proxyUsername: string | null
  hasProxyPassword: boolean
  qbitmanageEnabled: boolean
  qbitmanageTags: QbitmanageTagConfig
  backupScheduleEnabled: boolean
  backupScheduleFrequency: string
  backupRetentionCount: number
  backupEncryptionEnabled: boolean
  hasBackupPassword: boolean
  backupStoragePath: string | null
  hasPtpimgKey: boolean
  hasOeimgKey: boolean
  hasImgbbKey: boolean
  credentialVaultEnabled: boolean
  integrationIdentityMode: "none" | "trackers" | "full"
  rankGoals: string | null
  prowlarrUrl: string | null
  hasProwlarrApiKey: boolean
  prowlarrAllowPrivate: boolean
  digestEnabled: boolean
  digestTime: string
  digestTimezone: string
  digestEmptyBehavior: string
  digestTargetIds: string | null
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  quietHoursTimezone: string
  quietHoursCriticalBypass: boolean
}

export interface SettingsClientProps {
  initialSettings: SettingsData
  initialProxyTrackers: { id: number; name: string; color: string }[]
  databaseSize?: string
}

export function SettingsClient({
  initialSettings,
  initialProxyTrackers,
  databaseSize,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")

  return (
    <div data-settings-page className="flex w-full flex-col gap-10 pb-16">
      <div className="flex flex-col gap-6">
        <H1>Settings</H1>
        <TabBar tabs={SETTINGS_TABS} activeTab={activeTab} onChange={setActiveTab} wrap />
      </div>

      {activeTab === "general" && (
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-2 xl:items-start">
          <div className="xl:col-span-2">
            <AccountSection initialUsername={initialSettings.username ?? ""} />
          </div>

          <TwoFactorSection />

          <PrivacySection initialStoreUsernames={initialSettings.storeUsernames} />

          {/* Must stay on this ("general") default tab: the credential sheet's
              opt-in gate deep-links to #credential-vault-heading, and tab state
              is plain React state with no URL sync, so an anchor into any other
              tab would resolve to an unmounted element. */}
          <CredentialVaultSection initialEnabled={initialSettings.credentialVaultEnabled} />

          <DataSection initialPollInterval={initialSettings.trackerPollIntervalMinutes ?? 60} />

          <div className="xl:col-span-2">
            <SecurityPoliciesSection
              initialLockout={{
                enabled: initialSettings.lockoutEnabled,
                threshold: initialSettings.lockoutThreshold,
                durationMinutes: initialSettings.lockoutDurationMinutes,
              }}
              initialSnapshotRetentionDays={initialSettings.snapshotRetentionDays}
              initialSessionTimeoutMinutes={initialSettings.sessionTimeoutMinutes}
              databaseSize={databaseSize}
            />
          </div>

          <div className="xl:col-span-2">
            <ProxySection
              initialProxy={{
                enabled: initialSettings.proxyEnabled,
                type: initialSettings.proxyType || "socks5",
                host: initialSettings.proxyHost ?? "",
                port: initialSettings.proxyPort ?? 1080,
                username: initialSettings.proxyUsername ?? "",
                hasPassword: initialSettings.hasProxyPassword,
              }}
              trackers={initialProxyTrackers}
            />
          </div>

          <div className="xl:col-span-2">
            <DangerZoneSection />
          </div>
        </div>
      )}

      {activeTab === "clients" && (
        <>
          <DownloadClients />
          <QbitmanageSettings
            initialEnabled={initialSettings.qbitmanageEnabled}
            initialTags={initialSettings.qbitmanageTags}
          />
          <TagGroups />
        </>
      )}

      {activeTab === "notifications" && (
        <>
          <NotificationTargets />
          <DigestSection
            initialConfig={{
              enabled: initialSettings.digestEnabled,
              time: initialSettings.digestTime,
              timezone: initialSettings.digestTimezone,
              emptyBehavior: initialSettings.digestEmptyBehavior,
              targetIds: initialSettings.digestTargetIds,
              quietEnabled: initialSettings.quietHoursEnabled,
              quietStart: initialSettings.quietHoursStart,
              quietEnd: initialSettings.quietHoursEnd,
              quietTimezone: initialSettings.quietHoursTimezone,
              quietCriticalBypass: initialSettings.quietHoursCriticalBypass,
            }}
          />
        </>
      )}

      {activeTab === "backups" && (
        <BackupsSection
          initialConfig={{
            encryptBackups: initialSettings.backupEncryptionEnabled,
            hasBackupPassword: initialSettings.hasBackupPassword,
            scheduleEnabled: initialSettings.backupScheduleEnabled,
            scheduleFrequency: initialSettings.backupScheduleFrequency,
            backupRetentionCount: initialSettings.backupRetentionCount,
            backupStoragePath: initialSettings.backupStoragePath ?? "/data/backups",
          }}
        />
      )}

      {activeTab === "events" && <EventsSection />}

      {activeTab === "about" && <AboutSection />}
    </div>
  )
}
