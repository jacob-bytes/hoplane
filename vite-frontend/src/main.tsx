import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

import App from "./App.tsx";
import { applyDensity } from "./lib/density";
import { ErrorBoundary, reloadOnce } from "./components/error-boundary";
import { IS_DEMO, installDemo } from "./demo";
import { DemoBanner } from "./demo/banner";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";

// A page chunk from the previous build is gone after an upgrade: reload
// to pick up the new build. When that already happened in the last
// minute, the error reaches the page's ErrorBoundary, which offers a reload.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnce()) event.preventDefault();
});

if (IS_DEMO) installDemo();

// Browsers only look for a new service worker on navigation (and at most
// daily), and a dashboard tab rarely navigates: after a panel upgrade the
// refresh prompt could take hours. Ask every minute and when the tab comes
// back into view, gets focus or comes back online instead.
const SW_UPDATE_INTERVAL = 60 * 1000;

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    let checking = false;
    const check = () => {
      if (
        checking ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      )
        return;
      checking = true;
      registration
        .update()
        .catch(() => {})
        .finally(() => {
          checking = false;
        });
    };

    setInterval(check, SW_UPDATE_INTERVAL);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    window.addEventListener("pageshow", check);
  },
  onNeedRefresh() {
    toast("发现新版本，是否立即刷新以应用更新？", {
      id: "sw-update",
      duration: Infinity,
      action: { label: "刷新", onClick: () => updateSW(true) },
      cancel: { label: "稍后", onClick: () => toast.dismiss("sw-update") },
    });
  },
});

// The demo is static files on GitHub Pages: hash routes need no server.
const Router = IS_DEMO ? HashRouter : BrowserRouter;

applyDensity();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Router>
    <Provider>
      <ErrorBoundary fullScreen>
        <App />
      </ErrorBoundary>
      {IS_DEMO && <DemoBanner />}
    </Provider>
  </Router>,
);
