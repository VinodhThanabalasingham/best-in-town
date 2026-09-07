import Nav from "@/components/nav";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Best In Town",
  description: "The best local business in every category, in your own words.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f0e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased bg-background`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Nav />
        {children}
      </body>
    </html>
  );
}
