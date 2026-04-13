from pydantic import BaseModel


class AdoPbi(BaseModel):
    id: int
    title: str = ""
    description: str = ""
    acceptanceCriteria: str = ""
    state: str = ""
    assignedTo: str = ""
    tags: str = ""
    areaPath: str = ""
    iterationPath: str = ""
    workItemType: str = ""  # Product Backlog Item | Bug | etc.
    url: str = ""


class AdoPullRequest(BaseModel):
    id: int
    title: str = ""
    description: str = ""
    status: str = ""  # active | completed | abandoned
    createdBy: str = ""
    sourceBranch: str = ""
    targetBranch: str = ""
    repositoryName: str = ""
    reviewers: list[str] = []
    creationDate: str = ""
    url: str = ""


class AdoBoardColumn(BaseModel):
    name: str
    itemLimit: int = 0
    isSplit: bool = False


class AdoAreaPath(BaseModel):
    name: str
    path: str


class AdoTestCase(BaseModel):
    id: int
    name: str = ""
    state: str = ""
    priority: int = 0
    automationStatus: str = ""


class AdoTestSuite(BaseModel):
    id: int
    name: str = ""
    suiteType: str = ""  # staticTestSuite | requirementTestSuite | dynamicTestSuite
    parentSuiteId: int | None = None
    testCaseCount: int = 0
    testCases: list[AdoTestCase] = []


class AdoTestPlan(BaseModel):
    id: int
    name: str = ""
    state: str = ""  # Active | Inactive
    areaPath: str = ""
    iteration: str = ""
    rootSuiteId: int = 0
    suites: list[AdoTestSuite] = []


class AdoConnectionStatus(BaseModel):
    connected: bool
    organization: str = ""
    project: str = ""
    error: str = ""
