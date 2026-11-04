import { useEffect, useRef, useState } from "react";
import { IesError, errorMessage } from "@/lib/ies/api";
export function useTask() {
  const mounted = useRef(true),
    locked = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run<T>(work: () => Promise<T>, done?: (result: T) => void) {
    if (locked.current || !mounted.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await work();
      if (mounted.current) done?.(value);
    } catch (e) {
      if (mounted.current && !(e instanceof IesError && e.kind === "cancelled"))
        setError(errorMessage(e));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
