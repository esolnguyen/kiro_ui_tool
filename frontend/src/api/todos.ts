import client from './client'

export interface TodoTask {
  description?: string
  title?: string
  completed?: boolean
  done?: boolean
}

export interface TodoList {
  id: string
  file: string
  description: string
  tasks: TodoTask[]
  totalTasks: number
  completedTasks: number
  finished: boolean
  modifiedFiles: string[]
}

export const todosApi = {
  list: (projectDir: string) =>
    client.get<TodoList[]>('/todos', { params: { projectDir } }).then((r) => r.data),

  get: (id: string, projectDir: string) =>
    client.get<TodoList>(`/todos/${id}`, { params: { projectDir } }).then((r) => r.data),

  delete: (id: string, projectDir: string) =>
    client.delete(`/todos/${id}`, { params: { projectDir } }).then((r) => r.data),

  deleteAll: (projectDir: string, finishedOnly = false) =>
    client.delete('/todos', { params: { projectDir, finishedOnly } }).then((r) => r.data),
}
