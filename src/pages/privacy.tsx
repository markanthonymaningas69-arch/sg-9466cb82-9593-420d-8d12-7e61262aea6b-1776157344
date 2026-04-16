import React from "react";
import { PublicLayout } from "@/components/PublicLayout";

export default function PrivacyPage() {
  const lastUpdated = "April 16, 2026";

  return (
    <PublicLayout title="Privacy Policy | ConstructERP">
      <div className="container mx-auto px-4 py-20 max-w-3xl">
        <h1 className="text-4xl font-bold font-heading mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last Updated: {lastUpdated}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold">1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us, including when you create an account, update your profile, use our services, or communicate with us. This may include your name, email address, company name, billing information, and any construction project data you upload to the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Provide, maintain, and improve our services.</li>
              <li>Process transactions and send related information, including confirmations and invoices.</li>
              <li>Send you technical notices, updates, security alerts, and support messages.</li>
              <li>Respond to your comments, questions, and customer service requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold">3. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures designed to protect your data against accidental or unlawful destruction, loss, alteration, unauthorized disclosure, or access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">4. Sharing of Information</h2>
            <p>
              We do not sell your personal information. We may share information with third-party vendors, consultants, and other service providers who need access to such information to carry out work on our behalf (e.g., payment processing, cloud hosting).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@constructerp.com.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}