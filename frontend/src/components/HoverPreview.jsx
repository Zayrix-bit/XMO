import { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';

export default function HoverPreview({ video }) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);

  const touchTimer = useRef(null);
  const isLongPress = useRef(false);
  const isStickyPreview = useRef(false);

  useEffect(() => {
    const handlePreviewStarted = (e) => {
      // If another video started its preview, stop ours
      if (e.detail !== video.link) {
        isStickyPreview.current = false;
        setIsHovered(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }
    };

    window.addEventListener('previewStarted', handlePreviewStarted);
    return () => window.removeEventListener('previewStarted', handlePreviewStarted);
  }, [video.link]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => { });
    }
  };

  const handleMouseLeave = () => {
    if (!isStickyPreview.current) {
      setIsHovered(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };

  const handleTouchStart = () => {
    isLongPress.current = false;
    touchTimer.current = setTimeout(() => {
      isLongPress.current = true;
      isStickyPreview.current = true;
      setIsHovered(true);

      // Dispatch event to stop other previews
      window.dispatchEvent(new CustomEvent('previewStarted', { detail: video.link }));

      if (videoRef.current) {
        videoRef.current.play().catch(() => { });
      }
    }, 400); // 400ms threshold for long press
  };

  const handleTouchEndOrMove = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
    // Only stop if it hasn't become a sticky preview yet
    if (isHovered && !isStickyPreview.current) {
      setIsHovered(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  };

  const handleClick = (e) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
    }
  };

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEndOrMove}
      onTouchMove={handleTouchEndOrMove}
      onTouchCancel={handleTouchEndOrMove}
      onClick={handleClick}
      // Add context menu prevention so the long-press doesn't trigger the browser's save-image menu
      onContextMenu={(e) => { if (isLongPress.current) e.preventDefault(); }}
    >
      <img
        src={video.image}
        alt={video.title}
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${isHovered && video.previewVideo ? 'opacity-0' : 'opacity-100'}`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {video.previewVideo && (
        <video
          ref={videoRef}
          src={video.previewVideo}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          muted
          loop
          playsInline
        />
      )}

      {/* Play button overlay - only show if there is no preview video playing */}
      <div className={`absolute inset-0 bg-black/35 transition-opacity flex items-center justify-center pointer-events-none ${isHovered && !video.previewVideo ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#ff2a5f]/95 flex items-center justify-center shadow-lg">
          <Play className="w-7 h-7 md:w-8 md:h-8 text-white ml-1" />
        </div>
      </div>
    </div>
  );
}
