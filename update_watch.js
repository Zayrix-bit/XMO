
const fs = require('fs');
const path = require('path');

const watchPath = path.join(__dirname, 'frontend', 'src', 'pages', 'Watch.jsx');
let content = fs.readFileSync(watchPath, 'utf8');

// Inject the CSS import if not present
if (!content.includes("import '../player.css';")) {
  content = content.replace("import { Helmet } from 'react-helmet-async';", "import { Helmet } from 'react-helmet-async';\nimport '../player.css';");
}

// Extract the old player block (from {/* Video Player Wrapper Container */} to the closing </div> before {/* Video Info & Actions */})
const startIndex = content.indexOf('{/* Video Player Wrapper Container */}');
const endIndex = content.indexOf('{/* Video Info & Actions */}');

if (startIndex !== -1 && endIndex !== -1) {
  const newPlayerJSX = `
              {/* Video Player Wrapper Container */}
              <div 
                ref={playerContainerRef}
                id="player-wrapper" 
                className={\`player-wrapper \${showControls ? 'controls-visible' : 'controls-hidden'}\`}
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
                <div id="gradient-top" className={\`gradient gradient-top \${showControls ? '' : 'hidden'}\`}></div>
                <div id="gradient-bottom" className={\`gradient gradient-bottom \${showControls ? '' : 'hidden'}\`}></div>

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
                <div id="top-bar" className={\`top-bar \${showControls ? '' : 'hidden'}\`}>
                  <span id="video-title" className="video-title">{videoData.title}</span>
                </div>

                {/* Bottom Controls */}
                <div id="controls" className={\`controls \${showControls ? '' : 'hidden'}\`} onClick={(e) => e.stopPropagation()}>
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
                      <div id="seek-played" className="seek-fill seek-played" style={{ width: \`\${duration > 5 ? ((currentTime - 5) / (duration - 5)) * 100 : 0}%\` }}></div>
                      <div id="seek-thumb" className="seek-thumb" style={{ left: \`\${duration > 5 ? ((currentTime - 5) / (duration - 5)) * 100 : 0}%\` }}></div>
                    </div>
                    {isScrubbing && scrubTime !== null && (
                      <div id="seek-tooltip" className="seek-tooltip" style={{ opacity: 1, left: \`\${duration > 5 ? ((scrubTime - 5) / (duration - 5)) * 100 : 0}%\` }}>
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
                      {/* Settings (Quality) */}
                      {qualities.length > 0 && (
                        <div className="dropdown-anchor" id="anchor-settings">
                          <button id="btn-settings" className="ctrl-btn" title="Settings" onClick={() => setShowQualityMenu(!showQualityMenu)}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            <span id="quality-badge" className="quality-badge" style={{ display: 'inline-flex' }}>{currentQuality === -1 ? 'Auto' : qualities.find(q => q.index === currentQuality)?.label || 'Auto'}</span>
                          </button>
                          
                          {showQualityMenu && (
                            <div id="menu-settings" className="dropdown-menu" style={{ width: '220px', padding: 0 }}>
                              <div id="panel-quality" className="settings-panel">
                                <button className="settings-back-btn" id="btn-back-quality" onClick={() => setShowQualityMenu(false)}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                  Quality
                                </button>
                                <div id="quality-options" className="menu-options" style={{ paddingBottom: '8px' }}>
                                  <button
                                    onClick={() => switchQuality(-1)}
                                    className={\`menu-option \${currentQuality === -1 ? 'active' : ''}\`}
                                  >
                                    Auto {currentQuality === -1 && <Check className="w-3 h-3 ml-2 inline-block" />}
                                  </button>
                                  {qualities.sort((a, b) => b.height - a.height).map((q) => (
                                    <button
                                      key={q.index}
                                      onClick={() => switchQuality(q.index)}
                                      className={\`menu-option \${currentQuality === q.index ? 'active' : ''}\`}
                                    >
                                      {q.label} {currentQuality === q.index && <Check className="w-3 h-3 ml-2 inline-block" />}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

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
              
              `;

  content = content.substring(0, startIndex) + newPlayerJSX + content.substring(endIndex);
  fs.writeFileSync(watchPath, content, 'utf8');
  console.log('Successfully updated Watch.jsx');
} else {
  console.error('Could not find the start or end index in Watch.jsx');
}
