package main

import (
	_ "embed"
	"net"
	"net/http"
	"os"
	"path/filepath"

	webview2 "github.com/jchv/go-webview2"
)

//go:embed index.html
var page []byte

func main() {
	// Fester Port, damit der Spielstand (localStorage) immer zur selben Adresse gehört.
	addr := "127.0.0.1:47823"
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		ln, _ = net.Listen("tcp", "127.0.0.1:47824")
	}
	url := "http://" + ln.Addr().String() + "/"
	go http.Serve(ln, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(page)
	}))

	data := filepath.Join(os.Getenv("LOCALAPPDATA"), "Lumen")
	os.MkdirAll(data, 0o755)
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  data,
		WindowOptions: webview2.WindowOptions{
			Title:  "Lumen – Der letzte Funke",
			Width:  1280,
			Height: 800,
			IconId: 1,
			Center: true,
		},
	})
	if w == nil {
		msg := "Lumen braucht die Microsoft Edge WebView2 Runtime.\nBitte installiere sie von: https://go.microsoft.com/fwlink/p/?LinkId=2124703"
		os.WriteFile(filepath.Join(os.TempDir(), "lumen-fehler.txt"), []byte(msg), 0o644)
		showError(msg)
		return
	}
	defer w.Destroy()
	w.SetSize(1280, 800, webview2.HintNone)
	w.Navigate(url)
	w.Run()
}
