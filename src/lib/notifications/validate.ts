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
        return "Enter a Discord webhook URL."
      }
      if (!DISCORD_WEBHOOK_RE.test(url.trim())) {
        return "That isn't a Discord webhook URL. It starts with https://discord.com/api/webhooks/."
      }
      // Defense-in-depth SSRF check
      try {
        if (isUnsafeNetworkHost(new URL(url.trim()).hostname)) {
          return "That webhook URL points to a private network address."
        }
      } catch {
        return "That isn't a valid URL."
      }
      return null
    }
    case "telegram": {
      // Telegram uses a fixed official host; there is no user-supplied URL to
      // SSRF. Keep the same defense-in-depth check on that constant.
      if (isUnsafeNetworkHost("api.telegram.org")) {
        return "That Telegram address isn't allowed."
      }
      const token = config.botToken
      if (typeof token !== "string" || !TELEGRAM_BOT_TOKEN_RE.test(token.trim())) {
        // Never echo the token in a validation error.
        return "Enter a valid Telegram bot token."
      }
      const chatId = config.chatId
      if (typeof chatId !== "string" || !chatId.trim() || chatId.trim().length > 100) {
        return "Enter a Telegram chat ID."
      }
      if (!/^(?:-?\d+|@[A-Za-z][A-Za-z0-9_]{3,})$/.test(chatId.trim())) {
        return "The chat ID must be a number or an @channel name."
      }
      return null
    }
    case "ntfy": {
      const rawUrl = config.serverUrl
      if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        return "Enter the ntfy server URL."
      }
      let url: URL
      try {
        url = new URL(rawUrl.trim())
      } catch {
        return "That isn't a valid ntfy server URL."
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "The ntfy server URL must start with http or https."
      }
      if (url.username || url.password) {
        return "Remove the username and password from the ntfy server URL."
      }
      if (url.search || url.hash) {
        return "Remove anything after ? or # from the ntfy server URL."
      }
      const allowPrivate = config.allowPrivateNetwork === true
      if (config.allowPrivateNetwork !== undefined && typeof config.allowPrivateNetwork !== "boolean") {
        return "\"Allow private network\" must be on or off."
      }
      if (!allowPrivate && isUnsafeNetworkHost(url.hostname)) {
        return "That ntfy server is on a private network. Turn on \"Allow private network\" for a self-hosted server."
      }
      const topic = config.topic
      if (typeof topic !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(topic.trim())) {
        return "The ntfy topic can use 1 to 64 letters, numbers, _ or -."
      }
      if (config.authToken !== undefined) {
        const token = config.authToken
        if (
          typeof token !== "string" ||
          !token.trim() ||
          token.length > 512 ||
          /\s/.test(token)
        ) {
          return "Enter a valid ntfy access token."
        }
      }
      return null
    }
    default:
      return `Unsupported notification type: ${type}`
  }
}
