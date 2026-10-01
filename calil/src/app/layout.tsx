import type { Metadata, Viewport } from "next";
import { Inter, Rubik } from "next/font/google";
import { LANG_BOOT_SCRIPT } from "@/lib/lang-boot";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Hebrew glyphs on devices without SF (Android, Windows). Apple devices use the system font.
const rubik = Rubik({ subsets: ["hebrew"], variable: "--font-hebrew", display: "swap" });

export const metadata: Metadata = {
  title: "Calil",
  description: "The fastest, calmest workout notebook. Log sets without breaking your flow.",
  applicationName: "Calil",
  appleWebApp: { capable: true, title: "Calil", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f7f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${rubik.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
