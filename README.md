# MediPeX

**Version:** 0.1.1
**Author:** [@asutx-78](https://github.com/asutx-78)

MediPeX is a powerful, modern, standalone desktop media suite built with [Wails](https://wails.io/) and Go. It combines the functionality of local media players like VLC with seamless, ad-free YouTube streaming and downloading capabilities via Invidious proxy integration.

## 🚀 Features

- **Local & Online Media Playback:** Play offline files (mp4, mkv, mp3, flac, etc.) alongside YouTube videos in one unified player.
- **Advanced Volume Booster:** Bypass system volume limits with a built-in Web Audio API GainNode, boosting audio up to 300%.
- **VLC-Style Custom Controls:** Complete with A-B repeat looping, playback speed control, and precision seek bars.
- **YouTube Integration & Downloads:** Search, stream, and download YouTube videos directly. Extract full 1080p+, 4K, or pure audio formats directly from YouTube's servers.
- **Web Audio Equalizer:** Built-in 5-band EQ with presets (Flat, Bass Booster, Acoustic, Electronic, etc.) to customize your local listening experience.
- **Robust Playlist Engine:** Create, reorder, shuffle, and repeat custom playlists. Save playlists directly to your device and recall them instantly.
- **Keyboard Shortcuts:** Full control over your media without reaching for the mouse.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play / Pause |
| `Arrow Left` / `Right` | Seek backward / forward 10 seconds |
| `Shift + Arrow Left/Right` | Play Previous / Next media in playlist |
| `Arrow Up` / `Down` | Volume Up / Down (5%) |
| `Shift + >` / `<` | Increase / Decrease playback speed |
| `Shift + V` | Reset volume to safe default (75%) |

## 🛠️ Development

MediPeX is built using Go on the backend and raw HTML/CSS/JS on the frontend for lightning-fast performance and a tiny memory footprint.

### Prerequisites
- Go 1.20+
- Node.js & npm (for frontend dependencies)
- Wails CLI

### Running Locally
```bash
wails dev
```

### Building for Release
```bash
wails build
```

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
