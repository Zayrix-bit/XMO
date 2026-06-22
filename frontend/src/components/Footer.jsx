import { Flame, Search } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCategories } from '../context/CategoriesContext';

export default function Footer() {
  const { categories, loading } = useCategories();
  
  const groupedCategories = useMemo(() => {
    const grouped = {};
    categories.forEach(cat => {
      const firstLetter = cat.name.charAt(0).toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(cat);
    });
    return grouped;
  }, [categories]);

  // Get sorted letters
  const sortedLetters = Object.keys(groupedCategories).sort();

  return (
    <footer className="bg-[#0a0a0f] border-t border-white/[0.06] mt-24">
      {/* Category Index Section (A-Z) */}
      {sortedLetters.length > 0 && (
        <div className="border-b border-white/[0.06] py-12">
          <div className="max-w-[1600px] mx-auto px-6">
            <h3 className="text-base font-semibold text-white mb-6">All Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {sortedLetters.map(letter => (
                <div key={letter} className="space-y-2">
                  <div className="text-sm font-semibold text-white">
                    {letter}
                  </div>
                  <ul className="space-y-1.5">
                    {groupedCategories[letter].slice(0, 5).map((cat, i) => (
                      <li key={i}>
                        <Link 
                          to={`/?tab=category&slug=${cat.slug}`}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors block"
                        >
                          {cat.name}
                        </Link>
                      </li>
                    ))}
                    {groupedCategories[letter].length > 5 && (
                      <li>
                        <Link 
                          to="/?tab=categories"
                          className="text-xs text-[#ff2a5f] font-medium hover:text-[#ff4a75] transition-colors"
                        >
                          View All
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
      
      <div className="max-w-[1600px] mx-auto px-6 py-12">
        {/* Top Grid of Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10 pb-10 border-b border-white/[0.06]">
          {/* Column 1: Brand & Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ff2a5f] flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                NIGHT<span className="text-[#ff2a5f]">HUB</span>
              </span>
            </div>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="hover:text-white cursor-pointer transition-colors">Press</li>
              <li className="hover:text-white cursor-pointer transition-colors">Blog</li>
              <li className="hover:text-white cursor-pointer transition-colors">Creator's Blog</li>
              <li className="hover:text-white cursor-pointer transition-colors">Advertising</li>
            </ul>
          </div>

          {/* Column 2: Help */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Help</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="hover:text-white cursor-pointer transition-colors">FAQ</li>
              <li className="hover:text-white cursor-pointer transition-colors">Contact us</li>
              <li className="hover:text-white cursor-pointer transition-colors">Content Removal</li>
              <li className="hover:text-white cursor-pointer transition-colors">Improve NightHub</li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="hover:text-white cursor-pointer transition-colors">Terms of use</li>
              <li className="hover:text-white cursor-pointer transition-colors">Privacy policy</li>
              <li className="hover:text-white cursor-pointer transition-colors">Cookies policy</li>
              <li className="hover:text-white cursor-pointer transition-colors">DMCA/Copyright</li>
              <li className="hover:text-white cursor-pointer transition-colors">Parental Controls</li>
            </ul>
          </div>

          {/* Column 4: Make Money */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Start making money</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li className="hover:text-white cursor-pointer transition-colors">Camgirls Wanted</li>
                <li className="hover:text-white cursor-pointer transition-colors">Creator Contest</li>
                <li className="hover:text-white cursor-pointer transition-colors">Content Creators Program</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom copyright segment */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-10 text-xs text-gray-500">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <span>&copy; 2026 NIGHTHUB.com</span>
          </div>
          
          <div className="text-center max-w-md lg:text-left">
            18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement
          </div>
        </div>
      </div>
    </footer>
  );
}
