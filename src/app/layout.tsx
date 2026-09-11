import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "./globals.css";
import "./features.css";
import { BRAND } from "@/lib/brand";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: BRAND.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.name,
  },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#181918",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
