
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import { ArrowLeft, Heart, Clock, Play, Eye, User } from 'lucide-react';

export default function Creator() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [creatorData, setCreatorData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCreator = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/api/creator/${slug}?page=${page}`);
        if (response.data.status === 'success') {
          setCreatorData(response.data.creator);
          if (page === 1) {
            setVideos(response.data.videos);
          } else {
            setVideos(prev => [...prev, ...response.data.videos]);
          }
        }
      } catch (err) {
        console.error("Creator fetch error:", err);
        setError('Failed to load creator');
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchCreator();
    }
  }, [slug, page]);

  if (loading && !creatorData) {
    return (
      <div className="pt-24 pb-28 px-6 max-w-[1600px] mx-auto w-full">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-semibold"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back
        </button>
        <div className="animate-pulse">
          <div className="h-40 bg-gray-800 rounded-xl mb-6"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-xl aspect-video"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-24 pb-28 px-6 max-w-[1600px] mx-auto w-full">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-semibold"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back
        </button>
        <div className="text-center py-12 text-gray-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{creatorData ? `${creatorData.name || slug} | Watch Free Videos - Nighthub` : 'Creator - Nighthub'}</title>
        <meta name="description" content={creatorData ? `Watch all videos by ${creatorData.name || slug} in HD quality on Nighthub. Free streaming with no interruptions.` : 'Browse creators on Nighthub.'} />
        <meta name="keywords" content={creatorData ? `${creatorData.name || slug}, free videos, creator, HD streaming` : 'creators, free videos, watch online'} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={creatorData ? `${creatorData.name || slug} | Watch Free Videos - Nighthub` : 'Creator - Nighthub'} />
        <meta property="og:description" content={creatorData ? `Watch all videos by ${creatorData.name || slug} in HD quality on Nighthub. Free streaming with no interruptions.` : 'Browse creators on Nighthub.'} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:site_name" content="Nighthub" />
        {creatorData?.avatar && (
          <meta property="og:image" content={creatorData.avatar} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={creatorData ? `${creatorData.name || slug} | Watch Free Videos - Nighthub` : 'Creator - Nighthub'} />
        <meta name="twitter:description" content={creatorData ? `Watch all videos by ${creatorData.name || slug} in HD quality on Nighthub. Free streaming with no interruptions.` : 'Browse creators on Nighthub.'} />
        {creatorData?.avatar && (
          <meta name="twitter:image" content={creatorData.avatar} />
        )}
      </Helmet>
      <div className="pt-24 pb-28 px-6 max-w-[1600px] mx-auto w-full">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-semibold"
      >
        <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back
      </button>

      <div className="bg-[#121218] rounded-2xl p-6 md:p-8 border border-white/5 mb-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {creatorData?.avatar ? (
            <img
              src={creatorData.avatar}
              alt={creatorData?.name || slug}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-2 border-white/10"
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/10">
              <User className="w-10 h-10 md:w-14 md:h-14 text-white/70" />
            </div>
          )}
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {creatorData?.name || slug}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-gray-400 text-sm md:text-base">
              {creatorData?.videoCount && (
                <div>
                  <span className="font-bold text-white">{creatorData.videoCount}</span> Videos
                </div>
              )}
              {creatorData?.viewsCount && (
                <div>
                  <span className="font-bold text-white">{creatorData.viewsCount}</span> Views
                </div>
              )}
              {creatorData?.subscribers && (
                <div>
                  <span className="font-bold text-white">{creatorData.subscribers}</span> Subscribers
                </div>
              )}
              {creatorData?.translatedCountryName && (
                <div>{creatorData.translatedCountryName}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
        {videos.map((video, index) => {
          const videoId = video.id || video.link.split('-').pop().replace('/', '');
          return (
            <Link
              to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`}
              key={index}
              className="group bg-[#121218] rounded-xl border border-white/5 hover:border-[#ff2a5f]/30 transition-all duration-200 overflow-hidden active:scale-95"
            >
              <div className="relative aspect-video">
                {video.image && (
                  <img
                    src={video.image}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#ff2a5f] flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300">
                    <Play className="w-4 h-4 text-white ml-1" />
                  </div>
                </div>
                {video.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md px-2 py-1 rounded text-xs font-semibold text-white flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#ff2a5f]" /> {video.duration}
                  </div>
                )}
              </div>
              <div className="p-3 md:p-4">
                <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white line-clamp-2 transition-colors mb-1">
                  {video.title}
                </h3>
                {video.views && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Eye className="w-3 h-3" />
                    {video.views}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {videos.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setPage(p => p + 1)}
            className="bg-white/5 hover:bg-[#ff2a5f]/20 border border-white/10 hover:border-[#ff2a5f]/50 py-3 px-8 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            Load More
          </button>
        </div>
      )}
      </div>
    </>
  );
}
