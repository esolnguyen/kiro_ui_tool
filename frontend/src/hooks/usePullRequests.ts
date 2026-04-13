import { useEffect, useState } from "react";
import { adoApi, type AdoPullRequest } from "../api/ado";

export function usePullRequests(active: boolean) {
  const [pullRequests, setPullRequests] = useState<AdoPullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("active");
  const [repoFilter, setRepoFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");

  async function fetchPullRequests() {
    setLoading(true);
    setError("");
    try {
      const prs = await adoApi.listPullRequests({
        status: statusFilter,
        top: 50,
      });
      setPullRequests(prs);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to fetch pull requests",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active) fetchPullRequests();
  }, [statusFilter, active]);

  const repos = [
    ...new Set(pullRequests.map((pr) => pr.repositoryName).filter(Boolean)),
  ].sort();
  const creators = [
    ...new Set(pullRequests.map((pr) => pr.createdBy).filter(Boolean)),
  ].sort();

  const filtered = pullRequests.filter((pr) => {
    if (repoFilter && pr.repositoryName !== repoFilter) return false;
    if (creatorFilter && pr.createdBy !== creatorFilter) return false;
    return true;
  });

  return {
    pullRequests: filtered,
    allPullRequests: pullRequests,
    loading,
    error,
    repos,
    creators,
    statusFilter,
    setStatusFilter,
    repoFilter,
    setRepoFilter,
    creatorFilter,
    setCreatorFilter,
    refresh: fetchPullRequests,
  };
}
