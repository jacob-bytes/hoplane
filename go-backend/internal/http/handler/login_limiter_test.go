package handler

import (
	"testing"
	"time"
)

func TestLoginLimiterBlocksAfterRepeatedFailures(t *testing.T) {
	l := newLoginLimiter()
	now := time.Now()
	for i := 0; i < loginMaxFailures; i++ {
		if !l.allow("user|ip", now) {
			t.Fatalf("blocked too early at %d", i)
		}
		l.fail("user|ip", now)
	}
	if l.allow("user|ip", now) {
		t.Fatal("limiter did not block")
	}
	if !l.allow("user|ip", now.Add(loginBlock+time.Second)) {
		t.Fatal("limiter did not recover")
	}
}

func TestLoginLimiterResetOnSuccess(t *testing.T) {
	l := newLoginLimiter()
	now := time.Now()
	for i := 0; i < loginMaxFailures-1; i++ {
		l.fail("user|ip", now)
	}
	l.reset("user|ip")
	for i := 0; i < loginMaxFailures-1; i++ {
		l.fail("user|ip", now)
	}
	if !l.allow("user|ip", now) {
		t.Fatal("successful login did not reset failures")
	}
}
