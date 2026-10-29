// src/components/charts/lib/theme.ts
//
// Single source of truth for all chart color values. Mirrors the 3-layer
// token system in globals.css. Every chart component imports from here.
// Never hardcode a hex in a chart file.
//
// Functions:
//   escHtml             - HTML-escape untrusted strings for ECharts tooltips
//   chartDot            - square data swatch for tooltip rows
//   chartTooltipRow     - standard tooltip row: colored dot + label + bold value
//   chartTooltipHeader  - timestamp header for tooltip content
//   formatChartTimestamp - locale-formatted date/time for chart tooltips
//   chartLegend         - standard legend configuration
//   buildTagColors      - golden-angle hue distribution for tag series
//   shouldUseLogScale   - detects when log scale improves readability
//   chartTooltip        - standard tooltip configuration
//   chartGrid           - standard grid margins
//   chartAxisLabel      - standard axis label styling
//   chartDataZoom       - standard slider dataZoom configuration

import { hexToRgba } from "@/lib/color-utils"

let cachedTheme: string | null = null
const cssCache = new Map<string, string>()

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  const theme = document.documentElement.dataset.theme ?? "light"
  if (theme !== cachedTheme) {
    cssCache.clear()
    cachedTheme = theme
  }
  const cached = cssCache.get(name)
  if (cached) return cached
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  cssCache.set(name, value)
  return value
}

function cssAlpha(name: string, fallback: string, alpha: number): string {
  return hexToRgba(cssVar(name, fallback), alpha)
}

export const CHART_THEME = {
  // ── Surfaces ──
  get surface() {
    return cssVar("--color-base", "#f6f7fb")
  },
  get elevated() {
    return cssVar("--color-elevated", "#eef1f7")
  },
  get surfaceElevated() {
    return cssVar("--color-overlay", "#ffffff")
  },
  get overlay() {
    return cssVar("--color-overlay", "#ffffff")
  },
  get controlBg() {
    return cssVar("--color-control-bg", "#eef1f7")
  },
  get tooltipBg() {
    return cssVar("--color-raised", "#ffffff")
  },
  get surfaceSemi() {
    return cssVar("--chart-surface-semi", "rgba(246,247,251,0.82)")
  },

  // ── Text ──
  get textPrimary() {
    return cssVar("--color-primary", "#141824")
  },
  get textSecondary() {
    return cssVar("--color-secondary", "#4b5366")
  },
  get textTertiary() {
    return cssVar("--color-tertiary", "#60687c")
  },
  fontMono: "var(--font-mono), monospace",

  // ── Borders ──
  get tooltipBorder() {
    return cssAlpha("--color-secondary", "#4b5366", 0.2)
  },
  get gridLine() {
    return cssAlpha("--color-secondary", "#4b5366", 0.12)
  },
  get borderEmphasis() {
    return cssAlpha("--color-secondary", "#4b5366", 0.2)
  },
  get borderMid() {
    return cssAlpha("--color-secondary", "#4b5366", 0.35)
  },

  // ── Layer 1: Raw colors ──
  get cyan() {
    return cssVar("--color-scale-4", "#1d4ed8")
  },
  get amber() {
    return cssVar("--color-scale-2", "#854d0e")
  },
  get red() {
    return cssVar("--color-scale-1", "#b91c1c")
  },
  get green() {
    return cssVar("--color-scale-3", "#166534")
  },
  get lime() {
    return cssVar("--color-positive", "#166534")
  },
  get violet() {
    return cssVar("--color-scale-6", "#7e22ce")
  },
  get sky() {
    return cssVar("--color-scale-4", "#1d4ed8")
  },

  // ── Layer 2: Semantic ──
  get accent() {
    return cssVar("--color-accent", "#5b45d6")
  },
  get warn() {
    return cssVar("--color-warn", "#854d0e")
  },
  get danger() {
    return cssVar("--color-danger", "#b91c1c")
  },
  get success() {
    return cssVar("--color-success", "#166534")
  },

  // ── Layer 3: Purpose ──
  get upload() {
    return cssVar("--color-upload", "#166534")
  },
  get download() {
    return cssVar("--color-download", "#7e22ce")
  },
  get positive() {
    return cssVar("--color-positive", "#166534")
  },
  get negative() {
    return cssVar("--color-negative", "#b91c1c")
  },
  get neutral() {
    return cssVar("--color-neutral", "#60687c")
  },
  get chartFallback() {
    return cssVar("--color-tertiary", "#60687c")
  },

  // Ordinal scale for ratio/seed-time distribution buckets
  get scale(): string[] {
    return [
      cssVar("--color-scale-1", "#b91c1c"),
      cssVar("--color-scale-2", "#854d0e"),
      cssVar("--color-scale-3", "#166534"),
      cssVar("--color-scale-4", "#1d4ed8"),
      cssVar("--color-scale-5", "#c2410c"),
      cssVar("--color-scale-6", "#7e22ce"),
    ]
  },

  // ── Tint variants (area fills, selection) ──
  get accentDim() {
    return cssVar("--chart-accent-dim", "rgba(91,69,214,0.08)")
  },
  get accentGlow() {
    return cssVar("--chart-accent-glow", "rgba(91,69,214,0.2)")
  },
  get accentGlow40() {
    return cssVar("--chart-accent-glow-40", "rgba(91,69,214,0.32)")
  },
  get accentGlow60() {
    return cssVar("--chart-accent-glow-60", "rgba(91,69,214,0.45)")
  },
  get warnDim() {
    return cssVar("--chart-warn-dim", "rgba(133,77,14,0.1)")
  },
  get warnGlow() {
    return cssVar("--chart-warn-glow", "rgba(133,77,14,0.2)")
  },

  // ── Font sizes (raw numbers, ECharts cannot read CSS vars) ──
  // Keep in sync with @theme inline tokens in globals.css.
  fontSizeMicro: 12,
  fontSizeCompact: 12,
  fontSizeDense: 12,
  fontSizeSmall: 12,
}

/** Escape HTML entities in untrusted strings before injecting into ECharts tooltip HTML */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Square data swatch for tooltip rows */
export function chartDot(color: string): string {
  const safe = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|[a-z]+$)/.test(color)
    ? color
    : CHART_THEME.neutral
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:1px;background:${safe};margin-right:6px;"></span>`
}

/** Standard tooltip row: colored dot + label + bold value */
export function chartTooltipRow(color: string, label: string, value: string): string {
  return (
    chartDot(color) +
    `<span style="color:${CHART_THEME.textSecondary};">${escHtml(label)}:</span> ` +
    `<span style="color:${CHART_THEME.textPrimary};font-weight:600;">${escHtml(value)}</span>`
  )
}

/** Locale-formatted date/time string for chart tooltips */
export function formatChartTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

/** Timestamp header div for tooltip content */
export function chartTooltipHeader(label: string): string {
  return `<div style="font-family:var(--font-mono),monospace;font-size:${CHART_THEME.fontSizeDense}px;color:${CHART_THEME.textTertiary};margin-bottom:4px;">${escHtml(label)}</div>`
}

/** Standard legend configuration. Plain wrapping, toggle handled by ChartECharts wrapper */
export function chartLegend(overrides?: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    type: "plain",
    top: 4,
    left: 56,
    right: 80,
    icon: "circle",
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 12,
    textStyle: {
      color: CHART_THEME.textTertiary,
      fontFamily: CHART_THEME.fontMono,
      fontSize: CHART_THEME.fontSizeDense,
    },
    ...overrides,
  }
  // Strip keys explicitly set to undefined so ECharts doesn't see them
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key]
  }
  return merged
}

/** Golden-angle hue distribution for maximum visual separation of chart series */
export function buildTagColors(tags: string[]): Map<string, string> {
  const colorMap = new Map<string, string>()
  for (let i = 0; i < tags.length; i++) {
    const hue = (i * 137.5) % 360
    colorMap.set(tags[i], `hsl(${hue}, 70%, 55%)`)
  }
  return colorMap
}

/**
 * Returns true when positive values span more than 2 orders of magnitude,
 * meaning a log scale would make the chart far more readable.
 * Zeros and negatives are excluded from the ratio check (they can't
 * appear on log axes), but their presence doesn't block detection.
 */
export function shouldUseLogScale(values: number[]): boolean {
  const positive = values.filter((v) => v > 0)
  if (positive.length < 2) return false
  const max = Math.max(...positive)
  const min = Math.min(...positive)
  return max / min > 100
}

/**
 * Standard tooltip configuration.
 * @param trigger - "axis" for line/bar charts, "item" for pie/scatter
 * @param overrides - Additional tooltip properties to merge
 */
export function chartTooltip(
  trigger: "axis" | "item" | "none" = "axis",
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  return {
    trigger,
    appendToBody: true,
    confine: true,
    extraCssText:
      "max-height: 60vh !important; overflow-y: auto !important; scrollbar-width: thin;",
    backgroundColor: CHART_THEME.tooltipBg,
    borderColor: CHART_THEME.tooltipBorder,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: {
      color: CHART_THEME.textPrimary,
      fontFamily: CHART_THEME.fontMono,
      fontSize: CHART_THEME.fontSizeSmall,
    },
    ...(trigger === "axis"
      ? {
          axisPointer: {
            type: "line" as const,
            lineStyle: { color: CHART_THEME.borderMid, opacity: 0.8 },
          },
        }
      : {}),
    ...overrides,
  }
}

/**
 * Standard grid margins.
 */
export function chartGrid(overrides?: {
  left?: number
  right?: number
  top?: number
  bottom?: number
  containLabel?: boolean
}): Record<string, unknown> {
  return {
    left: 56,
    right: 24,
    top: 16,
    bottom: 40,
    containLabel: false,
    ...overrides,
  }
}

/**
 * Standard axis label styling.
 */
export function chartAxisLabel(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    color: CHART_THEME.textTertiary,
    fontFamily: CHART_THEME.fontMono,
    fontSize: CHART_THEME.fontSizeCompact,
    ...overrides,
  }
}

/**
 * Standard slider dataZoom configuration.
 * @param accentColor - The accent hex color for handles and filler
 */
export function chartDataZoom(accentColor: string): Record<string, unknown>[] {
  return [
    {
      type: "slider",
      borderColor: CHART_THEME.gridLine,
      borderRadius: 8,
      backgroundColor: hexToRgba("#1e2029", 0.8), // control-bg, recessed track
      fillerColor: hexToRgba(accentColor, 0.08),
      handleStyle: {
        color: CHART_THEME.surfaceElevated,
        borderColor: hexToRgba(accentColor, 0.4),
        borderWidth: 1,
        borderRadius: 4,
      },
      moveHandleStyle: {
        color: hexToRgba(accentColor, 0.3),
      },
      emphasis: {
        handleStyle: {
          color: CHART_THEME.surfaceElevated,
          borderColor: accentColor,
        },
        moveHandleStyle: {
          color: hexToRgba(accentColor, 0.5),
        },
      },
      selectedDataBackground: {
        lineStyle: { color: hexToRgba(accentColor, 0.6) },
        areaStyle: { color: hexToRgba(accentColor, 0.12) },
      },
      dataBackground: {
        lineStyle: { color: CHART_THEME.gridLine },
        areaStyle: { color: hexToRgba("#94a3b8", 0.04) },
      },
      textStyle: {
        color: CHART_THEME.textTertiary,
        fontFamily: CHART_THEME.fontMono,
        fontSize: CHART_THEME.fontSizeCompact,
      },
      height: 24,
      bottom: 8,
    },
  ]
}
