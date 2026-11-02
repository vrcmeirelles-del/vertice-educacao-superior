import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createEbitdaHandler} from './handler.ts';
Deno.serve(createEbitdaHandler(createClient,key=>Deno.env.get(key)));
