begin;
-- Validate the JSON clinical contract for direct RPC callers too, without changing legacy rows.
create or replace function vertice_discursiva.validate_clinical_question() returns trigger
language plpgsql set search_path=pg_catalog as $$
declare c jsonb:=new.content;k text;total numeric:=0;item jsonb;
begin
 if coalesce(c->>'profile','institutional') not in ('institutional','enamed','residencia') then raise exception 'Modalidade discursiva inválida';end if;
 if coalesce(c->>'profile','institutional')='institutional' then return new;end if;
 if c->>'medicalArea' is null or c->>'medicalArea' not in ('Clínica Médica','Cirurgia Geral','Pediatria','Ginecologia e Obstetrícia','Medicina de Família e Comunidade','Saúde Mental','Saúde Coletiva') then raise exception 'Área médica obrigatória';end if;
 if length(btrim(coalesce(c->>'referenceVersion','')))<2 or length(c->>'referenceVersion')>200 then raise exception 'Versão das referências obrigatória';end if;
 if c->>'profile'='residencia' and (length(btrim(coalesce(c->>'residencyProgram','')))<3 or length(c->>'residencyProgram')>300) then raise exception 'Programa ou preparação geral obrigatória';end if;
 if jsonb_typeof(c->'rubric') is distinct from 'array' or jsonb_array_length(c->'rubric')<>4 then raise exception 'Quatro critérios clínicos obrigatórios';end if;
 foreach k in array array['clinicalReasoning','diagnosticHypotheses','investigation','management'] loop
 if jsonb_typeof(c->'clinicalExpected'->k) is distinct from 'string' or length(btrim(coalesce(c->'clinicalExpected'->>k,'')))<20 or length(c->'clinicalExpected'->>k)>4000 then raise exception 'Resposta clínica específica obrigatória em cada dimensão';end if;
 if (select count(*) from jsonb_array_elements(c->'rubric')r where r->>'key'=k)<>1 then raise exception 'Dimensão clínica ausente ou repetida';end if;
 end loop;
 for item in select * from jsonb_array_elements(c->'rubric') loop
 if length(btrim(coalesce(item->>'criterion','')))<20 or jsonb_typeof(item->'points') is distinct from 'number' or (item->>'points')::numeric<=0 then raise exception 'Critério clínico inválido';end if;
 total:=total+(item->>'points')::numeric;
 end loop;
 if total<>10 then raise exception 'Rubrica clínica deve totalizar 10 pontos';end if;
 new.content:=jsonb_set(new.content,'{origin}','"authorial_preparation"'::jsonb);
 if new.status='approved' then
 if jsonb_typeof(c->'sources') is distinct from 'array' or jsonb_array_length(c->'sources')=0 or c->>'referenceVersion' ilike '%validar%' or c->>'referenceVersion' ilike '%pendente%' then raise exception 'Homologação clínica exige fontes versionadas e revisadas';end if;
 for item in select * from jsonb_array_elements(c->'sources') loop
 if length(coalesce(item->>'id',''))<3 or length(coalesce(item->>'excerpt',''))<30 then raise exception 'Fonte clínica sem evidência textual';end if;
 end loop;
 end if;
 return new;
end;$$;
revoke all on function vertice_discursiva.validate_clinical_question() from public,anon,authenticated;
create trigger discursiva_clinical_contract before insert or update on vertice_discursiva.questions for each row execute function vertice_discursiva.validate_clinical_question();
commit;
