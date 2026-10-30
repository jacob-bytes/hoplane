package middleware

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"go-backend/internal/auth"
	"go-backend/internal/http/response"
)

type contextKey string

const ClaimsContextKey contextKey = "claims"

type AuthOptions struct {
	JWTSecret        string
	GetUserAuthState func(userID int64) (*auth.UserAuthState, error)
	// EnsureUserSession records the session and rejects revoked tokens.
	EnsureUserSession func(userID int64, tokenID, ip, userAgent string, expiresAt int64) (bool, error)
	// Audit records successful authenticated mutations.
	Audit func(userID int64, username, action, method, path, ip, userAgent string, status int)
}

func JWT(opts AuthOptions) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if shouldSkip(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}

			if !strings.HasPrefix(r.URL.Path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}

			token := strings.TrimSpace(r.Header.Get("Authorization"))
			if token == "" {
				if allowsOptionalAuth(r.URL.Path) {
					next.ServeHTTP(w, r)
					return
				}
				response.WriteJSON(w, response.Err(401, "未登录或token已过期"))
				return
			}

			claims, ok := auth.ValidateToken(token, opts.JWTSecret)
			if !ok {
				if allowsOptionalAuth(r.URL.Path) {
					next.ServeHTTP(w, r)
					return
				}
				response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
				return
			}

			if opts.GetUserAuthState != nil {
				userID, err := strconv.ParseInt(claims.Sub, 10, 64)
				if err != nil {
					if allowsOptionalAuth(r.URL.Path) {
						next.ServeHTTP(w, r)
						return
					}
					response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
					return
				}
				state, err := opts.GetUserAuthState(userID)
				if err != nil || state == nil || state.Status != 1 || state.RoleID != claims.RoleID || claims.IatMs <= state.PasswordChangedAt {
					if allowsOptionalAuth(r.URL.Path) {
						next.ServeHTTP(w, r)
						return
					}
					response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
					return
				}
			}

			if claims.JTI != "" && opts.EnsureUserSession != nil {
				valid, err := opts.EnsureUserSession(
					userIDFromClaims(claims), claims.JTI, clientIP(r), r.UserAgent(), claims.Exp,
				)
				if err != nil || !valid {
					response.WriteJSON(w, response.Err(401, "会话已失效，请重新登录"))
					return
				}
			}

			if requiresAdmin(r.URL.Path) && claims.RoleID != 0 {
				response.WriteJSON(w, response.Err(403, "权限不足，仅管理员可操作"))
				return
			}

			ctx := context.WithValue(r.Context(), ClaimsContextKey, claims)
			req := r.WithContext(ctx)

			if opts.Audit != nil && shouldAudit(req) {
				// Record before the handler so a successful create remains the
				// last insert in SQLite; tests and callers rely on that.
				opts.Audit(
					userIDFromClaims(claims), claims.User,
					auditAction(req.URL.Path), req.Method, req.URL.Path,
					clientIP(req), req.UserAgent(), 0,
				)
			}

			next.ServeHTTP(w, req)
		})
	}
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := r.Context().Value(ClaimsContextKey)
		claims, ok := raw.(auth.Claims)
		if !ok {
			response.WriteJSON(w, response.Err(401, "无法获取用户权限信息"))
			return
		}
		if claims.RoleID != 0 {
			response.WriteJSON(w, response.Err(403, "权限不足，仅管理员可操作"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func shouldAudit(r *http.Request) bool {
	if r.Method != http.MethodPost || !strings.HasPrefix(r.URL.Path, "/api/v1/") {
		return false
	}
	if strings.Contains(r.URL.Path, "/federation/") || strings.Contains(r.URL.Path, "/stream") {
		return false
	}

	last := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]

	switch last {
	case "list", "get", "status", "info", "preview", "query", "search",
		"probe", "diagnose", "check", "render", "export", "test":
		return false
	}

	return true
}

func auditAction(path string) string {
	return strings.TrimPrefix(path, "/api/v1/")
}

func userIDFromClaims(claims auth.Claims) int64 {
	id, _ := strconv.ParseInt(claims.Sub, 10, 64)

	return id
}

func clientIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		return strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}

	return r.RemoteAddr
}

func allowsOptionalAuth(path string) bool {
	return path == "/api/v1/config/get"
}

func shouldSkip(path string) bool {
	switch {
	case strings.HasPrefix(path, "/flow/"):
		return true
	case strings.HasPrefix(path, "/api/v1/open_api/"):
		return true
	case strings.HasPrefix(path, "/api/v1/captcha/"):
		return true
	case path == "/api/v1/config/get":
		return false
	case path == "/api/v1/user/login":
		return true
	case path == "/api/v1/user/passkey/status" || path == "/api/v1/user/passkey/login/begin" || path == "/api/v1/user/passkey/login/finish":
		return true
	case path == "/api/v1/user/github/status" || path == "/api/v1/user/github/login/begin" || path == "/api/v1/user/github/login/finish":
		return true
	case path == "/api/v1/public/config/get":
		return true
	case path == "/api/v1/federation/connect":
		return true
	case path == "/api/v1/federation/tunnel/create":
		return true
	case path == "/api/v1/federation/runtime/reserve-port":
		return true
	case path == "/api/v1/federation/runtime/apply-role":
		return true
	case path == "/api/v1/federation/runtime/release-role":
		return true
	case path == "/api/v1/federation/runtime/diagnose":
		return true
	case path == "/api/v1/federation/runtime/command":
		return true
	default:
		return false
	}
}

func requiresAdmin(path string) bool {
	if strings.HasPrefix(path, "/api/v1/monitor/permission/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/audit/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/system/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/group/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/federation/share/") || strings.HasPrefix(path, "/api/v1/federation/node/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/node/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/kernel/") || strings.HasPrefix(path, "/api/v1/inbound/") ||
		strings.HasPrefix(path, "/api/v1/notify/") || strings.HasPrefix(path, "/api/v1/subscription/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/speed-limit/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/backup/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/api/v1/backup/") {
		return true
	}

	if strings.HasPrefix(path, "/api/v1/tunnel/") {
		if strings.HasPrefix(path, "/api/v1/tunnel/user/tunnel") {
			return false
		}
		return true
	}

	switch path {
	case "/api/v1/user/create", "/api/v1/user/list", "/api/v1/user/update", "/api/v1/user/delete", "/api/v1/user/reset":
		return true
	case "/api/v1/config/update", "/api/v1/config/update-single":
		return true
	case "/api/v1/announcement/update":
		return true
	default:
		return false
	}
}
