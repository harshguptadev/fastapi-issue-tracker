import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  type LucideIcon,
  UserCheck,
} from "lucide-react"

import type { IssuePublic } from "@/client"
import { IssuesService } from "@/client"
import {
  DUE_DATE_URGENCY_CLASS,
  formatDueDate,
  getDueDateUrgency,
  priorityLabel,
  STATUS_BADGE_VARIANT,
  toISODate,
} from "@/components/Issues/issueDisplay"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - Easy Tracker",
      },
    ],
  }),
})

const UPCOMING_WINDOW_DAYS = 14
const LIST_PREVIEW_SIZE = 5

function useDashboardData() {
  const issuesQuery = useQuery({
    queryKey: ["issues", "dashboard"],
    queryFn: () => IssuesService.readIssues({ limit: 100 }),
  })

  const today = new Date()
  const rangeEnd = new Date(today)
  rangeEnd.setDate(rangeEnd.getDate() + UPCOMING_WINDOW_DAYS)

  const calendarQuery = useQuery({
    queryKey: ["issues", "calendar", "dashboard"],
    queryFn: () =>
      IssuesService.readCalendarIssues({
        start: toISODate(today),
        end: toISODate(rangeEnd),
      }),
  })

  return { issuesQuery, calendarQuery }
}

function StatCard({
  title,
  value,
  icon: Icon,
  accentClassName,
  isLoading,
}: {
  title: string
  value: number
  icon: LucideIcon
  accentClassName: string
  isLoading: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-10" />
          ) : (
            <p className="text-3xl font-bold tracking-tight">{value}</p>
          )}
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${accentClassName}`}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyList({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>
}

function IssueListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

function DueSoonList({
  issues,
  isLoading,
}: {
  issues: IssuePublic[]
  isLoading: boolean
}) {
  if (isLoading) return <IssueListSkeleton />

  const sorted = [...issues]
    .filter((issue) => issue.status !== "Done")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, LIST_PREVIEW_SIZE)

  if (sorted.length === 0) {
    return <EmptyList message="Nothing due in the next two weeks." />
  }

  return (
    <div className="flex flex-col divide-y">
      {sorted.map((issue) => {
        const urgency = getDueDateUrgency(issue.due_date, issue.status)
        return (
          <Link
            key={issue.id}
            to="/issues/$issueId"
            params={{ issueId: issue.id }}
            className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
          >
            <span className="truncate text-sm font-medium">
              {issue.title}
            </span>
            <span
              className={`shrink-0 text-xs ${DUE_DATE_URGENCY_CLASS[urgency]}`}
            >
              {formatDueDate(issue.due_date)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function AssignedToMeList({
  issues,
  isLoading,
}: {
  issues: IssuePublic[]
  isLoading: boolean
}) {
  if (isLoading) return <IssueListSkeleton />

  const assigned = issues.slice(0, LIST_PREVIEW_SIZE)

  if (assigned.length === 0) {
    return <EmptyList message="No issues are assigned to you right now." />
  }

  return (
    <div className="flex flex-col divide-y">
      {assigned.map((issue) => (
        <Link
          key={issue.id}
          to="/issues/$issueId"
          params={{ issueId: issue.id }}
          className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
        >
          <span className="truncate text-sm font-medium">{issue.title}</span>
          <Badge variant={STATUS_BADGE_VARIANT[issue.status ?? "Open"]}>
            {issue.status}
          </Badge>
        </Link>
      ))}
    </div>
  )
}

function RecentActivityList({
  issues,
  isLoading,
}: {
  issues: IssuePublic[]
  isLoading: boolean
}) {
  if (isLoading) return <IssueListSkeleton />

  const recent = [...issues]
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, LIST_PREVIEW_SIZE)

  if (recent.length === 0) {
    return <EmptyList message="No recent activity yet." />
  }

  return (
    <div className="flex flex-col divide-y">
      {recent.map((issue) => (
        <Link
          key={issue.id}
          to="/issues/$issueId"
          params={{ issueId: issue.id }}
          className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
        >
          <span className="truncate text-sm font-medium">{issue.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {priorityLabel(issue.priority ?? 3)}
          </span>
        </Link>
      ))}
    </div>
  )
}

function Dashboard() {
  const { user: currentUser } = useAuth()
  const { issuesQuery, calendarQuery } = useDashboardData()

  const issues = issuesQuery.data?.data ?? []
  const dueSoonIssues = calendarQuery.data?.data ?? []
  const isLoading = issuesQuery.isLoading
  const isCalendarLoading = calendarQuery.isLoading

  const openCount = issues.filter((issue) => issue.status === "Open").length
  const inProgressCount = issues.filter(
    (issue) => issue.status === "In Progress",
  ).length
  const doneCount = issues.filter((issue) => issue.status === "Done").length
  const overdueCount = issues.filter(
    (issue) => getDueDateUrgency(issue.due_date, issue.status) === "overdue",
  ).length

  const assignedToMe = issues.filter(
    (issue) => issue.assignee_id === currentUser?.id,
  )

  const hasNoIssues = !isLoading && issues.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight truncate max-w-full">
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your issues.
        </p>
      </div>

      {hasNoIssues ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <CircleDot className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No issues yet</h3>
            <p className="text-muted-foreground">
              Create your first issue to get started tracking work.
            </p>
            <Link
              to="/issues"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to Issues
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              title="Open"
              value={openCount}
              icon={CircleDot}
              accentClassName="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
              isLoading={isLoading}
            />
            <StatCard
              title="In Progress"
              value={inProgressCount}
              icon={Clock}
              accentClassName="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              isLoading={isLoading}
            />
            <StatCard
              title="Done"
              value={doneCount}
              icon={CheckCircle2}
              accentClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              isLoading={isLoading}
            />
            <StatCard
              title="Overdue"
              value={overdueCount}
              icon={AlertTriangle}
              accentClassName="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="size-4" />
                  Due soon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DueSoonList
                  issues={dueSoonIssues}
                  isLoading={isCalendarLoading}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="size-4" />
                  Assigned to me
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AssignedToMeList issues={assignedToMe} isLoading={isLoading} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="size-4" />
                  Recently updated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecentActivityList issues={issues} isLoading={isLoading} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
