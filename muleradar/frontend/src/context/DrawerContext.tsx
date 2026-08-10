import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

interface DrawerContextValue {
  isOpen: boolean
  toggleDrawer: () => void
  closeDrawer: () => void
  openDrawer: () => void
  openDrawerForAccount: (accountId: string) => void
  initialAccountId: string | null
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialAccountId, setInitialAccountId] = useState<string | null>(null)
  const openDrawer = useCallback(() => setIsOpen(true), [])
  const closeDrawer = useCallback(() => {
    setIsOpen(false)
    setInitialAccountId(null)
  }, [])
  const toggleDrawer = useCallback(() => setIsOpen((prev) => !prev), [])
  const openDrawerForAccount = useCallback((accountId: string) => {
    setInitialAccountId(accountId)
    setIsOpen(true)
  }, [])

  const value = useMemo(
    () => ({ isOpen, openDrawer, closeDrawer, toggleDrawer, openDrawerForAccount, initialAccountId }),
    [isOpen, openDrawer, closeDrawer, toggleDrawer, openDrawerForAccount, initialAccountId],
  )

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}

export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext)
  if (!ctx) {
    throw new Error('useDrawer must be used within a DrawerProvider')
  }
  return ctx
}
