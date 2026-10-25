import { Link as RouterLink } from "@tanstack/react-router"
import { ChevronsUpDown, LogOut, Settings, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"

import { AccountLabelBadge } from "@/components/UserSettings/AccountLabelBadge"
import { AddAccountDialog } from "@/components/UserSettings/AddAccountDialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { getAccounts, getActiveAccountId, type StoredAccount } from "@/lib/accounts"
import { getInitials } from "@/utils"

interface UserInfoProps {
  fullName?: string
  email?: string
}

function UserInfo({ fullName, email }: UserInfoProps) {
  return (
    <div className="flex items-center gap-2.5 w-full min-w-0">
      <Avatar className="size-8">
        <AvatarFallback className="bg-zinc-600 text-white">
          {getInitials(fullName || "User")}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start min-w-0">
        <p className="text-sm font-medium truncate w-full">{fullName}</p>
        <p className="text-xs text-muted-foreground truncate w-full">{email}</p>
      </div>
    </div>
  )
}

export function User({ user }: { user: any }) {
  const { logout, switchAccount } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accounts, setAccounts] = useState<StoredAccount[]>([])

  const refreshAccounts = () => setAccounts(getAccounts())

  useEffect(() => {
    setAccounts(getAccounts())
  }, [])

  if (!user) return null

  const activeAccountId = getActiveAccountId()

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }
  const handleLogout = async () => {
    logout()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(next) => {
            setMenuOpen(next)
            if (next) refreshAccounts()
          }}
        >
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              data-testid="user-menu"
            >
              <UserInfo fullName={user?.full_name} email={user?.email} />
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <UserInfo fullName={user?.full_name} email={user?.email} />
            </DropdownMenuLabel>

            {accounts.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Switch account</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={activeAccountId ?? undefined}
                  onValueChange={(id) => {
                    handleMenuClick()
                    switchAccount(id)
                  }}
                >
                  {accounts.map((account) => (
                    <DropdownMenuRadioItem key={account.id} value={account.id}>
                      <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">
                            {account.fullName || account.email || "Unnamed account"}
                          </span>
                          {account.email && (
                            <span className="truncate text-xs text-muted-foreground">
                              {account.email}
                            </span>
                          )}
                        </div>
                        <AccountLabelBadge label={account.label} />
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}

            <DropdownMenuSeparator />
            <AddAccountDialog
              onAdded={refreshAccounts}
              trigger={
                <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                  <UserPlus />
                  Add account
                </DropdownMenuItem>
              }
            />
            <RouterLink to="/settings" onClick={handleMenuClick}>
              <DropdownMenuItem>
                <Settings />
                User Settings
              </DropdownMenuItem>
            </RouterLink>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
