"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ptBR } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={ptBR}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center text-sm font-medium text-ink-900",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: "absolute left-1 top-0 inline-flex items-center justify-center size-7 bg-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded-md transition-colors",
        button_next: "absolute right-1 top-0 inline-flex items-center justify-center size-7 bg-transparent text-ink-500 hover:text-ink-900 hover:bg-ink-100 rounded-md transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-ink-400 w-8 font-normal text-[0.65rem] uppercase",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          "inline-flex items-center justify-center size-8 rounded-md font-normal text-ink-900 transition-colors",
          "hover:bg-brand-olive-soft hover:text-brand-olive-dark",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-olive",
          "aria-selected:opacity-100"
        ),
        selected: "bg-brand-olive text-white hover:bg-brand-olive-dark rounded-md [&>button]:text-white [&>button]:hover:bg-brand-olive-dark",
        today: "[&>button]:bg-ink-100 [&>button]:text-ink-900 [&>button]:font-semibold",
        outside: "[&>button]:text-ink-300 [&>button]:opacity-50",
        disabled: "[&>button]:text-ink-300 [&>button]:opacity-50 [&>button]:cursor-not-allowed",
        range_middle: "bg-brand-olive-soft rounded-none [&>button]:text-brand-olive-dark [&>button]:bg-transparent",
        range_start: "bg-brand-olive rounded-l-md rounded-r-none [&>button]:text-white [&>button]:hover:bg-brand-olive-dark",
        range_end: "bg-brand-olive rounded-r-md rounded-l-none [&>button]:text-white [&>button]:hover:bg-brand-olive-dark",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  )
}

export { Calendar }
