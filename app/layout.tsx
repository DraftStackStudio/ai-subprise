import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Subprise",
  description: "Track AI tools, subscriptions, trials, and linked email accounts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
