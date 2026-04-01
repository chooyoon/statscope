import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer | StatScope",
  description: "Disclaimer for StatScope — data accuracy, MLB non-affiliation, and usage limitations.",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-800 mb-8">Disclaimer</h1>
      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-7">
        <p className="text-slate-500">Last updated: March {new Date().getFullYear()}</p>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">MLB Non-Affiliation</h2>
          <p>StatScope is an <strong>independent, fan-built analytics platform</strong>. We are not affiliated with, endorsed by, or sponsored by Major League Baseball (MLB), any MLB team, MLB Advanced Media, or any related entity. All team names, logos, and trademarks are the property of their respective owners and are used here for identification purposes only.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Data Accuracy</h2>
          <p>While we strive to provide accurate and up-to-date information, StatScope <strong>does not guarantee the accuracy, completeness, or reliability</strong> of any data, statistics, or analysis presented on this platform. Data is sourced from publicly available MLB APIs and may be subject to delays, errors, or omissions.</p>
          <p>Users should verify critical information through official MLB sources before relying on it for any purpose.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Not Gambling or Betting Advice</h2>
          <p>StatScope provides analytical tools including win probability models, player form indices, and statistical projections. These are <strong>strictly for educational and entertainment purposes</strong>. They are not intended as, and should not be construed as:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Gambling or sports betting advice</li>
            <li>Financial or investment recommendations</li>
            <li>Guaranteed predictions of game outcomes</li>
          </ul>
          <p>Users engage in sports betting or any form of gambling at their own risk. StatScope bears no responsibility for any financial losses resulting from decisions made based on our content.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Educational Purpose</h2>
          <p>The sabermetrics calculations, statistical models, and analytical content on StatScope are provided for <strong>educational and informational purposes</strong>. Our goal is to help baseball fans better understand the game through data-driven analysis.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Third-Party Content</h2>
          <p>StatScope may display news articles, images, or links from third-party sources. We do not control or endorse third-party content and are not responsible for its accuracy or availability. External links are provided for convenience only.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Advertising</h2>
          <p>StatScope displays advertisements through Google AdSense to support the free operation of this platform. Ad content is managed by Google and may be personalized based on your browsing behavior. We do not control specific ad content and are not responsible for products or services advertised.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, StatScope and its operators shall not be held liable for any damages, losses, or expenses arising from the use of or inability to use this platform, including but not limited to direct, indirect, incidental, or consequential damages.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mt-8 mb-3">Contact</h2>
          <p>If you have questions or concerns about this disclaimer:</p>
          <p className="font-medium text-slate-700">Email: statscope.help@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
