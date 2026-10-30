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

func (r *Repository) ListAuditLogs(limit, offset int) ([]model.AuditLog, int64, error) {
	if r == nil || r.db == nil {
		return nil, 0, errors.New("repository not initialized")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var total int64
	if err := r.db.Model(&model.AuditLog{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.AuditLog
	err := r.db.Order("id DESC").Limit(limit).Offset(offset).Find(&items).Error
	if err == nil && items == nil {
		items = make([]model.AuditLog, 0)
	}

	return items, total, err
}

func (r *Repository) CompleteAuditLog(id int64, status, code int) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	return r.db.Model(&model.AuditLog{}).Where("id = ?", id).
		UpdateColumns(map[string]interface{}{"status": status, "code": code}).Error
}

func (r *Repository) PurgeAuditLogs(cutoffMs int64) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	return r.db.Where("created_at < ?", cutoffMs).Delete(&model.AuditLog{}).Error
}
