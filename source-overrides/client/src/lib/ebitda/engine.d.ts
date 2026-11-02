export type EbitdaBody = Record<string, any>;
export type EbitdaResult = {ebitda:number; margin_percent:number|null; period_months:number|null; education:any; revenue_per_student_month:number|null; ebitda_per_student_month:number|null; warnings:string[]; formula:string; notice:string};
export const ebitdaFields: [string,string,string,boolean?][];
export const educationGroups: {title:string;keys:[string,string][]}[];
export function normalizeEbitda(input:Record<string,any>):EbitdaBody;
export function calculateEbitda(body:EbitdaBody):EbitdaResult;
export function ebitdaText(calculation:{body:EbitdaBody;result:EbitdaResult;evidence?:{file_name:string;sha256:string}}):string;
