import { supabase } from "@/lib/supabase";
import type { Entry, Payload, Scope, State } from "./model";
export async function loadOperations(
  scope: Scope,
  before?: number,
): Promise<State> {
  const { data, error } = await supabase.rpc("vertice_enade360_operations", {
    p_action: "state",
    p_payload: { ...scope, before },
  });
  if (error) throw error;
  return data as State;
}
export async function saveOperation(
  scope: Scope,
  front: string,
  kind: Entry["kind"],
  payload: Payload,
  id: string,
  expected_seq: number,
): Promise<Entry> {
  const { data, error } = await supabase.rpc("vertice_enade360_operations", {
    p_action: kind,
    p_payload: { ...scope, front, payload, id, expected_seq },
  });
  if (error) throw error;
  return data as Entry;
}
