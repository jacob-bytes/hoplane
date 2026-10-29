package handler

import (
	"net/http"

	"go-backend/internal/auth"
	"go-backend/internal/http/middleware"
	"go-backend/internal/http/response"
)

func (h *Handler) userSessionList(w http.ResponseWriter, r *http.Request) {
	userID, _, err := userRoleFromRequest(r)
	if err != nil {
		response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
		return
	}

	claims, _ := r.Context().Value(middleware.ClaimsContextKey).(auth.Claims)
	items, err := h.repo.ListUserSessions(userID)
	if err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}

	out := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		out = append(out, map[string]interface{}{
			"id": item.ID, "ip": item.IP, "userAgent": item.UserAgent,
			"createdAt": item.CreatedAt, "lastSeenAt": item.LastSeenAt,
			"expiresAt": item.ExpiresAt, "current": item.TokenID == claims.JTI,
		})
	}

	response.WriteJSON(w, response.OK(out))
}

func (h *Handler) userSessionRevoke(w http.ResponseWriter, r *http.Request) {
	userID, _, err := userRoleFromRequest(r)
	if err != nil {
		response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
		return
	}
	var req struct {
		ID int64 `json:"id"`
	}
	if err := decodeJSON(r.Body, &req); err != nil || req.ID <= 0 {
		response.WriteJSON(w, response.ErrDefault("参数错误"))
		return
	}
	if err := h.repo.RevokeUserSession(userID, req.ID); err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}
	response.WriteJSON(w, response.OKEmpty())
}

func (h *Handler) userSessionRevokeOthers(w http.ResponseWriter, r *http.Request) {
	userID, _, err := userRoleFromRequest(r)
	if err != nil {
		response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
		return
	}
	claims, _ := r.Context().Value(middleware.ClaimsContextKey).(auth.Claims)
	if err := h.repo.RevokeOtherUserSessions(userID, claims.JTI); err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}
	response.WriteJSON(w, response.OKEmpty())
}

func (h *Handler) userSessionRevokeAll(w http.ResponseWriter, r *http.Request) {
	userID, _, err := userRoleFromRequest(r)
	if err != nil {
		response.WriteJSON(w, response.Err(401, "无效的token或token已过期"))
		return
	}
	if err := h.repo.RevokeAllUserSessions(userID); err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}
	response.WriteJSON(w, response.OKEmpty())
}
