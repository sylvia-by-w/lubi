import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { zh } from './zh'
import { en } from './en'

export type Lang = 'zh' | 'en'

const dictionaries = { zh, en }

const STORAGE_KEY = 'lyubishchev_lang'

function getValue(dict: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, dict)
}

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (path: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'en' || saved === 'zh' ? saved : 'zh'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const t = (path: string, vars?: Record<string, string | number>): string => {
    let value = getValue(dictionaries[lang], path)
    if (typeof value !== 'string') value = getValue(dictionaries.zh, path)
    if (typeof value !== 'string') value = path
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = (value as string).replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return value as string
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang: setLangState, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
