import { useEffect, useRef, useState } from "react";

/**
 * Lightweight fixed-row windowing for long desktop tables. The list is only
 * virtualized above `threshold` rows; small lists keep their natural DOM.
 */
export function useWindowedList({
  count,
  rowHeight,
  enabled,
  overscan = 8,
}: {
  count: number;
  rowHeight: number;
  enabled: boolean;
  overscan?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: count });

  useEffect(() => {
    if (!enabled) {
      setRange({ start: 0, end: count });

      return;
    }

    const element = ref.current;
    const main = document.querySelector("main");

    if (!element || !main) return;

    const update = () => {
      const elementRect = element.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const offset = main.scrollTop + (elementRect.top - mainRect.top);
      const start = Math.max(0, Math.floor(offset / rowHeight) - overscan);
      const end = Math.min(
        count,
        start + Math.ceil(main.clientHeight / rowHeight) + overscan * 2,
      );

      setRange((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    };

    update();
    main.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      main.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count, enabled, overscan, rowHeight]);

  return { ref, ...range };
}
