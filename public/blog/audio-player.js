/**
 * audio-player.js - Reusable audio player for saba.link/blog
 * 
 * Usage:
 * 1. Include this script: <script src="audio-player.js"></script>
 * 2. Add player HTML container: <div id="stickyPlayer" class="sticky-player">...</div>
 * 3. Call: initAudioPlayer('audio-file.mp3', chapters);
 * 
 * Chapters format:
 * [
 *   { t: "Introduction", s: 0, id: null },
 *   { t: "Chapter Title", s: 45, id: "html-element-id" },
 *   ...
 * ]
 */

let audioPlayerState = {
    audio: null,
    chapters: [],
    lastCh: -1,
    autoScrollEl: null,
    chaptersEl: null
};

/**
 * Initialize the audio player
 * @param {string} audioSrc - Path to audio file
 * @param {Array} chapters - Chapter definitions with { t: title, s: seconds, id: elementId }
 */
function initAudioPlayer(audioSrc, chapters) {
    const audio = document.getElementById('blogAudio');
    const chapEl = document.getElementById('spChapters');
    const autoEl = document.getElementById('autoScroll');
    
    if (!audio || !chapEl) {
        console.warn('Audio player elements not found');
        return;
    }
    
    // Set audio source
    audio.src = audioSrc;
    
    // Store state
    audioPlayerState.audio = audio;
    audioPlayerState.chapters = chapters;
    audioPlayerState.chaptersEl = chapEl;
    audioPlayerState.autoScrollEl = autoEl;
    audioPlayerState.lastCh = -1;
    
    // Format time helper
    const fmt = s => Math.floor(s/60) + ':' + String(Math.floor(s%60)).padStart(2, '0');
    
    // Debug: Log audio state changes
    console.log('[AudioPlayer] Initializing with source:', audioSrc);
    audio.addEventListener('loadstart', () => console.log('[AudioPlayer] loadstart - readyState:', audio.readyState));
    audio.addEventListener('loadedmetadata', () => {
        const seekableEnd = audio.seekable.length > 0 ? audio.seekable.end(0) : 0;
        console.log('[AudioPlayer] loadedmetadata - readyState:', audio.readyState, 'duration:', audio.duration, 'seekable:', seekableEnd);
    });
    audio.addEventListener('loadeddata', () => console.log('[AudioPlayer] loadeddata - readyState:', audio.readyState));
    audio.addEventListener('canplay', () => {
        const seekableEnd = audio.seekable.length > 0 ? audio.seekable.end(0) : 0;
        console.log('[AudioPlayer] canplay - readyState:', audio.readyState, 'seekable:', seekableEnd);
    });
    audio.addEventListener('canplaythrough', () => {
        const seekableEnd = audio.seekable.length > 0 ? audio.seekable.end(0) : 0;
        console.log('[AudioPlayer] canplaythrough - readyState:', audio.readyState, 'seekable:', seekableEnd);
    });
    
    // Build chapter list
    chapEl.innerHTML = '';

    // Hide chapters + auto-scroll when no chapters provided (e.g. share pages)
    if (chapters.length === 0) {
        chapEl.style.display = 'none';
        const autoSect = autoEl && autoEl.closest('.sp-auto');
        if (autoSect) autoSect.style.display = 'none';
    }

    chapters.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'sp-ch';
        d.innerHTML = '<span class="sp-ch-time">' + fmt(c.s) + '</span><span>' + c.t + '</span>';
        d.onclick = () => {
            const idx = i;
            console.log('[AudioPlayer] Chapter clicked:', c.t, '| target time:', c.s, '| readyState:', audio.readyState, '| currentTime:', audio.currentTime);
            
            // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
            // Problem: Browser can only seek to buffered positions. If not buffered, seek fails silently.
            
            const attemptSeek = () => {
                const targetTime = c.s;
                
                // Check if target is actually buffered
                const isBuffered = (time) => {
                    for (let i = 0; i < audio.buffered.length; i++) {
                        if (time >= audio.buffered.start(i) && time <= audio.buffered.end(i)) {
                            return true;
                        }
                    }
                    return false;
                };
                
                const getBufferedEnd = () => {
                    if (audio.buffered.length > 0) {
                        return audio.buffered.end(audio.buffered.length - 1);
                    }
                    return 0;
                };
                
                const getSeekableEnd = () => {
                    if (audio.seekable.length > 0) {
                        return audio.seekable.end(audio.seekable.length - 1);
                    }
                    return 0;
                };
                
                const doSeek = () => {
                    const bufferedEnd = getBufferedEnd();
                    const seekableEnd = getSeekableEnd();
                    const targetBuffered = isBuffered(targetTime);
                    const targetSeekable = targetTime <= seekableEnd;
                    console.log('[AudioPlayer] Executing seek to', targetTime, '| buffered:', bufferedEnd.toFixed(1), '| seekable:', seekableEnd.toFixed(1), '| target seekable:', targetSeekable);
                    
                    if (!targetBuffered) {
                        console.log('[AudioPlayer] Target not yet buffered! Waiting for progress...');
                        // Wait for more buffer
                        const waitForBuffer = () => {
                            if (isBuffered(targetTime)) {
                                console.log('[AudioPlayer] Target now buffered, seeking...');
                                audio.removeEventListener('progress', waitForBuffer);
                                audio.currentTime = targetTime;
                                setTimeout(() => {
                                    console.log('[AudioPlayer] Seek after buffer | actual:', audio.currentTime);
                                    updateUI();
                                }, 100);
                            }
                        };
                        audio.addEventListener('progress', waitForBuffer);
                        // Also check periodically in case progress doesn't fire
                        let checks = 0;
                        const checkInterval = setInterval(() => {
                            checks++;
                            if (isBuffered(targetTime)) {
                                clearInterval(checkInterval);
                                audio.removeEventListener('progress', waitForBuffer);
                                console.log('[AudioPlayer] Target buffered (via interval), seeking...');
                                audio.currentTime = targetTime;
                                setTimeout(() => updateUI(), 100);
                            } else if (checks > 20) { // 5 seconds max
                                clearInterval(checkInterval);
                                audio.removeEventListener('progress', waitForBuffer);
                                console.log('[AudioPlayer] Gave up waiting for buffer');
                                updateUI();
                            }
                        }, 250);
                        return;
                    }
                    
                    // Try pause-seek-play pattern
                    const wasPlaying = !audio.paused;
                    if (wasPlaying) {
                        console.log('[AudioPlayer] Pausing before seek...');
                        audio.pause();
                    }
                    
                    // Wait a tick, then seek
                    setTimeout(() => {
                        console.log('[AudioPlayer] Setting currentTime to', targetTime);
                        audio.currentTime = targetTime;
                        
                        // Wait for seeked event
                        const onSeeked = () => {
                            const diff = Math.abs(audio.currentTime - targetTime);
                            console.log('[AudioPlayer] Seeked event | actual:', audio.currentTime.toFixed(1), '| diff:', diff.toFixed(1));
                            
                            if (diff <= 2) {
                                console.log('[AudioPlayer] Seek succeeded!');
                            } else {
                                console.log('[AudioPlayer] Seek failed. Trying load() workaround...');
                                // Nuclear option: reload and seek
                                const src = audio.src;
                                audio.src = '';
                                audio.src = src;
                                audio.currentTime = targetTime;
                            }
                            
                            if (wasPlaying) {
                                audio.play().catch(e => {});
                            }
                            updateUI();
                            audio.removeEventListener('seeked', onSeeked);
                        };
                        audio.addEventListener('seeked', onSeeked);
                        
                        // Fallback if seeked doesn't fire
                        setTimeout(() => {
                            audio.removeEventListener('seeked', onSeeked);
                            const diff = Math.abs(audio.currentTime - targetTime);
                            if (diff > 2) {
                                console.log('[AudioPlayer] Seeked timeout, trying src reload...');
                                const src = audio.src;
                                const wasPlaying2 = !audio.paused;
                                audio.src = '';
                                audio.src = src;
                                audio.addEventListener('loadedmetadata', () => {
                                    audio.currentTime = targetTime;
                                    if (wasPlaying2) audio.play().catch(e => {});
                                    updateUI();
                                }, { once: true });
                            }
                        }, 500);
                    }, 50);
                };
                
                // Must wait for audio to actually be playing before seek works
                if (audio.paused) {
                    console.log('[AudioPlayer] Audio paused, starting playback first...');
                    const onPlaying = () => {
                        console.log('[AudioPlayer] Playing event fired, waiting 500ms then seeking...');
                        audio.removeEventListener('playing', onPlaying);
                        // Longer delay - some browsers need time to stabilize
                        setTimeout(doSeek, 500);
                    };
                    audio.addEventListener('playing', onPlaying);
                    audio.play().catch(e => console.log('[AudioPlayer] Play rejected:', e));
                } else {
                    // Already playing - try fastSeek if available, else currentTime
                    if (typeof audio.fastSeek === 'function') {
                        console.log('[AudioPlayer] Using fastSeek()...');
                        audio.fastSeek(targetTime);
                        setTimeout(() => {
                            console.log('[AudioPlayer] After fastSeek | actual:', audio.currentTime.toFixed(1));
                            updateUI();
                        }, 150);
                    } else {
                        doSeek();
                    }
                }
            };
            
            const updateUI = () => {
                highlightSection(c.id);
                chapEl.querySelectorAll('.sp-ch').forEach((el, j) => el.classList.toggle('active', j === idx));
                // Always scroll on chapter click - scrollToSection handles null (intro)
                scrollToSection(c.id);
                audioPlayerState.lastCh = idx;
            };
            
            // Start playing first (this triggers buffering)
            if (audio.paused) {
                audio.play().catch(e => console.log('[AudioPlayer] play() rejected:', e));
            }
            
            // Then attempt seek
            attemptSeek();
        };
        chapEl.appendChild(d);
    });
    
    // Time update handler
    audio.ontimeupdate = () => {
        let ai = 0;
        for (let i = chapters.length - 1; i >= 0; i--) {
            if (audio.currentTime >= chapters[i].s) {
                ai = i;
                break;
            }
        }
        
        // Update active chapter in list
        chapEl.querySelectorAll('.sp-ch').forEach((el, i) => el.classList.toggle('active', i === ai));
        
        // Handle section change
        if (ai !== audioPlayerState.lastCh) {
            highlightSection(chapters[ai].id);
            if (autoEl && autoEl.checked && chapters[ai].id) {
                scrollToSection(chapters[ai].id);
            }
            audioPlayerState.lastCh = ai;
        }
    };
}

/**
 * Highlight a section by ID (only H2 heading)
 * @param {string|null} sectionId - Element ID to highlight, or null to clear
 */
function highlightSection(sectionId) {
    // Remove existing highlights
    document.querySelectorAll('.section-heading-active').forEach(el => {
        el.classList.remove('section-heading-active');
    });
    
    if (!sectionId) return;
    
    const h = document.getElementById(sectionId);
    if (!h) return;
    
    // Highlight only the heading
    h.classList.add('section-heading-active');
}

/**
 * Scroll to a section with offset for comfortable reading position
 * @param {string|null} sectionId - Element ID to scroll to, or null for top of article
 */
function scrollToSection(sectionId) {
    if (!sectionId) {
        // Intro section - scroll to top of article (first paragraph or content div)
        const content = document.querySelector('.content.prose') || document.querySelector('.content');
        if (content) {
            const rect = content.getBoundingClientRect();
            const offset = window.innerHeight * 0.25;
            window.scrollTo({
                top: window.scrollY + rect.top - offset,
                behavior: 'smooth'
            });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
    }
    
    const h = document.getElementById(sectionId);
    if (!h) return;
    
    const rect = h.getBoundingClientRect();
    const offset = window.innerHeight * 0.25; // Top 25% of viewport
    window.scrollTo({
        top: window.scrollY + rect.top - offset,
        behavior: 'smooth'
    });
}

/**
 * Toggle player minimize state
 */
function togglePlayer() {
    const p = document.getElementById('stickyPlayer');
    if (!p) return;

    p.classList.toggle('mini');

    // Legacy (blog pages): text-only toggle — update emoji vs dash
    // New (share pages): CSS handles .sp-toggle-close / .sp-toggle-icon visibility
    const toggle = p.querySelector('.sp-toggle');
    if (toggle && !toggle.querySelector('.sp-toggle-icon')) {
        toggle.textContent = p.classList.contains('mini') ? '🎧' : '−';
    }
}

/**
 * Toggle theme (dark/light)
 */
function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

/**
 * Initialize theme from localStorage or system preference
 */
function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

/**
 * Initialize reading progress bar
 */
function initProgressBar() {
    window.addEventListener('scroll', function() {
        const bar = document.getElementById('progressBar');
        if (!bar) return;
        
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        bar.style.width = progress + '%';
    });
}

// Auto-initialize theme and progress bar on load
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initProgressBar();
});

// Also run immediately in case DOMContentLoaded already fired
if (document.readyState !== 'loading') {
    initTheme();
    initProgressBar();
}

/**
 * Enable auto-collapse to mini bubble on scroll.
 * Mirrors the rc-bar behavior on share pages: collapse when scrolling,
 * expand automatically after `delay` ms of no scrolling.
 * Tap the mini bubble at any time to expand immediately.
 * @param {number} [delay=8000] - ms of scroll-stillness before auto-expanding
 */
function enableAudioPlayerAutoCollapse(delay) {
    delay = delay == null ? 8000 : delay;
    const p = document.getElementById('stickyPlayer');
    if (!p) return;
    let isMini = false;
    let scrollTimer;

    function collapsePlayer() {
        if (!isMini) {
            p.classList.add('mini');
            // Legacy text toggle (blog): update emoji; new SVG toggle (share): CSS handles it
            const toggle = p.querySelector('.sp-toggle');
            if (toggle && !toggle.querySelector('.sp-toggle-icon')) toggle.textContent = '🎧';
            isMini = true;
        }
    }

    function expandPlayer() {
        if (isMini) {
            p.classList.remove('mini');
            const toggle = p.querySelector('.sp-toggle');
            if (toggle && !toggle.querySelector('.sp-toggle-icon')) toggle.textContent = '−';
            isMini = false;
        }
    }

    window.addEventListener('scroll', function() {
        collapsePlayer();
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(expandPlayer, delay);
    }, { passive: true });

    // Tap mini bubble → expand immediately
    p.addEventListener('click', function() {
        if (isMini) {
            expandPlayer();
            clearTimeout(scrollTimer);
        }
    });
}

/**
 * Change the audio player's source (for language switching on share pages).
 * Preserves play/pause state.
 * @param {string} url - New audio URL
 */
function setAudioPlayerSrc(url) {
    const audio = audioPlayerState.audio || document.getElementById('blogAudio');
    if (!audio || !url) return;
    const wasPlaying = !audio.paused;
    audio.src = url;
    audio.load();
    if (wasPlaying) audio.play().catch(() => {});
}

/**
 * Initialize the custom audio player for share pages.
 * Wires up: seekbar (click + drag + touch), ±15s buttons, play/pause,
 * speed control, time display.
 * Uses #blogAudio as the hidden audio source.
 * @param {string} audioSrc - Audio URL
 */
function initCustomPlayer(audioSrc) {
    const audio = document.getElementById('blogAudio');
    if (!audio) return;

    audio.src = audioSrc;
    audioPlayerState.audio = audio;

    const seekbar   = document.getElementById('sp-seekbar');
    const fill      = document.getElementById('sp-seekbar-fill');
    const playBtn   = document.getElementById('sp-play');
    const backBtn   = document.getElementById('sp-back');
    const fwdBtn    = document.getElementById('sp-fwd');
    const timeEl    = document.getElementById('sp-time');
    const durEl     = document.getElementById('sp-dur');
    const speedCtrl = document.getElementById('speedCtrl');

    const fmt = s => {
        const t = Math.max(0, Math.floor(s));
        return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    };

    // Play / Pause
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            if (audio.paused) audio.play().catch(() => {});
            else audio.pause();
        });
    }

    // ±15 s
    if (backBtn) backBtn.addEventListener('click', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 15);
    });
    if (fwdBtn) fwdBtn.addEventListener('click', () => {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15);
    });

    // Speed
    if (speedCtrl) speedCtrl.addEventListener('change', () => {
        audio.playbackRate = parseFloat(speedCtrl.value);
    });

    // Play / Pause state icons
    audio.addEventListener('play',  () => { if (playBtn) playBtn.innerHTML = '&#9646;&#9646;'; });
    audio.addEventListener('pause', () => { if (playBtn) playBtn.innerHTML = '&#9654;'; });

    // Time + progress updates
    audio.addEventListener('timeupdate', () => {
        if (timeEl) timeEl.textContent = fmt(audio.currentTime);
        if (fill && audio.duration) {
            fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
        }
    });
    audio.addEventListener('loadedmetadata', () => {
        if (durEl) durEl.textContent = fmt(audio.duration);
    });

    // Seekbar — click, drag (mouse + touch)
    if (seekbar) {
        const seekTo = (clientX) => {
            if (!audio.duration) return;
            const rect = seekbar.getBoundingClientRect();
            const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            audio.currentTime = pct * audio.duration;
            if (fill) fill.style.width = (pct * 100) + '%';
        };

        seekbar.addEventListener('click', e => seekTo(e.clientX));

        // Mouse drag
        let dragging = false;
        seekbar.addEventListener('mousedown', () => {
            dragging = true;
            seekbar.classList.add('dragging');
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            seekTo(e.clientX);
        });
        document.addEventListener('mouseup', () => {
            if (dragging) { dragging = false; seekbar.classList.remove('dragging'); }
        });

        // Touch drag
        seekbar.addEventListener('touchstart', e => {
            e.preventDefault();
            dragging = true;
            seekbar.classList.add('dragging');
        }, { passive: false });
        seekbar.addEventListener('touchmove', e => {
            if (!dragging) return;
            e.preventDefault();
            seekTo(e.touches[0].clientX);
        }, { passive: false });
        seekbar.addEventListener('touchend', () => {
            dragging = false;
            seekbar.classList.remove('dragging');
        });
    }
}
