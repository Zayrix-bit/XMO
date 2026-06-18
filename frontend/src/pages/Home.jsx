import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Play, Clock, Loader2, Search } from 'lucide-react';

export default function Home() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || 'anime';
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`http://localhost:8000/api/search?q=${encodeURIComponent(query)}`);
        if (response.data.status === 'success') {
          setVideos(response.data.results);
        }
      } catch (error) {
        console.error("Failed to fetch videos:", error);
      }
      setLoading(false);
    };
    
    fetchVideos();
  }, [query]);

  return (
    <div className="p-6 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {query === 'anime' ? 'Recommended for you' : `Results for "${query}"`}
        </h1>
        <p className="text-gray-400">Discover the best content in high quality.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-12 h-12 text-[#ff2a5f] animate-spin" />
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {videos.map((video, index) => {
            // Extract ID for the watch page
            const videoId = video.link.split('-').pop().replace('/', '');
            
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
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No results found</h2>
          <p className="text-gray-400">Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
}
