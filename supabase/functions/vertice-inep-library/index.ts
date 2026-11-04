import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { libraryHandler } from './handler.ts';
Deno.serve(libraryHandler(createClient, key => Deno.env.get(key)));
