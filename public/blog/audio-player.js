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
    
    // Build chapter list
    chapEl.innerHTML = '';
    chapters.forEach((c, i) => {
        const d = document.createElement('div');
        d.className = 'sp-ch';
        d.innerHTML = '<span class="sp-ch-time">' + fmt(c.s) + '</span><span>' + c.t + '</span>';
        d.onclick = () => {
            const idx = chapters.indexOf(c);
            
            // Helper to seek and update UI
            const seekTo = () => {
                audio.currentTime = c.s;
                highlightSection(c.id);
                chapEl.querySelectorAll('.sp-ch').forEach((el, j) => el.classList.toggle('active', j === idx));
                if (c.id) {
                    scrollToSection(c.id);
                }
                audioPlayerState.lastCh = idx;
            };
            
            // If audio not ready yet, wait for canplay then seek
            if (audio.readyState < 2) {
                audio.play(); // Start loading
                const onCanPlay = () => {
                    seekTo();
                    audio.removeEventListener('canplay', onCanPlay);
                };
                audio.addEventListener('canplay', onCanPlay);
            } else {
                seekTo();
                audio.play();
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
 * Highlight a section by ID (H2 + all siblings until next H2)
 * @param {string|null} sectionId - Element ID to highlight, or null to clear
 */
function highlightSection(sectionId) {
    // Remove existing highlights
    document.querySelectorAll('.in-active-section').forEach(el => {
        el.classList.remove('in-active-section', 'section-heading', 'section-last');
    });
    
    if (!sectionId) return;
    
    const h = document.getElementById(sectionId);
    if (!h) return;
    
    // Highlight the heading
    h.classList.add('in-active-section', 'section-heading');
    
    // Highlight all siblings until next H2, track last one
    let el = h.nextElementSibling;
    let lastEl = h;
    while (el && !el.matches('h2')) {
        el.classList.add('in-active-section');
        lastEl = el;
        el = el.nextElementSibling;
    }
    
    // Mark the last element for bottom border-radius
    if (lastEl) {
        lastEl.classList.add('section-last');
    }
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
