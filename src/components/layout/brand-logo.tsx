"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import logo from "@/../public/assets/logo.svg";

interface BrandLogoProps {
  width?: number;
  height?: number;
  size?: number;
  onDark?: boolean;
  className?: string;
}

export function BrandLogo({
  width,
  height,
  size,
  onDark = false,
  className,
}: BrandLogoProps) {
  const [errored, setErrored] = useState(false);
  const w = width ?? size ?? 40;
  const h = height ?? size ?? 40;

  if (errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-sm font-bold tracking-tight",
          onDark
            ? "border border-white/10 bg-white/8 text-[#d4c89a]"
            : "bg-linear-to-br from-brand-olive to-brand-olive-dark text-white",
          className
        )}
        style={{ width: w, height: h, fontSize: Math.min(w, h) * 0.42 }}
      >
        E
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={{ width: w, height: h }}
    >
      <Image
        src={logo}
        alt="Essenza"
        width={w}
        height={h}
        className="h-auto w-auto max-h-full max-w-full object-contain"
        style={{ width: "auto", height: "auto" }}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
