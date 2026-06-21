import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Play, Clock, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="aspect-video bg-white/5 rounded-2xl w-full"></div>
      <div className="h-4 bg-white/5 rounded-lg w-3/4"></div>
      <div className="h-3 bg-white/5 rounded w-1/2"></div>
    </div>
  );
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q');
  const tab = searchParams.get('tab') || (query ? 'search' : 'trending');
  const page = parseInt(searchParams.get('page') || '1');
  
  // Debug log
  console.log("Home page debug - query:", query, "tab:", tab, "search params:", Object.fromEntries(searchParams.entries()));
  
  const [videos, setVideos] = useState([]);
  const [allCategoriesData, setAllCategoriesData] = useState([]);
  const [normalCategories, setNormalCategories] = useState([]);
  const [countries, setCountries] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all categories once
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/categories');
        setNormalCategories(res.data.categories || []);
        setCountries(res.data.countries || []);
        setAllCategories([...(res.data.categories || []), ...(res.data.countries || [])]);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    fetchCategories();
  }, []);

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
          // Only show categories, not countries on categories page
          setLoading(false);
          setVideos([]);
          return;
        } else {
          endpoint = `/api/trending?page=${page}`; // default
        }

        const response = await axios.get(`http://localhost:8000${endpoint}`);
        if (response.data.status === 'success') {
          setVideos(response.data.results);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [query, tab, page, searchParams, allCategories]);

  const handlePageChange = (newPage) => {
    if (newPage < 1) return;
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };



  return (
    <div className="pt-20 pb-24 px-4 md:px-8 lg:px-12 max-w-[1600px] mx-auto w-full">
      {/* Header & Filters */}
      <div className="mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-white mb-1.5 tracking-tight">
            {(!searchParams.get('tab') || tab === 'trending') && 'Trending Now'}
            {tab === 'new' && 'New Releases'}
            {tab === 'categories' && 'Browse Categories'}
            {tab === 'countries' && 'Browse Countries'}
            {tab === 'search' && `Results for "${query}"`}
            {tab === 'category' && searchParams.get('slug')?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </h1>
          <p className="text-gray-400 text-xs md:text-sm font-medium">Discover the best premium content in high quality.</p>
        </div>
      </div>

      {/* Limited Categories on Main Pages */}
      {tab !== 'categories' && allCategories.length > 0 && (
        <div className="mb-8 md:mb-12">
          <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-6 tracking-tight">
            Popular Categories
          </h2>
          <div className="flex overflow-x-auto gap-2 md:gap-3 md:flex-wrap pb-2 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden pr-4 md:pr-0">
            {allCategories.slice(0, 20).map((cat, i) => (
              <Link
                key={i}
                to={`/?tab=category&slug=${cat.slug}`}
                className="bg-[#1a1a20] hover:bg-[#ff2a5f] px-3.5 py-1.5 md:px-5 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold text-gray-300 hover:text-white transition-all duration-200 active:scale-95 shadow-sm hover:shadow-[0_0_15px_rgba(255,42,95,0.4)] border border-white/5 hover:border-transparent whitespace-nowrap"
              >
                {cat.name}
              </Link>
            ))}
            {allCategories.length > 20 && (
              <Link
                to="/?tab=categories"
                className="bg-[#1a1a20]/50 hover:bg-[#ff2a5f] px-3.5 py-1.5 md:px-5 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold text-[#ff2a5f] hover:text-white transition-all duration-200 active:scale-95 shadow-sm border border-dashed border-[#ff2a5f]/40 hover:border-transparent whitespace-nowrap flex items-center gap-1"
              >
                View All <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {tab === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
          {normalCategories.length === 0 ? (
            Array(24).fill(0).map((_, i) => <div key={i} className="aspect-[16/9] bg-white/5 rounded-md md:rounded-lg animate-pulse"></div>)
          ) : (
            normalCategories.map((cat, i) => (
              <Link 
                key={i} 
                to={`/?tab=category&slug=${cat.slug}`}
                className="relative aspect-[16/9] rounded-md md:rounded-lg overflow-hidden group transition-all"
              >
                {cat.image ? (
                  <>
                    {/* Image Background if exists */}
                    <img 
                      src={cat.image} 
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                    {/* Category Text Overlay - Bottom Left aligned */}
                    <div className="absolute inset-0 flex flex-col justify-end p-2 md:p-3">
                      <span className="font-bold text-white text-sm md:text-base drop-shadow-md">
                        {cat.name}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Solid background if no image */}
                    <div className="absolute inset-0 bg-[#1a1a20] hover:bg-[#ff2a5f]/20 border border-white/5 hover:border-[#ff2a5f]/40 transition-all"></div>
                    {/* Centered Category Text */}
                    <div className="absolute inset-0 flex flex-col justify-center items-center p-2 md:p-3">
                      <span className="font-bold text-white text-sm md:text-base text-center">
                        {cat.name}
                      </span>
                    </div>
                  </>
                )}
              </Link>
            ))
          )}
        </div>
      )}

      {/* Countries Grid */}
      {tab === 'countries' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
          {loading ? (
            Array(24).fill(0).map((_, i) => <div key={i} className="aspect-[16/9] bg-white/5 rounded-md md:rounded-lg animate-pulse"></div>)
          ) : (
            countries.map((cat, i) => (
              <Link 
                key={i} 
                to={`/?tab=category&slug=${cat.slug}`}
                className="relative aspect-[16/9] rounded-md md:rounded-lg overflow-hidden group transition-all"
              >
                {cat.image ? (
                  <>
                    {/* Image Background if exists */}
                    <img 
                      src={cat.image} 
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                    {/* Category Text Overlay - Bottom Left aligned */}
                    <div className="absolute inset-0 flex flex-col justify-end p-2 md:p-3">
                      <span className="font-bold text-white text-sm md:text-base drop-shadow-md">
                        {cat.name}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Solid background if no image */}
                    <div className="absolute inset-0 bg-[#1a1a20] hover:bg-[#ff2a5f]/20 border border-white/5 hover:border-[#ff2a5f]/40 transition-all"></div>
                    {/* Centered Category Text */}
                    <div className="absolute inset-0 flex flex-col justify-center items-center p-2 md:p-3">
                      <span className="font-bold text-white text-sm md:text-base text-center">
                        {cat.name}
                      </span>
                    </div>
                  </>
                )}
              </Link>
            ))
          )}
        </div>
      )}

      {/* Videos Grid */}
      {tab !== 'categories' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {loading ? (
              Array(15).fill(0).map((_, i) => <SkeletonCard key={i} />)
            ) : videos.length > 0 ? (
              videos.map((video, index) => {
                const videoId = video.id || video.link.split('-').pop().replace('/', '');
                return (
                  <Link to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} key={index} className="group flex flex-col gap-3 active:scale-[0.98]">
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-white/5 shadow-lg shadow-black/20">
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
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#ff2a5f] flex items-center justify-center shadow-[0_0_20px_rgba(255,42,95,0.6)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                          <Play className="w-5 h-5 md:w-6 md:h-6 text-white ml-0.5" />
                        </div>
                      </div>
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-semibold text-white flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#ff2a5f]" /> {video.duration}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm md:text-base font-medium text-gray-200 group-hover:text-white line-clamp-2 transition-colors">
                        {video.title}
                      </h3>
                      {video.views && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs text-gray-500">{video.views}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center h-72 text-center">
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
                  <Search className="w-10 h-10 text-gray-500" />
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-3">No results found</h2>
                <p className="text-gray-400 text-sm md:text-base">Try adjusting your filters or search terms.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && videos.length > 0 && (
            <div className="mt-14 flex items-center justify-center gap-4">
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-3 md:p-3.5 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              <div className="px-7 py-3 rounded-2xl bg-white/5 border border-white/10 font-semibold text-base md:text-lg">
                Page {page}
              </div>
              <button 
                onClick={() => handlePageChange(page + 1)}
                className="p-3 md:p-3.5 rounded-2xl bg-[#ff2a5f]/20 border border-[#ff2a5f]/50 text-[#ff2a5f] hover:bg-[#ff2a5f]/30 transition-all active:scale-95"
              >
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
