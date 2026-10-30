package repo

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"go-backend/internal/store/model"
)

// EnsureUserSession creates the session row on first use and rejects revoked
// or expired tokens. LastSeenAt is refreshed at most once every five minutes.
func (r *Repository) EnsureUserSession(userID int64, tokenID, ip, userAgent string, expiresAt int64) (bool, error) {
	if r == nil || r.db == nil {
		return false, errors.New("repository not initialized")
	}
	if tokenID == "" {
		return true, nil
	}

	now := time.Now().UnixMilli()
	if expiresAt > 0 && expiresAt*1000 < now {
		return false, nil
	}

	var session model.UserSession
	err := r.db.Where("token_id = ?", tokenID).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true, r.db.Create(&model.UserSession{
			UserID: userID, TokenID: tokenID, IP: ip, UserAgent: userAgent,
			CreatedAt: now, LastSeenAt: now, ExpiresAt: expiresAt * 1000,
		}).Error
	}
	if err != nil {
		return false, err
	}
	if session.UserID != userID || session.RevokedAt.Valid ||
		(session.ExpiresAt > 0 && session.ExpiresAt < now) {
		return false, nil
	}
	if now-session.LastSeenAt > 5*60*1000 {
		_ = r.db.Model(&model.UserSession{}).Where("id = ?", session.ID).
			Update("last_seen_at", now).Error
	}

	return true, nil
}

func (r *Repository) ListUserSessions(userID int64) ([]model.UserSession, error) {
	if r == nil || r.db == nil {
		return nil, errors.New("repository not initialized")
	}
	var items []model.UserSession
	err := r.db.Where("user_id = ? AND revoked_at IS NULL AND (expires_at = 0 OR expires_at > ?)", userID, time.Now().UnixMilli()).
		Order("last_seen_at DESC").Find(&items).Error
	return items, err
}

func (r *Repository) RevokeUserSession(userID, id int64) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	return r.db.Model(&model.UserSession{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("revoked_at", time.Now().UnixMilli()).Error
}

func (r *Repository) RevokeOtherUserSessions(userID int64, currentTokenID string) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	return r.db.Model(&model.UserSession{}).
		Where("user_id = ? AND token_id <> ? AND revoked_at IS NULL", userID, currentTokenID).
		Update("revoked_at", time.Now().UnixMilli()).Error
}

func (r *Repository) RevokeAllUserSessions(userID int64) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}
	return r.db.Model(&model.UserSession{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", time.Now().UnixMilli()).Error
}

func (r *Repository) PurgeUserSessions(cutoffMs int64) error {
	if r == nil || r.db == nil {
		return errors.New("repository not initialized")
	}

	return r.db.Where(
		"(expires_at > 0 AND expires_at < ?) OR (revoked_at IS NOT NULL AND revoked_at < ?)",
		cutoffMs, cutoffMs,
	).Delete(&model.UserSession{}).Error
}

func (r *Repository) HasUserSessionIP(userID int64, ip string) (bool, error) {
	if r == nil || r.db == nil {
		return false, errors.New("repository not initialized")
	}
	var count int64
	err := r.db.Model(&model.UserSession{}).
		Where("user_id = ? AND ip = ? AND revoked_at IS NULL", userID, ip).
		Count(&count).Error

	return count > 0, err
}
