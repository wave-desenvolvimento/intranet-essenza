"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavorite } from "@/app/(dashboard)/favorites-actions";
import { cn } from "@/lib/utils";

interface Props {
  itemId: string;
  collectionId: string;
  initialFavorited?: boolean;
  size?: number;
  className?: string;
}

export function FavoriteButton({ itemId, collectionId, initialFavorited = false, size = 13, className }: Props) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const result = await toggleFavorite(itemId, collectionId);
      if ("error" in result) setFavorited(!next); // revert on error
    });
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        "rounded-md p-1 transition-colors",
        favorited
          ? "text-amber-500 hover:text-amber-600"
          : "text-ink-400 hover:text-amber-500 hover:bg-ink-100",
        className
      )}
      title={favorited ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      <Star size={size} fill={favorited ? "currentColor" : "none"} />
    </button>
  );
}
