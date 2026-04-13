import client from './client'

export interface AdoPbi {
  id: number
  title: string
  description: string
  acceptanceCriteria: string
  state: string
  assignedTo: string
  tags: string
  areaPath: string
  iterationPath: string
  workItemType: string
  url: string
}

export interface AdoPullRequest {
  id: number
  title: string
  description: string
  status: string
  createdBy: string
  sourceBranch: string
  targetBranch: string
  repositoryName: string
  reviewers: string[]
  creationDate: string
  url: string
}

export interface AdoConnectionStatus {
  connected: boolean
  organization: string
  project: string
  error: string
}

export interface AdoBoardColumn {
  name: string
  itemLimit: number
  isSplit: boolean
}

export interface AdoAreaPath {
  name: string
  path: string
}

export interface AdoTestCase {
  id: number
  name: string
  state: string
  priority: number
  automationStatus: string
}

export interface AdoTestSuite {
  id: number
  name: string
  suiteType: string
  parentSuiteId: number | null
  testCaseCount: number
  testCases: AdoTestCase[]
}

export interface AdoTestPlan {
  id: number
  name: string
  state: string
  areaPath: string
  iteration: string
  rootSuiteId: number
  suites: AdoTestSuite[]
}

export const adoApi = {
  status: () =>
    client.get<AdoConnectionStatus>('/ado/status').then((r) => r.data),

  listPbis: (params?: { work_item_type?: string; state?: string; area_path?: string; top?: number }) =>
    client.get<AdoPbi[]>('/ado/pbis', { params }).then((r) => r.data),

  getPbi: (id: number) =>
    client.get<AdoPbi>(`/ado/pbis/${id}`).then((r) => r.data),

  updateState: (id: number, state: string) =>
    client.patch<AdoPbi>(`/ado/pbis/${id}/state`, { state }).then((r) => r.data),

  boardColumns: () =>
    client.get<AdoBoardColumn[]>('/ado/board/columns').then((r) => r.data),

  areaPaths: () =>
    client.get<AdoAreaPath[]>('/ado/area-paths').then((r) => r.data),

  listPullRequests: (params?: { status?: string; top?: number }) =>
    client.get<AdoPullRequest[]>('/ado/pull-requests', { params }).then((r) => r.data),

  // Test Plans
  listTestPlans: () =>
    client.get<AdoTestPlan[]>('/ado/test-plans').then((r) => r.data),

  getTestPlan: (planId: number) =>
    client.get<AdoTestPlan>(`/ado/test-plans/${planId}`).then((r) => r.data),

  listTestSuites: (planId: number) =>
    client.get<AdoTestSuite[]>(`/ado/test-plans/${planId}/suites`).then((r) => r.data),

  listTestCases: (planId: number, suiteId: number) =>
    client.get<AdoTestCase[]>(`/ado/test-plans/${planId}/suites/${suiteId}/test-cases`).then((r) => r.data),

  createTestPlan: (name: string, areaPath?: string, iteration?: string) =>
    client.post<AdoTestPlan>('/ado/test-plans', { name, areaPath, iteration }).then((r) => r.data),

  createTestSuite: (planId: number, name: string, suiteType?: string, parentSuiteId?: number) =>
    client.post<AdoTestSuite>(`/ado/test-plans/${planId}/suites`, { name, suiteType, parentSuiteId }).then((r) => r.data),

  createTestCase: (title: string, steps?: string[]) =>
    client.post<AdoTestCase>('/ado/test-cases', { title, steps }).then((r) => r.data),

  addTestCasesToSuite: (planId: number, suiteId: number, testCaseIds: number[]) =>
    client.post<AdoTestCase[]>(`/ado/test-plans/${planId}/suites/${suiteId}/test-cases`, { testCaseIds }).then((r) => r.data),
}
