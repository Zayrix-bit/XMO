import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import '../player.css';
import api from '../services/api';
import Hls from 'hls.js';
import { ArrowLeft, Heart, Share2, AlertCircle, Check, Eye, User, Download, Clock, ChevronDown } from 'lucide-react';
import HoverPreview from '../components/HoverPreview';

function SkeletonVideo() {
  return (
    <div className="w-full aspect-video bg-gray-800 rounded-lg animate-pulse"></div>
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
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showSettingsMenu && !e.target.closest('#anchor-settings')) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showSettingsMenu]);

  const [activeSettingsPanel, setActiveSettingsPanel] = useState('main');
  const [subColor, setSubColor] = useState('#ffffff');
  const [subBg, setSubBg] = useState('rgba(0, 0, 0, 0.75)');
  const [subSize, setSubSize] = useState('clamp(12px, 3.5vw, 24px)');
  const [autoActiveQuality, setAutoActiveQuality] = useState('');
  const [subEnabled, setSubEnabled] = useState(false);
  const [relatedVisibleCount, setRelatedVisibleCount] = useState(10);
  const [isLiked, setIsLiked] = useState(false);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [scrubTime, setScrubTime] = useState(null); // Time to preview
  const [isScrubbing, setIsScrubbing] = useState(false);
  const canvasRef = useRef(null);
  useEffect(() => {
    document.documentElement.style.setProperty('--sub-color', subColor);
    document.documentElement.style.setProperty('--sub-bg', subBg);
    document.documentElement.style.setProperty('--sub-size', subSize);
  }, [subColor, subBg, subSize]);
  
  const wasPlayingRef = useRef(false);
  


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
  const relatedVideos = useMemo(() => videoData?.related || [], [videoData]);

  useEffect(() => {
    const fetchVideo = async () => {
      setLoading(true);
      setError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      try {
        const targetUrl = originalUrl || `https://xhamster.com/videos/video-${id}`;
        const response = await api.get(`/api/video?url=${encodeURIComponent(targetUrl)}`);
        
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
    const hlsUrl = videoData.hls_proxy_url ? `${import.meta.env.VITE_API_BASE_URL}${videoData.hls_proxy_url}` : null;
    const mp4Url = videoData.proxy_url ? `${import.meta.env.VITE_API_BASE_URL}${videoData.proxy_url}` : null;

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
        startLevel: -1, // Start in Auto mode
        abrEwmaDefaultEstimate: 500000, // 500 Kbps initial estimate (forces lower quality like 480p initially)
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
        
        // Smart default: Set to Auto (-1) for Adaptive Bitrate (ABR)
        // This ensures users with slow internet won't get stuck buffering 720p
        setCurrentQuality(-1);
        hls.currentLevel = -1;
        
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (hls.levels && hls.levels[data.level]) {
          setAutoActiveQuality(`${hls.levels[data.level].height}p`);
        }
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
    setShowSettingsMenu(false);
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleVideoClick = () => {
    setShowSettingsMenu(false);
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    
    // On touch devices (mobile), tapping the screen should toggle UI controls.
    if (isTouch) {
      setShowControls(prev => !prev);
      // Reset the auto-hide timer when controls are toggled on
      if (!showControls) {
        triggerControls();
      }
      return;
    }
    // On desktop, clicking the video toggles play/pause
    togglePlay();
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
    setShowSettingsMenu(false);
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

  // Update preview when scrubbing
  useEffect(() => {
    if (isScrubbing && videoRef.current && canvasRef.current && scrubTime !== null) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      // Save original playing state
      if (!wasPlayingRef.current) {
        wasPlayingRef.current = !video.paused;
        if (!video.paused) video.pause();
      }

      const handleSeeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        video.removeEventListener('seeked', handleSeeked);
      };

      video.addEventListener('seeked', handleSeeked);
      video.currentTime = scrubTime;
    } else if (!isScrubbing && videoRef.current && wasPlayingRef.current) {
      // Resume playback if it was playing before scrubbing
      if (videoRef.current.paused) videoRef.current.play().catch(() => {});
      wasPlayingRef.current = false;
    }
  }, [scrubTime, isScrubbing]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, volume, isFullscreen, isMuted]);

  return (
    <>
      <Helmet>
        <title>{videoData ? `${videoData.title} | Watch Free HD Video - Hotster` : 'Watch Video - Hotster'}</title>
        <meta name="description" content={videoData ? `Watch ${videoData.title} in HD quality on Hotster. Free streaming with no interruptions.` : 'Watch free HD videos on Hotster.'} />
        <meta name="keywords" content={videoData ? `${videoData.title.split(' ').join(', ')}, free video, HD streaming, online video` : 'free videos, HD streaming, watch online'} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={videoData ? `${videoData.title} | Watch Free HD Video - Hotster` : 'Watch Video - Hotster'} />
        <meta property="og:description" content={videoData ? `Watch ${videoData.title} in HD quality on Hotster. Free streaming with no interruptions.` : 'Watch free HD videos on Hotster.'} />
        <meta property="og:type" content="video.movie" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:site_name" content="Hotster" />
        {videoData?.related?.[0]?.image && (
          <meta property="og:image" content={videoData.related[0].image} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={videoData ? `${videoData.title} | Watch Free HD Video - Hotster` : 'Watch Video - Hotster'} />
        <meta name="twitter:description" content={videoData ? `Watch ${videoData.title} in HD quality on Hotster. Free streaming with no interruptions.` : 'Watch free HD videos on Hotster.'} />
        {videoData?.related?.[0]?.image && (
          <meta name="twitter:image" content={videoData.related[0].image} />
        )}
      </Helmet>
      
      {/* Video Schema.org Structured Data */}
      {videoData && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": videoData.title,
            "description": `Watch ${videoData.title} in HD quality on Hotster.`,
            "thumbnailUrl": videoData.related?.[0]?.image || "",
            "embedUrl": window.location.href,
            "uploadDate": new Date().toISOString(),
            "contentUrl": window.location.href,
            "interactionCount": videoData.views?.replace(/,/g, '') || "0"
          })}
        </script>
      )}
      <div className="pt-24 pb-28 px-4 md:px-6 max-w-[1400px] mx-auto w-full">
      <div className="w-full">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#ff2a5f] transition-colors mb-6 font-semibold"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" /> Back
        </button>

        {loading ? (
          <div className="flex flex-col gap-8 w-full">
            {/* Top Skeleton */}
            <div className="w-full space-y-6">
              <SkeletonVideo />
              <div className="h-20 bg-[#121218] rounded-lg animate-pulse"></div>
            </div>
            {/* Bottom Skeleton (Grid) */}
            <div className="w-full">
              <div className="h-7 bg-[#121218] rounded-lg w-48 animate-pulse mb-4"></div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col gap-3 animate-pulse">
                  <div className="w-full aspect-video bg-[#121218] rounded-lg"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-[#121218] rounded w-full"></div>
                    <div className="h-3 bg-[#121218] rounded w-2/3"></div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="w-full aspect-video bg-red-500/10 rounded-lg flex flex-col items-center justify-center border border-red-500/20 p-8">
            <AlertCircle className="w-14 h-14 md:w-16 md:h-16 text-red-500 mb-5" />
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">Stream Error</h2>
            <p className="text-gray-400 text-sm md:text-base">{error}</p>
          </div>
        ) : hasStream ? (
          <div className="flex flex-col gap-10 items-start w-full">
            {/* Top Section: Video Player & Video Details */}
            <div className="w-full space-y-4">
              
              {/* Video Player Wrapper Container */}
              <div 
                ref={playerContainerRef}
                id="player-wrapper" 
                className={`player-wrapper w-full aspect-video rounded-lg overflow-hidden border border-white/[0.08] ${showControls ? 'controls-visible' : 'controls-hidden'}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                {/* Video Element */}
                <video 
                  ref={videoRef}
                  id="video" 
                  crossOrigin="anonymous" 
                  playsInline 
                  preload="auto"
                  autoPlay
                  poster={videoData.related?.[0]?.image || ''}
                ></video>

                {/* Click area for play/pause toggle */}
                <div id="click-area" className="click-area" onClick={handleVideoClick} onDoubleClick={handleDoubleClick}></div>

                {/* Gradient overlays for controls visibility */}
                <div id="gradient-top" className={`gradient gradient-top ${showControls ? '' : 'hidden'}`}></div>
                <div id="gradient-bottom" className={`gradient gradient-bottom ${showControls ? '' : 'hidden'}`}></div>

                {/* Loading Overlay */}
                {isBuffering && (
                  <div id="overlay-loading" className="overlay">
                    <div className="loader-ring">
                      <div></div><div></div><div></div><div></div>
                    </div>
                  </div>
                )}

                {/* Double Tap Ripple Indicators */}
                {showLeftRipple && (
                  <div id="dt-left" className="dt-indicator dt-left">
                    <div className="dt-ripple"></div>
                    <div className="dt-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
                      <span>10s</span>
                    </div>
                  </div>
                )}
                {showRightRipple && (
                  <div id="dt-right" className="dt-indicator dt-right">
                    <div className="dt-ripple"></div>
                    <div className="dt-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
                      <span>10s</span>
                    </div>
                  </div>
                )}
                
                {/* Top bar with title */}
                <div id="top-bar" className={`top-bar ${showControls ? '' : 'hidden'}`}>
                  <span id="video-title" className="video-title">{videoData.title}</span>
                </div>

                {/* Bottom Controls */}
                <div id="controls" className={`controls ${showControls ? '' : 'hidden'}`} onClick={(e) => e.stopPropagation()}>
                  {/* Progress / Seek Bar */}
                  <div className="seek-container" id="seek-container"
                       onMouseDown={(e) => {
                         setIsScrubbing(true);
                         const rect = e.currentTarget.getBoundingClientRect();
                         const pos = (e.clientX - rect.left) / rect.width;
                         const scrubVal = 5 + pos * (duration - 5);
                         setScrubTime(scrubVal);
                         setCurrentTime(scrubVal);
                         if (videoRef.current) videoRef.current.currentTime = scrubVal;
                       }}
                       onMouseMove={(e) => {
                         if (isScrubbing) {
                           const rect = e.currentTarget.getBoundingClientRect();
                           let pos = (e.clientX - rect.left) / rect.width;
                           if (pos < 0) pos = 0;
                           if (pos > 1) pos = 1;
                           const scrubVal = 5 + pos * (duration - 5);
                           setScrubTime(scrubVal);
                           setCurrentTime(scrubVal);
                           if (videoRef.current) videoRef.current.currentTime = scrubVal;
                         }
                       }}
                       onMouseUp={() => setIsScrubbing(false)}
                       onMouseLeave={() => setIsScrubbing(false)}
                       onTouchStart={(e) => {
                         setIsScrubbing(true);
                         if (e.touches[0]) {
                           const rect = e.currentTarget.getBoundingClientRect();
                           const pos = (e.touches[0].clientX - rect.left) / rect.width;
                           const scrubVal = 5 + pos * (duration - 5);
                           setScrubTime(scrubVal);
                           setCurrentTime(scrubVal);
                           if (videoRef.current) videoRef.current.currentTime = scrubVal;
                         }
                       }}
                       onTouchMove={(e) => {
                         if (isScrubbing && e.touches[0]) {
                           const rect = e.currentTarget.getBoundingClientRect();
                           let pos = (e.touches[0].clientX - rect.left) / rect.width;
                           if (pos < 0) pos = 0;
                           if (pos > 1) pos = 1;
                           const scrubVal = 5 + pos * (duration - 5);
                           setScrubTime(scrubVal);
                           setCurrentTime(scrubVal);
                           if (videoRef.current) videoRef.current.currentTime = scrubVal;
                         }
                       }}
                       onTouchEnd={() => setIsScrubbing(false)}
                  >
                    <div className="seek-track">
                      <div id="seek-buffered" className="seek-fill seek-buffered"></div>
                      <div id="seek-played" className="seek-fill seek-played" style={{ width: `${duration > 5 ? ((currentTime - 5) / (duration - 5)) * 100 : 0}%` }}></div>
                      <div id="seek-thumb" className="seek-thumb" style={{ left: `${duration > 5 ? ((currentTime - 5) / (duration - 5)) * 100 : 0}%` }}></div>
                    </div>
                    {isScrubbing && scrubTime !== null && (
                      <div id="seek-tooltip" className="seek-tooltip" style={{ opacity: 1, left: `${duration > 5 ? ((scrubTime - 5) / (duration - 5)) * 100 : 0}%` }}>
                        {formatTime(scrubTime)}
                      </div>
                    )}
                  </div>

                  {/* Control buttons row */}
                  <div className="controls-row">
                    <div className="controls-left">
                      {/* Rewind 10s */}
                      <button id="btn-rewind" className="ctrl-btn" title="Rewind 10s" onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 5);
                          triggerControls();
                        }
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
                      </button>

                      {/* Play / Pause */}
                      <button id="btn-play" className="ctrl-btn" title="Play (Space)" onClick={togglePlay}>
                        {!isPlaying ? (
                          <svg id="icon-play" width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        ) : (
                          <svg id="icon-pause" width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        )}
                      </button>

                      {/* Forward 10s */}
                      <button id="btn-forward" className="ctrl-btn" title="Forward 10s" onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration || 0);
                          triggerControls();
                        }
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
                      </button>

                      {/* Volume */}
                      <div className="volume-area" id="volume-area">
                        <button id="btn-mute" className="ctrl-btn" title="Mute (M)" onClick={toggleMute}>
                          {(isMuted || volume === 0) ? (
                            <svg id="icon-vol-mute" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                          ) : volume < 0.5 ? (
                            <svg id="icon-vol-low" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                          ) : (
                            <svg id="icon-vol-high" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                          )}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          style={{ marginLeft: '10px', width: '80px' }}
                          className="w-0 opacity-0 group-hover/volume:w-14 md:group-hover/volume:w-18 group-hover/volume:opacity-100 transition-all duration-300 h-1 rounded-full appearance-none bg-white/30 accent-[#ff2a5f] cursor-pointer hidden md:block"
                        />
                      </div>

                      {/* Time Display */}
                      <span id="time-display" className="time-display" style={{ marginLeft: '10px' }}>
                        {formatTime(Math.max(currentTime - 5, 0))} / {formatTime(Math.max(duration - 5, 0))}
                      </span>
                    </div>

                                        <div className="controls-right">
                      {/* Settings */}
                      <div className="dropdown-anchor" id="anchor-settings">
                        <button id="btn-settings" className="ctrl-btn" title="Settings" onClick={() => {
                          if (showSettingsMenu) {
                            setShowSettingsMenu(false);
                          } else {
                            setShowSettingsMenu(true);
                            setActiveSettingsPanel('main');
                          }
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                          {qualities.length > 0 && (
                            <span id="quality-badge" className="quality-badge" style={{ display: 'inline-flex' }}>
                              {currentQuality === -1 ? `Auto ${autoActiveQuality ? `(${autoActiveQuality})` : ''}` : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}
                            </span>
                          )}
                        </button>
                        
                        {showSettingsMenu && (
                          <div id="menu-settings" className="dropdown-menu" style={{ width: '220px', padding: 0 }}>
                            {activeSettingsPanel === 'main' && (
                              <div id="panel-main" className="settings-panel">
                                <div className="menu-title" style={{ padding: '10px 14px 4px' }}>Settings</div>
                                {qualities.length > 0 && (
                                  <button className="settings-item" onClick={() => setActiveSettingsPanel('quality')}>
                                    <span>Quality</span>
                                    <span className="settings-val">{currentQuality === -1 ? `Auto ${autoActiveQuality ? `(${autoActiveQuality})` : ''}` : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}</span>
                                  </button>
                                )}
                                <button className="settings-item" onClick={() => setActiveSettingsPanel('subs')}>
                                  <span>Captions</span>
                                  <span className="settings-val">{subEnabled ? 'On' : 'Off'}</span>
                                </button>
                              </div>
                            )}

                            {activeSettingsPanel === 'quality' && (
                              <div id="panel-quality" className="settings-panel">
                                <button className="settings-back-btn" onClick={() => setActiveSettingsPanel('main')}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                  Quality
                                </button>
                                <div className="menu-options" style={{ paddingBottom: '8px' }}>
                                  <button
                                    onClick={() => { switchQuality(-1); setShowSettingsMenu(false); }}
                                    className={`menu-option ${currentQuality === -1 ? 'active' : ''}`}
                                  >
                                    Auto {currentQuality === -1 && autoActiveQuality ? `(${autoActiveQuality})` : ''} {currentQuality === -1 && <Check className="w-3 h-3 ml-2 inline-block" />}
                                  </button>
                                  {[...qualities].sort((a, b) => b.height - a.height).map((q) => (
                                    <button
                                      key={q.index}
                                      onClick={() => { switchQuality(q.index); setShowSettingsMenu(false); }}
                                      className={`menu-option ${currentQuality === q.index ? 'active' : ''}`}
                                    >
                                      {q.label} {currentQuality === q.index && <Check className="w-3 h-3 ml-2 inline-block" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {activeSettingsPanel === 'subs' && (
                              <div id="panel-subs" className="settings-panel">
                                <button className="settings-back-btn" onClick={() => setActiveSettingsPanel('main')}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                  Captions
                                </button>
                                <button className="settings-item" style={{ marginBottom: '4px', paddingTop: '4px' }} onClick={() => setActiveSettingsPanel('sub-settings')}>
                                  <span>Subtitle Settings</span>
                                </button>
                                <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0 14px 4px' }} />
                                <div className="menu-options" style={{ paddingBottom: '8px' }}>
                                  <button onClick={() => setSubEnabled(false)} className={`menu-option ${!subEnabled ? 'active' : ''}`}>Off</button>
                                  <button onClick={() => setSubEnabled(true)} className={`menu-option ${subEnabled ? 'active' : ''}`}>On</button>
                                </div>
                              </div>
                            )}

                            {activeSettingsPanel === 'sub-settings' && (
                              <div id="panel-sub-settings" className="settings-panel">
                                <button className="settings-back-btn" onClick={() => setActiveSettingsPanel('subs')}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                  Subtitle Settings
                                </button>
                                <div className="menu-options" style={{ paddingBottom: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                                  <div className="menu-title" style={{ padding: '8px 14px 4px', fontSize: '11px', opacity: 0.7 }}>COLOR</div>
                                  <button className={`menu-option ${subColor === '#ffffff' ? 'active' : ''}`} onClick={() => setSubColor('#ffffff')}>White</button>
                                  <button className={`menu-option ${subColor === '#ffff00' ? 'active' : ''}`} onClick={() => setSubColor('#ffff00')}>Yellow</button>
                                  <button className={`menu-option ${subColor === '#00ffff' ? 'active' : ''}`} onClick={() => setSubColor('#00ffff')}>Cyan</button>
                                  <button className={`menu-option ${subColor === '#00ff00' ? 'active' : ''}`} onClick={() => setSubColor('#00ff00')}>Green</button>
                                  
                                  <div className="menu-title" style={{ padding: '8px 14px 4px', fontSize: '11px', opacity: 0.7 }}>BACKGROUND</div>
                                  <button className={`menu-option ${subBg === 'rgba(0, 0, 0, 0)' ? 'active' : ''}`} onClick={() => setSubBg('rgba(0, 0, 0, 0)')}>Transparent</button>
                                  <button className={`menu-option ${subBg === 'rgba(0, 0, 0, 0.75)' ? 'active' : ''}`} onClick={() => setSubBg('rgba(0, 0, 0, 0.75)')}>Semi-Transparent</button>
                                  <button className={`menu-option ${subBg === 'rgba(0, 0, 0, 1)' ? 'active' : ''}`} onClick={() => setSubBg('rgba(0, 0, 0, 1)')}>Solid Black</button>
                                  
                                  <div className="menu-title" style={{ padding: '8px 14px 4px', fontSize: '11px', opacity: 0.7 }}>SIZE</div>
                                  <button className={`menu-option ${subSize === 'clamp(10px, 2.5vw, 18px)' ? 'active' : ''}`} onClick={() => setSubSize('clamp(10px, 2.5vw, 18px)')}>Small</button>
                                  <button className={`menu-option ${subSize === 'clamp(12px, 3.5vw, 24px)' ? 'active' : ''}`} onClick={() => setSubSize('clamp(12px, 3.5vw, 24px)')}>Normal</button>
                                  <button className={`menu-option ${subSize === 'clamp(16px, 4.5vw, 32px)' ? 'active' : ''}`} onClick={() => setSubSize('clamp(16px, 4.5vw, 32px)')}>Large</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Fullscreen */}
                      <button id="btn-fullscreen" className="ctrl-btn" title="Fullscreen (F)" onClick={toggleFullscreen}>
                        {!isFullscreen ? (
                          <svg id="icon-expand" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        ) : (
                          <svg id="icon-compress" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Video Info & Actions */}
              <div className="mt-4 flex flex-col gap-4">
                {/* Title */}
                <h1 
                  onClick={() => setTitleExpanded(!titleExpanded)}
                  className={`text-xl md:text-2xl lg:text-3xl font-bold text-white cursor-pointer hover:text-white/90 transition-colors ${!titleExpanded ? 'line-clamp-2' : ''}`}
                >
                  {videoData.title || "Now Playing"}
                </h1>

                {/* Uploader, Stats, Actions Row */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-4 border-b border-white/10">
                  {/* Left Side: Uploader */}
                  <div className="flex items-center gap-3">
                    {videoData.uploader ? (
                      <>
                        {videoData.uploader.avatar ? (
                          <img 
                            src={videoData.uploader.avatar} 
                            alt={videoData.uploader.name || videoData.uploader.username} 
                            className="w-12 h-12 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                            <User className="w-6 h-6 text-white/70" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm md:text-base font-bold text-white">
                            {videoData.uploader.name || videoData.uploader.username}
                          </span>
                          {videoData.uploader.username && videoData.uploader.name && (
                            <span className="text-xs text-gray-400">
                              @{videoData.uploader.username}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                          <User className="w-6 h-6 text-white/70" />
                        </div>
                        <span className="text-sm md:text-base font-bold text-white">Unknown Creator</span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Actions & Stats */}
                  <div className="flex items-center gap-2 md:gap-3 overflow-x-auto pb-1 md:pb-0 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden w-full md:w-auto">
                    {videoData.views && (
                      <span className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-gray-300 font-medium text-xs md:text-sm transition-colors cursor-default flex-shrink-0">
                        <Eye className="w-3.5 h-3.5 text-gray-400" /> {videoData.views}
                      </span>
                    )}

                    <div className="w-[1px] h-5 md:h-6 bg-white/10 mx-0.5 md:mx-1 hidden sm:block flex-shrink-0"></div>
                    <button 
                      onClick={() => setIsLiked(!isLiked)} 
                      className={`flex items-center justify-center gap-1.5 md:gap-2 px-4 md:px-5 py-1.5 md:py-2 rounded-full transition-all font-semibold text-xs md:text-sm active:scale-95 flex-shrink-0 ${
                        isLiked 
                          ? 'bg-[#ff2a5f]/20 text-[#ff2a5f]' 
                          : 'bg-white/5 text-white hover:bg-[#ff2a5f]/20 hover:text-[#ff2a5f]'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 md:w-4 md:h-4" fill={isLiked ? 'currentColor' : 'none'} /> Like
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
                            console.error('Share failed:', err);
                          }
                        } else {
                          await navigator.clipboard.writeText(window.location.href);
                          alert('Link copied to clipboard!');
                        }
                      }} 
                      className="flex items-center justify-center gap-1.5 md:gap-2 bg-white/5 hover:bg-white/10 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full transition-all font-semibold text-xs md:text-sm active:scale-95 flex-shrink-0"
                    >
                      <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" /> Share
                    </button>
                    {videoData.proxy_url && (
                      <a 
                        href={`${import.meta.env.VITE_API_BASE_URL}${videoData.proxy_url}&download=true&title=${encodeURIComponent(videoData.title || 'video')}`}
                        download
                        className="flex items-center justify-center gap-1.5 md:gap-2 bg-white/5 hover:bg-white/10 text-white px-4 md:px-5 py-1.5 md:py-2 rounded-full transition-all font-semibold text-xs md:text-sm active:scale-95 flex-shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> Download
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Creator Videos & Related Videos */}
            <div className="w-full space-y-10 border-t border-white/10 pt-8">


              {/* Related Videos */}
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                    {relatedVideos.slice(0, relatedVisibleCount).map((video, index) => {
                      const videoId = video.id || video.link.split('-').pop().replace('/', '');
                      return (
                        <Link 
                          to={`/watch/${videoId}?url=${encodeURIComponent(video.link)}`} 
                          key={index} 
                          className="group flex flex-col gap-2.5 hover:bg-white/5 p-2 -m-2 rounded-xl transition-all duration-300"
                        >
                          {/* Thumbnail */}
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0">
                            {video.image && (
                              <HoverPreview video={video} />
                            )}

                            {video.duration && (
                              <div className="absolute bottom-0.5 right-0.5 bg-black/85 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-white flex items-center gap-0.5">
                                <Clock className="w-2 h-2 text-[#ff2a5f]" /> {video.duration}
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="flex flex-col min-w-0">
                            <h4 className="text-sm font-semibold text-gray-200 group-hover:text-white line-clamp-2 transition-colors leading-snug">
                              {video.title}
                            </h4>
                            {video.views && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Eye className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-500 font-medium">{video.views}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {relatedVideos.length > relatedVisibleCount && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={() => setRelatedVisibleCount(prev => prev + 10)}
                        className="w-full bg-white/5 hover:bg-[#ff2a5f]/20 border border-white/10 hover:border-[#ff2a5f]/50 py-2 rounded-xl text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        Show More <ChevronDown className="w-3.5 h-3.5" />
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
    </>
  );
}
