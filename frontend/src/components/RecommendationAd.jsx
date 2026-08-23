import { useEffect, useRef } from 'react';

export default function RecommendationAd({ className = "my-4" }) {
  const adRef = useRef(null);

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
    try {
      window.AdProvider = window.AdProvider || [];
      window.AdProvider.push({ "serve": {} });
    } catch (e) {
      console.debug("AdProvider error", e);
    }
  }, []);

  return (
    <div ref={adRef} className={`w-full overflow-hidden ${className}`}>
      {/* ExoClick Recommendation Widget */}
      <ins className="eas6a97888e20" data-zoneid="6009572"></ins>
    </div>
  );
}
