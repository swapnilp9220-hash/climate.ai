import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResilioAI Core",
  description:
    "Central autonomous intelligence for agriculture, climate, and smart resources",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
