package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenFile opens a file dialog and returns the selected file path
func (a *App) OpenFile() (string, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Media File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Media Files",
				Pattern:     "*.mp4;*.webm;*.ogg;*.mp3;*.wav;*.flac;*.m3u;*.mkv;*.avi",
			},
		},
	})
	if err != nil {
		return "", err
	}
	return selection, nil
}

// DownloadFile prompts the user for a save location and downloads the URL to that path.
func (a *App) DownloadFile(url string, suggestedFilename string) (string, error) {
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Media Download",
		DefaultFilename: suggestedFilename,
	})
	if err != nil || savePath == "" {
		return "", err
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("download failed with HTTP status: %d", resp.StatusCode)
	}

	out, err := os.Create(savePath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		return "", err
	}

	return savePath, nil
}
