package repo

import (
	"testing"

	"go-backend/internal/store/model"
)

func TestAuditLogCreateAndList(t *testing.T) {
	r, err := Open(t.TempDir() + "/audit.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	for _, action := range []string{"node/create", "forward/update"} {
		if err := r.CreateAuditLog(model.AuditLog{
			UserID: 1, Username: "admin", Action: action,
			Method: "POST", Path: "/api/v1/" + action, IP: "127.0.0.1",
		}); err != nil {
			t.Fatal(err)
		}
	}

	items, err := r.ListAuditLogs(10)
	if err != nil {
		t.Fatalf("ListAuditLogs() error = %v", err)
	}
	if len(items) != 2 || items[0].Action != "forward/update" || items[1].Action != "node/create" {
		t.Fatalf("unexpected audit order: %+v", items)
	}
	if items[0].CreatedAt == 0 {
		t.Fatal("audit entry has no timestamp")
	}
}

func TestAuditAndSessionTablesMigrate(t *testing.T) {
	r, err := Open(t.TempDir() + "/schema.db")
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })

	for _, table := range []string{"user_session", "audit_log"} {
		if !r.DB().Migrator().HasTable(table) {
			t.Fatalf("missing table %s", table)
		}
	}
}
