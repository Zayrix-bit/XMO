import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import Hls from 'hls.js';
import { ArrowLeft, Heart, Share2, AlertCircle, Settings, Check, Play, Clock } from 'lucide-react';

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

  const originalUrl = searchParams.get('url') || '';

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
        hls.destroy();
        hlsRef.current = null;
      };
    } 
    // Fallback: direct MP4
    else if (mp4Url) {
      video.src = mp4Url;
      video.play().catch(() => {});
    }
  }, [videoData]);

  const switchQuality = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  };

  const hasStream = videoData && (videoData.hls_proxy_url || videoData.proxy_url);
  const relatedVideos = videoData?.related || [];

  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col items-center pb-20">
      <div className="w-full max-w-6xl">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-5 h-5" /> Back
        </button>

        {loading ? (
          <div className="space-y-6">
            <SkeletonVideo />
            <div className="h-24 bg-white/5 rounded-2xl animate-pulse"></div>
          </div>
        ) : error ? (
          <div className="w-full aspect-video bg-red-500/10 rounded-2xl flex flex-col items-center justify-center border border-red-500/20">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Stream Error</h2>
            <p className="text-gray-400">{error}</p>
          </div>
        ) : hasStream ? (
          <div className="space-y-6">
            {/* Video Player */}
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 group">
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
                    className="bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-all border border-white/10 text-sm font-medium opacity-0 group-hover:opacity-100"
                  >
                    <Settings className="w-4 h-4" />
                    {currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}
                  </button>

                  {showQualityMenu && (
                    <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden shadow-2xl min-w-[160px]">
                      <div className="px-3 py-2 border-b border-white/10">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quality</span>
                      </div>
                      <button
                        onClick={() => switchQuality(-1)}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-white/10 transition-colors ${currentQuality === -1 ? 'text-[#ff2a5f]' : 'text-white'}`}
                      >
                        Auto
                        {currentQuality === -1 && <Check className="w-4 h-4" />}
                      </button>
                      {qualities.sort((a, b) => b.height - a.height).map((q) => (
                        <button
                          key={q.index}
                          onClick={() => switchQuality(q.index)}
                          className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-white/10 transition-colors ${currentQuality === q.index ? 'text-[#ff2a5f]' : 'text-white'}`}
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
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-white mb-3 line-clamp-2">
                  {videoData.title || "Now Playing"}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                  <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-md text-white font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    {qualities.length > 0 ? 'HLS' : 'MP4'}
                  </span>
                  <span>Scraped securely</span>
                  <span>•</span>
                  <span>Premium Source</span>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-[#ff2a5f]/20 text-white hover:text-[#ff2a5f] border border-white/10 hover:border-[#ff2a5f]/50 px-5 py-3 rounded-xl transition-all font-medium">
                  <Heart className="w-5 h-5" /> Like
                </button>
                <button className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-3 rounded-xl transition-all font-medium">
                  <Share2 className="w-5 h-5" /> Share
                </button>
              </div>
            </div>

            {/* Related Videos */}
            {relatedVideos.length > 0 && (
              <div className="mt-12">
                <h3 className="text-xl font-bold text-white mb-6">Related Videos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {relatedVideos.map((video, index) => {
                    const videoId = video.id || video.link.split('-').pop().replace('/', '');
                    return (
                      <Link to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} key={index} className="group flex flex-col gap-3">
                        <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5">
                          {video.image && (
                            <img 
                              src={video.image} 
                              alt={video.title} 
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-[#ff2a5f] flex items-center justify-center shadow-[0_0_20px_rgba(255,42,95,0.6)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                              <Play className="w-4 h-4 text-white ml-1" />
                            </div>
                          </div>
                          {video.duration && (
                            <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-white flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#ff2a5f]" /> {video.duration}
                            </div>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-gray-200 group-hover:text-white line-clamp-2 transition-colors">
                          {video.title}
                        </h3>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full aspect-video bg-red-500/10 rounded-2xl flex flex-col items-center justify-center border border-red-500/20">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No Stream Found</h2>
            <p className="text-gray-400">Could not find a playable video source.</p>
          </div>
        )}
      </div>
    </div>
  );
}
