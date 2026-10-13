import { Accessibility, Moon, Pause, Play, Sun } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function AccessibilityControls() {
  const { appearance, setAppearance, reducedMotion, setReducedMotion } =
    useTheme();
  const [open, setOpen] = useState(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("qaPreferences") ===
        "open"
  );

  const options = [
    { id: "light" as const, label: "Light", icon: Sun },
    { id: "dark" as const, label: "Dark", icon: Moon },
    {
      id: "high-contrast" as const,
      label: "High contrast",
      icon: Accessibility,
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Display and motion preferences"
          className="grid size-9 place-items-center rounded-full border border-white/20 bg-white/[0.06] text-white transition hover:bg-white/15"
        >
          <Accessibility className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="accessibility-popover z-[100] w-64 rounded-2xl border border-white/20 bg-[#06353a]/95 p-3 text-white shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-3 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
            Display preferences
          </p>
          <p className="mt-1 text-xs text-white/70">Saved on this device.</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {options.map(option => {
            const Icon = option.icon;
            const active = appearance === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setAppearance(option.id)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-medium transition ${active ? "border-white bg-white text-[#06353a]" : "border-white/15 bg-white/[0.04] text-white/75 hover:bg-white/12"}`}
              >
                <Icon className="size-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-white">Reduce motion</p>
            <p className="mt-0.5 text-[10px] text-white/55">
              Pause decorative video
            </p>
          </div>
          <button
            onClick={() => setReducedMotion(!reducedMotion)}
            aria-pressed={reducedMotion}
            className={`grid size-8 place-items-center rounded-lg transition ${reducedMotion ? "bg-white text-[#06353a]" : "bg-white/10 text-white"}`}
          >
            {reducedMotion ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
