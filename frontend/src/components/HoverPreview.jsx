import { useState, useRef } from 'react';

export default function HoverPreview({ video }) {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div 
      className="absolute inset-0 w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img 
        src={video.image} 
        alt={video.title} 
        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${isHovered && video.previewVideo ? 'opacity-0' : 'opacity-100'}`}
        loading="lazy"
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
    </div>
  );
}
