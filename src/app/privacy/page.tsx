import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | StatScope",
  description: "StatScope privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-800 mb-8">Privacy Policy</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-7">
        <p className="text-slate-500">Last updated: March {new Date().getFullYear()}</p>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">1. Information We Collect</h2>
          <p>StatScope collects only the minimum information necessary to provide our services.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Google Sign-In:</strong> Name, email address, profile picture (public information provided by your Google account)</li>
            <li><strong>Automatically Collected:</strong> Visit history, browser type, access time (cookie-based via Google AdSense)</li>
            <li><strong>User Preferences:</strong> Favorite teams, favorite players, and other in-app settings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Personalized content delivery (based on favorite teams/players)</li>
            <li>Service usage analytics and improvements</li>
            <li>Ad delivery (Google AdSense)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">3. Data Retention & Deletion</h2>
          <p>When you delete your account or request service withdrawal, all associated personal data is deleted immediately. Automatically collected log data is retained for up to 1 year before deletion.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">4. Third-Party Sharing</h2>
          <p>StatScope does not sell or share your personal information with third parties, except in the following cases:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>When required by law</li>
            <li>External service providers essential to operations (Google AdSense) — their own privacy policies apply separately</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">5. Cookies</h2>
          <p>StatScope uses cookies to improve user experience and deliver ads. You can disable cookies in your browser settings, though some features may be limited.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Essential Cookies:</strong> Login session management</li>
            <li><strong>Advertising Cookies:</strong> Google AdSense (personalized ads and visit statistics)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">6. Your Rights</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You may request to view, modify, or delete your personal information.</li>
            <li>You can withdraw from the service at any time by unlinking your Google account.</li>
            <li>For inquiries, please contact us at the address below.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">7. Data Sources</h2>
          <p>MLB game data, player statistics, and team standings provided on StatScope are based on publicly available MLB data, independently analyzed and processed. StatScope is not officially affiliated with Major League Baseball.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">8. Contact</h2>
          <p>For privacy-related inquiries:</p>
          <p className="font-medium text-slate-700">Email: statscope.help@gmail.com</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">9. Policy Changes</h2>
          <p>This privacy policy may be updated due to changes in applicable laws or services. Any changes will be posted on this page.</p>
        </section>
      </div>
    </div>
  );
}
