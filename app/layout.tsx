import type { Metadata } from "next";
import { Nunito, Geist } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const nunito = Nunito({
  variable: "--font-nunito",
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
      className={cn("h-full", "antialiased", nunito.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Toaster>{children}</Toaster>
        </ThemeProvider>
      </body>
    </html>
  );
}
