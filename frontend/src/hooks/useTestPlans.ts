import { useEffect, useState } from "react";
import { adoApi, type AdoTestPlan, type AdoTestSuite, type AdoTestCase } from "../api/ado";

export function useTestPlans(active: boolean) {
  const [testPlans, setTestPlans] = useState<AdoTestPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Selected plan & suite for drill-down
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedSuiteId, setSelectedSuiteId] = useState<number | null>(null);

  // Suites for selected plan
  const [suites, setSuites] = useState<AdoTestSuite[]>([]);
  const [suitesLoading, setSuitesLoading] = useState(false);

  // Test cases for selected suite
  const [testCases, setTestCases] = useState<AdoTestCase[]>([]);
  const [testCasesLoading, setTestCasesLoading] = useState(false);

  async function fetchTestPlans() {
    setLoading(true);
    setError("");
    try {
      const plans = await adoApi.listTestPlans();
      setTestPlans(plans);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch test plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active) fetchTestPlans();
  }, [active]);

  // Fetch suites when a plan is selected
  useEffect(() => {
    if (!selectedPlanId) {
      setSuites([]);
      setSelectedSuiteId(null);
      setTestCases([]);
      return;
    }
    setSuitesLoading(true);
    adoApi
      .listTestSuites(selectedPlanId)
      .then(setSuites)
      .catch(() => setSuites([]))
      .finally(() => setSuitesLoading(false));
  }, [selectedPlanId]);

  // Fetch test cases when a suite is selected
  useEffect(() => {
    if (!selectedPlanId || !selectedSuiteId) {
      setTestCases([]);
      return;
    }
    setTestCasesLoading(true);
    adoApi
      .listTestCases(selectedPlanId, selectedSuiteId)
      .then(setTestCases)
      .catch(() => setTestCases([]))
      .finally(() => setTestCasesLoading(false));
  }, [selectedPlanId, selectedSuiteId]);

  function selectPlan(planId: number | null) {
    setSelectedPlanId(planId);
    setSelectedSuiteId(null);
    setTestCases([]);
  }

  function refreshSuites() {
    if (!selectedPlanId) return;
    setSuitesLoading(true);
    adoApi
      .listTestSuites(selectedPlanId)
      .then(setSuites)
      .catch(() => setSuites([]))
      .finally(() => setSuitesLoading(false));
  }

  return {
    testPlans,
    loading,
    error,
    selectedPlanId,
    selectPlan,
    suites,
    suitesLoading,
    selectedSuiteId,
    setSelectedSuiteId,
    testCases,
    testCasesLoading,
    refresh: fetchTestPlans,
    refreshSuites,
  };
}
