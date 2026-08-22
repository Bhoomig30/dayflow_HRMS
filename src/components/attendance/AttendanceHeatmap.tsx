import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/ui/format";

interface HistoryDay {
  date: string;
  effective: string | null;
  isWeekend: boolean;
}

const toneBg: Record<string, string> = {
  PRESENT: "bg-[var(--df-success)]",
  ABSENT: "bg-[var(--df-danger)]",
  HALF_DAY: "bg-[var(--df-warning)]",
  LEAVE: "bg-[var(--df-info)]",
};

/** A simple Mon-Fri x week grid heatmap — visual status indicators as required, always paired with the table below for anyone who needs the exact values (color is never the only signal). */
export function AttendanceHeatmap({ history }: { history: HistoryDay[] }) {
  const weekdays = history.filter((d) => !d.isWeekend);
  const weeks: HistoryDay[][] = [];
  for (let i = 0; i < weekdays.length; i += 5) weeks.push(weekdays.slice(i, i + 5));

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${formatDate(day.date)} · ${day.effective ?? "No data"}`}
                className={cn("size-3.5 rounded-[3px]", day.effective ? toneBg[day.effective] : "bg-white/[0.06]")}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--df-text-muted)]">
        {Object.entries({ PRESENT: "Present", HALF_DAY: "Half-day", LEAVE: "Leave", ABSENT: "Absent" }).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[2px]", toneBg[key])} /> {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-white/[0.06]" /> No data
        </span>
      </div>
    </div>
  );
}
