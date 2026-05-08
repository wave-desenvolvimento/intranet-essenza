"use client";

import { useState, useRef } from "react";

export function useDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (orderedIds: string[]) => void
) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLElement | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    dragNode.current = e.target as HTMLElement;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNode.current) dragNode.current.style.opacity = "0.4";
    });
  }

  function handleDragEnd() {
    if (dragNode.current) dragNode.current.style.opacity = "1";
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const reordered = [...items];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(overIndex, 0, moved);
      onReorder(reordered.map((item) => item.id));
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNode.current = null;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }

  function getDragProps(index: number) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragEnd: handleDragEnd,
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
    };
  }

  return {
    dragIndex,
    overIndex,
    getDragProps,
  };
}
