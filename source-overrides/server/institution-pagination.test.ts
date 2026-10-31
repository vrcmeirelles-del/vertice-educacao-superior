import { describe, expect, it, vi } from "vitest";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../client/src/lib/supabase", () => ({ supabase: { from } }));
import { listByInstitution } from "../client/src/lib/area";
describe("listas completas da instituição", () => {
 it("carrega além de mil registros com ordenação estável e mantém o filtro da IES", async () => {
  const first=Array.from({length:1000},(_,i)=>({id:String(i)}));
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValueOnce({data:first,error:null}).mockResolvedValueOnce({data:[{id:"1000"}],error:null})};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query);from.mockReturnValue(query);
  const rows=await listByInstitution("vertice_goals","ies-a");
  expect(rows).toHaveLength(1001);expect(query.eq).toHaveBeenCalledWith("institution_id","ies-a");
  expect(query.order).toHaveBeenCalledWith("id",{ascending:true});
  expect(query.range.mock.calls).toEqual([[0,999],[1000,1999]]);
 });
 it("não apresenta uma lista parcial como completa após falha",async()=>{
  const query={select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn().mockResolvedValue({data:null,error:new Error("Falha")})};
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);query.order.mockReturnValue(query);from.mockReturnValue(query);
  await expect(listByInstitution("vertice_goals","ies-a")).rejects.toThrow("Falha");
 });
});
