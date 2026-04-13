"""Azure DevOps REST API client.

Read-only client for fetching PBIs, board columns, and work item details.
Also supports updating PBI state (for pipeline hooks).
"""

import re
from html import unescape

import httpx

from app.models.ado import (
    AdoPbi, AdoPullRequest, AdoBoardColumn, AdoAreaPath, AdoConnectionStatus,
    AdoTestPlan, AdoTestSuite, AdoTestCase,
)
from app.services import settings_store


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _html_to_text(html: str) -> str:
    """Strip HTML tags and decode entities."""
    if not html:
        return ""
    text = _HTML_TAG_RE.sub("", html)
    return unescape(text).strip()


def _get_config() -> dict:
    """Load ADO config from settings."""
    settings = settings_store.load()
    return settings.get("azureDevOps", {})


def _check_config(config: dict) -> str | None:
    """Return error message if config is incomplete, else None."""
    if not config.get("organization"):
        return "Azure DevOps organization not configured"
    if not config.get("project"):
        return "Azure DevOps project not configured"
    if not config.get("personalAccessToken"):
        return "Azure DevOps personal access token not configured"
    return None


class AdoClient:
    """Azure DevOps REST API client."""

    def __init__(self, org: str, project: str, pat: str, api_version: str = "7.1"):
        self.base_url = f"https://dev.azure.com/{org}/{project}/_apis"
        self.org = org
        self.project = project
        self.auth = httpx.BasicAuth("", pat)
        self.api_version = api_version

    def _params(self, **extra: str) -> dict[str, str]:
        params = {"api-version": self.api_version}
        params.update(extra)
        return params

    async def get_pbi(self, work_item_id: int) -> AdoPbi:
        """Fetch a single work item by ID."""
        url = f"{self.base_url}/wit/workitems/{work_item_id}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                auth=self.auth,
                params=self._params(**{"$expand": "all"}),
            )
            resp.raise_for_status()
            data = resp.json()
        return self._parse_work_item(data)

    async def list_pbis(
        self,
        work_item_type: str | None = None,
        state: str | None = None,
        area_path: str | None = None,
        top: int = 50,
    ) -> list[AdoPbi]:
        """List work items using WIQL query."""
        conditions = ["[System.TeamProject] = @project"]
        if work_item_type:
            conditions.append(f"[System.WorkItemType] = '{work_item_type}'")
        else:
            conditions.append(
                "[System.WorkItemType] IN ('Product Backlog Item', 'Bug', 'User Story', 'Task')"
            )
        if state:
            conditions.append(f"[System.State] = '{state}'")
        if area_path:
            conditions.append(f"[System.AreaPath] UNDER '{area_path}'")

        wiql = f"SELECT [System.Id] FROM WorkItems WHERE {' AND '.join(conditions)} ORDER BY [System.ChangedDate] DESC"

        url = f"{self.base_url}/wit/wiql"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                auth=self.auth,
                params=self._params(**{"$top": str(top)}),
                json={"query": wiql},
            )
            resp.raise_for_status()
            data = resp.json()

        work_item_ids = [item["id"] for item in data.get("workItems", [])]
        if not work_item_ids:
            return []

        # Batch fetch work item details
        ids_str = ",".join(str(i) for i in work_item_ids[:top])
        url = f"{self.base_url}/wit/workitems"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                auth=self.auth,
                params=self._params(ids=ids_str, **{"$expand": "all"}),
            )
            resp.raise_for_status()
            data = resp.json()

        return [self._parse_work_item(item) for item in data.get("value", [])]

    async def get_board_columns(self, team: str | None = None) -> list[AdoBoardColumn]:
        """Get board column definitions."""
        team_segment = team or f"{self.project} Team"
        url = f"https://dev.azure.com/{self.org}/{self.project}/{team_segment}/_apis/work/boards/Backlog items/columns"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                auth=self.auth,
                params=self._params(),
            )
            resp.raise_for_status()
            data = resp.json()

        return [
            AdoBoardColumn(
                name=col.get("name", ""),
                itemLimit=col.get("itemLimit", 0),
                isSplit=col.get("isSplit", False),
            )
            for col in data.get("value", [])
        ]

    async def list_area_paths(self, depth: int = 2) -> list[AdoAreaPath]:
        """Get area path tree for the project."""
        url = f"{self.base_url}/wit/classificationnodes/Areas"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                url,
                auth=self.auth,
                params=self._params(**{"$depth": str(depth)}),
            )
            resp.raise_for_status()
            data = resp.json()

        results: list[AdoAreaPath] = []
        self._collect_area_paths(data, results)
        return results

    def _collect_area_paths(self, node: dict, results: list[AdoAreaPath], skip_root: bool = True) -> None:
        path = node.get("path", "")
        name = node.get("name", "")
        if path and not skip_root:
            # API returns paths like \Project\Area\Team — strip leading \ and \Area segment
            clean = path.lstrip("\\").replace("\\Area", "", 1)
            results.append(AdoAreaPath(name=name, path=clean))
        for child in node.get("children", []):
            self._collect_area_paths(child, results, skip_root=False)

    async def list_pull_requests(
        self,
        status: str = "active",
        repository_id: str | None = None,
        top: int = 50,
    ) -> list[AdoPullRequest]:
        """List pull requests from Azure DevOps Git repositories."""
        if repository_id:
            url = f"{self.base_url}/git/repositories/{repository_id}/pullrequests"
        else:
            url = f"{self.base_url}/git/pullrequests"

        params = self._params(
            **{"searchCriteria.status": status, "$top": str(top)}
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, auth=self.auth, params=params)
            resp.raise_for_status()
            data = resp.json()

        return [self._parse_pull_request(pr) for pr in data.get("value", [])]

    def _parse_pull_request(self, data: dict) -> AdoPullRequest:
        """Parse ADO pull request JSON into AdoPullRequest."""
        created_by = data.get("createdBy", {})
        reviewers = [
            r.get("displayName", "")
            for r in data.get("reviewers", [])
            if r.get("displayName")
        ]
        repo = data.get("repository", {})
        source = data.get("sourceRefName", "").replace("refs/heads/", "")
        target = data.get("targetRefName", "").replace("refs/heads/", "")

        web_url = (
            data.get("url", "")
            .replace("/_apis/git/repositories/", "/_git/")
            .replace("/pullRequests/", "/pullrequest/")
        )

        return AdoPullRequest(
            id=data.get("pullRequestId", 0),
            title=data.get("title", ""),
            description=data.get("description", ""),
            status=data.get("status", ""),
            createdBy=created_by.get("displayName", "") if isinstance(created_by, dict) else str(created_by),
            sourceBranch=source,
            targetBranch=target,
            repositoryName=repo.get("name", ""),
            reviewers=reviewers,
            creationDate=data.get("creationDate", ""),
            url=web_url,
        )

    async def update_pbi_state(self, work_item_id: int, state: str) -> AdoPbi:
        """Update a work item's state."""
        url = f"{self.base_url}/wit/workitems/{work_item_id}"
        patch_doc = [
            {
                "op": "replace",
                "path": "/fields/System.State",
                "value": state,
            }
        ]
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(
                url,
                auth=self.auth,
                params=self._params(),
                json=patch_doc,
                headers={"Content-Type": "application/json-patch+json"},
            )
            resp.raise_for_status()
            data = resp.json()
        return self._parse_work_item(data)

    # ── Test Plans ────────────────────────────────────────────────────────

    async def list_test_plans(self) -> list[AdoTestPlan]:
        """List all test plans in the project."""
        url = f"{self.base_url}/testplan/plans"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, auth=self.auth, params=self._params())
            resp.raise_for_status()
            data = resp.json()
        return [self._parse_test_plan(p) for p in data.get("value", [])]

    async def get_test_plan(self, plan_id: int) -> AdoTestPlan:
        """Fetch a single test plan with its suites."""
        url = f"{self.base_url}/testplan/plans/{plan_id}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, auth=self.auth, params=self._params())
            resp.raise_for_status()
            plan_data = resp.json()

        plan = self._parse_test_plan(plan_data)
        plan.suites = await self.list_test_suites(plan_id)
        return plan

    async def list_test_suites(self, plan_id: int) -> list[AdoTestSuite]:
        """List suites in a test plan."""
        url = f"{self.base_url}/testplan/plans/{plan_id}/suites"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, auth=self.auth, params=self._params())
            resp.raise_for_status()
            data = resp.json()
        return [self._parse_test_suite(s) for s in data.get("value", [])]

    async def list_test_cases(self, plan_id: int, suite_id: int) -> list[AdoTestCase]:
        """List test cases in a suite."""
        url = f"{self.base_url}/testplan/plans/{plan_id}/suites/{suite_id}/testcase"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, auth=self.auth, params=self._params())
            resp.raise_for_status()
            data = resp.json()
        return [self._parse_test_case(tc) for tc in data.get("value", [])]

    async def create_test_plan(self, name: str, area_path: str = "", iteration: str = "") -> AdoTestPlan:
        """Create a new test plan."""
        url = f"{self.base_url}/testplan/plans"
        body: dict = {"name": name}
        if area_path:
            body["areaPath"] = area_path
        if iteration:
            body["iteration"] = iteration
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, auth=self.auth, params=self._params(), json=body)
            resp.raise_for_status()
            data = resp.json()
        return self._parse_test_plan(data)

    async def create_test_suite(
        self, plan_id: int, name: str, suite_type: str = "staticTestSuite",
        parent_suite_id: int | None = None, requirement_id: int | None = None,
    ) -> AdoTestSuite:
        """Create a test suite inside a plan."""
        root_suite_id = parent_suite_id
        if not root_suite_id:
            plan = await self.get_test_plan(plan_id)
            root_suite_id = plan.rootSuiteId

        url = f"{self.base_url}/testplan/plans/{plan_id}/suites"
        body: dict = {"name": name, "suiteType": suite_type}
        if root_suite_id:
            body["parentSuite"] = {"id": root_suite_id}
        if requirement_id and suite_type == "requirementTestSuite":
            body["requirementId"] = requirement_id
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, auth=self.auth, params=self._params(), json=body)
            resp.raise_for_status()
            data = resp.json()
        return self._parse_test_suite(data)

    async def create_test_case(self, title: str, steps: list[str] | None = None) -> AdoTestCase:
        """Create a test case work item."""
        url = f"{self.base_url}/wit/workitems/$Test Case"
        patch_doc = [
            {"op": "add", "path": "/fields/System.Title", "value": title},
        ]
        if steps:
            steps_xml = "".join(
                f'<step id="{i+1}" type="ActionStep"><parameterizedString isformatted="true">{s}</parameterizedString><parameterizedString isformatted="true"></parameterizedString><description/></step>'
                for i, s in enumerate(steps)
            )
            patch_doc.append(
                {"op": "add", "path": "/fields/Microsoft.VSTS.TCM.Steps", "value": f"<steps>{steps_xml}</steps>"}
            )
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url, auth=self.auth, params=self._params(),
                json=patch_doc,
                headers={"Content-Type": "application/json-patch+json"},
            )
            resp.raise_for_status()
            data = resp.json()
        fields = data.get("fields", {})
        return AdoTestCase(
            id=data.get("id", 0),
            name=fields.get("System.Title", ""),
            state=fields.get("System.State", ""),
            priority=fields.get("Microsoft.VSTS.Common.Priority", 0),
            automationStatus=fields.get("Microsoft.VSTS.TCM.AutomationStatus", ""),
        )

    async def add_test_case_to_suite(self, plan_id: int, suite_id: int, test_case_ids: list[int]) -> None:
        """Add existing test case work items to a suite."""
        url = f"{self.base_url}/testplan/plans/{plan_id}/suites/{suite_id}/testcase"
        body = [{"workItem": {"id": tc_id}} for tc_id in test_case_ids]
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, auth=self.auth, params=self._params(), json=body)
            resp.raise_for_status()

    def _parse_test_plan(self, data: dict) -> AdoTestPlan:
        root_suite = data.get("rootSuite", {})
        return AdoTestPlan(
            id=data.get("id", 0),
            name=data.get("name", ""),
            state=data.get("state", ""),
            areaPath=data.get("areaPath", ""),
            iteration=data.get("iteration", ""),
            rootSuiteId=root_suite.get("id", 0) if isinstance(root_suite, dict) else 0,
        )

    def _parse_test_suite(self, data: dict) -> AdoTestSuite:
        parent = data.get("parentSuite", {})
        return AdoTestSuite(
            id=data.get("id", 0),
            name=data.get("name", ""),
            suiteType=data.get("suiteType", ""),
            parentSuiteId=parent.get("id") if isinstance(parent, dict) else None,
            testCaseCount=data.get("testCaseCount", 0),
        )

    def _parse_test_case(self, data: dict) -> AdoTestCase:
        wi = data.get("workItem", {})
        wi_fields = wi.get("workItemFields", [])
        fields: dict = {}
        for f in wi_fields:
            if isinstance(f, dict):
                fields.update(f)
        return AdoTestCase(
            id=wi.get("id", data.get("testCase", {}).get("id", 0)),
            name=wi.get("name", fields.get("System.Title", "")),
            state=fields.get("System.State", ""),
            priority=fields.get("Microsoft.VSTS.Common.Priority", 0),
            automationStatus=fields.get("Microsoft.VSTS.TCM.AutomationStatus", ""),
        )

    def _parse_work_item(self, data: dict) -> AdoPbi:
        """Parse ADO work item JSON into AdoPbi."""
        fields = data.get("fields", {})
        assigned = fields.get("System.AssignedTo", {})
        assigned_name = assigned.get("displayName", "") if isinstance(assigned, dict) else str(assigned)

        return AdoPbi(
            id=data.get("id", 0),
            title=fields.get("System.Title", ""),
            description=_html_to_text(fields.get("System.Description", "")),
            acceptanceCriteria=_html_to_text(
                fields.get("Microsoft.VSTS.Common.AcceptanceCriteria", "")
            ),
            state=fields.get("System.State", ""),
            assignedTo=assigned_name,
            tags=fields.get("System.Tags", ""),
            areaPath=fields.get("System.AreaPath", ""),
            iterationPath=fields.get("System.IterationPath", ""),
            workItemType=fields.get("System.WorkItemType", ""),
            url=data.get("_links", {}).get("html", {}).get("href", ""),
        )


# ── Factory ───────────────────────────────────────────────────────────────

def get_ado_client() -> AdoClient | None:
    """Create an AdoClient from settings. Returns None if not configured."""
    config = _get_config()
    err = _check_config(config)
    if err:
        return None
    return AdoClient(
        org=config["organization"],
        project=config["project"],
        pat=config["personalAccessToken"],
        api_version=config.get("apiVersion", "7.1"),
    )


def get_connection_status() -> AdoConnectionStatus:
    """Check if ADO is configured and return status."""
    config = _get_config()
    err = _check_config(config)
    if err:
        return AdoConnectionStatus(
            connected=False,
            organization=config.get("organization", ""),
            project=config.get("project", ""),
            error=err,
        )
    return AdoConnectionStatus(
        connected=True,
        organization=config["organization"],
        project=config["project"],
    )
