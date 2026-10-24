// src/lib/notifications/validate.ts
//
// Functions: validateNotificationConfig

import { isUnsafeNetworkHost } from "@/lib/network"
import {
  DISCORD_WEBHOOK_RE,
  type NotificationTargetType,
  SUPPORTED_NOTIFICATION_TYPES,
  TELEGRAM_BOT_TOKEN_RE,
} from "@/lib/notifications/types"

/**
 * Validates a notification config object for a given type.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateNotificationConfig(
  type: NotificationTargetType,
  config: Record<string, unknown>
): string | null {
  if (!(SUPPORTED_NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    return `${type} notifications are not yet supported`
  }

  switch (type) {
    case "discord": {
      const url = config.webhookUrl
      if (typeof url !== "string" || !url.trim()) {
        return "Discord config requires a webhookUrl string"
      }
      if (!DISCORD_WEBHOOK_RE.test(url.trim())) {
        return "Invalid Discord webhook URL - must match https://discord.com/api/webhooks/{id}/{token}"
      }
      // Defense-in-depth SSRF check
      try {
        if (isUnsafeNetworkHost(new URL(url.trim()).hostname)) {
          return "Webhook URL points to a private or reserved network address"
        }
      } catch {
        return "Invalid webhook URL format"
      }
      return null
    }
    case "telegram": {
      // Telegram uses a fixed official host; there is no user-supplied URL to
      // SSRF. Keep the same defense-in-depth check on that constant.
      if (isUnsafeNetworkHost("api.telegram.org")) {
        return "Telegram API host is not allowed"
      }
      const token = config.botToken
      if (typeof token !== "string" || !TELEGRAM_BOT_TOKEN_RE.test(token.trim())) {
        // Never echo the token in a validation error.
        return "Telegram config requires a valid bot token"
      }
      const chatId = config.chatId
      if (typeof chatId !== "string" || !chatId.trim() || chatId.trim().length > 100) {
        return "Telegram config requires a chatId string"
      }
      if (!/^(?:-?\d+|@[A-Za-z][A-Za-z0-9_]{3,})$/.test(chatId.trim())) {
        return "Telegram chatId must be a numeric chat ID or an @channel username"
      }
      return null
    }
    default:
      return `Unsupported notification type: ${type}`
  }
}
