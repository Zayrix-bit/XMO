import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Search, Flame, X, Menu } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const [search, setSearch] = useState('');
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
      setMobileMenu(false);
    }
  };

  const goHome = () => {
    navigate('/', { replace: true });
    setMobileMenu(false);
  };

  const setTab = (tab) => {
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
    <nav className="fixed top-0 left-0 w-full z-50 bg-[#121218] h-[64px] border-b border-[#2a2a35] shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4 sm:gap-8">
        
        {/* Logo */}
        <button onClick={goHome} className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded bg-[#ff2a5f] flex items-center justify-center shadow-sm">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight text-white hidden sm:block">
            HOT<span className="text-[#ff2a5f]">STER</span>
          </span>
        </button>

        {/* Search Bar (Always visible) */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl relative mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search videos..." 
              className="w-full bg-[#1a1a24] border border-[#2a2a35] rounded py-2 pl-9 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-[#ff2a5f] transition-colors text-sm"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {/* Desktop Links (Visible on desktop) */}
          <div className="hidden md:flex items-center gap-1">
            <button onClick={goHome} className={`px-3 py-2 rounded text-sm font-medium transition-colors ${!activeTab ? 'text-white bg-[#2a2a35]' : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'}`}>
              Home
            </button>
            <button onClick={() => setTab('trending')} className={`px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'trending' ? 'text-white bg-[#2a2a35]' : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'}`}>
              <Flame className="w-4 h-4" /> Trending
            </button>
            <button onClick={() => setTab('new')} className={`px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'new' ? 'text-white bg-[#2a2a35]' : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'}`}>
              New
            </button>
            <button onClick={() => setTab('categories')} className={`px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'categories' ? 'text-white bg-[#2a2a35]' : 'text-gray-400 hover:text-white hover:bg-[#1a1a24]'}`}>
              Categories
            </button>
          </div>



          {/* Mobile Menu Toggle (Visible on tablets and phones) */}
          <button 
            onClick={() => { setMobileMenu(!mobileMenu); }} 
            className="md:hidden text-gray-400 hover:text-white p-2 rounded hover:bg-[#1a1a24]"
          >
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>



      {/* Mobile Menu Dropdown */}
      {mobileMenu && (
        <div className="md:hidden absolute top-[64px] left-0 w-full bg-[#121218] border-b border-[#2a2a35] px-4 py-2 shadow-lg">
          <div className="flex flex-col gap-1">
            <button onClick={goHome} className={`text-left px-4 py-3 rounded transition-colors ${!activeTab ? 'bg-[#2a2a35] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24]'}`}>
              Home
            </button>
            <button onClick={() => setTab('trending')} className={`text-left px-4 py-3 rounded transition-colors flex items-center gap-2 ${activeTab === 'trending' ? 'bg-[#2a2a35] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24]'}`}>
              <Flame className="w-4 h-4" /> Trending
            </button>
            <button onClick={() => setTab('new')} className={`text-left px-4 py-3 rounded transition-colors ${activeTab === 'new' ? 'bg-[#2a2a35] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24]'}`}>
              New
            </button>
            <button onClick={() => setTab('categories')} className={`text-left px-4 py-3 rounded transition-colors ${activeTab === 'categories' ? 'bg-[#2a2a35] text-white font-medium' : 'text-gray-400 hover:bg-[#1a1a24]'}`}>
              Categories
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
