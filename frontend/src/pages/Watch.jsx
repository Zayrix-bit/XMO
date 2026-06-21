import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import Hls from 'hls.js';
import { ArrowLeft, Heart, Share2, AlertCircle, Settings, Check, Play, Clock, ChevronDown, ChevronUp, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, ChevronLeft, ChevronRight, RotateCcw, RotateCw, Eye } from 'lucide-react';

function SkeletonVideo() {
  return (
    <div className="w-full aspect-video bg-[#121218] rounded-lg animate-pulse"></div>
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
  const [isLiked, setIsLiked] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);

  // Custom player states & references
  const playerContainerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);

  // Skip visual ripple states & refs
  const [showLeftRipple, setShowLeftRipple] = useState(false);
  const [showRightRipple, setShowRightRipple] = useState(false);
  const leftRippleTimeout = useRef(null);
  const rightRippleTimeout = useRef(null);

  // Autoplay next state (persisted via localStorage)
  const [autoPlayNext, setAutoPlayNext] = useState(() => {
    const saved = localStorage.getItem('autoPlayNext');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const autoPlayNextRef = useRef(autoPlayNext);
  
  useEffect(() => {
    autoPlayNextRef.current = autoPlayNext;
    localStorage.setItem('autoPlayNext', JSON.stringify(autoPlayNext));
  }, [autoPlayNext]);

  // Ref to track if we skipped the starting 5s intro
  const hasSkippedIntroRef = useRef(false);

  useEffect(() => {
    hasSkippedIntroRef.current = false;
  }, [id]);

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
      if (autoPlayNextRef.current && relatedVideos.length > 0) {
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

  // Video Action Helper Functions
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const muted = !isMuted;
    setIsMuted(muted);
    videoRef.current.muted = muted;
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    const container = playerContainerRef.current;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error("Exit fullscreen error:", err);
      });
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(val, 5);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const switchQuality = (levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
    setShowQualityMenu(false);
  };

  // Skip 10s Double-Click Handler
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const video = videoRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (clickX < width / 2) {
      // Seek 10s backward
      video.currentTime = Math.max(video.currentTime - 10, 5);

      // Trigger left ripple feedback
      setShowLeftRipple(true);
      if (leftRippleTimeout.current) clearTimeout(leftRippleTimeout.current);
      leftRippleTimeout.current = setTimeout(() => setShowLeftRipple(false), 800);
    } else {
      // Seek 10s forward
      video.currentTime = Math.min(video.currentTime + 10, video.duration || 0);

      // Trigger right ripple feedback
      setShowRightRipple(true);
      if (rightRippleTimeout.current) clearTimeout(rightRippleTimeout.current);
      rightRippleTimeout.current = setTimeout(() => setShowRightRipple(false), 800);
    }
  };

  // Controls Visibility & Inactivity Timers
  const triggerControls = (forceAutoHide = null) => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Auto-hide controls if explicitly requested, or if video is currently playing
    const shouldAutoHide = forceAutoHide !== null ? forceAutoHide : (videoRef.current ? !videoRef.current.paused : false);
    if (shouldAutoHide) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const handleMouseMove = () => {
    triggerControls();
  };

  const handleMouseLeave = () => {
    if (videoRef.current && !videoRef.current.paused) {
      setShowControls(false);
    }
  };

  // Sync HTML5 video element events with React state
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const onPlay = () => {
      setIsPlaying(true);
      triggerControls(true); // Force auto-hide on playback start
    };
    const onPause = () => {
      setIsPlaying(false);
      triggerControls(false); // Disable auto-hide on pause to keep controls visible
    };
    const onTimeUpdate = () => {
      if (!hasSkippedIntroRef.current && video.duration > 5) {
        video.currentTime = 5;
        hasSkippedIntroRef.current = true;
      }
      if (video.currentTime < 5 && video.duration > 5) {
        video.currentTime = 5;
      }
      setCurrentTime(video.currentTime);
    };
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      if (!hasSkippedIntroRef.current && video.duration > 5) {
        video.currentTime = 5;
        hasSkippedIntroRef.current = true;
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    // Sync initial state if metadata is already loaded
    setIsPlaying(!video.paused);
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);

    // Initial controls scheduling based on playback state
    triggerControls(!video.paused);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [videoData]);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (leftRippleTimeout.current) clearTimeout(leftRippleTimeout.current);
      if (rightRippleTimeout.current) clearTimeout(rightRippleTimeout.current);
    };
  }, []);

  // Keyboard Shortcuts (Hotkeys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      if (!videoRef.current) return;
      const video = videoRef.current;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowright':
          e.preventDefault();
          video.currentTime = Math.min(video.currentTime + 10, video.duration || 0);
          break;
        case 'arrowleft':
          e.preventDefault();
          video.currentTime = Math.max(video.currentTime - 10, 5);
          break;
        case 'arrowup': {
          e.preventDefault();
          const newVolUp = Math.min(volume + 0.1, 1);
          setVolume(newVolUp);
          video.volume = newVolUp;
          setIsMuted(newVolUp === 0);
          break;
        }
        case 'arrowdown': {
          e.preventDefault();
          const newVolDown = Math.max(volume - 0.1, 0);
          setVolume(newVolDown);
          video.volume = newVolDown;
          setIsMuted(newVolDown === 0);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, volume, isFullscreen, isMuted]);

  return (
    <div className="pt-24 pb-28 px-6 max-w-[1600px] mx-auto w-full">
      <div className="w-full">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-semibold"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back
        </button>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Skeleton Column */}
            <div className="lg:col-span-2 space-y-6">
              <SkeletonVideo />
              <div className="h-32 bg-[#121218] rounded-lg animate-pulse"></div>
            </div>
            {/* Right Skeleton Column */}
            <div className="lg:col-span-1 space-y-4">
              <div className="h-7 bg-[#121218] rounded-lg w-1/3 animate-pulse mb-4"></div>
              {Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-36 aspect-video bg-[#121218] rounded-lg flex-shrink-0"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-[#121218] rounded w-full"></div>
                    <div className="h-3 bg-[#121218] rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="w-full aspect-video bg-red-500/10 rounded-lg flex flex-col items-center justify-center border border-red-500/20 p-8">
            <AlertCircle className="w-14 h-14 md:w-16 md:h-16 text-red-500 mb-5" />
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">Stream Error</h2>
            <p className="text-gray-400 text-sm md:text-base">{error}</p>
          </div>
        ) : hasStream ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column: Video Player & Video Details */}
            <div className="lg:col-span-2 space-y-4">
              {/* Title Section */}
              <div>
                <h1 
                  onClick={() => setTitleExpanded(!titleExpanded)}
                  className={`text-xl md:text-2xl font-bold text-white mb-2 cursor-pointer hover:text-white/90 transition-colors ${!titleExpanded ? 'line-clamp-2' : ''}`}
                >
                  {videoData.title || "Now Playing"}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-gray-400">
                  <span className="flex items-center gap-1.5 bg-[#121218] px-3 py-1.5 rounded-lg text-white/90 font-medium border border-white/[0.06]">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    {qualities.length > 0 ? 'HLS' : 'MP4'}
                  </span>
                  {videoData.views && (
                    <span className="flex items-center gap-1.5 bg-[#121218] px-3 py-1.5 rounded-lg text-gray-300 font-medium border border-white/[0.06]">
                      <Eye className="w-3.5 h-3.5 text-gray-400" /> {videoData.views}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Video Player Wrapper Container */}
              <div 
                ref={playerContainerRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={togglePlay}
                onDoubleClick={handleDoubleClick}
                className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/[0.08] group select-none cursor-pointer"
              >
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  autoPlay
                  playsInline
                  preload="auto"
                  poster={videoData.related?.[0]?.image || ''}
                />

                {/* Double Click Skip Animation Overlay */}
                {showLeftRipple && (
                  <div className="absolute inset-y-0 left-0 w-1/3 bg-white/5 backdrop-blur-[0.5px] flex items-center justify-center rounded-l-xl pointer-events-none z-20 ripple-animate">
                    <div className="flex flex-col items-center gap-1 bg-black/45 px-4 py-3 rounded-full border border-white/5">
                      <div className="flex gap-0.5">
                        <ChevronLeft className="w-5 h-5 text-white animate-pulse" />
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[9px] font-extrabold text-white tracking-widest uppercase">-10s</span>
                    </div>
                  </div>
                )}
                {showRightRipple && (
                  <div className="absolute inset-y-0 right-0 w-1/3 bg-white/5 backdrop-blur-[0.5px] flex items-center justify-center rounded-r-xl pointer-events-none z-20 ripple-animate">
                    <div className="flex flex-col items-center gap-1 bg-black/45 px-4 py-3 rounded-full border border-white/5">
                      <div className="flex gap-0.5">
                        <ChevronRight className="w-5 h-5 text-white" />
                        <ChevronRight className="w-5 h-5 text-white animate-pulse" />
                      </div>
                      <span className="text-[9px] font-extrabold text-white tracking-widest uppercase">+10s</span>
                    </div>
                  </div>
                )}

                <style>{`
                  @keyframes rippleFade {
                    0% { opacity: 0; transform: scale(0.9); }
                    15% { opacity: 1; transform: scale(1); }
                    80% { opacity: 1; transform: scale(1); }
                    100% { opacity: 0; transform: scale(0.95); }
                  }
                  .ripple-animate {
                    animation: rippleFade 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                  }
                `}</style>

                {/* Buffering/Loading Indicator */}
                {isBuffering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none z-10">
                    <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-[#ff2a5f] animate-spin" />
                  </div>
                )}

                {/* Custom Overlay Controls */}
                <div 
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-3 md:p-4 transition-all duration-300 ${
                    showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
                  }`}
                >

                  {/* Timeline (Progress Bar) */}
                  <div className="w-full mb-3 flex items-center group/timeline">
                    <input
                      type="range"
                      min={5}
                      max={duration || 100}
                      value={Math.max(currentTime, 5)}
                      onChange={handleSeek}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer outline-none bg-white/20 accent-[#ff2a5f] transition-all hover:h-1.5 focus:outline-none"
                      style={{
                        background: `linear-gradient(to right, #ff2a5f 0%, #ff2a5f ${
                          duration > 5 ? ((currentTime - 5) / (duration - 5)) * 100 : 0
                        }%, rgba(255, 255, 255, 0.2) ${
                          duration > 5 ? ((currentTime - 5) / (duration - 5)) * 100 : 0
                        }%, rgba(255, 255, 255, 0.2) 100%)`,
                      }}
                    />
                  </div>

                  {/* Playback Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4">
                      {/* Skip Back Button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 5);
                            triggerControls();
                          }
                        }}
                        title="Rewind 10s"
                        className="text-white hover:text-[#ff2a5f] transition-colors focus:outline-none"
                      >
                        <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                      </button>

                      {/* Play/Pause Button */}
                      <button 
                        onClick={togglePlay}
                        className="text-white hover:text-[#ff2a5f] transition-colors focus:outline-none"
                      >
                        {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" />}
                      </button>

                      {/* Skip Forward Button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration || 0);
                            triggerControls();
                          }
                        }}
                        title="Forward 10s"
                        className="text-white hover:text-[#ff2a5f] transition-colors focus:outline-none"
                      >
                        <RotateCw className="w-4 h-4 md:w-5 md:h-5" />
                      </button>

                      {/* Volume Slider Section */}
                      <div className="flex items-center gap-2 group/volume">
                        <button 
                          onClick={toggleMute}
                          className="text-white hover:text-[#ff2a5f] transition-colors focus:outline-none"
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
                          ) : (
                            <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-0 opacity-0 group-hover/volume:w-14 md:group-hover/volume:w-18 group-hover/volume:opacity-100 transition-all duration-300 h-1 rounded-full appearance-none bg-white/30 accent-[#ff2a5f] cursor-pointer"
                        />
                      </div>

                      {/* Time Duration Label */}
                      <div className="text-white text-[10px] md:text-xs font-semibold tracking-wide">
                        {formatTime(Math.max(currentTime - 5, 0))} <span className="text-white/40 mx-1">/</span> {formatTime(Math.max(duration - 5, 0))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                      {/* Quality Selector Pop-up Menu */}
                      {qualities.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setShowQualityMenu(!showQualityMenu)}
                            className="text-white hover:text-[#ff2a5f] transition-colors focus:outline-none flex items-center gap-1.5 text-[10px] md:text-xs font-bold bg-white/10 hover:bg-white/15 px-2.5 py-1.5 rounded-lg border border-white/5"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            {currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}
                          </button>

                          {showQualityMenu && (
                            <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-xl border border-white/15 rounded-xl overflow-hidden shadow-lg min-w-[130px] z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
                              <div className="px-3 py-1.5 border-b border-white/10">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Quality</span>
                              </div>
                              <button
                                onClick={() => switchQuality(-1)}
                                className={`w-full px-4 py-1.5 text-left text-[10px] md:text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${currentQuality === -1 ? 'text-[#ff2a5f] font-bold' : 'text-white'}`}
                              >
                                Auto
                                {currentQuality === -1 && <Check className="w-3 h-3" />}
                              </button>
                              {qualities.sort((a, b) => b.height - a.height).map((q) => (
                                <button
                                  key={q.index}
                                  onClick={() => switchQuality(q.index)}
                                  className={`w-full px-4 py-1.5 text-left text-[10px] md:text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${currentQuality === q.index ? 'text-[#ff2a5f] font-bold' : 'text-white'}`}
                                >
                                  {q.label}
                                  {currentQuality === q.index && <Check className="w-3 h-3" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Fullscreen Button */}
                      <button 
                        onClick={toggleFullscreen}
                        className="text-white hover:text-[#ff2a5f] transition-colors focus:outline-none"
                      >
                        {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Video Actions */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsLiked(!isLiked)} 
                  className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all font-medium text-sm active:scale-95 ${
                    isLiked 
                      ? 'bg-[#ff2a5f]/20 text-[#ff2a5f] border border-[#ff2a5f]/50' 
                      : 'bg-white/5 text-white border border-white/10 hover:bg-[#ff2a5f]/20 hover:text-[#ff2a5f] hover:border-[#ff2a5f]/50'
                  }`}
                >
                  <Heart className="w-4 h-4" fill={isLiked ? 'currentColor' : 'none'} /> Like
                </button>
                <button 
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: videoData.title,
                          text: 'Check out this video!',
                          url: window.location.href
                        });
                      } catch (err) {
                        // Ignore cancel errors
                      }
                    } else {
                      // Fallback: copy link to clipboard
                      await navigator.clipboard.writeText(window.location.href);
                      alert('Link copied to clipboard!');
                    }
                  }} 
                  className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2 rounded-xl transition-all font-medium text-sm active:scale-95"
                >
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>

            {/* Right Column: Related Videos List */}
            <div className="lg:col-span-1 space-y-4">
              {relatedVideos.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">Related</h3>
                    <div 
                      onClick={() => setAutoPlayNext(!autoPlayNext)}
                      className="flex items-center gap-2 cursor-pointer text-[10px] text-gray-400 select-none hover:text-white transition-colors"
                    >
                      <span>Autoplay</span>
                      <div 
                        className={`relative w-7 h-3.5 rounded-full transition-colors duration-200 ${autoPlayNext ? 'bg-[#ff2a5f]' : 'bg-white/20'}`}
                      >
                        <div 
                          className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform duration-200 ${autoPlayNext ? 'translate-x-3' : 'translate-x-0'}`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {(showAllRelated ? relatedVideos : relatedVideos.slice(0, 8)).map((video, index) => {
                      const videoId = video.id || video.link.split('-').pop().replace('/', '');
                      return (
                        <Link 
                          to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} 
                          key={index} 
                          className="group flex gap-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-1.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
                        >
                          {/* Thumbnail */}
                          <div className="relative w-28 md:w-32 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                            {video.image && (
                              <img 
                                src={video.image} 
                                alt={video.title} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-[#ff2a5f] flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300">
                                <Play className="w-3 h-3 text-white ml-0.5" />
                              </div>
                            </div>
                            {video.duration && (
                              <div className="absolute bottom-0.5 right-0.5 bg-black/85 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-white flex items-center gap-0.5">
                                <Clock className="w-2 h-2 text-[#ff2a5f]" /> {video.duration}
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                            <h4 className="text-[11px] md:text-xs font-semibold text-gray-200 group-hover:text-white line-clamp-2 transition-colors leading-snug">
                              {video.title}
                            </h4>
                            {video.views && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Eye className="w-2.5 h-2.5 text-gray-500" />
                                <span className="text-[9px] text-gray-500">{video.views}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {relatedVideos.length > 8 && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={() => setShowAllRelated(!showAllRelated)}
                        className="w-full bg-white/5 hover:bg-[#ff2a5f]/20 border border-white/10 hover:border-[#ff2a5f]/50 py-2 rounded-xl text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        {showAllRelated ? (
                          <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>Show More <ChevronDown className="w-3.5 h-3.5" /></>
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
