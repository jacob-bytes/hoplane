package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNotifierReportsWebhookFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	defer server.Close()

	n := newNotifier()
	err := n.send(context.Background(), notifySettings{WebhookURL: server.URL}, notifyMessage{
		Event: "test", Title: "test", Message: "hello", Time: 1, App: "hoplane",
	})
	if err == nil {
		t.Fatal("expected webhook failure")
	}
}

func TestNotifierAcceptsWebhookSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	if err := newNotifier().send(context.Background(), notifySettings{WebhookURL: server.URL}, notifyMessage{
		Event: "test", Title: "test", Message: "hello", Time: 1, App: "hoplane",
	}); err != nil {
		t.Fatalf("webhook failed: %v", err)
	}
}
