package repo

import (
	"errors"
	"time"

	"go-backend/internal/store/model"
)

func (r *Repository) CreateAuditLog(entry model.AuditLog) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	if entry.CreatedAt == 0 {
		entry.CreatedAt = time.Now().UnixMilli()
	}

	return r.db.Create(&entry).Error
}

func (r *Repository) ListAuditLogs(limit int) ([]model.AuditLog, error) {
	if r == nil || r.db == nil {
		return nil, errors.New("repository not initialized")
	}
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	var items []model.AuditLog
	err := r.db.Order("id DESC").Limit(limit).Find(&items).Error
	if err == nil && items == nil {
		items = make([]model.AuditLog, 0)
	}

	return items, err
}
