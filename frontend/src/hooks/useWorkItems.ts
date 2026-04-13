import { useEffect, useState } from "react";
import { adoApi, type AdoPbi, type AdoAreaPath } from "../api/ado";
import { useWorkplace } from "../components/workplace/WorkplaceContext";

export function useWorkItems() {
  const { setStatus } = useWorkplace();

  const [pbis, setPbis] = useState<AdoPbi[]>([]);
  const [boardColumns, setBoardColumns] = useState<AdoAreaPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("Approved");
  const [areaFilter, setAreaFilter] = useState("");

  async function fetchWorkItems() {
    setLoading(true);
    setError("");
    try {
      const adoStatus = await adoApi.status();
      setStatus(adoStatus);
      if (!adoStatus.connected) {
        setLoading(false);
        return;
      }
      const [items, columns] = await Promise.all([
        adoApi.listPbis({
          ...(typeFilter ? { work_item_type: typeFilter } : {}),
          ...(stateFilter ? { state: stateFilter } : {}),
          ...(areaFilter ? { area_path: areaFilter } : {}),
          top: 50,
        }),
        adoApi.areaPaths().catch(() => [] as AdoAreaPath[]),
      ]);
      setPbis(items);
      setBoardColumns(columns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch work items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkItems();
  }, [typeFilter, stateFilter, areaFilter]);

  return {
    pbis,
    loading,
    error,
    boardColumns,
    typeFilter,
    setTypeFilter,
    stateFilter,
    setStateFilter,
    areaFilter,
    setAreaFilter,
    refresh: fetchWorkItems,
  };
}
