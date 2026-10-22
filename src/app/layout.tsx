// src/app/layout.tsx
import type { Metadata } from "next"
import { Barlow, Barlow_Condensed, Roboto_Mono } from "next/font/google"
import Script from "next/script"
import type { ReactNode } from "react"
import "./globals.css"

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
})

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
})

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-roboto-mono",
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
        className={`${barlow.variable} ${barlowCondensed.variable} ${robotoMono.variable} font-sans antialiased bg-base text-primary`}
      >
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  )
}
