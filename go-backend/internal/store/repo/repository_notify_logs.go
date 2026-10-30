package repo

import (
	"errors"

	"go-backend/internal/store/model"
)

func (r *Repository) CreateNotifyLog(entry model.NotifyLog) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	return r.db.Create(&entry).Error
}

func (r *Repository) ListNotifyLogs(limit int) ([]model.NotifyLog, error) {
	if r == nil || r.db == nil {
		return nil, errors.New("repository not initialized")
	}
	if limit <= 0 || limit > 200 {
		limit = 20
	}
	var items []model.NotifyLog
	err := r.db.Order("id DESC").Limit(limit).Find(&items).Error
	return items, err
}

func (r *Repository) GetNotifyLog(id int64) (*model.NotifyLog, error) {
	if r == nil || r.db == nil {
		return nil, errors.New("repository not initialized")
	}
	var item model.NotifyLog
	if err := r.db.First(&item, id).Error; err != nil {
		return nil, err
	}
	return &item, nil
}
