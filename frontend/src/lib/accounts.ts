// Local, per-browser multi-account credential pool. Lets a user keep several
// logged-in accounts (e.g. "work" / "personal") and switch between them
// without re-entering a password, until that account's token expires.

const ACCOUNTS_KEY = "accounts"
const ACTIVE_ACCOUNT_KEY = "active_account_id"
const LEGACY_TOKEN_KEY = "access_token"
const LEGACY_ACCOUNT_ID = "legacy"

export interface AccountLabel {
  text: string
  color: string
}

export interface StoredAccount {
  id: string
  token: string
  email: string
  fullName?: string
  label: AccountLabel
}

export const LABEL_COLOR_PRESETS: AccountLabel[] = [
  { text: "Company", color: "#2563eb" },
  { text: "Personal", color: "#16a34a" },
  { text: "Work", color: "#9333ea" },
  { text: "Client", color: "#ea580c" },
  { text: "Test", color: "#db2777" },
  { text: "Other", color: "#64748b" },
]

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

// Upgrades pre-multi-account browsers (single "access_token" key) into a
// one-item account pool so existing sessions survive the migration.
function migrateLegacyToken(): StoredAccount[] {
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY)
  if (!legacyToken) return []

  const migrated: StoredAccount = {
    id: LEGACY_ACCOUNT_ID,
    token: legacyToken,
    email: "",
    label: { text: "Account", color: "#64748b" },
  }
  writeAccounts([migrated])
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, LEGACY_ACCOUNT_ID)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
  return [migrated]
}

export function getAccounts(): StoredAccount[] {
  const existing = readAccounts()
  if (existing.length > 0) return existing
  return migrateLegacyToken()
}

export function getActiveAccountId(): string | null {
  getAccounts() // ensure legacy migration has run before we read the pointer
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY)
}

export function getActiveAccount(): StoredAccount | null {
  const id = getActiveAccountId()
  if (!id) return null
  return getAccounts().find((account) => account.id === id) ?? null
}

export function getActiveToken(): string {
  return getActiveAccount()?.token ?? ""
}

export function setActiveAccountId(id: string) {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, id)
}

export function pickDefaultLabel(accounts: StoredAccount[]): AccountLabel {
  const usedColors = new Set(accounts.map((account) => account.label.color))
  const unused = LABEL_COLOR_PRESETS.find(
    (preset) => !usedColors.has(preset.color),
  )
  return unused ?? LABEL_COLOR_PRESETS[accounts.length % LABEL_COLOR_PRESETS.length]
}

export function upsertAccount(account: StoredAccount) {
  const accounts = getAccounts()
  const index = accounts.findIndex((existing) => existing.id === account.id)
  const next =
    index === -1
      ? [...accounts, account]
      : accounts.map((existing, i) => (i === index ? account : existing))
  writeAccounts(next)
}

export function updateAccountLabel(id: string, label: AccountLabel) {
  const accounts = getAccounts()
  writeAccounts(
    accounts.map((account) => (account.id === id ? { ...account, label } : account)),
  )
}

// Removes an account from the pool and returns whatever is left, so callers
// can decide whether to switch to another account or fall back to /login.
export function removeAccountFromStorage(id: string): StoredAccount[] {
  const remaining = getAccounts().filter((account) => account.id !== id)
  writeAccounts(remaining)
  return remaining
}

export function clearAllAccounts() {
  localStorage.removeItem(ACCOUNTS_KEY)
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}

// Keeps the active account's id/email/name in sync with whatever the server
// returns for "current user" - this is also how a "legacy" placeholder
// (created during migration, before we knew the real user id) gets resolved
// into its real id the first time /users/me succeeds.
export function resolveActiveAccount(user: {
  id: string
  email: string
  full_name?: string | null
}) {
  const activeId = getActiveAccountId()
  if (!activeId) return

  const accounts = getAccounts()
  const index = accounts.findIndex((account) => account.id === activeId)
  if (index === -1) return

  const current = accounts[index]
  const fullName = user.full_name ?? undefined
  if (
    current.id === user.id &&
    current.email === user.email &&
    current.fullName === fullName
  ) {
    return
  }

  const next = [...accounts]
  next[index] = { ...current, id: user.id, email: user.email, fullName }
  writeAccounts(next)

  if (activeId !== user.id) {
    setActiveAccountId(user.id)
  }
}

// Removes the active account and figures out what should happen next:
// switch to another stored account, or fall back to a full logout.
export function handleInvalidActiveAccount(): "switched" | "loggedOut" {
  const activeId = getActiveAccountId()
  if (!activeId) return "loggedOut"

  const remaining = removeAccountFromStorage(activeId)
  if (remaining.length > 0) {
    setActiveAccountId(remaining[0].id)
    return "switched"
  }

  clearAllAccounts()
  return "loggedOut"
}
