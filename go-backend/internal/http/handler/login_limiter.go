package handler

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

const (
	loginMaxFailures = 5
	loginWindow      = 15 * time.Minute
	loginBlock       = 15 * time.Minute
)

type loginAttempt struct {
	failures     int
	windowStart  time.Time
	blockedUntil time.Time
}

type loginLimiter struct {
	mu       sync.Mutex
	attempts map[string]loginAttempt
}

func newLoginLimiter() *loginLimiter {
	return &loginLimiter{attempts: make(map[string]loginAttempt)}
}

func (l *loginLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, ok := l.attempts[key]
	if !ok {
		return true
	}
	if now.Before(entry.blockedUntil) {
		return false
	}
	if now.Sub(entry.windowStart) > loginWindow {
		delete(l.attempts, key)

		return true
	}

	return true
}

func (l *loginLimiter) fail(key string, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	entry := l.attempts[key]
	if entry.windowStart.IsZero() || now.Sub(entry.windowStart) > loginWindow {
		entry = loginAttempt{windowStart: now}
	}
	entry.failures++
	if entry.failures >= loginMaxFailures {
		entry.blockedUntil = now.Add(loginBlock)
	}
	l.attempts[key] = entry
}

func (l *loginLimiter) reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}

func loginKey(r *http.Request, username string) string {
	ip := strings.TrimSpace(r.RemoteAddr)
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		ip = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}

	return strings.ToLower(strings.TrimSpace(username)) + "|" + ip
}
