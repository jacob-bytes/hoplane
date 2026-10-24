package handler

import (
	"strings"
	"testing"
)

func TestDockerInstallCommand(t *testing.T) {
	old := githubRepo
	githubRepo = "Jacob-Bytes/Hoplane"
	defer func() { githubRepo = old }()

	cmd := dockerInstallCommand("3.4.0", "panel.example.com:6365", "s3cret")
	for _, want := range []string{
		"docker rm -f hoplane_agent",
		"--restart unless-stopped",
		"--network host",
		"--cap-add NET_ADMIN",
		"-v /etc/hoplane_agent:/etc/hoplane_agent",
		"-e HOPLANE_AGENT_ADDR=panel.example.com:6365",
		"-e HOPLANE_AGENT_SECRET=s3cret",
		" ghcr.io/jacob-bytes/hoplane-agent:3.4.0",
	} {
		if !strings.Contains(cmd, want) {
			t.Errorf("missing %q in %s", want, cmd)
		}
	}
}
