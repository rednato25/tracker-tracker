// src/app/layout.tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Script from "next/script"
import type { ReactNode } from "react"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Tracker Tracker",
  description: "Monitor your private tracker stats",
  icons: {
    icon: "/favicon.png",
  },
  ...(process.env.BASE_URL && {
    metadataBase: new URL(process.env.BASE_URL),
  }),
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-base text-primary`}
      >
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  )
}
