import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "GuestBox Checkout", template: "%s | GuestBox" },
  description: "GuestBox checkout — hospitality devices and services.",
};

// Checkout is a dedicated root layout with its own <html>/<body>, separate
// from the (main) root layout that the admin panel's dark-mode toggle lives
// in. Its <html> never has the "dark" class added (no theme-init script
// here), and the hardcoded "light" class blocks globals.css's
// prefers-color-scheme fallback, so checkout can never render in dark mode.
export default function CheckoutLayout({ children }: LayoutProps<"/c">) {
  return (
    <html lang="en" className={`light ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black">
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
