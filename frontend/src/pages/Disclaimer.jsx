import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';

export default function Disclaimer() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-24 pb-28 px-6 max-w-[1600px] mx-auto w-full">
      <Helmet>
        <title>Disclaimer - Hotster</title>
        <meta name="description" content="Legal disclaimer for Hotster video platform." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/"
        className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-8 font-semibold"
      >
        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back to Home
      </Link>

      <div className="bg-[#0a0a0f] border border-white/[0.06] rounded-xl p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6">Legal Disclaimer</h1>

        <div className="space-y-6 text-gray-300 text-sm md:text-base">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Third-Party Content</h2>
            <p>
              All videos, images, and other content displayed on this website are provided by and hosted on third-party platforms, including but not limited to xHamster. 
              Nighthub does not host, store, or upload any of the content shown on this website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. No Affiliation</h2>
            <p>
              Nighthub is not affiliated, associated, authorized, endorsed by, or in any way officially connected with xHamster, or any of its subsidiaries or affiliates. 
              All product and company names are the registered trademarks of their original owners.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Content Responsibility</h2>
            <p>
              The responsibility for all content available through this website lies solely with the original content creators and the third-party hosting platforms. 
              Nighthub is a mere aggregator and does not exercise any editorial control over the content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Age Restriction</h2>
            <p>
              By accessing this website, you confirm that you are at least 18 years of age (or the age of majority in your jurisdiction) and that you consent to viewing adult content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Copyright Infringement</h2>
            <p>
              If you believe that any content on this website infringes your copyright, please contact the respective third-party hosting platform directly. 
              Nighthub will promptly remove any links to infringing content upon proper notification from the copyright holder.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}