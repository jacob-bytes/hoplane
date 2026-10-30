package handler

import (
	"net/http"

	"go-backend/internal/http/response"
)

func (h *Handler) notifyLogsList(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListNotifyLogs(20)
	if err != nil {
		response.WriteJSON(w, response.Err(-2, err.Error()))
		return
	}
	out := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		out = append(out, map[string]interface{}{
			"id": item.ID, "event": item.Event, "title": item.Title,
			"message": item.Message, "success": item.Success,
			"error": item.Error, "createdAt": item.CreatedAt,
		})
	}
	response.WriteJSON(w, response.OK(out))
}

func (h *Handler) notifyLogResend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID int64 `json:"id"`
	}
	if err := decodeJSON(r.Body, &req); err != nil || req.ID <= 0 {
		response.WriteJSON(w, response.ErrDefault("参数错误"))
		return
	}
	item, err := h.repo.GetNotifyLog(req.ID)
	if err != nil {
		response.WriteJSON(w, response.ErrDefault("告警记录不存在"))
		return
	}
	h.notify(item.Event, item.Title, item.Message)
	response.WriteJSON(w, response.OKEmpty())
}
