import React from "react";
import { PublicLayout } from "@/components/PublicLayout";

export default function TermsPage() {
  const lastUpdated = "April 16, 2026";

  return (
    <PublicLayout title="Terms & Conditions | THEA-X">
      <div className="container mx-auto px-4 py-20 max-w-3xl">
        <h1 className="text-4xl font-bold font-heading mb-4">Terms and Conditions</h1>
        <p className="text-muted-foreground mb-12">Last Updated: {lastUpdated}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the THEA-X platform, you agree to be bound by these Terms and Conditions. If you disagree with any part of the terms, you may not access the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">2. Description of Service</h2>
            <p>
              THEA-X provides an online construction management and accounting software platform. The service is provided "as is" and "as available" without any warranty or condition, express, implied, or statutory.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">3. User Accounts</h2>
            <p>
              To use certain features of the service, you must register for an account. You are responsible for safeguarding the password that you use to access the service and for any activities or actions under your password.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Use the service for any illegal or unauthorized purpose.</li>
              <li>Attempt to hack, destabilize, or adapt the service.</li>
              <li>Transmit any worms, viruses, or any code of a destructive nature.</li>
              <li>Reproduce, duplicate, copy, sell, resell or exploit any portion of the Service without express written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold">5. Limitation of Liability</h2>
            <p>
              In no event shall THEA-X, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}