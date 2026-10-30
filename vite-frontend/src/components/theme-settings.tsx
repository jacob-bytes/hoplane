/**
 * Appearance mode picker for the Settings page. The panel ships a single
 * neutral theme now; mode is the only visual choice users need.
 */

import type { ThemeMode } from "@/themes/registry";

import React from "react";
import { toast } from "sonner";

import { useThemeContext } from "@/themes/context";

const MODE_OPTIONS: Array<{ value: ThemeMode; label: string; icon: string }> = [
  { value: "light", label: "亮色", icon: "☀️" },
  { value: "dark", label: "暗色", icon: "🌙" },
  { value: "system", label: "跟随系统", icon: "🖥️" },
];

export const ThemeSettings: React.FC = () => {
  const { mode, setMode } = useThemeContext();

  const handleModeChange = (next: ThemeMode) => {
    setMode(next);
    const label =
      next === "light" ? "亮色" : next === "dark" ? "暗色" : "跟随系统";

    toast.success(`已切换为${label}模式`);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex w-fit rounded-lg border border-hairline p-1">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            aria-pressed={mode === option.value}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              mode === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            type="button"
            onClick={() => handleModeChange(option.value)}
          >
            <span className="mr-1.5">{option.icon}</span>
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        使用内置中性主题，点选后立即生效。
      </p>
    </div>
  );
};
