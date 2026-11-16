import {supabase} from '@/lib/supabase';
import type {Entry,Payload} from './model';
export type State={entries:Entry[];current:Entry[];next_before:number|null;fetched_at:string};
export async function loadHomologation(before?:number):Promise<State>{const {data,error}=await supabase.rpc('vertice_master_homologation',{p_action:before?'history':'state',p_payload:before?{before}:{}});if(error)throw error;return data as State;}
export async function saveHomologation(kind:Entry['kind'],payload:Payload&{id:string;module_key:string;institution_id:string;course_id:string|null;expected_seq?:number}){const {data,error}=await supabase.rpc('vertice_master_homologation',{p_action:kind,p_payload:payload});if(error)throw error;return data as Entry;}
