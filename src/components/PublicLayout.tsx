import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { SEO } from "@/components/SEO";

interface PublicLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function PublicLayout({ 
  children, 
  title = "THEA-X Construction Accounting System", 
  description = "Enterprise-grade construction management and accounting software."
}: PublicLayoutProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans">
      <SEO title={title} description={description} />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <div className="bg-primary p-2 rounded-lg">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-heading hidden sm:inline-block">
              THEA-X
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              About
            </Link>
            <Link href="/privacy" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Terms
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost" className="hidden sm:inline-flex text-sm font-medium">
                Log in
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button className="text-sm font-medium shadow-sm">
                Start Now
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-12 mt-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-md">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-lg font-bold font-heading">THEA-X</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              Comprehensive accounting and project management solution tailored for modern construction firms. Build better, track smarter.
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4 text-sm tracking-tight">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold mb-4 text-sm tracking-tight">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground">
          <p>© {currentYear} THEA-X Construction Accounting System. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">Designed for construction professionals.</p>
        </div>
      </footer>
    </div>
  );
}