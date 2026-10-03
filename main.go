package main

import (
	"embed"
	"io"
	"net/http"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

type FileLoader struct{}

func (h *FileLoader) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	res.Header().Set("Access-Control-Allow-Origin", "*")
	res.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	res.Header().Set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Range")
	
	if req.Method == "OPTIONS" {
		res.WriteHeader(http.StatusOK)
		return
	}

	if req.URL.Path == "/stream" {
		filePath := req.URL.Query().Get("path")
		if filePath == "" {
			res.WriteHeader(http.StatusBadRequest)
			return
		}
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			res.WriteHeader(http.StatusNotFound)
			return
		}
		http.ServeFile(res, req, filePath)
		return
	}

	if req.URL.Path == "/proxy" {
		targetUrl := req.URL.Query().Get("url")
		if targetUrl == "" {
			res.WriteHeader(http.StatusBadRequest)
			return
		}
		
		// Create request to target URL
		proxyReq, err := http.NewRequest("GET", targetUrl, nil)
		if err != nil {
			res.WriteHeader(http.StatusInternalServerError)
			return
		}
		proxyReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
		
		// Copy Range header if present
		if rangeHeader := req.Header.Get("Range"); rangeHeader != "" {
			proxyReq.Header.Set("Range", rangeHeader)
		}
		
		client := &http.Client{}
		resp, err := client.Do(proxyReq)
		if err != nil {
			res.WriteHeader(http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		
		// Copy response headers
		for k, v := range resp.Header {
			// Skip CORS headers from target as we already set them
			if k != "Access-Control-Allow-Origin" && k != "Access-Control-Allow-Methods" && k != "Access-Control-Allow-Headers" {
				for _, val := range v {
					res.Header().Add(k, val)
				}
			}
		}
		res.WriteHeader(resp.StatusCode)
		
		// Stream the body
		io.Copy(res, resp.Body)
		return
	}
	res.WriteHeader(http.StatusNotFound)
}

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "MediPeX v1.0",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Middleware: func(next http.Handler) http.Handler {
				fileLoader := &FileLoader{}
				return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
					if req.URL.Path == "/stream" || req.URL.Path == "/proxy" {
						fileLoader.ServeHTTP(res, req)
						return
					}
					next.ServeHTTP(res, req)
				})
			},
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
