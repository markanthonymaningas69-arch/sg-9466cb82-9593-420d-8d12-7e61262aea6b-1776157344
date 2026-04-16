import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/PublicLayout";
import { ArrowRight, BarChart3, Building2, Calculator, CheckCircle2, FolderKanban, HardHat, ShieldCheck, Users } from "lucide-react";

export default function LandingPage() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden bg-background">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10 dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/20">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              Construction Management software built for the future
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight font-heading mb-8 text-foreground leading-[1.1]">
              Manage Construction Finances with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Absolute Precision</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect your field operations, accounting, HR, and supply chain in one unified platform. Designed specifically for modern construction firms.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login">
                <Button size="lg" className="h-14 px-8 text-base shadow-lg hover:shadow-xl transition-shadow w-full sm:w-auto group">
                  Start Now 
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base w-full sm:w-auto">
                  Learn More
                </Button>
              </Link>
            </div>
            
            {/* Trust Badges */}
            <div className="mt-16 pt-10 border-t border-border/50">
              <p className="text-sm font-medium text-muted-foreground mb-6">Trusted by industry professionals</p>
              <div className="flex flex-wrap justify-center gap-8 opacity-60 grayscale">
                <div className="flex items-center gap-2 font-bold text-xl font-heading"><Building2 className="h-6 w-6"/> BuildCo</div>
                <div className="flex items-center gap-2 font-bold text-xl font-heading"><HardHat className="h-6 w-6"/> Apex Contractors</div>
                <div className="flex items-center gap-2 font-bold text-xl font-heading"><ShieldCheck className="h-6 w-6"/> Vanguard Dev</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Everything you need to run your firm</h2>
            <p className="text-muted-foreground text-lg">Stop juggling spreadsheets. Bring your entire company onto a single source of truth.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-background rounded-2xl p-8 border shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                <Calculator className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Enterprise Accounting</h3>
              <p className="text-muted-foreground">Track expenses, manage budgets, process vouchers, and handle payroll with industry-specific ledgers.</p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-background rounded-2xl p-8 border shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-orange-100 text-orange-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                <FolderKanban className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Project Management</h3>
              <p className="text-muted-foreground">Monitor Bill of Materials (BOM), project progress, and scopes of work directly from the field.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-background rounded-2xl p-8 border shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-green-100 text-green-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Workforce & HR</h3>
              <p className="text-muted-foreground">Manage site personnel, track daily attendance, and calculate labor costs in real-time.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold font-heading mb-6">Ready to scale your operations?</h2>
            <p className="text-xl opacity-90 mb-10">Join the platform that gives you total control over your construction projects, finances, and workforce.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/auth/login">
                <Button size="lg" variant="secondary" className="h-14 px-8 text-base text-primary font-bold hover:bg-white w-full sm:w-auto shadow-xl">
                  Start Now - It's Free
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm opacity-80">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> No credit card required</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Setup in minutes</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> 24/7 Priority Support</div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}