import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import Hls from 'hls.js';
import { ArrowLeft, Heart, Share2, AlertCircle, Settings, Check, Play, Clock, ChevronDown, ChevronUp } from 'lucide-react';

function SkeletonVideo() {
  return (
    <div className="w-full aspect-video bg-white/5 rounded-2xl animate-pulse"></div>
  );
}

export default function Watch() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);

  const originalUrl = searchParams.get('url') || '';
  const hasStream = videoData && (videoData.hls_proxy_url || videoData.proxy_url);
  const relatedVideos = videoData?.related || [];

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
        const targetUrl = originalUrl || `https://xhamster.com/videos/video-${id}`;
        const response = await axios.get(`http://localhost:8000/api/video?url=${encodeURIComponent(targetUrl)}`);
        
        if (response.data.status === 'success') {
          setVideoData(response.data);
        } else {
          setError('Failed to load video stream');
        }
      } catch (err) {
        console.error("Video fetch error:", err);
        setError('Network error while connecting to server');
      }
      setLoading(false);
    };

    if (id) fetchVideo();
  }, [id, originalUrl]);

  // Setup HLS.js or fallback to MP4
  useEffect(() => {
    if (!videoData || !videoRef.current) return;

    const video = videoRef.current;
    const hlsUrl = videoData.hls_proxy_url ? `http://localhost:8000${videoData.hls_proxy_url}` : null;
    const mp4Url = videoData.proxy_url ? `http://localhost:8000${videoData.proxy_url}` : null;

    // Function to handle video end
    const handleVideoEnd = () => {
      if (relatedVideos.length > 0) {
        const nextVideo = relatedVideos[0];
        const nextVideoId = nextVideo.id || nextVideo.link.split('-').pop().replace('/', '');
        navigate(`/watch/${nextVideoId}?url=${encodeURIComponent(nextVideo.link)}`);
      }
    };

    video.addEventListener('ended', handleVideoEnd);

    // Try HLS first
    if (hlsUrl && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels.map((level, index) => ({
          index,
          height: level.height,
          label: `${level.height}p`,
        }));
        setQualities(levels);
        setCurrentQuality(-1); // auto
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          if (mp4Url) {
            video.src = mp4Url;
            video.play().catch(() => {});
          }
        }
      });

      return () => {
        video.removeEventListener('ended', handleVideoEnd);
        hls.destroy();
        hlsRef.current = null;
      };
    } 
    // Fallback: direct MP4
    else if (mp4Url) {
      video.src = mp4Url;
      video.play().catch(() => {});
      return () => {
        video.removeEventListener('ended', handleVideoEnd);
      };
    }
    return () => {
      video.removeEventListener('ended', handleVideoEnd);
    };
  }, [videoData, relatedVideos, navigate]);

  const switchQuality = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  };

  return (
    <div className="pt-24 pb-28 px-4 md:px-8 lg:px-12 max-w-[1600px] mx-auto w-full">
      <div className="w-full">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-semibold active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back
        </button>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Skeleton Column */}
            <div className="lg:col-span-2 space-y-6">
              <SkeletonVideo />
              <div className="h-32 bg-white/5 rounded-2xl animate-pulse"></div>
            </div>
            {/* Right Skeleton Column */}
            <div className="lg:col-span-1 space-y-4">
              <div className="h-7 bg-white/5 rounded-lg w-1/3 animate-pulse mb-4"></div>
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-36 aspect-video bg-white/5 rounded-xl flex-shrink-0"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-white/5 rounded w-full"></div>
                    <div className="h-3 bg-white/5 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="w-full aspect-video bg-red-500/10 rounded-2xl flex flex-col items-center justify-center border border-red-500/20 p-8">
            <AlertCircle className="w-14 h-14 md:w-16 md:h-16 text-red-500 mb-5" />
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">Stream Error</h2>
            <p className="text-gray-400 text-sm md:text-base">{error}</p>
          </div>
        ) : hasStream ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Video Player & Video Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Video Player */}
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10 group">
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  poster={videoData.related?.[0]?.image || ''} // temporary poster fallback
                />

                {/* Quality Menu */}
                {qualities.length > 0 && (
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={() => setShowQualityMenu(!showQualityMenu)}
                      className="bg-black/75 backdrop-blur-md hover:bg-black/90 text-white px-4 py-2.5 rounded-2xl flex items-center gap-2 transition-all border border-white/10 text-sm font-semibold opacity-0 group-hover:opacity-100"
                    >
                      <Settings className="w-4 h-4" />
                      {currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}
                    </button>

                    {showQualityMenu && (
                      <div className="absolute top-full right-0 mt-3 bg-black/90 backdrop-blur-xl border border-white/15 rounded-2xl overflow-hidden shadow-2xl min-w-[160px]">
                        <div className="px-4 py-3 border-b border-white/10">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quality</span>
                        </div>
                        <button
                          onClick={() => switchQuality(-1)}
                          className={`w-full px-5 py-3 text-left text-sm flex items-center justify-between hover:bg-white/10 transition-colors ${currentQuality === -1 ? 'text-[#ff2a5f]' : 'text-white'}`}
                        >
                          Auto
                          {currentQuality === -1 && <Check className="w-4 h-4" />}
                        </button>
                        {qualities.sort((a, b) => b.height - a.height).map((q) => (
                          <button
                            key={q.index}
                            onClick={() => switchQuality(q.index)}
                            className={`w-full px-5 py-3 text-left text-sm flex items-center justify-between hover:bg-white/10 transition-colors ${currentQuality === q.index ? 'text-[#ff2a5f]' : 'text-white'}`}
                          >
                            {q.label}
                            {currentQuality === q.index && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Video Info */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-7 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex-1">
                  <h1 className="text-lg md:text-2xl font-bold text-white mb-3 line-clamp-2">
                    {videoData.title || "Now Playing"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-white font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                      {qualities.length > 0 ? 'HLS' : 'MP4'}
                    </span>
                    <span>Scraped securely</span>
                    <span>•</span>
                    <span>Premium Source</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-[#ff2a5f]/20 text-white hover:text-[#ff2a5f] border border-white/10 hover:border-[#ff2a5f]/50 px-5 py-3 rounded-2xl transition-all font-medium active:scale-95">
                    <Heart className="w-5 h-5" /> Like
                  </button>
                  <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-3 rounded-2xl transition-all font-medium active:scale-95">
                    <Share2 className="w-5 h-5" /> Share
                  </button>
                  {videoData.original_url && (
                    <a
                      href={videoData.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#ff2a5f]/20 hover:bg-[#ff2a5f]/30 text-[#ff2a5f] border border-[#ff2a5f]/50 hover:border-[#ff2a5f] px-5 py-3 rounded-2xl transition-all font-medium active:scale-95"
                    >
                      View on Source
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Related Videos List */}
            <div className="lg:col-span-1 space-y-6">
              {relatedVideos.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4">Related Videos</h3>
                  <div className="flex flex-col gap-3.5">
                    {(showAllRelated ? relatedVideos : relatedVideos.slice(0, 8)).map((video, index) => {
                      const videoId = video.id || video.link.split('-').pop().replace('/', '');
                      return (
                        <Link 
                          to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} 
                          key={index} 
                          className="group flex gap-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-2 rounded-2xl transition-all duration-300 active:scale-[0.98]"
                        >
                          {/* Thumbnail */}
                          <div className="relative w-32 xl:w-40 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0">
                            {video.image && (
                              <img 
                                src={video.image} 
                                alt={video.title} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-[#ff2a5f] flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300">
                                <Play className="w-3.5 h-3.5 text-white ml-0.5" />
                              </div>
                            </div>
                            {video.duration && (
                              <div className="absolute bottom-1 right-1 bg-black/85 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-semibold text-white flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 text-[#ff2a5f]" /> {video.duration}
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex flex-col justify-between flex-1 min-w-0 py-1">
                            <h4 className="text-xs xl:text-sm font-semibold text-gray-200 group-hover:text-white line-clamp-2 transition-colors leading-snug">
                              {video.title}
                            </h4>
                            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Related</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {relatedVideos.length > 8 && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => setShowAllRelated(!showAllRelated)}
                        className="w-full bg-white/5 hover:bg-[#ff2a5f]/20 border border-white/10 hover:border-[#ff2a5f]/50 py-3 rounded-2xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        {showAllRelated ? (
                          <>Show Less <ChevronUp className="w-4 h-4" /></>
                        ) : (
                          <>Show More Related <ChevronDown className="w-4 h-4" /></>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video bg-red-500/10 rounded-2xl flex flex-col items-center justify-center border border-red-500/20 p-8">
            <AlertCircle className="w-14 h-14 md:w-16 md:h-16 text-red-500 mb-5" />
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">No Stream Found</h2>
            <p className="text-gray-400 text-sm md:text-base">Could not find a playable video source.</p>
          </div>
        )}
      </div>
    </div>
  );
}
