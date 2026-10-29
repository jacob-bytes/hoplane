import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Turnstile } from "@marsidev/react-turnstile";
import { motion } from "framer-motion";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { VersionFooter } from "@/components/version-footer";
import { BrandLogo } from "@/components/brand-logo";
import {
  login,
  LoginData,
  checkCaptcha,
  getPublicConfigByName,
  getPasskeyStatus,
  beginPasskeyLogin,
  finishPasskeyLogin,
  getGithubStatus,
  beginGithubLogin,
} from "@/api";
import { writeLoginSession } from "@/utils/session";
import { getPasskey } from "@/utils/passkey";
import { githubCallbackUrl, goToGithub } from "@/utils/github-login";
import { useWebViewMode } from "@/hooks/useWebViewMode";

interface LoginForm {
  username: string;
  password: string;
  captchaId: string;
}

export default function IndexPage() {
  const [form, setForm] = useState<LoginForm>({
    username: "",
    password: "",
    captchaId: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<LoginForm>>({});
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [siteKey, setSiteKey] = useState("");
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(false);
  const navigate = useNavigate();
  const isWebView = useWebViewMode();

  // The app's WebView can't come back from GitHub, so no button there.
  useEffect(() => {
    if (isWebView) return;
    getGithubStatus()
      .then((res) => setGithubEnabled(res.code === 0 && res.data.enabled))
      .catch(() => setGithubEnabled(false));
  }, [isWebView]);

  const handleGithubLogin = async () => {
    setLoading(true);
    try {
      const res = await beginGithubLogin(githubCallbackUrl());

      if (res.code !== 0) {
        toast.error(res.msg || "无法使用 GitHub 登录");
        setLoading(false);

        return;
      }
      goToGithub("login", res.data.url);
    } catch {
      toast.error("无法使用 GitHub 登录");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      window.isSecureContext &&
      typeof window.PublicKeyCredential !== "undefined"
    ) {
      getPasskeyStatus()
        .then((res) => setPasskeyEnabled(res.code === 0 && res.data.enabled))
        .catch(() => setPasskeyEnabled(false));
    }
  }, []);

  const handlePasskeyLogin = async () => {
    setLoading(true);
    try {
      const begin = await beginPasskeyLogin();

      if (begin.code !== 0) {
        toast.error(begin.msg || "无法使用通行证密钥登录");

        return;
      }
      const credential = await getPasskey(begin.data.options);
      const result = await finishPasskeyLogin(begin.data.sessionId, credential);

      if (result.code !== 0) {
        toast.error(result.msg || "通行证密钥登录失败");

        return;
      }
      writeLoginSession(result.data);
      toast.success("登录成功");
      navigate(
        result.data.requirePasswordChange ? "/change-password" : "/dashboard",
      );
    } catch {
      toast.error("通行证密钥登录已取消或失败");
    } finally {
      setLoading(false);
    }
  };

  // 验证表单
  const validateForm = (): boolean => {
    const newErrors: Partial<LoginForm> = {};

    if (!form.username.trim()) {
      newErrors.username = "请输入用户名";
    }

    if (!form.password.trim()) {
      newErrors.password = "请输入密码";
    } else if (form.password.length < 6) {
      newErrors.password = "密码长度至少6位";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // 处理输入变化
  const handleInputChange = (field: keyof LoginForm, value: string) => {
    setAuthError("");
    setForm((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // 执行登录请求
  const performLogin = async (captchaToken?: string) => {
    try {
      const finalCaptchaId =
        typeof captchaToken === "string" && captchaToken.trim()
          ? captchaToken
          : form.captchaId;

      const loginData: LoginData = {
        username: form.username.trim(),
        password: form.password,
        captchaId: finalCaptchaId,
      };

      const response = await login(loginData);

      if (response.code !== 0) {
        setAuthError(response.msg || "登录失败");
        toast.error(response.msg || "登录失败");
        if (showCaptcha) {
          setForm((prev) => ({ ...prev, captchaId: "" }));
        }

        return;
      }

      // 检查是否需要强制修改密码
      if (response.data.requirePasswordChange) {
        writeLoginSession(response.data);
        toast.success("检测到默认密码，即将跳转到修改密码页面");
        navigate("/change-password");

        return;
      }

      // 保存登录信息
      writeLoginSession(response.data);

      // 登录成功
      toast.success("登录成功");
      navigate("/dashboard");
    } catch {
      setAuthError("网络错误，请稍后重试");
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // 先检查是否需要验证码
      const checkResponse = await checkCaptcha();

      if (checkResponse.code !== 0) {
        toast.error("检查验证码状态失败，请重试" + checkResponse.msg);
        setLoading(false);

        return;
      }

      // 根据返回值决定是否显示验证码
      if (checkResponse.data === 0) {
        await performLogin();
      } else {
        const configResp = await getPublicConfigByName("cloudflare_site_key");

        if (configResp.code === 0 && configResp.data && configResp.data.value) {
          setSiteKey(configResp.data.value);
          setShowCaptcha(true);
        } else {
          toast.error("未配置Cloudflare Site Key，请联系管理员");
          setLoading(false);
        }
      }
    } catch (error) {
      toast.error("网络错误，请稍后重试" + error);
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas">
      <section className="relative z-10 flex w-full flex-1 flex-col items-center justify-center p-4 pb-20 sm:pb-4">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[420px] px-4 sm:px-0"
          initial={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="w-full rounded-[14px] border border-hairline bg-raised p-2 shadow-[0_16px_48px_-24px_rgba(15,23,42,0.35)] sm:p-4">
            <CardHeader className="pb-0 pt-6 px-6 flex-col items-center">
              <BrandLogo className="mb-4 h-12 w-12 rounded-lg" size={48} />
              <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
                {siteConfig.name}
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                登录以管理你的网络
              </p>
            </CardHeader>
            <CardContent className="px-6 py-6 mt-2">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="login-username">用户名</Label>
                  <Input
                    aria-invalid={!!errors.username || undefined}
                    autoComplete="username"
                    className="h-10 rounded-md text-sm"
                    disabled={loading}
                    id="login-username"
                    placeholder="admin"
                    value={form.username}
                    onChange={(e) =>
                      handleInputChange("username", e.target.value)
                    }
                    onKeyDown={handleKeyPress}
                  />
                  {errors.username ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.username}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="login-password">密码</Label>
                  <div className="relative">
                    <Input
                      aria-invalid={!!errors.password || undefined}
                      autoComplete="current-password"
                      className="h-10 rounded-md pr-10 text-sm tracking-wider"
                      disabled={loading}
                      id="login-password"
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      onKeyDown={handleKeyPress}
                    />
                    <button
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="text-xs text-destructive" role="alert">
                      {errors.password}
                    </p>
                  ) : null}
                </div>

                {authError ? (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                    role="alert"
                  >
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{authError}</span>
                  </div>
                ) : null}
                <Button
                  className="mt-2 h-10 rounded-md bg-primary text-sm font-medium shadow-none"
                  loading={loading}
                  onClick={handleLogin}
                >
                  {loading ? (showCaptcha ? "验证中…" : "登录中…") : "登录"}
                </Button>
                {passkeyEnabled && (
                  <Button
                    className="h-10 rounded-md"
                    disabled={loading}
                    variant="outline"
                    onClick={() => void handlePasskeyLogin()}
                  >
                    选择通行证密钥登录
                  </Button>
                )}
                {githubEnabled && (
                  <Button
                    className="h-10 rounded-md"
                    disabled={loading}
                    variant="outline"
                    onClick={() => void handleGithubLogin()}
                  >
                    使用 GitHub 登录
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 版权信息 - 固定在底部，不占据布局空间 */}

        <VersionFooter
          containerClassName="fixed inset-x-0 bottom-4 text-center py-4"
          poweredClassName="text-xs text-muted-foreground"
          updateBadgeClassName="ml-2 inline-flex items-center rounded-full bg-destructive/90 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white"
          version={isWebView ? siteConfig.app_version : siteConfig.version}
          versionClassName="text-xs text-muted-foreground mt-1"
        />

        {/* 验证码弹层 */}
        {showCaptcha && siteKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩层 - 模糊效果，暗黑模式下更深 */}
            <button
              className="absolute inset-0 bg-black/60 dark:bg-black/80  captcha-backdrop-enter"
              type="button"
              onClick={() => {
                setShowCaptcha(false);
                setLoading(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setShowCaptcha(false);
                  setLoading(false);
                }
              }}
            />
            {/* 验证码容器 */}
            <div className="mb-4 relative z-50 bg-white dark:bg-muted p-6 rounded-lg shadow-xl">
              <div className="mb-4 text-center text-sm font-medium text-foreground">
                请完成安全验证
              </div>
              <div className="flex justify-center">
                <Turnstile
                  options={{
                    theme: (document.documentElement.classList.contains(
                      "dark",
                    ) ||
                    document.documentElement.getAttribute("data-theme") ===
                      "dark" ||
                    window.matchMedia("(prefers-color-scheme: dark)").matches
                      ? "dark"
                      : "light") as "light" | "dark" | "auto",
                  }}
                  siteKey={siteKey}
                  onError={() => {
                    toast.error("验证失败，请刷新重试");
                    setLoading(false);
                  }}
                  onExpire={() => {
                    setForm((prev) => ({ ...prev, captchaId: "" }));
                  }}
                  onSuccess={(token) => {
                    setForm((prev) => ({ ...prev, captchaId: token }));
                    void performLogin(token);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
