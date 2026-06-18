import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Hls from 'hls.js';
import { Loader2, ArrowLeft, Heart, Share2, AlertCircle, Settings, Check } from 'lucide-react';

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
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const originalUrl = searchParams.get('url') || '';

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError(null);
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
          width: level.width,
          bitrate: level.bitrate,
          label: `${level.height}p`,
        }));
        setQualities(levels);
        setCurrentQuality(-1); // auto
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('HLS fatal error, falling back to MP4');
          hls.destroy();
          // Fallback to MP4
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
    // Fallback: direct MP4 via proxy
    else if (mp4Url) {
      video.src = mp4Url;
      video.play().catch(() => {});
    }
  }, [videoData]);

  const switchQuality = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 for auto
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  };

  const hasStream = videoData && (videoData.hls_proxy_url || videoData.proxy_url);

  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-5 h-5" /> Back to browse
        </button>

        {loading ? (
          <div className="w-full aspect-video bg-white/5 rounded-2xl flex flex-col items-center justify-center border border-white/10 shadow-2xl">
            <Loader2 className="w-12 h-12 text-[#ff2a5f] animate-spin mb-4" />
            <p className="text-gray-400 font-medium">Loading video stream...</p>
          </div>
        ) : error ? (
          <div className="w-full aspect-video bg-red-500/10 rounded-2xl flex flex-col items-center justify-center border border-red-500/20">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Stream Error</h2>
            <p className="text-gray-400">{error}</p>
          </div>
        ) : hasStream ? (
          <div className="space-y-6">
            {/* Video Player Container */}
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 group">
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                autoPlay
                playsInline
                preload="auto"
              />

              {/* Quality Selector Button */}
              {qualities.length > 0 && (
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    className="bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-all border border-white/10 text-sm font-medium opacity-0 group-hover:opacity-100"
                  >
                    <Settings className="w-4 h-4" />
                    {currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}
                  </button>

                  {/* Quality Dropdown */}
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
            
            {/* Info Bar */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Now Playing</h1>
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 
                  {qualities.length > 0 ? `HLS Stream • ${qualities.length} qualities available` : 'MP4 Stream'}
                  <span className="text-gray-600">•</span> Streaming on NIGHTHUB
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-[#ff2a5f]/20 text-white hover:text-[#ff2a5f] border border-white/10 hover:border-[#ff2a5f]/50 px-4 py-2.5 rounded-xl transition-all font-medium">
                  <Heart className="w-5 h-5" /> Like
                </button>
                <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2.5 rounded-xl transition-all font-medium">
                  <Share2 className="w-5 h-5" /> Share
                </button>
              </div>
            </div>
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
