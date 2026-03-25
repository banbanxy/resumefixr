import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResumeFixr — ATS Resume Optimizer",
  description:
    "Get 23+ AI-powered rewrite suggestions to beat ATS filters and land more interviews. One-time $4.99.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
