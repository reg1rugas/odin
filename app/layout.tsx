import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Odin — Visual Intelligence",
  description:
    "See more. Understand everything. Your intelligent camera operations workspace.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
