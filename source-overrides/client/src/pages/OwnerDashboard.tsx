import {MasterDirectory, MasterInvitationGate} from '@/components/area/MasterAccess';
import {storeActionDraft} from "@/lib/portal-integration";
import {institutionEnrollmentSummary} from "@/lib/enrollment-summary";
import {can, ROLE_LABEL} from "@/lib/area";
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link} from 'wouter';
import {supabase} from '@/lib/supabase';
import type {Session} from '@supabase/supabase-js';
import type {AcademicReport} from '@/components/AcademicReports';
import {CourseView, InstitutionView, courseTotals, latestEnrollmentSnapshots, type Course, type Enrollment, type Institution} from '@/components/InstitutionArea';
import Workspace, {INSTITUTION_FIELDS} from '@/components/area/Workspace';
import RecordForm from '@/components/area/RecordForm';
import {TABLES, isLate, saveRow, type Role, type Row} from '@/lib/area';
import {listByInstitution} from '@/lib/area';
import {listRepository} from '@/lib/repository-data';
import {isInstrumentRequest,latestInstrumentDocuments} from '@/lib/repository';
import GlobalRepository from '@/components/area/GlobalRepository';
import GreenHost from '@/components/acquisitions/GreenHost';
import DemoLeads from '@/components/DemoLeads';
import CaptacaoBI from '@/components/area/CaptacaoBI';
import AcademicoBI from '@/components/bi/AcademicoBI';
import PainelBI from '@/components/bi/PainelBI';
import ProfileSimulator from '@/components/area/ProfileSimulator';


type Membership={user_id:string;institution_id:string;role:string};
const SNAPSHOT_COLUMNS='id,course_id,semester,class_label,enrolled,capacity,available,source_report_at,reported_total,student_status';
async function fetchAllSnapshots(){
 const page=1000;const all:Enrollment[]=[];
 for(let from=0;;from+=page){
  const {data,error}=await supabase.from('vertice_enrollment_snapshots').select(SNAPSHOT_COLUMNS).order('source_report_at',{ascending:false}).order('id').range(from,from+page-1);
  if(error)throw error;all.push(...(data as Enrollment[]));if(!data||data.length<page)break;
 }
 return all;
}
async function fetchDashboardRows(table:string,order:string,ascending=true,columns='*'){
 const rows:Row[]=[];
 for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(columns).order(order,{ascending}).order('id').range(from,from+999);if(error)throw error;rows.push(...((data??[]) as unknown as Row[]));if(!data||data.length<1000)break;}
