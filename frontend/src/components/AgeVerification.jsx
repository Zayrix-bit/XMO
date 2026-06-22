import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function AgeVerification({ isVerified, setIsVerified }) {
  const [showClose, setShowClose] = useState(false);

  // Show close button after 3 seconds (optional)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowClose(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // When user clicks "Yes, I'm 18+"
  const handleVerify = () => {
    localStorage.setItem('ageVerified', 'true'); // Save choice to localStorage
    setIsVerified(true); // Hide the popup
  };

  // When user clicks "No" or close button
  const handleDecline = () => {
    window.location.href = 'https://www.google.com'; // Redirect away
  };

  // If already verified, don't show anything
  if (isVerified) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6">
      {/* Close Button (appears after 3 seconds) */}
      {showClose && (
        <button
          onClick={handleDecline}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white/70 hover:text-white"
        >
          <X className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      )}

      {/* Main Popup Box */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg sm:rounded-xl max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-2xl w-full p-3 sm:p-4 md:p-6 lg:p-6">
        <div className="text-center space-y-3 sm:space-y-4 md:space-y-5">
          {/* Heading Section */}
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
              Nighthub is <span className="text-[#ff2a5f]">adults only</span>!
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-300">
              This site contains adult content.
            </p>
          </div>

          {/* Information Text */}
          <div className="text-left text-gray-300 text-xs sm:text-sm md:text-base space-y-2 sm:space-y-3 md:space-y-4">
            <p>
              The content available on Nighthub may contain pornographic materials.
            </p>
            <p>
              Nighthub is strictly limited to those over 18 or of legal age in your jurisdiction, whichever is greater.
            </p>
            <p>
              One of our core goals is to help parents restrict access to Nighthub for minors, so we have ensured that Nighthub is, and remains, fully compliant with the RTA (Restricted to Adults) code. This means that all access to the site can be blocked by simple parental control tools. It is important that responsible parents and guardians take the necessary steps to prevent minors from accessing unsuitable content online, especially age-restricted content.
            </p>
            <p>
              Anyone with a minor in their household or under their supervision should implement basic parental control protections, including computer hardware and device settings, software installation, or ISP filtering services, to block your minors from accessing inappropriate content.
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-2 sm:space-y-3 pt-1">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-white">
              To enter, confirm you are 18 or older
            </h3>
            <button
              onClick={handleVerify}
              className="w-full py-2 sm:py-3 bg-[#ff2a5f] hover:bg-[#ff4a75] text-white text-sm sm:text-base md:text-lg font-bold rounded-lg sm:rounded-xl transition-all active:scale-98"
            >
              Yes, I'm 18 or older — Enter Nighthub
            </button>
          </div>

          {/* Bottom Link */}
          <div className="pt-2 sm:pt-3 border-t border-white/10">
            <button
              onClick={handleDecline}
              className="text-gray-400 hover:text-white underline text-xs sm:text-sm md:text-base"
            >
              I'm under 18 — Take me out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}