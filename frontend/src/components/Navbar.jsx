import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Flame, X, Menu, Sparkles, FolderHeart } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [search, setSearch] = useState('');
  const [mobileSearch, setMobileSearch] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      const params = new URLSearchParams();
      params.set('tab', 'search');
      params.set('q', search.trim());
      params.set('page', '1');
      navigate(`/?${params.toString()}`, { replace: true });
      setMobileSearch(false);
      setMobileMenu(false);
    }
  };

  const goHome = () => {
    navigate('/', { replace: true });
    setMobileMenu(false);
  };

  const setTab = (tab) => {
    // If we're not on home, go to home first
    if (location.pathname !== '/') {
      navigate(`/?tab=${tab}&page=1`, { replace: true });
    } else {
      const params = new URLSearchParams();
      params.set('tab', tab);
      params.set('page', '1');
      setSearchParams(params);
    }
    setMobileMenu(false);
  };

  const activeTab = searchParams.get('tab');

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.08] h-[64px]">
      <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between gap-8">
        <button onClick={goHome} className="flex items-center gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-lg bg-[#ff2a5f] flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight hidden sm:inline">
            HOT<span className="text-[#ff2a5f]">STER</span>
          </span>
        </button>

        {/* Desktop Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos..." 
              className="w-full bg-[#121218] border border-white/[0.08] rounded-full py-2.5 pl-12 pr-6 text-white placeholder-gray-500 focus:outline-none focus:border-[#ff2a5f]/50 focus:bg-[#14141c] transition-all text-sm"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1.5">
            <button onClick={goHome} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${!activeTab ? 'text-white bg-white/[0.08]' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
              Home
            </button>
            <button onClick={() => setTab('trending')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 ${activeTab === 'trending' ? 'text-white bg-white/[0.08]' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
              <Flame className="w-4 h-4" /> Trending
            </button>
            <button onClick={() => setTab('new')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab === 'new' ? 'text-white bg-white/[0.08]' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
              New
            </button>
            <button onClick={() => setTab('categories')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${activeTab === 'categories' ? 'text-white bg-white/[0.08]' : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'}`}>
              Categories
            </button>
          </div>

          {/* Mobile Search Toggle */}
          <button 
            onClick={() => { setMobileSearch(!mobileSearch); setMobileMenu(false); }} 
            className="md:hidden text-gray-400 hover:text-white p-2 rounded-lg transition-all hover:bg-white/[0.05]"
          >
            {mobileSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => { setMobileMenu(!mobileMenu); setMobileSearch(false); }} 
            className="md:hidden text-gray-400 hover:text-white p-2 rounded-lg transition-all hover:bg-white/[0.05]"
          >
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {mobileSearch && (
        <div className="md:hidden bg-[#0a0a0f] border-b border-white/[0.08] px-6 py-3">
          <form onSubmit={handleSearch} className="flex items-center bg-[#121218] border border-white/[0.08] rounded-lg px-4 py-2.5">
            <Search className="w-4 h-4 text-gray-500 mr-3" />
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

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="md:hidden absolute top-[64px] left-0 w-full bg-[#0a0a0f] border-b border-white/[0.08] px-6 py-4 shadow-2xl shadow-black/50">
          <div className="flex flex-col gap-1">
            <button 
              onClick={goHome} 
              className={`text-left px-4 py-2.5 rounded-lg transition-all ${!activeTab ? 'bg-white/[0.08] text-white font-semibold' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
            >
              Home
            </button>
            <button 
              onClick={() => setTab('trending')} 
              className={`text-left px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 ${activeTab === 'trending' ? 'bg-white/[0.08] text-white font-semibold' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
            >
              <Flame className="w-4 h-4" /> Trending
            </button>
            <button 
              onClick={() => setTab('new')} 
              className={`text-left px-4 py-2.5 rounded-lg transition-all ${activeTab === 'new' ? 'bg-white/[0.08] text-white font-semibold' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
            >
              New
            </button>
            <button 
              onClick={() => setTab('categories')} 
              className={`text-left px-4 py-2.5 rounded-lg transition-all ${activeTab === 'categories' ? 'bg-white/[0.08] text-white font-semibold' : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'}`}
            >
              Categories
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
