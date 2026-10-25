import { useEffect, useState } from "react"

import {
  AccountLabelBadge,
  LabelEditorDialog,
} from "@/components/UserSettings/AccountLabelBadge"
import { AddAccountDialog } from "@/components/UserSettings/AddAccountDialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import useAuth from "@/hooks/useAuth"
import {
  type StoredAccount,
  getAccounts,
  getActiveAccountId,
  updateAccountLabel,
} from "@/lib/accounts"
import { getInitials } from "@/utils"

function RemoveAccountDialog({
  account,
  onConfirm,
}: {
  account: StoredAccount
  onConfirm: () => void
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove account</DialogTitle>
          <DialogDescription>
            This will remove{" "}
            <strong>{account.fullName || account.email || "this account"}</strong>{" "}
            from this device. It only clears the locally saved sign-in info; it
            won't delete the account itself, and you can always sign back in to
            add it again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={onConfirm}>
              Remove
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccountRow({
  account,
  isActive,
  onChanged,
}: {
  account: StoredAccount
  isActive: boolean
  onChanged: () => void
}) {
  const { switchAccount, removeAccount } = useAuth()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-zinc-600 text-white">
            {getInitials(account.fullName || account.email || "User")}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {account.fullName || "Unnamed account"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {account.email || "Unknown email"}
          </span>
        </div>
        <LabelEditorDialog
          label={account.label}
          onSave={(label) => {
            updateAccountLabel(account.id, label)
            onChanged()
          }}
          trigger={
            <button type="button" className="cursor-pointer">
              <AccountLabelBadge label={account.label} />
            </button>
          }
        />
      </div>

      <div className="flex items-center gap-2">
        {isActive ? (
          <span className="text-sm font-medium text-muted-foreground">
            Currently active
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => switchAccount(account.id)}
          >
            Switch to this account
          </Button>
        )}
        <RemoveAccountDialog
          account={account}
          onConfirm={() => {
            removeAccount(account.id)
            onChanged()
          }}
        />
      </div>
    </div>
  )
}

const AccountsManager = () => {
  const [accounts, setAccounts] = useState<StoredAccount[]>([])
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(
    null,
  )

  const refresh = () => {
    setAccounts(getAccounts())
    setActiveAccountIdState(getActiveAccountId())
  }

  useEffect(() => {
    setAccounts(getAccounts())
    setActiveAccountIdState(getActiveAccountId())
  }, [])

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Account management</h3>
          <p className="text-sm text-muted-foreground">
            Add multiple accounts (e.g. work and personal) and switch between
            them anytime, without signing in again.
          </p>
        </div>
        <AddAccountDialog
          onAdded={refresh}
          trigger={<Button>Add account</Button>}
        />
      </div>

      <div className="flex flex-col gap-3">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            isActive={account.id === activeAccountId}
            onChanged={refresh}
          />
        ))}
      </div>
    </div>
  )
}

export default AccountsManager
