import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import axios from "axios"
import { useEffect } from "react"

import {
  type Body_login_login_access_token as AccessToken,
  LoginService,
  OpenAPI,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import {
  type AccountLabel,
  type StoredAccount,
  clearAllAccounts,
  getActiveAccount,
  getActiveAccountId,
  getAccounts,
  pickDefaultLabel,
  removeAccountFromStorage,
  resolveActiveAccount,
  setActiveAccountId,
  upsertAccount,
} from "@/lib/accounts"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return getActiveAccount() !== null
}

// Fetches "current user" for a specific token directly, bypassing the global
// OpenAPI.TOKEN resolver (which always points at the *active* account) so we
// can look up a freshly logged-in account without disturbing the one that's
// currently in use.
const fetchUserForToken = async (token: string): Promise<UserPublic> => {
  const response = await axios.get<UserPublic>(
    `${OpenAPI.BASE}/api/v1/users/me`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return response.data
}

const buildAccountFromToken = async (
  token: string,
  labelOverride?: AccountLabel,
): Promise<StoredAccount> => {
  const user = await fetchUserForToken(token)
  const accounts = getAccounts()
  const existing = accounts.find((account) => account.id === user.id)
  const label = labelOverride ?? existing?.label ?? pickDefaultLabel(accounts)

  return {
    id: user.id,
    token,
    email: user.email,
    fullName: user.full_name ?? undefined,
    label,
  }
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()
  const activeAccountId = getActiveAccountId()

  const { data: user } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser", activeAccountId],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
  })

  useEffect(() => {
    if (user) {
      resolveActiveAccount(user)
    }
  }, [user])

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ requestBody: data }),
    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    const account = await buildAccountFromToken(response.access_token)
    upsertAccount(account)
    setActiveAccountId(account.id)
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      queryClient.clear()
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
  })

  // Logs a second (or third...) account into the local pool without
  // switching away from whichever account is currently active.
  const addAccount = async (data: AccessToken): Promise<StoredAccount> => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    const account = await buildAccountFromToken(response.access_token)
    upsertAccount(account)
    return account
  }

  const addAccountMutation = useMutation({
    mutationFn: addAccount,
    onError: handleError.bind(showErrorToast),
  })

  const switchAccount = (id: string) => {
    if (id === getActiveAccountId()) return
    setActiveAccountId(id)
    queryClient.clear()
    navigate({ to: "/" })
  }

  // Removes one account from the pool. If it was the active one, falls back
  // to another stored account, or a full logout if none are left.
  const removeAccount = (id: string) => {
    const wasActive = getActiveAccountId() === id
    const remaining = removeAccountFromStorage(id)

    if (!wasActive) return

    if (remaining.length > 0) {
      setActiveAccountId(remaining[0].id)
      queryClient.clear()
      navigate({ to: "/" })
    } else {
      clearAllAccounts()
      queryClient.clear()
      navigate({ to: "/login" })
    }
  }

  // Full sign-out: clears every stored account, not just the active one.
  const logout = () => {
    clearAllAccounts()
    queryClient.clear()
    navigate({ to: "/login" })
  }

  return {
    signUpMutation,
    loginMutation,
    addAccountMutation,
    switchAccount,
    removeAccount,
    logout,
    user,
  }
}

export { isLoggedIn }
export default useAuth
