import { Globe2 } from "lucide-react";

import auFlag from "../assets/flags/au.svg";
import brFlag from "../assets/flags/br.svg";
import caFlag from "../assets/flags/ca.svg";
import cnFlag from "../assets/flags/cn.svg";
import deFlag from "../assets/flags/de.svg";
import frFlag from "../assets/flags/fr.svg";
import gbFlag from "../assets/flags/gb.svg";
import hkFlag from "../assets/flags/hk.svg";
import inFlag from "../assets/flags/in.svg";
import jpFlag from "../assets/flags/jp.svg";
import krFlag from "../assets/flags/kr.svg";
import nlFlag from "../assets/flags/nl.svg";
import ruFlag from "../assets/flags/ru.svg";
import sgFlag from "../assets/flags/sg.svg";
import trFlag from "../assets/flags/tr.svg";
import twFlag from "../assets/flags/tw.svg";
import usFlag from "../assets/flags/us.svg";

import { cn } from "@/lib/utils";

const FLAG_URLS: Record<string, string> = {
  AU: auFlag,
  BR: brFlag,
  CA: caFlag,
  CN: cnFlag,
  DE: deFlag,
  FR: frFlag,
  GB: gbFlag,
  HK: hkFlag,
  IN: inFlag,
  JP: jpFlag,
  KR: krFlag,
  NL: nlFlag,
  RU: ruFlag,
  SG: sgFlag,
  TR: trFlag,
  TW: twFlag,
  US: usFlag,
};

/**
 * A bundled SVG flag. Emoji flags render as letter pairs on Windows, so the
 * card uses assets instead of the flag characters.
 */
export function NodeFlag({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const src = FLAG_URLS[code];

  if (!src) {
    return (
      <Globe2
        aria-hidden
        className={cn("h-4 w-4 text-muted-foreground", className)}
      />
    );
  }

  return (
    <img
      alt=""
      className={cn(
        "h-4 w-6 rounded-[3px] object-cover ring-1 ring-black/5",
        className,
      )}
      src={src}
    />
  );
}
