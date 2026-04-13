import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import styles from './workplace.module.scss'

interface SearchableSelectProps {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
}

export default function SearchableSelect({ value, onChange, options, placeholder }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <div ref={ref} className={styles.searchSelect}>
      <button
        onClick={() => { setOpen(!open); setSearch('') }}
        className={`input ${styles.searchSelectBtn}`}
      >
        <span className={`${styles.searchSelectBtnText} ${value ? styles.searchSelectValue : styles.searchSelectPlaceholder}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
      </button>
      {open && (
        <div className={styles.searchSelectDropdown}>
          <div className={styles.searchSelectSearch}>
            <Search size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className={styles.searchSelectInput}
            />
          </div>
          <div className={styles.searchSelectOptions}>
            <div
              onClick={() => { onChange(''); setOpen(false) }}
              className={`hover-bg ${styles.searchSelectOption} ${!value ? styles.selected : ''}`}
            >
              {placeholder}
            </div>
            {filtered.map((o) => (
              <div
                key={o}
                onClick={() => { onChange(o); setOpen(false) }}
                className={`hover-bg ${styles.searchSelectOption} ${o === value ? styles.selected : ''}`}
              >
                {o}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className={styles.searchSelectEmpty}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
