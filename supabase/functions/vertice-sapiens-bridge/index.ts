import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {createSapiensHandler} from './handler.ts';
const env=(k:string)=>Deno.env.get(k)||'';
const keys=(()=>{try{return JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}');}catch{return {};}})();
const admin=createClient(env('SUPABASE_URL'),keys.default||env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
Deno.serve(createSapiensHandler({
 getUser:async token=>{const {data,error}=await admin.auth.getUser(token);return error?null:data.user;},
 isMaster:async id=>{const {data,error}=await admin.from('vertice_admins').select('user_id').eq('user_id',id).maybeSingle();if(error)throw error;return !!data;},
 rpc:async args=>{const {data,error}=await admin.rpc('vertice_sapiens_bridge',args);if(error)throw error;return data;},
 fetch,baseUrl:env('FATO_ORDEM_BRIDGE_URL')||'https://www.fatoeordem.com.br',bridgeKey:env('VERTICE_BRIDGE_API_KEY')
}));
