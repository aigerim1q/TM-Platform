package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateLimitEntry struct {
	count   int
	resetAt time.Time
}

func RateLimitByIP(limit int, window time.Duration) func(http.Handler) http.Handler {
	if limit <= 0 {
		limit = 60
	}
	if window <= 0 {
		window = time.Minute
	}

	var (
		mu      sync.Mutex
		entries = map[string]rateLimitEntry{}
	)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			now := time.Now().UTC()
			ip := clientIP(r)

			mu.Lock()
			entry := entries[ip]
			if entry.resetAt.IsZero() || now.After(entry.resetAt) {
				entry = rateLimitEntry{count: 0, resetAt: now.Add(window)}
			}
			entry.count++
			entries[ip] = entry

			for key, e := range entries {
				if now.After(e.resetAt.Add(window)) {
					delete(entries, key)
				}
			}
			mu.Unlock()

			if entry.count > limit {
				retryAfter := int(time.Until(entry.resetAt).Seconds())
				if retryAfter < 1 {
					retryAfter = int(window.Seconds())
				}
				w.Header().Set("Retry-After", strconvItoa(retryAfter))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"rate limit exceeded"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	host := strings.TrimSpace(r.RemoteAddr)
	if parsed, _, err := net.SplitHostPort(host); err == nil && parsed != "" {
		return parsed
	}
	if host == "" {
		return "unknown"
	}
	return host
}

func strconvItoa(v int) string {
	if v == 0 {
		return "0"
	}
	neg := false
	if v < 0 {
		neg = true
		v = -v
	}
	out := make([]byte, 0, 12)
	for v > 0 {
		out = append(out, byte('0'+(v%10)))
		v /= 10
	}
	if neg {
		out = append(out, '-')
	}
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return string(out)
}
