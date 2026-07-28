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
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const openDrawer = useCallback(() => setIsOpen(true), [])
  const closeDrawer = useCallback(() => setIsOpen(false), [])
  const toggleDrawer = useCallback(() => setIsOpen((prev) => !prev), [])

  const value = useMemo(
    () => ({ isOpen, openDrawer, closeDrawer, toggleDrawer }),
    [isOpen, openDrawer, closeDrawer, toggleDrawer],
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
