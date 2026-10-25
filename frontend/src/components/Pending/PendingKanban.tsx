import { Skeleton } from "@/components/ui/skeleton"
import { ISSUE_STATUSES } from "@/components/Issues/issueDisplay"

const PendingKanban = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {ISSUE_STATUSES.map((status) => (
      <div key={status} className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    ))}
  </div>
)

export default PendingKanban
