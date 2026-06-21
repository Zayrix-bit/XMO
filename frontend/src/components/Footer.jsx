import { Flame, Globe, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [categories, setCategories] = useState([]);
  const [groupedCategories, setGroupedCategories] = useState({});

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/categories');
        const cats = res.data.categories || [];
        const countries = res.data.countries || [];
        const combined = [...cats, ...countries];
        setCategories(combined);
        
        // Group categories by first letter
        const grouped = {};
        combined.forEach(cat => {
          const firstLetter = cat.name.charAt(0).toUpperCase();
          if (!grouped[firstLetter]) {
            grouped[firstLetter] = [];
          }
          grouped[firstLetter].push(cat);
        });
        setGroupedCategories(grouped);
      } catch (err) {
        console.error("Error fetching categories for footer:", err);
      }
    };
    fetchCategories();
  }, []);

  // Get sorted letters
  const sortedLetters = Object.keys(groupedCategories).sort();

  return (
    <footer className="bg-[#0b0b0f] border-t border-white/10 mt-28">
      {/* Category Index Section (A-Z) */}
      {sortedLetters.length > 0 && (
        <div className="border-b border-white/5 py-10">
          <div className="max-w-[1600px] mx-auto px-6 md:px-12">
            <div className="flex items-center gap-3 mb-8">
              <Search className="w-5 h-5 text-[#ff2a5f]" />
              <h3 className="text-lg font-bold text-white">All other categories</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
              {sortedLetters.slice(0, 18).map(letter => (
                <div key={letter} className="space-y-3">
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[#ff2a5f] text-xs font-black">
                      {letter}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {groupedCategories[letter].slice(0, 5).map((cat, i) => (
                      <li key={i}>
                        <Link 
                          to={`/?tab=category&slug=${cat.slug}`}
                          className="text-xs text-gray-500 hover:text-white transition-colors block"
                        >
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                    {groupedCategories[letter].length > 5 && (
                      <li>
                        <Link 
                          to="/?tab=categories"
                          className="text-xs text-[#ff2a5f] font-semibold hover:text-[#ff7e40] transition-colors"
                        >
                          View All &rsaquo;
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        {/* Top Grid of Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 pb-12 border-b border-white/5">
          {/* Column 1: Brand & Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff2a5f] to-[#ff7e40] flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-black tracking-tight">
                NIGHT<span className="text-[#ff2a5f]">HUB</span>
              </span>
            </div>
            <ul className="space-y-2 text-sm text-gray-500 font-medium">
              <li className="hover:text-white cursor-pointer transition-colors">Press</li>
              <li className="hover:text-white cursor-pointer transition-colors">Blog</li>
              <li className="hover:text-white cursor-pointer transition-colors">Creator's Blog</li>
              <li className="hover:text-white cursor-pointer transition-colors">Advertising</li>
              <li className="hover:text-white cursor-pointer transition-colors">NightHub Awards 2026</li>
            </ul>
          </div>

          {/* Column 2: Help */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Help</h4>
            <ul className="space-y-2 text-sm text-gray-500 font-medium">
              <li className="hover:text-white cursor-pointer transition-colors">FAQ</li>
              <li className="hover:text-white cursor-pointer transition-colors">Contact us</li>
              <li className="hover:text-white cursor-pointer transition-colors">Content Removal</li>
              <li className="hover:text-white cursor-pointer transition-colors">Improve NightHub</li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500 font-medium">
              <li className="hover:text-white cursor-pointer transition-colors">Terms of use</li>
              <li className="hover:text-white cursor-pointer transition-colors">Privacy policy</li>
              <li className="hover:text-white cursor-pointer transition-colors">Cookies policy</li>
              <li className="hover:text-white cursor-pointer transition-colors">DMCA/Copyright</li>
              <li className="hover:text-white cursor-pointer transition-colors">Parental Controls</li>
              <li className="hover:text-white cursor-pointer transition-colors">EU DSA</li>
              <li className="hover:text-white cursor-pointer transition-colors">Trust and Safety</li>
            </ul>
          </div>

          {/* Column 4: Make Money */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Start making money</h4>
              <ul className="space-y-2 text-sm text-gray-500 font-medium">
                <li className="hover:text-white cursor-pointer transition-colors">Camgirls Wanted</li>
                <li className="hover:text-white cursor-pointer transition-colors">Creator Contest</li>
                <li className="hover:text-white cursor-pointer transition-colors">Content Creators Program</li>
              </ul>
            </div>
            
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-white uppercase tracking-wider">Monetize content</h5>
              <div className="flex items-center gap-3">
                <button className="bg-gradient-to-r from-[#ff2a5f] to-[#ff7e40] hover:brightness-110 text-white font-bold text-xs px-4 py-2.5 rounded-full shadow-lg hover:shadow-[#ff2a5f]/25 transition-all">
                  Become a creator
                </button>
                {/* Profile Avatars */}
                <div className="flex -space-x-2.5">
                  <img className="w-7 h-7 rounded-full border border-black object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&auto=format" alt="User 1" />
                  <img className="w-7 h-7 rounded-full border border-black object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&auto=format" alt="User 2" />
                  <img className="w-7 h-7 rounded-full border border-black object-cover" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&fit=crop&auto=format" alt="User 3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright segment */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-10 text-xs text-gray-500">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span>&copy; 2007 - 2026 NIGHTHUB.com</span>
            <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-1.5 rounded-xl transition-all font-semibold flex items-center gap-1.5 active:scale-95">
              <Globe className="w-3.5 h-3.5" /> Mobile Version
            </button>
          </div>
          
          <div className="text-center max-w-md lg:text-left leading-relaxed">
            18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement
            <div className="mt-1 font-semibold text-[10px] text-gray-600">Restricted to Adults (RTA) Website Registered</div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>
            <button className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.42 4.814c-.23.861-.907 1.538-1.768 1.768C18.254 19 12 19 12 19s-6.254 0-7.812-.418c-.861-.23-1.538-.907-1.768-1.768C2 15.254 2 12 2 12s0-3.255.42-4.814c.23-.861.907-1.538 1.768-1.768C5.746 5 12 5 12 5s6.254 0 7.812.418ZM9.75 15.002l6-3.002-6-3.002v6Z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="border border-red-500/30 text-red-500 font-black px-3 py-1.5 rounded text-[10px] tracking-wider bg-red-500/5 select-none uppercase">
              RTA
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
