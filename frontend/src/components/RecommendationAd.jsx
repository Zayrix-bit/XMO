import { useEffect } from 'react';

export default function RecommendationAd() {
  useEffect(() => {
    // Check if script is already injected
    if (!document.getElementById('magsrv-ad-provider')) {
      const script = document.createElement('script');
      script.id = 'magsrv-ad-provider';
      script.type = 'application/javascript';
      script.src = 'https://a.magsrv.com/ad-provider.js';
      script.async = true;
      document.body.appendChild(script);
    }

    // Push the ad to the provider
    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({ "serve": {} });
  }, []);

  return (
    <div className="w-full my-6 overflow-hidden">
      {/* ExoClick Recommendation Widget */}
      <ins className="eas6a97888e20" data-zoneid="6009572"></ins>
    </div>
  );
}
