import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";

/** Loads once per open (and on retry); `load` is captured on first render. */
export function useLoaded<T>(load: () => Promise<T>, fallback: string) {
  const [loader] = useState(() => load);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    loader()
      .then((value) => current && setData(value))
      .catch((err: unknown) => current && setError(getErrorMessage(err, fallback)));
    return () => {
      current = false;
    };
  }, [loader, fallback, attempt]);
  return {
    data,
    error,
    retry: () => {
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
