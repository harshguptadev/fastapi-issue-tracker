import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Share2, X } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { IssuesService } from "@/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const formSchema = z.object({
  email: z.string().email({ message: "Enter a valid email" }),
  canEditStatus: z.boolean(),
  canEditAssignee: z.boolean(),
})

type FormData = z.infer<typeof formSchema>

interface ShareIssueDialogProps {
  issueId: string
}

const ShareIssueDialog = ({ issueId }: ShareIssueDialogProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const sharesQuery = useQuery({
    queryKey: ["issues", issueId, "shares"],
    queryFn: () => IssuesService.readShares({ id: issueId }),
    enabled: isOpen,
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      canEditStatus: false,
      canEditAssignee: false,
    },
  })

  const shareMutation = useMutation({
    mutationFn: (data: FormData) =>
      IssuesService.createShare({
        id: issueId,
        requestBody: {
          email: data.email,
          can_edit_status: data.canEditStatus,
          can_edit_assignee: data.canEditAssignee,
        },
      }),
    onSuccess: () => {
      showSuccessToast("Issue shared successfully")
      form.reset()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", issueId, "shares"] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (userId: string) =>
      IssuesService.deleteShare({ id: issueId, userId }),
    onSuccess: () => {
      showSuccessToast("Access revoked")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", issueId, "shares"] })
    },
  })

  const onSubmit = (data: FormData) => {
    shareMutation.mutate(data)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share issue</DialogTitle>
          <DialogDescription>
            Grant another user access to this issue.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="teammate@example.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="canEditStatus"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Can edit status
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="canEditAssignee"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Can edit assignee
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <LoadingButton
              type="submit"
              loading={shareMutation.isPending}
              className="self-start"
            >
              Share
            </LoadingButton>
          </form>
        </Form>

        <div className="flex flex-col gap-2 border-t pt-4">
          <h4 className="text-sm font-medium">Shared with</h4>
          {sharesQuery.isLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {sharesQuery.data?.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Not shared with anyone yet.
            </p>
          )}
          {sharesQuery.data?.data.map((share) => (
            <div
              key={share.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm">{share.user_email}</span>
                <span className="text-xs text-muted-foreground">
                  {[
                    share.can_edit_status && "can edit status",
                    share.can_edit_assignee && "can edit assignee",
                  ]
                    .filter(Boolean)
                    .join(", ") || "view & comment only"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => revokeMutation.mutate(share.user_id)}
                disabled={revokeMutation.isPending}
              >
                <X className="size-4" />
                <span className="sr-only">Revoke access</span>
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ShareIssueDialog
