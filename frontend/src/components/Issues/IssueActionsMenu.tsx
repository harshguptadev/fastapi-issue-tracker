import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { IssuePublic } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteIssue from "./DeleteIssue"
import EditIssue from "./EditIssue"

interface IssueActionsMenuProps {
  issue: IssuePublic
}

export const IssueActionsMenu = ({ issue }: IssueActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <EditIssue issue={issue} onSuccess={() => setOpen(false)} />
        <DeleteIssue id={issue.id} onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
