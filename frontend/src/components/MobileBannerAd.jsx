import { useEffect } from 'react';

export default function MobileBannerAd() {
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
    <div className="w-full flex justify-center my-4 overflow-hidden min-h-[250px] max-w-full">
      {/* ExoClick 300x250 Mobile Banner Tag */}
      <ins className="eas6a97888e10" data-zoneid="6009574"></ins>
    </div>
  );
}
