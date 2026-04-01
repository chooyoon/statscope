import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | StatScope",
  description: "Terms of Service for StatScope MLB analytics platform.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-800 mb-8">Terms of Service</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-7">
        <p className="text-slate-500">Last updated: March {new Date().getFullYear()}</p>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>By accessing and using StatScope (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">2. Description of Service</h2>
          <p>StatScope is a free, data-driven MLB analytics platform that provides game schedules, live scores, player statistics, sabermetrics analysis, win probability models, and related baseball content. The Service is intended for informational and entertainment purposes only.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">3. MLB Data Disclaimer</h2>
          <p>StatScope is <strong>not affiliated with, endorsed by, or sponsored by Major League Baseball (MLB)</strong>, any MLB team, or MLB Advanced Media. All MLB-related data, names, logos, and trademarks are the property of their respective owners. Data is sourced from publicly available MLB APIs and is provided as-is for informational purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">4. No Gambling or Investment Advice</h2>
          <p>The analytics, predictions, and win probability models provided by StatScope are for <strong>educational and entertainment purposes only</strong>. They do not constitute gambling advice, betting recommendations, or investment guidance. Users are solely responsible for any decisions made based on information from the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">5. User Accounts</h2>
          <p>You may access certain features by signing in with your Google account. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the Service for any unlawful purpose</li>
            <li>Scrape, crawl, or harvest data from the Service in an automated manner without permission</li>
            <li>Attempt to gain unauthorized access to any portion of the Service</li>
            <li>Interfere with or disrupt the Service or servers</li>
            <li>Reproduce, distribute, or commercially exploit any content from the Service without permission</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">7. Intellectual Property</h2>
          <p>The Service&apos;s original content, including but not limited to analytics models, design, and code, is owned by StatScope and protected by applicable intellectual property laws. MLB data and trademarks belong to their respective owners.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">8. Limitation of Liability</h2>
          <p>StatScope is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied. We do not guarantee the accuracy, completeness, or timeliness of any information on the Service. In no event shall StatScope be liable for any indirect, incidental, special, or consequential damages arising from the use of the Service.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">9. Third-Party Services</h2>
          <p>The Service may contain links to third-party websites or use third-party services (including Google AdSense for advertising and Google Analytics for usage tracking). We are not responsible for the content or practices of these third parties. Their use is governed by their own terms and privacy policies.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">10. Modifications to Service</h2>
          <p>We reserve the right to modify, suspend, or discontinue the Service (or any part of it) at any time without prior notice. We may also update these Terms of Service from time to time. Continued use of the Service after changes constitutes acceptance of the revised terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">11. Termination</h2>
          <p>We may terminate or suspend your access to the Service at any time, without prior notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">12. Contact</h2>
          <p>For questions about these Terms of Service:</p>
          <p className="font-medium text-slate-700">Email: statscope.help@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
