"use client";

import { useState } from "react";
import { Settings, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { CourseManager } from "./course-manager";
import { CourseCatalog } from "./course-catalog";
import type { CourseModule, CourseCatalogData } from "./course-actions";

export function CourseManagerWithToggle({
  modules,
  catalogData,
  userName,
  userAvatar,
  canEdit,
  canView,
}: {
  modules: CourseModule[];
  catalogData: CourseCatalogData;
  userName: string;
  userAvatar: string;
  canEdit: boolean;
  canView: boolean;
}) {
  const [view, setView] = useState<"admin" | "preview">("admin");

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-ink-100 bg-white p-1 w-fit">
        <button
          onClick={() => setView("admin")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === "admin" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-700"
          )}
        >
          <Settings size={13} />
          Gerenciar
        </button>
        <button
          onClick={() => setView("preview")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            view === "preview" ? "bg-ink-900 text-white" : "text-ink-500 hover:text-ink-700"
          )}
        >
          <Eye size={13} />
          Visualizar como franqueado
        </button>
      </div>

      {view === "admin" ? (
        <CourseManager modules={modules} canEdit={canEdit} canView={canView} />
      ) : (
        <CourseCatalog data={catalogData} userName={userName} userAvatar={userAvatar} />
      )}
    </div>
  );
}
