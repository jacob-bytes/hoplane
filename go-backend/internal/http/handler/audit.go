package handler

import (
	"net/http"

	"go-backend/internal/http/response"
)

func (h *Handler) auditList(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListAuditLogs(200)
	if err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}

	out := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		out = append(out, map[string]interface{}{
			"id": item.ID, "userId": item.UserID, "username": item.Username,
			"action": item.Action, "method": item.Method, "path": item.Path,
			"ip": item.IP, "userAgent": item.UserAgent, "status": item.Status,
			"createdAt": item.CreatedAt,
		})
	}

	response.WriteJSON(w, response.OK(out))
}
