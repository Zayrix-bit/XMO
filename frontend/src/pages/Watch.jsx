import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ArrowLeft, Heart, Share2, AlertCircle } from 'lucide-react';

export default function Watch() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  // The full original URL is passed as ?url= query param
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

    if (id) {
      fetchVideo();
    }
  }, [id, originalUrl]);

  // Use the proxy URL from our backend (bypasses CDN 403 blocks)
  const getVideoSrc = () => {
    if (!videoData) return null;
    
    // Backend returns a proxy_url that streams through our server with correct headers
    if (videoData.proxy_url) return `http://localhost:8000${videoData.proxy_url}`;
    
    return null;
  };

  const videoSrc = getVideoSrc();

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
        ) : videoSrc ? (
          <div className="space-y-6">
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full"
                controls
                autoPlay
                playsInline
                preload="auto"
              />
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white mb-2">Now Playing</h1>
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Streaming on NIGHTHUB
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
