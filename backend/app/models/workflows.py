from pydantic import BaseModel


class WorkflowStep(BaseModel):
    id: str
    agentSlug: str
    label: str


class WorkflowCreate(BaseModel):
    name: str
    description: str = ""
    steps: list[WorkflowStep] = []


class WorkflowResponse(WorkflowCreate):
    id: str
    createdAt: str
