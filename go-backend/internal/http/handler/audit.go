package handler

import (
	"net/http"

	"go-backend/internal/http/response"
	"go-backend/internal/store/repo"
)

func (h *Handler) auditList(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Page       int    `json:"page"`
		PageSize   int    `json:"pageSize"`
		Search     string `json:"search"`
		FailedOnly bool   `json:"failedOnly"`
	}
	_ = decodeJSON(r.Body, &req)
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 || req.PageSize > 200 {
		req.PageSize = 50
	}

	items, total, err := h.repo.ListAuditLogsFiltered(repo.AuditFilter{
		Limit: req.PageSize, Offset: (req.Page - 1) * req.PageSize,
		Search: req.Search, FailedOnly: req.FailedOnly,
	})
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
			"code": item.Code, "createdAt": item.CreatedAt,
		})
	}

	response.WriteJSON(w, response.OK(map[string]interface{}{
		"items": out, "total": total, "page": req.Page, "pageSize": req.PageSize,
	}))
}
