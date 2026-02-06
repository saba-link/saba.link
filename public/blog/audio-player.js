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
    audio.addEventListener('loadedmetadata', () => console.log('[AudioPlayer] loadedmetadata - readyState:', audio.readyState, 'duration:', audio.duration));
    audio.addEventListener('loadeddata', () => console.log('[AudioPlayer] loadeddata - readyState:', audio.readyState));
    audio.addEventListener('canplay', () => console.log('[AudioPlayer] canplay - readyState:', audio.readyState));
    audio.addEventListener('canplaythrough', () => console.log('[AudioPlayer] canplaythrough - readyState:', audio.readyState));
    
    // Build chapter list
    chapEl.innerHTML = '';
    chapters.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'sp-ch';
        d.innerHTML = '<span class="sp-ch-time">' + fmt(c.s) + '</span><span>' + c.t + '</span>';
        d.onclick = () => {
            const idx = i;
            console.log('[AudioPlayer] Chapter clicked:', c.t, '| target time:', c.s, '| readyState:', audio.readyState, '| currentTime:', audio.currentTime);
            
            // Helper to seek and update UI
            const seekTo = () => {
                const beforeSeek = audio.currentTime;
                audio.currentTime = c.s;
                console.log('[AudioPlayer] seekTo called | before:', beforeSeek, '| target:', c.s, '| after:', audio.currentTime, '| readyState:', audio.readyState);
                
                highlightSection(c.id);
                chapEl.querySelectorAll('.sp-ch').forEach((el, j) => el.classList.toggle('active', j === idx));
                if (c.id) {
                    scrollToSection(c.id);
                }
                audioPlayerState.lastCh = idx;
            };
            
            // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
            if (audio.readyState < 1) {
                // No metadata yet - need to wait for loadedmetadata
                console.log('[AudioPlayer] No metadata yet, waiting for loadedmetadata...');
                audio.play().catch(e => console.log('[AudioPlayer] play() rejected:', e));
                const onLoaded = () => {
                    console.log('[AudioPlayer] loadedmetadata fired, now seeking...');
                    seekTo();
                    audio.removeEventListener('loadedmetadata', onLoaded);
                };
                audio.addEventListener('loadedmetadata', onLoaded);
            } else {
                // We have metadata, can seek directly
                console.log('[AudioPlayer] Have metadata, seeking directly...');
                seekTo();
                if (audio.paused) {
                    audio.play().catch(e => console.log('[AudioPlayer] play() rejected:', e));
                }
            }
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
 * @param {string} sectionId - Element ID to scroll to
 */
function scrollToSection(sectionId) {
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
    const toggle = p.querySelector('.sp-toggle');
    if (toggle) {
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
}
