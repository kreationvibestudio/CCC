import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Campaign Command Center",
  description: "Analyze · Mobilize · Win — smart tools for smarter campaigns",
  applicationName: "CCC HQ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CCC HQ",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/ccc-logo.webp", type: "image/webp" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
    { media: "(prefers-color-scheme: light)", color: "#0b1220" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // next-themes writes an inline <script> to avoid a flash of the wrong theme;
  // it needs the CSP nonce the middleware minted for this request.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className={`${geistSans.className} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
          <Toaster richColors position="top-right" />
          <RegisterServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
