import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
        <Script id="chatwoot" strategy="lazyOnload">{`
          window.chatwootSettings = {"position":"right","type":"expanded_bubble","launcherTitle":"Live Chat"};
          (function(d,t) {
            var BASE_URL="https://livechat.guestbox.tv";
            var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
            g.src=BASE_URL+"/packs/js/sdk.js";
            g.async=true;
            s.parentNode.insertBefore(g,s);
            g.onload=function(){
              window.chatwootSDK.run({
                websiteToken: '7PASVdMhThXH4gHDXf8mvqkE',
                baseUrl: BASE_URL
              })
            }
          })(document,"script");
        `}</Script>
      </body>
    </html>
  );
}
