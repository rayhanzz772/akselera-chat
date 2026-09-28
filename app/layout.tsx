import type { Metadata } from "next";
import { Nunito, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Akselera",
  description: "Internal chat application for Akselera Tech",
  icons: {
    icon: "/assets/logo/favicon.png",
  },
  openGraph: {
    title: "Akselera",
    description: "Internal chat application for Akselera Tech",
    url: "https://akselera.rayhancreative.web.id",
    siteName: "Akselera",
    images: [
      {
        url: "/assets/logo/dark.png",
        width: 1200,
        height: 630,
        alt: "Akselera Chat",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Akselera",
    description: "Internal chat application for Akselera Tech",
    images: ["/assets/logo/dark.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
