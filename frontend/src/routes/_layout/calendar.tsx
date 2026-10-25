import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import type { IssuePublic } from "@/client"
import { IssuesService } from "@/client"
import {
  getDueDateUrgency,
  priorityBadgeClass,
  toISODate,
} from "@/components/Issues/issueDisplay"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/_layout/calendar")({
  component: CalendarPage,
  head: () => ({
    meta: [
      {
        title: "Calendar - Easy Tracker",
      },
    ],
  }),
})

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MAX_ISSUES_PER_DAY = 3

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildCalendarDays(monthAnchor: Date): Date[] {
  const gridStart = startOfMonth(monthAnchor)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function CalendarPage() {
  const [monthAnchor, setMonthAnchor] = useState(() =>
    startOfMonth(new Date()),
  )

  const days = useMemo(() => buildCalendarDays(monthAnchor), [monthAnchor])
  const rangeStart = days[0]
  const rangeEnd = days[days.length - 1]

  const { data, isLoading } = useQuery({
    queryKey: [
      "issues",
      "calendar",
      toISODate(rangeStart),
      toISODate(rangeEnd),
    ],
    queryFn: () =>
      IssuesService.readCalendarIssues({
        start: toISODate(rangeStart),
        end: toISODate(rangeEnd),
      }),
  })

  const issuesByDate = useMemo(() => {
    const map = new Map<string, IssuePublic[]>()
    for (const issue of data?.data ?? []) {
      if (!issue.due_date) continue
      const list = map.get(issue.due_date) ?? []
      list.push(issue)
      map.set(issue.due_date, list)
    }
    return map
  }, [data])

  const today = new Date()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">Issues grouped by due date</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() =>
              setMonthAnchor(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {monthAnchor.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() =>
              setMonthAnchor(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMonthAnchor(startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="p-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const isCurrentMonth =
                  day.getMonth() === monthAnchor.getMonth()
                const isToday = isSameDay(day, today)
                const dayIssues = issuesByDate.get(toISODate(day)) ?? []

                return (
                  <div
                    key={day.toISOString()}
                    className={`flex min-h-28 flex-col gap-1 border-b border-r p-1.5 ${
                      isCurrentMonth ? "" : "bg-muted/20"
                    }`}
                  >
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? "bg-primary font-semibold text-primary-foreground"
                          : isCurrentMonth
                            ? ""
                            : "text-muted-foreground"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {dayIssues.slice(0, MAX_ISSUES_PER_DAY).map((issue) => {
                        const urgency = getDueDateUrgency(
                          issue.due_date,
                          issue.status,
                        )
                        return (
                          <Link
                            key={issue.id}
                            to="/issues/$issueId"
                            params={{ issueId: issue.id }}
                            className={`truncate rounded px-1.5 py-0.5 text-xs hover:underline ${priorityBadgeClass(
                              issue.priority ?? 3,
                            )} ${urgency === "overdue" ? "ring-1 ring-destructive" : ""}`}
                          >
                            {issue.title}
                          </Link>
                        )
                      })}
                      {dayIssues.length > MAX_ISSUES_PER_DAY && (
                        <span className="text-xs text-muted-foreground">
                          +{dayIssues.length - MAX_ISSUES_PER_DAY} more
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
