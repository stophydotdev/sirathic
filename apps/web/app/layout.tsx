import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google"
import "./globals.css"

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
})
const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-serif",
})
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "Sirathic — Trace every answer",
  description: "Citation-first Islamic research across Qur'an, hadith, and trusted scholarship.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  )
}
