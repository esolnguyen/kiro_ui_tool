import type { Pipeline, PipelineRun } from '../types'
import { createCrudApi } from './crud'
import client from './client'

export type PipelineCreate = Omit<Pipeline, 'id' | 'createdAt'>

export const pipelinesApi = createCrudApi<Pipeline, PipelineCreate>('/pipelines', 'id')

export const pipelineRunsApi = {
  start: (pipelineId: string, input: Record<string, unknown> = {}) =>
    client.post<PipelineRun>('/pipelines/runs', { pipelineId, input }).then((r) => r.data),

  list: (pipelineId?: string) =>
    client.get<PipelineRun[]>('/pipelines/runs', { params: pipelineId ? { pipeline_id: pipelineId } : {} }).then((r) => r.data),

  get: (runId: string) =>
    client.get<PipelineRun>(`/pipelines/runs/${runId}`).then((r) => r.data),

  delete: (runId: string) =>
    client.delete(`/pipelines/runs/${runId}`),

  approveStage: (runId: string, stageId: string) =>
    client.post<PipelineRun>(`/pipelines/runs/${runId}/stages/${stageId}/approve`).then((r) => r.data),

  rejectStage: (runId: string, stageId: string) =>
    client.post<PipelineRun>(`/pipelines/runs/${runId}/stages/${stageId}/reject`).then((r) => r.data),

  submitInput: (runId: string, stageId: string, input: string) =>
    client.post<PipelineRun>(`/pipelines/runs/${runId}/stages/${stageId}/submit-input`, { input }).then((r) => r.data),

  retryStage: (runId: string, stageId: string) =>
    client.post<PipelineRun>(`/pipelines/runs/${runId}/stages/${stageId}/retry`).then((r) => r.data),
}
