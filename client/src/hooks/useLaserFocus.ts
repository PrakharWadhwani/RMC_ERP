"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import type { StakeholderLaserFocus, ProductLaserFocus, VendorFullProfile } from "../lib/types";

type LaserType = "customer" | "vendor" | "product";

interface UseLaserFocusOptions {
  type: LaserType;
  id: number | string;
}

interface LaserFocusState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLaserFocus(options: UseLaserFocusOptions & { type: "customer" }): LaserFocusState<StakeholderLaserFocus>;
export function useLaserFocus(options: UseLaserFocusOptions & { type: "vendor" }): LaserFocusState<VendorFullProfile>;
export function useLaserFocus(options: UseLaserFocusOptions & { type: "product" }): LaserFocusState<ProductLaserFocus>;
export function useLaserFocus({ type, id }: UseLaserFocusOptions): LaserFocusState<StakeholderLaserFocus | VendorFullProfile | ProductLaserFocus> {
  const [data, setData] = useState<StakeholderLaserFocus | ProductLaserFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      let endpoint = "";
      if (type === "customer") endpoint = `/customers/${id}/history`;
      else if (type === "vendor") endpoint = `/vendors/${id}/full-profile`;
      else endpoint = `/inventory/products/${id}/laser`;

      const response = await api.get(endpoint);
      setData(response.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(`Failed to load ${type} details`);
      }
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
