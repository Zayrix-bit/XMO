import { Link, useNavigate } from 'react-router-dom';
import { Search, Flame, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [search, setSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`);
      setMobileSearch(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#0f0f13]/90 backdrop-blur-md border-b border-white/5 h-[70px]">
      <div className="max-w-[1600px] mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff2a5f] to-[#ff7e40] flex items-center justify-center shadow-[0_0_15px_rgba(255,42,95,0.4)] group-hover:shadow-[0_0_25px_rgba(255,42,95,0.6)] transition-all">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight hidden sm:inline">
            NIGHT<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff2a5f] to-[#ff7e40]">HUB</span>
          </span>
        </Link>

        {/* Desktop Search */}
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

        <div className="flex items-center gap-3">
          {/* Mobile Search Toggle */}
          <button onClick={() => setMobileSearch(!mobileSearch)} className="md:hidden text-gray-400 hover:text-white p-2">
            {mobileSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
          <Link to="/" className="text-xs font-bold text-gray-300 hover:text-white transition-colors tracking-wider">HOME</Link>
          <Link to="/?tab=trending" className="text-xs font-bold text-[#ff2a5f] hover:text-[#ff7e40] transition-colors flex items-center gap-1 tracking-wider">
            <Flame className="w-3.5 h-3.5" /> TRENDING
          </Link>
          <Link to="/?tab=new" className="text-xs font-bold text-gray-300 hover:text-white transition-colors tracking-wider hidden sm:inline">NEW</Link>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {mobileSearch && (
        <div className="md:hidden bg-[#0f0f13] border-b border-white/5 px-4 py-3 animate-in slide-in-from-top duration-200">
          <form onSubmit={handleSearch} className="flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-white outline-none w-full placeholder-gray-500 text-sm"
              autoFocus
            />
          </form>
        </div>
      )}
    </nav>
  );
}
