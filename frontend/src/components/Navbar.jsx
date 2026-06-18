import { Link, useNavigate } from 'react-router-dom';
import { Search, Flame } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#0f0f13]/90 backdrop-blur-md border-b border-white/5 h-[70px]">
      <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff2a5f] to-[#ff7e40] flex items-center justify-center shadow-[0_0_15px_rgba(255,42,95,0.4)] group-hover:shadow-[0_0_25px_rgba(255,42,95,0.6)] transition-all">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight">
            NIGHT<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff2a5f] to-[#ff7e40]">HUB</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-8 relative hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for amazing content..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-6 text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a5f]/50 focus:bg-white/10 transition-all"
            />
          </div>
        </form>

        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">HOME</Link>
          <Link to="/?q=trending" className="text-sm font-semibold text-[#ff2a5f] hover:text-[#ff7e40] transition-colors flex items-center gap-1">
            <Flame className="w-4 h-4" /> TRENDING
          </Link>
        </div>
      </div>
    </nav>
  );
}
