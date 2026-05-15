"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../lib/api";
import type { EntityLaserFocus, ProductLaserFocus } from "../lib/types";

type LaserType = "entity" | "product";

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

export function useLaserFocus(options: UseLaserFocusOptions & { type: "entity" }): LaserFocusState<EntityLaserFocus>;
export function useLaserFocus(options: UseLaserFocusOptions & { type: "product" }): LaserFocusState<ProductLaserFocus>;
export function useLaserFocus({ type, id }: UseLaserFocusOptions): LaserFocusState<EntityLaserFocus | ProductLaserFocus> {
  const [data, setData] = useState<EntityLaserFocus | ProductLaserFocus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint =
        type === "entity"
          ? `/stakeholders/entities/${id}/history`
          : `/inventory/products/${id}/laser`;

      const response = await api.get(endpoint);
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to load ${type} details`);
    } finally {
      setLoading(false);
    }
  }, [type, id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
