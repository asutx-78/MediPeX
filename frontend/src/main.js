import {OpenFile, DownloadFile} from '../wailsjs/go/main/App';

const videoPlayer = document.getElementById('media-player');
const ytIframe = document.getElementById('yt-iframe');
const playlistBody = document.getElementById('playlist-body');

let playlistData = [];


// --- THEME SWITCHER ---
window.setTheme = function(themeName) {
    document.body.setAttribute('data-theme', themeName);
}

// --- WEB AUDIO API EQUALIZER ---
let audioCtx;
let mediaSource;
let masterGain;
const filters = [];
let isEqOn = document.getElementById('eq-toggle').checked;
let eqLastNode = null;

const eqPresets = {
    'flat': [0, 0, 0, 0, 0],
    'large-hall': [5, 3, 0, -2, -5],
    'small-room': [2, 0, 0, 1, 3],
    'acoustic': [4, 2, 1, 3, 3],
    'bass-booster': [6, 4, 1, 0, 0],
    'electronic': [4, 1, -2, 2, 4],
    'pop': [-2, 0, 3, 2, -1]
};

function initAudioEq() {
    if (audioCtx) return; // Already initialized
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    
    // Create MediaElementSource
    mediaSource = audioCtx.createMediaElementSource(videoPlayer);
    
    // Create filters based on the UI
    const sliders = document.querySelectorAll('.eq-slider');
    let prevNode = mediaSource;

    sliders.forEach(slider => {
        const freq = parseFloat(slider.getAttribute('data-freq'));
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = parseFloat(slider.value);
        
        // Connect to previous node
        prevNode.connect(filter);
        prevNode = filter;
        filters.push({ slider, filter });

        // Update on change
        slider.addEventListener('input', (e) => {
            if (isEqOn) {
                filter.gain.value = parseFloat(e.target.value);
            }
        });
    });

    eqLastNode = prevNode;
    updateEqRouting();
}

function updateEqRouting() {
    if (!audioCtx) return;
    
    // Disconnect everything first
    try { mediaSource.disconnect(); } catch (e) {}
    try { eqLastNode.disconnect(); } catch (e) {}
    try { masterGain.disconnect(); } catch (e) {}
    
    if (isEqOn) {
        mediaSource.connect(filters[0].filter);
        eqLastNode.connect(masterGain);
        masterGain.connect(audioCtx.destination);
        // Restore slider values to filters
        filters.forEach(f => f.filter.gain.value = parseFloat(f.slider.value));
    } else {
        mediaSource.connect(masterGain);
        masterGain.connect(audioCtx.destination);
        // Visuals stay the same, but actual gain is effectively bypassed
    }
}

document.getElementById('eq-toggle').addEventListener('change', (e) => {
    isEqOn = e.target.checked;
    updateEqRouting();
});

document.getElementById('eq-presets').addEventListener('change', (e) => {
    const preset = eqPresets[e.target.value];
    if (preset && filters.length === preset.length) {
        filters.forEach((f, i) => {
            f.slider.value = preset[i];
            if (isEqOn) {
                f.filter.gain.value = preset[i];
            }
        });
    }
});
// Ensure AudioContext is resumed upon user interaction
videoPlayer.addEventListener('play', () => {
    initAudioEq();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
});

// --- LOCAL FILE PLAYBACK ---
// (Moved to the add+ button below, but we'll keep this old button working just in case)
document.getElementById('btn-open-local').addEventListener('click', async () => {
    try {
        const filePath = await OpenFile();
        if (filePath) {
            // Using our custom wails asset server handler /stream
            const url = '/stream?path=' + encodeURIComponent(filePath);
            playMedia(url, filePath.split(/[\\/]/).pop());
        }
    } catch (err) {
        console.error("Failed to open file:", err);
    }
});

function playMedia(url, title) {
    ytIframe.style.display = 'none';
    ytIframe.src = '';
    videoPlayer.style.display = 'block';
    
    videoPlayer.src = url;
    videoPlayer.play();
    document.getElementById('yt-download-controls').style.display = 'none';
}

function playYtMedia(videoId, title, formats = null) {
    videoPlayer.style.display = 'none';
    videoPlayer.pause();
    ytIframe.style.display = 'block';
    
    // Use YouTube's official embed player with JS API enabled!
    ytIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
    isYtPlaying = true;
    document.getElementById('btn-playpause').textContent = '⏸';
    
    const dlControls = document.getElementById('yt-download-controls');
    dlControls.style.display = 'flex';
    
    const formatSelect = document.getElementById('download-format-select');
    formatSelect.innerHTML = '';
    
    // Filter formats to remove pure duplicates and pick best combinations
    if (formats && formats.length > 0) {
        formats.forEach(f => {
            if (!f.url) return;
            const opt = document.createElement('option');
            opt.value = f.url;
            let typeLabel = (f.type && f.type.includes('audio')) ? 'Audio' : 'Video';
            let resLabel = f.qualityLabel || f.resolution || f.audioQuality || typeLabel;
            opt.textContent = `${resLabel} (${f.container || 'mp4'})`;
            opt.dataset.ext = f.container || 'mp4';
            formatSelect.appendChild(opt);
        });
    } else {
        // Fallback options
        formatSelect.innerHTML = `
            <option value="https://invidious.f5.si/latest_version?id=${videoId}&itag=22&local=true" data-ext="mp4">720p (HD Video)</option>
            <option value="https://invidious.f5.si/latest_version?id=${videoId}&itag=18&local=true" data-ext="mp4">360p (SD Video)</option>
            <option value="https://invidious.f5.si/latest_version?id=${videoId}&itag=140&local=true" data-ext="m4a">Audio Only (M4A)</option>
        `;
    }
    
    document.getElementById('btn-download-yt').onclick = async () => {
        const selectedOpt = formatSelect.options[formatSelect.selectedIndex];
        const url = selectedOpt.value;
        const ext = `.${selectedOpt.dataset.ext}`;
        
        const suggestedName = `${title.replace(/[^a-zA-Z0-9 ]/g, "")}${ext}`;
        document.getElementById('btn-download-yt').innerText = "Downloading...";
        try {
            const savedTo = await DownloadFile(url, suggestedName);
            if (savedTo) {
                alert(`Successfully downloaded to: ${savedTo}`);
            }
        } catch (err) {
            console.error(err);
            alert("Download failed: " + err);
        }
        document.getElementById('btn-download-yt').innerText = "Download";
    };
}

function addToPlaylist(source, title, time, url, ytVideoId = null, thumb = '') {
    playlistData.push({
        source,
        title,
        time,
        url,
        ytVideoId,
        thumb
    });
    renderPlaylist();
}

function renderPlaylist() {
    playlistBody.innerHTML = '';
    playlistData.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'play-row';
        
        const thumbHtml = item.thumb ? `<img src="${item.thumb}" style="width:50px; height:35px; object-fit:cover; border-radius:4px;">` : '🎬';
        
        tr.innerHTML = `
            <td onclick="event.stopPropagation()">
                <input type="text" class="sl-input" data-index="${index}" value="${index + 1}">
            </td>
            <td style="text-align:center;">${thumbHtml}</td>
            <td>${item.source}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</td>
            <td>${item.time}</td>
            <td style="text-align:center;" onclick="event.stopPropagation()">
                <button class="menu-btn" style="padding: 2px 6px; font-size: 0.8rem; background: var(--panel-bg); color: #ff4444; border: 1px solid var(--border-color); border-radius: 4px;" data-del="${index}">❌</button>
            </td>
        `;
        
        // Right Click Context Menu
        tr.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            activeCtxItem = item;
            const ctxMenu = document.getElementById('context-menu');
            ctxMenu.style.display = 'flex';
            ctxMenu.style.left = e.pageX + 'px';
            ctxMenu.style.top = e.pageY + 'px';
        });
        
        tr.addEventListener('click', () => {
            playItemAtIndex(index);
        });
        
        playlistBody.appendChild(tr);
    });
    
    // Add delete listeners
    document.querySelectorAll('button[data-del]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-del'));
            playlistData.splice(idx, 1);
            renderPlaylist();
        });
    });
}

function playItemAtIndex(idx) {
    if (idx < 0 || idx >= playlistData.length) return;
    currentPlayIndex = idx;
    const item = playlistData[idx];
    if (item.source === 'YouTube') {
        playYtMedia(item.ytVideoId, item.title, null);
    } else {
        playMedia(item.url, item.title);
    }
}

document.getElementById('btn-refresh-playlist').addEventListener('click', () => {
    const inputs = document.querySelectorAll('.sl-input');
    const newOrder = [];
    
    inputs.forEach(input => {
        const oldIndex = parseInt(input.getAttribute('data-index'));
        const newSlNo = parseInt(input.value);
        newOrder.push({
            item: playlistData[oldIndex],
            slNo: isNaN(newSlNo) ? oldIndex + 1 : newSlNo
        });
    });
    
    // Sort by new Sl.No
    newOrder.sort((a, b) => a.slNo - b.slNo);
    
    // Update playlist data
    playlistData = newOrder.map(obj => obj.item);
    renderPlaylist();
});

// Named Playlist Logic
function getSavedPlaylists() {
    const raw = localStorage.getItem('medpex_playlists_v2');
    return raw ? JSON.parse(raw) : {};
}

function savePlaylists(obj) {
    localStorage.setItem('medpex_playlists_v2', JSON.stringify(obj));
}

document.getElementById('btn-save-menu').addEventListener('click', () => {
    const name = prompt("Enter a name for this playlist:");
    if (!name || name.trim() === "") return;
    
    const playlists = getSavedPlaylists();
    playlists[name.trim()] = playlistData;
    savePlaylists(playlists);
    alert(`Playlist '${name}' saved successfully!`);
});

const loadModal = document.getElementById('load-playlist-modal');
document.getElementById('close-load-modal').onclick = () => loadModal.style.display = "none";

document.getElementById('btn-load-menu').addEventListener('click', () => {
    const playlists = getSavedPlaylists();
    const listUI = document.getElementById('saved-playlists-list');
    listUI.innerHTML = '';
    
    if (Object.keys(playlists).length === 0) {
        listUI.innerHTML = '<li>No saved playlists.</li>';
    } else {
        Object.keys(playlists).forEach(name => {
            const li = document.createElement('li');
            li.style.display = "flex";
            li.style.justifyContent = "space-between";
            li.style.marginBottom = "10px";
            
            const btnLoad = document.createElement('button');
            btnLoad.textContent = `📂 ${name} (${playlists[name].length} items)`;
            btnLoad.className = 'menu-btn';
            btnLoad.style.border = '1px solid var(--border-color)';
            btnLoad.onclick = () => {
                playlistData = playlists[name];
                renderPlaylist();
                loadModal.style.display = "none";
            };
            
            const btnDel = document.createElement('button');
            btnDel.textContent = '❌';
            btnDel.className = 'menu-btn';
            btnDel.onclick = () => {
                if (confirm(`Delete playlist '${name}'?`)) {
                    delete playlists[name];
                    savePlaylists(playlists);
                    li.remove();
                }
            };
            
            li.appendChild(btnLoad);
            li.appendChild(btnDel);
            listUI.appendChild(li);
        });
    }
    
    loadModal.style.display = "block";
});

// Ribbon Open Local file fallback
document.getElementById('btn-open-local-menu').addEventListener('click', () => {
    document.getElementById('btn-open-local').click();
});

document.getElementById('btn-add-file').addEventListener('click', async () => {
    const input = prompt("Enter YouTube link to add (or leave blank to open a local file):");
    if (input === null) return; // cancelled
    
    if (input.trim() === "") {
        // Open local file
        try {
            const filepath = await OpenFile();
            if (filepath) {
                const parts = filepath.split(/[\/\\]/);
                const filename = parts[parts.length - 1];
                const proxyUrl = '/stream?path=' + encodeURIComponent(filepath);
                addToPlaylist('Local', filename, '-', proxyUrl, null);
                playMedia(proxyUrl, filename);
            }
        } catch (err) {
            console.error(err);
        }
    } else {
        // Assume YouTube link or search query
        searchYouTube(input);
    }
});

// --- YOUTUBE INVIDIOUS API ---
const INVIDIOUS_INSTANCES = [
    'https://invidious.f5.si',
    'https://invidious.nerdvpn.de',
    'https://invidious.projectsegfau.lt',
    'https://inv.tux.pizza',
    'https://invidious.jing.rocks'
];

async function fetchYtDetails(videoId) {
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const videoUrl = `${instance}/api/v1/videos/${videoId}`;
            const proxyUrl = '/proxy?url=' + encodeURIComponent(videoUrl);
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;
            
            const data = await response.json();
            
            const timeString = data.lengthSeconds ? new Date(data.lengthSeconds * 1000).toISOString().substring(11, 19).replace(/^00:/, '') : '-';
            const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            
            // Extract ALL formats
            const formats = [];
            if (data.formatStreams) formats.push(...data.formatStreams);
            if (data.adaptiveFormats) {
                 formats.push(...data.adaptiveFormats);
            }
            
            // Sort by quality
            formats.sort((a, b) => {
                 let resA = parseInt(a.qualityLabel) || 0;
                 let resB = parseInt(b.qualityLabel) || 0;
                 return resB - resA;
            });
            
            addToPlaylist('YouTube', data.title, timeString, null, videoId, thumbUrl);
            playYtMedia(videoId, data.title, formats);
            return;
        } catch (err) {
            console.error(`Failed to fetch details from ${instance}:`, err);
        }
    }
    // Fallback if all instances fail to fetch details
    addToPlaylist('YouTube', "Pasted YouTube Video", "-", null, videoId, `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
    playYtMedia(videoId, "Pasted YouTube Video", null);
}

async function searchYouTube(query) {
    // Check if query is a YouTube URL
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = query.match(regExp);
    if (match && match[2] && match[2].length === 11) {
        fetchYtDetails(match[2]);
        return;
    }

    playlistBody.innerHTML = '<tr><td colspan="5">Searching...</td></tr>';
    
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
            const proxySearchUrl = '/proxy?url=' + encodeURIComponent(searchUrl);
            const response = await fetch(proxySearchUrl);
            if (!response.ok) continue;
            const data = await response.json();
            
            playlistBody.innerHTML = '';
            data.forEach(video => {
                const tr = document.createElement('tr');
                tr.className = 'play-row';
                
                const timeString = video.lengthSeconds ? new Date(video.lengthSeconds * 1000).toISOString().substring(11, 19).replace(/^00:/, '') : '-';
                const thumbUrl = `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
                const thumbHtml = `<img src="${thumbUrl}" style="width:50px; height:35px; object-fit:cover; border-radius:4px;">`;
                
                tr.innerHTML = `
                    <td>+</td>
                    <td style="text-align:center;">${thumbHtml}</td>
                    <td>YouTube</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${video.title}</td>
                    <td>${timeString}</td>
                    <td></td>
                `;
                
                tr.addEventListener('click', () => {
                    fetchYtDetails(video.videoId); // fetch details for formats and proper insertion
                });
                playlistBody.appendChild(tr);
            });
            return; // Successfully loaded, exit loop
        } catch (error) {
            console.log(`Failed on ${instance}:`, error);
        }
    }
    playlistBody.innerHTML = `<tr><td colspan="5">Error: All instances failed or rate limited</td></tr>`;
}

// (Legacy function, no longer needed as we use IFrame)
async function fetchAndPlayYt(videoId, title) {
    playYtMedia(videoId, title);
}

document.getElementById('btn-search-yt').addEventListener('click', () => {
    const q = document.getElementById('yt-query').value;
    if (q.trim()) searchYouTube(q);
});
document.getElementById('yt-query').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const q = e.target.value;
        if (q.trim()) searchYouTube(q);
    }
});

// Removed old addToPlaylist function

// --- TOP MENU MODALS ---
const modal = document.getElementById('info-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');

closeModal.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; }

function showModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.style.display = "block";
}

document.getElementById('btn-about').onclick = () => showModal("About Us", "<p>MedPex is an advanced local and online media player featuring custom Equalizer settings, playlist management, and Invidious YouTube streaming.</p><p>Built with Wails & Go.</p>");
document.getElementById('btn-reach').onclick = () => showModal("Reach Us", "<p>Email: contact@medpex.example.com</p><p>GitHub: github.com/user/med_pex</p>");
document.getElementById('btn-info').onclick = () => showModal("How to use", "<ul><li style='margin-bottom:10px;'><b>Local Files:</b> Click 'Add +' or 'Open Local File' to play offline media.</li><li style='margin-bottom:10px;'><b>YouTube:</b> Paste a link into the search bar or use 'Add +'.</li><li style='margin-bottom:10px;'><b>Playlist:</b> Change Sl.No inputs and click 'Refresh Order' to reorder.</li><li style='margin-bottom:10px;'><b>Equalizer:</b> Toggle on for local offline media processing!</li></ul>");
document.getElementById('btn-license').onclick = () => showModal("License", "<p>MIT License</p><p>Copyright (c) 2026</p><p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software...</p>");
document.getElementById('btn-settings').onclick = () => showModal("Settings", "<p>Settings functionality coming soon.</p>");

// --- CUSTOM MEDIA CONTROLS & LOGIC ---
let currentPlayIndex = -1;
let isShuffle = false;
let isRepeat = false;
let isYtPlaying = false;

document.getElementById('btn-shuffle').onclick = (e) => {
    isShuffle = !isShuffle;
    e.target.style.color = isShuffle ? 'var(--accent-color)' : '';
};
document.getElementById('btn-repeat').onclick = (e) => {
    isRepeat = !isRepeat;
    e.target.style.color = isRepeat ? 'var(--accent-color)' : '';
};

function playNext() {
    if (playlistData.length === 0) return;
    if (isShuffle) {
        currentPlayIndex = Math.floor(Math.random() * playlistData.length);
    } else {
        currentPlayIndex++;
        if (currentPlayIndex >= playlistData.length) {
            if (isRepeat) currentPlayIndex = 0;
            else return; 
        }
    }
    playItemAtIndex(currentPlayIndex);
}

function playPrev() {
    if (playlistData.length === 0) return;
    currentPlayIndex--;
    if (currentPlayIndex < 0) {
        currentPlayIndex = isRepeat ? playlistData.length - 1 : 0;
    }
    playItemAtIndex(currentPlayIndex);
}

const btnPlayPause = document.getElementById('btn-playpause');
const btnStop = document.getElementById('btn-stop');
const seekBar = document.getElementById('seek-bar');
const timeDisplay = document.getElementById('time-display');
const volBar = document.getElementById('vol-bar');
const btnSpeed = document.getElementById('btn-speed');
const btnABRepeat = document.getElementById('btn-ab-repeat');

btnPlayPause.onclick = () => {
    if (videoPlayer.style.display === 'none') {
        isYtPlaying = !isYtPlaying;
        const func = isYtPlaying ? 'playVideo' : 'pauseVideo';
        ytIframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: func}), '*');
        btnPlayPause.textContent = isYtPlaying ? '⏸' : '▶';
    } else {
        if (videoPlayer.paused) videoPlayer.play();
        else videoPlayer.pause();
    }
};

videoPlayer.addEventListener('play', () => btnPlayPause.textContent = '⏸');
videoPlayer.addEventListener('pause', () => btnPlayPause.textContent = '▶');

btnStop.onclick = () => {
    if (videoPlayer.style.display !== 'none') {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
    } else {
        ytIframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: 'stopVideo'}), '*');
        btnPlayPause.textContent = '▶';
        isYtPlaying = false;
    }
};

let abStart = -1, abEnd = -1, abState = 0;
videoPlayer.addEventListener('timeupdate', () => {
    if (abEnd > 0 && videoPlayer.currentTime >= abEnd) {
        videoPlayer.currentTime = abStart;
    }
    const ratio = videoPlayer.currentTime / videoPlayer.duration;
    seekBar.value = ratio * 100 || 0;
    
    const cur = formatTime(videoPlayer.currentTime);
    const tot = formatTime(videoPlayer.duration);
    timeDisplay.textContent = `${cur} / ${tot}`;
});


document.getElementById('btn-mute').onclick = (e) => {
    setVolume(videoPlayer.muted ? 1 : 0);
};

let isBoostEnabled = false;
document.getElementById('btn-boost').onclick = (e) => {
    if (!isBoostEnabled) {
        if (confirm("Warning: Boosting volume above 100% can cause audio distortion and may damage your speakers or hearing. Proceed?")) {
            isBoostEnabled = true;
            volBar.max = 3;
            e.target.style.color = "var(--accent-color)";
        }
    } else {
        isBoostEnabled = false;
        volBar.max = 1;
        e.target.style.color = "";
        if (parseFloat(volBar.value) > 1) {
            setVolume(1);
        }
    }
};

volBar.addEventListener('input', () => {
    setVolume(parseFloat(volBar.value));
});

function setVolume(v) {
    let maxVol = isBoostEnabled ? 3 : 1;
    v = Math.max(0, Math.min(maxVol, v));
    volBar.value = v;
    if (v <= 1) {
        videoPlayer.volume = v;
        if (masterGain) masterGain.gain.value = 1;
    } else {
        videoPlayer.volume = 1;
        if (masterGain) masterGain.gain.value = v;
    }
    videoPlayer.muted = (v === 0);
    document.getElementById('btn-mute').textContent = videoPlayer.muted ? '🔇' : '🔊';
    
    if (ytIframe.contentWindow) {
        let ytVol = Math.min(100, v * 100);
        ytIframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: 'setVolume', args: [ytVol]}), '*');
    }
}

let playbackSpeeds = [0.5, 1.0, 1.25, 1.5, 2.0];
let speedIndex = 1;
btnSpeed.onclick = () => cycleSpeed(1);

function cycleSpeed(dir) {
    speedIndex = (speedIndex + dir + playbackSpeeds.length) % playbackSpeeds.length;
    videoPlayer.playbackRate = playbackSpeeds[speedIndex];
    btnSpeed.textContent = playbackSpeeds[speedIndex].toFixed(1) + 'x';
    if(ytIframe.contentWindow) {
         ytIframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: 'setPlaybackRate', args: [playbackSpeeds[speedIndex]]}), '*');
    }
}

btnABRepeat.onclick = () => {
    if (abState === 0) {
        abStart = videoPlayer.currentTime;
        abState = 1;
        btnABRepeat.textContent = 'A-';
        btnABRepeat.style.color = 'var(--accent-color)';
    } else if (abState === 1) {
        abEnd = videoPlayer.currentTime;
        abState = 2;
        btnABRepeat.textContent = 'A-B';
    } else {
        abStart = -1; abEnd = -1; abState = 0;
        btnABRepeat.textContent = 'A-B';
        btnABRepeat.style.color = '';
    }
};

videoPlayer.addEventListener('ended', playNext);
document.getElementById('btn-next').onclick = playNext;
document.getElementById('btn-prev').onclick = playPrev;

function formatTime(sec) {
    if (!sec || isNaN(sec)) return "00:00";
    let m = Math.floor(sec / 60);
    let s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ":" + (s < 10 ? '0' : '') + s;
}

// --- YOUTUBE IFRAME SYNC & KEYBOARD SHORTCUTS ---
let ytCurrentTime = 0;
let ytDuration = 0;

ytIframe.onload = () => {
    ytIframe.contentWindow.postMessage(JSON.stringify({event: 'listening'}), '*');
};

window.addEventListener('message', (e) => {
    try {
        const data = JSON.parse(e.data);
        if (data.event === 'infoDelivery' && data.info) {
            if (data.info.currentTime !== undefined) ytCurrentTime = data.info.currentTime;
            if (data.info.duration !== undefined) ytDuration = data.info.duration;
            if (data.info.playerState !== undefined) {
                 if (data.info.playerState === 0) playNext();
                 if (data.info.playerState === 1) {
                      isYtPlaying = true;
                      btnPlayPause.textContent = '⏸';
                 }
                 if (data.info.playerState === 2) {
                      isYtPlaying = false;
                      btnPlayPause.textContent = '▶';
                 }
            }
            if (ytIframe.style.display !== 'none') {
                 const ratio = ytCurrentTime / ytDuration;
                 if(!isNaN(ratio)) seekBar.value = ratio * 100 || 0;
                 timeDisplay.textContent = formatTime(ytCurrentTime) + " / " + formatTime(ytDuration);
            }
        }
    } catch(err) {}
});

seekBar.addEventListener('input', () => {
    if (videoPlayer.style.display !== 'none' && videoPlayer.duration) {
        videoPlayer.currentTime = (seekBar.value / 100) * videoPlayer.duration;
    } else if (ytIframe.style.display !== 'none' && ytDuration) {
        const t = (seekBar.value / 100) * ytDuration;
        ytIframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: 'seekTo', args: [t, true]}), '*');
    }
});

window.addEventListener('keydown', (e) => {
    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
        e.preventDefault();
        btnPlayPause.click();
    } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) playNext();
        else seekRelative(10);
    } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) playPrev();
        else seekRelative(-10);
    } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setVolume(parseFloat(volBar.value) + 0.05);
    } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setVolume(parseFloat(volBar.value) - 0.05);
    } else if (e.shiftKey && (e.key === '>' || e.key === '.')) {
        e.preventDefault();
        cycleSpeed(1);
    } else if (e.shiftKey && (e.key === '<' || e.key === ',')) {
        e.preventDefault();
        cycleSpeed(-1);
    } else if (e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        setVolume(0.75);
    }
});

function seekRelative(delta) {
    if (videoPlayer.style.display !== 'none' && videoPlayer.duration) {
        videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.duration, videoPlayer.currentTime + delta));
    } else if (ytIframe.style.display !== 'none' && ytDuration) {
        const t = Math.max(0, Math.min(ytDuration, ytCurrentTime + delta));
        ytIframe.contentWindow.postMessage(JSON.stringify({event: 'command', func: 'seekTo', args: [t, true]}), '*');
    }
}

// --- CONTEXT MENU LOGIC ---
let activeCtxItem = null;
const ctxMenu = document.getElementById('context-menu');
document.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
});

document.getElementById('ctx-copy-link').onclick = () => {
    if (!activeCtxItem) return;
    const url = activeCtxItem.url || `https://youtube.com/watch?v=${activeCtxItem.ytVideoId}`;
    navigator.clipboard.writeText(url).then(() => alert('Link copied to clipboard!'));
};

const addToListModal = document.getElementById('add-to-list-modal');
document.getElementById('close-add-to-list-modal').onclick = () => addToListModal.style.display = 'none';

document.getElementById('ctx-add-to-list').onclick = () => {
    if (!activeCtxItem) return;
    const playlists = getSavedPlaylists();
    const listUI = document.getElementById('append-playlists-list');
    listUI.innerHTML = '';
    
    if (Object.keys(playlists).length === 0) {
        listUI.innerHTML = '<li>No saved playlists exist yet.</li>';
    } else {
        Object.keys(playlists).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn';
            btn.style.width = '100%';
            btn.style.marginBottom = '5px';
            btn.textContent = `➕ Add to '${name}'`;
            btn.onclick = () => {
                playlists[name].push(activeCtxItem);
                savePlaylists(playlists);
                addToListModal.style.display = 'none';
                alert(`Added to playlist '${name}'`);
            };
            listUI.appendChild(btn);
        });
    }
    addToListModal.style.display = 'block';
};

document.getElementById('ctx-create-new-list').onclick = () => {
    if (!activeCtxItem) return;
    const name = prompt("Name the new playlist:");
    if (name && name.trim() !== "") {
        const playlists = getSavedPlaylists();
        playlists[name.trim()] = [activeCtxItem];
        savePlaylists(playlists);
        alert(`Created new playlist '${name}' with 1 item!`);
    }
};
