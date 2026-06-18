import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Play, Clock, Search, Flame, Sparkles, FolderHeart, ChevronLeft, ChevronRight } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="aspect-video bg-white/5 rounded-xl w-full"></div>
      <div className="h-4 bg-white/5 rounded w-3/4"></div>
      <div className="h-3 bg-white/5 rounded w-1/2"></div>
    </div>
  );
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q');
  const tab = searchParams.get('tab') || (query ? 'search' : 'trending');
  const page = parseInt(searchParams.get('page') || '1');
  
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
        let endpoint = '';
        if (tab === 'search' && query) {
          endpoint = `/api/search?q=${encodeURIComponent(query)}&page=${page}`;
        } else if (tab === 'trending') {
          endpoint = `/api/trending?page=${page}`;
        } else if (tab === 'new') {
          endpoint = `/api/newest?page=${page}`;
        } else if (tab === 'category') {
          const slug = searchParams.get('slug');
          endpoint = `/api/category/${slug}?page=${page}`;
        } else if (tab === 'categories') {
          endpoint = '/api/categories';
        } else {
          endpoint = `/api/trending?page=${page}`; // default
        }

        const response = await axios.get(`http://localhost:8000${endpoint}`);
        if (response.data.status === 'success') {
          if (tab === 'categories') {
            setCategories(response.data.categories);
            setVideos([]);
          } else {
            setVideos(response.data.results);
            setCategories([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [query, tab, page, searchParams]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const setTab = (newTab) => {
    setSearchParams({ tab: newTab, page: '1' });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 pb-20">
      {/* Header & Filters */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            {tab === 'trending' && <><Flame className="text-[#ff2a5f]" /> Trending Now</>}
            {tab === 'new' && <><Sparkles className="text-blue-400" /> New Releases</>}
            {tab === 'categories' && <><FolderHeart className="text-purple-400" /> Browse Categories</>}
            {tab === 'search' && <><Search className="text-gray-400" /> Results for "{query}"</>}
            {tab === 'category' && <><FolderHeart className="text-[#ff2a5f]" /> Category: {searchParams.get('slug')}</>}
          </h1>
          <p className="text-gray-400">Discover the best premium content in high quality.</p>
        </div>

        {/* Tab Selector */}
        {!query && tab !== 'category' && (
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
            <button 
              onClick={() => setTab('trending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'trending' ? 'bg-[#ff2a5f] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Trending
            </button>
            <button 
              onClick={() => setTab('new')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'new' ? 'bg-[#ff2a5f] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Newest
            </button>
            <button 
              onClick={() => setTab('categories')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'categories' ? 'bg-[#ff2a5f] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Categories
            </button>
          </div>
        )}
      </div>

      {/* Categories Grid */}
      {tab === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {loading ? (
            Array(24).fill(0).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse"></div>)
          ) : (
            categories.map((cat, i) => (
              <Link 
                key={i} 
                to={`/?tab=category&slug=${cat.slug}`}
                className="bg-white/5 hover:bg-[#ff2a5f]/20 border border-white/10 hover:border-[#ff2a5f]/50 p-4 rounded-xl flex items-center justify-center text-center transition-all group"
              >
                <span className="font-medium text-gray-300 group-hover:text-white text-sm">{cat.name}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Videos Grid */}
      {tab !== 'categories' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {loading ? (
              Array(15).fill(0).map((_, i) => <SkeletonCard key={i} />)
            ) : videos.length > 0 ? (
              videos.map((video, index) => {
                const videoId = video.id || video.link.split('-').pop().replace('/', '');
                return (
                  <Link to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} key={index} className="group flex flex-col gap-3">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                      {video.image ? (
                        <img 
                          src={video.image} 
                          alt={video.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center">
                          <Play className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-[#ff2a5f] flex items-center justify-center shadow-[0_0_20px_rgba(255,42,95,0.6)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                          <Play className="w-5 h-5 text-white ml-1" />
                        </div>
                      </div>
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#ff2a5f]" /> {video.duration}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-200 group-hover:text-white line-clamp-2 transition-colors">
                        {video.title}
                      </h3>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-gray-500" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">No results found</h2>
                <p className="text-gray-400">Try adjusting your filters or search terms.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && videos.length > 0 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 font-medium">
                Page {page}
              </div>
              <button 
                onClick={() => handlePageChange(page + 1)}
                className="p-3 rounded-xl bg-[#ff2a5f]/20 border border-[#ff2a5f]/50 text-[#ff2a5f] hover:bg-[#ff2a5f]/30 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
