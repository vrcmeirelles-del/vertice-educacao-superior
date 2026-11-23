import {supabase} from '@/lib/supabase';
import type {PrintStudent} from './individualized-pdf';
export type AuthorizedClassStudent=PrintStudent&{verified:boolean};
/** Fonte: RPC com AAL2, vínculo de curso e disciplina e IES. Sem leitura pública de roster. */
export async function loadAuthorizedClassRoster(args:{
 institutionId:string;courseId:string;disciplineId:string;classLabel:string;forPrinting?:boolean
}):Promise<{students:AuthorizedClassStudent[];registrationVerified:false}>{
 if(!args.institutionId||!args.courseId||!args.disciplineId||!args.classLabel.trim())
  throw new Error('Selecione curso, disciplina e turma antes da consulta.');
 const {data,error}=await supabase.rpc(args.forPrinting?'vertice_avalia_print_roster':'vertice_avalia_class_roster',{
  p_institution:args.institutionId,p_course:args.courseId,
  p_discipline:args.disciplineId,p_class:args.classLabel.trim()
 });
 if(error)throw new Error('Consulta à turma indisponível ou sem autorização.');
 if(!data||typeof data!=='object'||!Array.isArray((data as {students?:unknown}).students))
  throw new Error('Lista da turma incompleta.');
 const rows=(data as {students:unknown[];registrationVerified?:unknown}).students;
 const unique=new Set<string>();
 const students:AuthorizedClassStudent[]=rows.map((value)=>{
  if(!value||typeof value!=='object')throw new Error('Registro da turma inválido.');
  const row=value as Record<string,unknown>;
  if(typeof row.id!=='string'||typeof row.name!=='string'||
     !row.id.trim()||!row.name.trim()||unique.has(row.id))
    throw new Error('Lista contém registros sem identificação ou duplicados.');
  unique.add(row.id);
  return {id:row.id,name:row.name,registration:typeof row.registration==='string'?row.registration:undefined,
   verified:row.verified===true,selected:true};
 });
 return {students,registrationVerified:false};
}
