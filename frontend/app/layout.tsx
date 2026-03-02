import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SearchProvider } from "./context/SearchContext";
import Navbar from "./components/Navbar"; // <-- Added Navbar import

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Schihub: Where Ski Geeks Meet",
  description: "Finding hidden ski gems with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased relative bg-slate-950`}>
        <SearchProvider>
          {/* Global System Navigation */}
          <Navbar />
          
          {/* Main content area with padding to account for the fixed Navbar */}
          <main className="pt-16 min-h-screen">
            {children}
          </main>
        </SearchProvider>
      </body>
    </html>
  );
}