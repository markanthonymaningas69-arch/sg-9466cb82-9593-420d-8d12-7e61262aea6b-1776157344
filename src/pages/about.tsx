import React from "react";
import { PublicLayout } from "@/components/PublicLayout";
import { Building2, Users, Target, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <PublicLayout title="About Us | ConstructERP" description="Learn more about our mission to revolutionize construction management.">
      <div className="container mx-auto px-4 py-20 max-w-4xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6" style={{ lineHeight: "1", fontSize: "32px", backgroundColor: "#00000000", backgroundImage: "none" }}>About THEA-X 
Construction Accounting System</h1>
          <p className="text-xl text-muted-foreground">
            We are building the future of construction management software, designed specifically for the unique needs of general contractors and developers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-20">
          <div>
            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              To empower construction firms with absolute financial visibility and operational control. We believe that by bridging the gap between the field and the back office, we can eliminate cost overruns and project delays.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-4">Our Vision</h2>
            <p className="text-muted-foreground leading-relaxed">
              A world where every construction project is delivered on time and under budget, supported by intelligent data and seamless team collaboration.
            </p>
          </div>
        </div>

        <div className="bg-muted/30 rounded-2xl p-10 border">
          <h2 className="text-2xl font-bold mb-8 text-center">Core Values</h2>
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-lg h-fit">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Precision</h3>
                <p className="text-sm text-muted-foreground">Accuracy in accounting and project tracking is non-negotiable.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-lg h-fit">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Reliability</h3>
                <p className="text-sm text-muted-foreground">Enterprise-grade security and uptime you can trust.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-lg h-fit">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Collaboration</h3>
                <p className="text-sm text-muted-foreground">Built for teams, connecting the job site to the executive suite.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-primary/10 p-3 rounded-lg h-fit">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Industry Focus</h3>
                <p className="text-sm text-muted-foreground">Designed exclusively for the construction industry's unique workflows.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>);
}