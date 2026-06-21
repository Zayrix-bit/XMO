import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Play, Clock, Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="aspect-video bg-[#121218] rounded-lg w-full animate-pulse"></div>
      <div className="h-4 bg-[#121218] rounded-md w-5/6 animate-pulse"></div>
      <div className="h-3 bg-[#121218] rounded-md w-1/3 animate-pulse"></div>
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
    <div className="pt-24 pb-20 px-6 max-w-[1600px] mx-auto w-full">
      {/* Header & Filters */}
      <div className="mb-10">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
            {(!searchParams.get('tab') || tab === 'trending') && 'Trending Now'}
            {tab === 'new' && 'New Releases'}
            {tab === 'categories' && 'Browse Categories'}
            {tab === 'countries' && 'Browse Countries'}
            {tab === 'search' && `Results for "${query}"`}
            {tab === 'category' && searchParams.get('slug')?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </h1>
          <p className="text-gray-500 text-sm md:text-base">
            {tab === 'categories' ? 'Explore all available categories' : 'Discover high-quality videos'}
          </p>
        </div>
      </div>

      {/* Limited Categories on Main Pages */}
      {tab !== 'categories' && allCategories.length > 0 && (
        <div className="mb-10">
          <h2 className="text-base md:text-lg font-semibold text-white mb-4">Popular Categories</h2>
          <div className="flex overflow-x-auto gap-2.5 md:flex-wrap pb-3 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden pr-1 md:pr-0">
            {allCategories.slice(0, 20).map((cat, i) => (
              <Link
                key={i}
                to={`/?tab=category&slug=${cat.slug}`}
                className="bg-[#121218] hover:bg-[#181822] px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-all border border-white/[0.06] whitespace-nowrap"
              >
                {cat.name}
              </Link>
            ))}
            {allCategories.length > 20 && (
              <Link
                to="/?tab=categories"
                className="bg-[#121218] hover:bg-[#181822] px-4 py-2.5 rounded-lg text-sm font-medium text-[#ff2a5f] hover:text-[#ff4a75] transition-all border border-white/[0.06] whitespace-nowrap flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {tab === 'categories' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {normalCategories.length === 0 ? (
            Array(24).fill(0).map((_, i) => <div key={i} className="aspect-[16/9] bg-[#121218] rounded-lg animate-pulse"></div>)
          ) : (
            normalCategories.map((cat, i) => (
              <Link 
                key={i} 
                to={`/?tab=category&slug=${cat.slug}`}
                className="relative aspect-[16/9] rounded-lg overflow-hidden group transition-all border border-white/[0.06]"
              >
                {cat.image ? (
                  <>
                    <img 
                      src={cat.image} 
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
                    <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-4">
                      <span className="font-semibold text-white text-sm md:text-base drop-shadow-md">
                        {cat.name}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[#121218] hover:bg-[#181822] transition-all"></div>
                    <div className="absolute inset-0 flex flex-col justify-center items-center p-3 md:p-4">
                      <span className="font-semibold text-white text-sm md:text-base text-center">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {loading ? (
            Array(24).fill(0).map((_, i) => <div key={i} className="aspect-[16/9] bg-[#121218] rounded-lg animate-pulse"></div>)
          ) : (
            countries.map((cat, i) => (
              <Link 
                key={i} 
                to={`/?tab=category&slug=${cat.slug}`}
                className="relative aspect-[16/9] rounded-lg overflow-hidden group transition-all border border-white/[0.06]"
              >
                {cat.image ? (
                  <>
                    <img 
                      src={cat.image} 
                      alt={cat.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
                    <div className="absolute inset-0 flex flex-col justify-end p-3 md:p-4">
                      <span className="font-semibold text-white text-sm md:text-base drop-shadow-md">
                        {cat.name}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[#121218] hover:bg-[#181822] transition-all"></div>
                    <div className="absolute inset-0 flex flex-col justify-center items-center p-3 md:p-4">
                      <span className="font-semibold text-white text-sm md:text-base text-center">
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
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {loading ? (
              Array(20).fill(0).map((_, i) => <SkeletonCard key={i} />)
            ) : videos.length > 0 ? (
              videos.map((video, index) => {
                const videoId = video.id || video.link.split('-').pop().replace('/', '');
                return (
                  <Link to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} key={index} className="group flex flex-col gap-2.5">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-[#121218]">
                      {video.image ? (
                        <img 
                          src={video.image} 
                          alt={video.title} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#121218] to-[#181822] flex items-center justify-center">
                          <Play className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#ff2a5f]/95 flex items-center justify-center shadow-lg">
                          <Play className="w-7 h-7 md:w-8 md:h-8 text-white ml-1" />
                        </div>
                      </div>
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs font-semibold text-white">
                          {video.duration}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm md:text-base font-medium text-gray-300 group-hover:text-white line-clamp-2 transition-colors leading-snug">
                        {video.title}
                      </h3>
                      {video.views && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Eye className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-xs text-gray-500">{video.views}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center h-80 text-center">
                <div className="w-20 h-20 rounded-full bg-[#121218] flex items-center justify-center mb-5">
                  <Search className="w-10 h-10 text-gray-500" />
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-white mb-3">No results found</h2>
                <p className="text-gray-500 text-sm md:text-base">Try adjusting your filters or search terms.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {!loading && videos.length > 0 && (
            <div className="mt-12 flex items-center justify-center gap-3">
              <button 
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#121218] border border-white/[0.06] text-white hover:bg-[#181822] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <div className="px-4 py-2.5 rounded-lg bg-[#121218] border border-white/[0.06] font-semibold text-sm md:text-base">
                Page {page}
              </div>
              <button 
                onClick={() => handlePageChange(page + 1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#ff2a5f] text-white hover:bg-[#ff4a75] transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
