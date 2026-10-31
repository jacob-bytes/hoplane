package contract_test

import (
	"database/sql"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"go-backend/internal/store/model"
	"go-backend/internal/store/repo"
)

func TestPostgresSessionAuditNotifyTables(t *testing.T) {
	baseDSN := strings.TrimSpace(os.Getenv("HOPLANE_POSTGRES_TEST_DSN"))
	if baseDSN == "" {
		t.Skip("set HOPLANE_POSTGRES_TEST_DSN to run postgres contract tests")
	}

	schema := "contract_hardening_" + strconv.FormatInt(time.Now().UnixNano(), 36)
	admin, err := sql.Open("pgx", baseDSN)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(`DROP SCHEMA IF EXISTS "` + schema + `" CASCADE`)
		_ = admin.Close()
	})
	if _, err := admin.Exec(`CREATE SCHEMA "` + schema + `"`); err != nil {
		t.Fatal(err)
	}
	dsn, err := withSearchPath(baseDSN, schema)
	if err != nil {
		t.Fatal(err)
	}
	r, err := repo.OpenPostgres(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = r.Close() })

	for _, table := range []string{"user_session", "audit_log", "notify_log"} {
		if !r.DB().Migrator().HasTable(table) {
			t.Fatalf("missing table %s", table)
		}
	}

	if _, err := r.EnsureUserSession(1, "pg-token", "203.0.113.1", "ua", time.Now().Add(time.Hour).Unix()); err != nil {
		t.Fatal(err)
	}
	if valid, _ := r.EnsureUserSession(1, "pg-token", "203.0.113.1", "ua", time.Now().Add(time.Hour).Unix()); !valid {
		t.Fatal("postgres session was not valid")
	}
	if err := r.CreateAuditLog(model.AuditLog{UserID: 1, Username: "admin", Action: "node/create", Status: 200, Code: 0}); err != nil {
		t.Fatal(err)
	}
	if items, total, err := r.ListAuditLogsFiltered(repo.AuditFilter{Limit: 10, Search: "node"}); err != nil || total != 1 || len(items) != 1 {
		t.Fatalf("audit filter = total %d items %d err %v", total, len(items), err)
	}
	if err := r.CreateNotifyLog(model.NotifyLog{Event: "test", Title: "test", Success: true}); err != nil {
		t.Fatal(err)
	}
	if logs, err := r.ListNotifyLogs(5); err != nil || len(logs) != 1 {
		t.Fatalf("notify logs = %d err %v", len(logs), err)
	}
}
