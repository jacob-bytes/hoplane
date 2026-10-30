package handler

import (
	"path/filepath"
	"testing"
	"time"

	"go-backend/internal/store/repo"
)

func TestRunStatisticsFlowJobTracksIncrementAndPrunes(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "jobs-stats.db")
	r, err := repo.Open(dbPath)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	h := New(r, "secret")
	now := time.Date(2026, 2, 7, 12, 0, 0, 0, time.UTC)
	nowMs := now.UnixMilli()

	if err := r.DB().Exec(`UPDATE user SET in_flow = 100, out_flow = 200 WHERE id = 1`).Error; err != nil {
		t.Fatalf("seed user flow: %v", err)
	}

	if err := r.DB().Exec(`INSERT INTO statistics_flow(user_id, flow, total_flow, time, created_time) VALUES(1, 250, 250, '11:00', ?)`, now.Add(-time.Hour).UnixMilli()).Error; err != nil {
		t.Fatalf("seed recent statistics row: %v", err)
	}
	if err := r.DB().Exec(`INSERT INTO statistics_flow(user_id, flow, total_flow, time, created_time) VALUES(1, 10, 10, '00:00', ?)`, now.Add(-32*24*time.Hour).UnixMilli()).Error; err != nil {
		t.Fatalf("seed stale statistics row: %v", err)
	}

	h.runStatisticsFlowJob(now)

	staleCount := mustQueryInt(t, r, `SELECT COUNT(1) FROM statistics_flow WHERE created_time < ?`, nowMs-int64((31*24*time.Hour)/time.Millisecond))
	if staleCount != 0 {
		t.Fatalf("expected stale statistics rows to be pruned, got %d", staleCount)
	}

	flow, total, hour := mustQueryInt64Int64String(t, r, `SELECT flow, total_flow, time FROM statistics_flow WHERE user_id = 1 ORDER BY id DESC LIMIT 1`)
	if flow != 50 {
		t.Fatalf("expected increment flow 50, got %d", flow)
	}
	if total != 300 {
		t.Fatalf("expected total flow 300, got %d", total)
	}
	if hour != "12:00" {
		t.Fatalf("expected hour mark 12:00, got %s", hour)
	}

	// Legacy row has no direction split: fall back to the current 1:2 ratio.
	var inFlow, outFlow int64
	if err := r.DB().Raw(`SELECT in_flow, out_flow FROM statistics_flow WHERE user_id = 1 ORDER BY id DESC LIMIT 1`).Row().Scan(&inFlow, &outFlow); err != nil {
		t.Fatal(err)
	}
	if inFlow != 16 || outFlow != 34 {
		t.Fatalf("expected fallback split 16/34, got %d/%d", inFlow, outFlow)
	}
}

func TestRunStatisticsFlowJobTracksDirectionDeltas(t *testing.T) {
	r, err := repo.Open(filepath.Join(t.TempDir(), "jobs-direction.db"))
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	h := New(r, "secret")
	now := time.Date(2026, 2, 7, 12, 0, 0, 0, time.UTC)
	nowMs := now.UnixMilli()

	if err := r.DB().Exec(`UPDATE user SET in_flow = 500, out_flow = 700 WHERE id = 1`).Error; err != nil {
		t.Fatal(err)
	}
	if err := r.DB().Exec(`INSERT INTO statistics_flow(user_id, flow, in_flow, out_flow, total_flow, time, created_time) VALUES(1, 700, 300, 400, 700, '11:00', ?)`, now.Add(-time.Hour).UnixMilli()).Error; err != nil {
		t.Fatal(err)
	}

	h.runStatisticsFlowJob(now)

	var flow, inFlow, outFlow, total int64
	if err := r.DB().Raw(`SELECT flow, in_flow, out_flow, total_flow FROM statistics_flow WHERE user_id = 1 ORDER BY id DESC LIMIT 1`).Row().Scan(&flow, &inFlow, &outFlow, &total); err != nil {
		t.Fatal(err)
	}
	if flow != 500 || inFlow != 200 || outFlow != 300 || total != 1200 {
		t.Fatalf("unexpected direction row: flow=%d in=%d out=%d total=%d", flow, inFlow, outFlow, total)
	}
	if rowTime := mustQueryInt(t, r, `SELECT COUNT(1) FROM statistics_flow WHERE created_time = ?`, nowMs); rowTime != 1 {
		t.Fatalf("expected one row at the hour mark, got %d", rowTime)
	}
}

func TestRunResetAndExpiryJobResetsFlowAndDisablesExpiredRecords(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "jobs-reset.db")
	r, err := repo.Open(dbPath)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	h := New(r, "secret")
	now := time.Date(2026, 3, 15, 0, 0, 5, 0, time.UTC)
	nowMs := now.UnixMilli()

	if err := r.DB().Exec(`
		INSERT INTO user(id, user, pwd, role_id, exp_time, flow, in_flow, out_flow, flow_reset_time, num, created_time, updated_time, status)
		VALUES(2, 'expired_user', 'x', 1, ?, 100, 1000, 2000, 15, 1, ?, ?, 1)
	`, nowMs-1000, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert expired user: %v", err)
	}

	if err := r.DB().Exec(`
		INSERT INTO user(id, user, pwd, role_id, exp_time, flow, in_flow, out_flow, flow_reset_time, num, created_time, updated_time, status)
		VALUES(3, 'non_expiring_user', 'x', 1, 0, 100, 1000, 2000, 15, 1, ?, ?, 1)
	`, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert non-expiring user: %v", err)
	}

	if err := r.DB().Exec(`
		INSERT INTO tunnel(id, name, traffic_ratio, type, protocol, flow, created_time, updated_time, status, in_ip, inx)
		VALUES(1, 't1', 1.0, 1, 'tls', 1, ?, ?, 1, NULL, 0)
	`, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert tunnel: %v", err)
	}

	if err := r.DB().Exec(`
		INSERT INTO user_tunnel(id, user_id, tunnel_id, speed_id, num, flow, in_flow, out_flow, flow_reset_time, exp_time, status)
		VALUES(10, 2, 1, NULL, 1, 1, 300, 400, 15, ?, 1)
	`, nowMs-1000).Error; err != nil {
		t.Fatalf("insert expired user_tunnel: %v", err)
	}

	if err := r.DB().Exec(`
		INSERT INTO user_tunnel(id, user_id, tunnel_id, speed_id, num, flow, in_flow, out_flow, flow_reset_time, exp_time, status)
		VALUES(11, 3, 1, NULL, 1, 1, 300, 400, 15, 0, 1)
	`).Error; err != nil {
		t.Fatalf("insert non-expiring user_tunnel: %v", err)
	}

	if err := r.DB().Exec(`
		INSERT INTO forward(id, user_id, user_name, name, tunnel_id, remote_addr, strategy, in_flow, out_flow, created_time, updated_time, status, inx)
		VALUES(20, 2, 'expired_user', 'f1', 1, '1.1.1.1:443', 'fifo', 0, 0, ?, ?, 1, 0)
	`, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert forward: %v", err)
	}

	if err := r.DB().Exec(`
		INSERT INTO forward(id, user_id, user_name, name, tunnel_id, remote_addr, strategy, in_flow, out_flow, created_time, updated_time, status, inx)
		VALUES(21, 3, 'non_expiring_user', 'f2', 1, '1.1.1.1:443', 'fifo', 0, 0, ?, ?, 1, 1)
	`, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert non-expiring forward: %v", err)
	}

	h.runResetAndExpiryJob(now)

	userIn, userOut, userStatus := mustQueryInt64Int64Int(t, r, `SELECT in_flow, out_flow, status FROM user WHERE id = 2`)
	if userIn != 0 || userOut != 0 || userStatus != 0 {
		t.Fatalf("expected user reset+disabled, got in=%d out=%d status=%d", userIn, userOut, userStatus)
	}

	utIn, utOut, utStatus := mustQueryInt64Int64Int(t, r, `SELECT in_flow, out_flow, status FROM user_tunnel WHERE id = 10`)
	if utIn != 0 || utOut != 0 || utStatus != 0 {
		t.Fatalf("expected user_tunnel reset+disabled, got in=%d out=%d status=%d", utIn, utOut, utStatus)
	}

	forwardStatus := mustQueryInt(t, r, `SELECT status FROM forward WHERE id = 20`)
	if forwardStatus != 0 {
		t.Fatalf("expected forward status=0 after expiry handling, got %d", forwardStatus)
	}

	nonExpUserStatus := mustQueryInt(t, r, `SELECT status FROM user WHERE id = 3`)
	if nonExpUserStatus != 1 {
		t.Fatalf("expected non-expiring user to remain enabled, got status=%d", nonExpUserStatus)
	}

	nonExpTunnelStatus := mustQueryInt(t, r, `SELECT status FROM user_tunnel WHERE id = 11`)
	if nonExpTunnelStatus != 1 {
		t.Fatalf("expected non-expiring user_tunnel to remain enabled, got status=%d", nonExpTunnelStatus)
	}

	nonExpForwardStatus := mustQueryInt(t, r, `SELECT status FROM forward WHERE id = 21`)
	if nonExpForwardStatus != 1 {
		t.Fatalf("expected non-expiring forward to remain enabled, got status=%d", nonExpForwardStatus)
	}
}

func TestRunResetAndExpiryJobResetsUserQuotaAndUnblocksUser(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "jobs-quota-reset.db")
	r, err := repo.Open(dbPath)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	h := New(r, "secret")
	now := time.Date(2026, 3, 12, 0, 0, 5, 0, time.UTC)
	nowMs := now.UnixMilli()

	if err := r.DB().Exec(`
		INSERT INTO user(id, user, pwd, role_id, exp_time, flow, in_flow, out_flow, flow_reset_time, num, created_time, updated_time, status)
		VALUES(2, 'quota-reset-user', 'x', 1, 0, 99999, 0, 0, 1, 99999, ?, ?, 1)
	`, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert user: %v", err)
	}
	if err := r.DB().Exec(`
		INSERT INTO user_quota(user_id, daily_limit_gb, monthly_limit_gb, daily_used_bytes, monthly_used_bytes, day_key, month_key, disabled_by_quota, disabled_at, paused_forward_ids, created_time, updated_time)
		VALUES(2, 10, 0, ?, ?, 20260311, 202603, 1, ?, '', ?, ?)
	`, 11*int64(1024*1024*1024), 11*int64(1024*1024*1024), nowMs, nowMs, nowMs).Error; err != nil {
		t.Fatalf("insert user quota: %v", err)
	}

	h.runResetAndExpiryJob(now)

	dailyUsed := mustQueryInt(t, r, `SELECT daily_used_bytes FROM user_quota WHERE user_id = 2`)
	if dailyUsed != 0 {
		t.Fatalf("expected daily quota usage reset, got %d", dailyUsed)
	}
	quotaDisabled := mustQueryInt(t, r, `SELECT disabled_by_quota FROM user_quota WHERE user_id = 2`)
	if quotaDisabled != 0 {
		t.Fatalf("expected quota disabled flag cleared, got %d", quotaDisabled)
	}
}
