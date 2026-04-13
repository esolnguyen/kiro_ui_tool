import { Filter } from 'lucide-react'
import type { AdoAreaPath } from '../../api/ado'
import SearchableSelect from './SearchableSelect'
import styles from './workplace.module.scss'

interface WorkItemFiltersProps {
  typeFilter: string
  setTypeFilter: (v: string) => void
  stateFilter: string
  setStateFilter: (v: string) => void
  areaFilter: string
  setAreaFilter: (v: string) => void
  boardColumns: AdoAreaPath[]
}

export function WorkItemFilters({
  typeFilter, setTypeFilter,
  stateFilter, setStateFilter,
  areaFilter, setAreaFilter,
  boardColumns,
}: WorkItemFiltersProps) {
  const activeCount = [typeFilter, stateFilter, areaFilter].filter(Boolean).length

  return (
    <div className={styles.filters}>
      <Filter size={12} className={`${styles.filterIcon} ${activeCount > 0 ? styles.active : ''}`} />
      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
        className={`input ${styles.filterSelect}`}>
        <option value="">All types</option>
        <option value="Product Backlog Item">PBI</option>
        <option value="Bug">Bug</option>
        <option value="Task">Task</option>
        <option value="Feature">Feature</option>
      </select>
      <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
        className={`input ${styles.filterSelect}`}>
        <option value="">All states</option>
        <option value="New">New</option>
        <option value="Approved">Approved</option>
        <option value="Committed">Committed</option>
        <option value="On hold">On hold</option>
        <option value="In Review">In Review</option>
        <option value="Done">Done</option>
        <option value="Removed">Removed</option>
      </select>
      <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}
        className={`input ${styles.filterSelect}`}>
        <option value="">All areas</option>
        {boardColumns.map((area) => (
          <option key={area.path} value={area.path}>{area.name}</option>
        ))}
      </select>
    </div>
  )
}

interface PrFiltersProps {
  statusFilter: string
  setStatusFilter: (v: string) => void
  repoFilter: string
  setRepoFilter: (v: string) => void
  creatorFilter: string
  setCreatorFilter: (v: string) => void
  repos: string[]
  creators: string[]
}

export function PrFilters({
  statusFilter, setStatusFilter,
  repoFilter, setRepoFilter,
  creatorFilter, setCreatorFilter,
  repos, creators,
}: PrFiltersProps) {
  return (
    <div className={styles.prFilters}>
      <Filter size={11} className={styles.filterIcon} />
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
        className={`input ${styles.prFilterSelect}`}>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="abandoned">Abandoned</option>
      </select>
      <SearchableSelect value={repoFilter} onChange={setRepoFilter} options={repos} placeholder="All repos" />
      <SearchableSelect value={creatorFilter} onChange={setCreatorFilter} options={creators} placeholder="All authors" />
    </div>
  )
}
