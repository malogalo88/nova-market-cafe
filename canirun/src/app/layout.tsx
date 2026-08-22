import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AuthSessionProvider from "@/components/SessionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CanIRun - PC Gaming Compatibility & FPS Estimator",
  description: "Check if your PC can run any game. Compare hardware, estimate FPS, analyze bottlenecks, and find recommended settings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary">
        <AuthSessionProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border bg-bg-secondary py-6 text-center text-sm text-text-muted">
            <div className="mx-auto max-w-7xl px-4">
              <p>CanIRun - PC Gaming Compatibility Checker</p>
              <p className="mt-1">
                All FPS values are <span className="text-yellow">estimates</span> based on relative performance scoring, not real benchmarks.
              </p>
            </div>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
