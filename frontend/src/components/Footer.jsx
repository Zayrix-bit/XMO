import { Flame } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0e] border-t border-white/5 mt-20">
      <div className="max-w-[1600px] mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff2a5f] to-[#ff7e40] flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">
              NIGHT<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff2a5f] to-[#ff7e40]">HUB</span>
            </span>
          </div>
          <p className="text-gray-500 text-xs text-center">
            &copy; {new Date().getFullYear()} NIGHTHUB. All content is scraped from third-party sources. For educational purposes only.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="hover:text-white cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-white cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-white cursor-pointer transition-colors">DMCA</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
