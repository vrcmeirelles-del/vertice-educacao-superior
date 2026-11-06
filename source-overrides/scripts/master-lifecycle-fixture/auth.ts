const callbacks=new Set<Function>();let user={id:'11111111-1111-4111-8111-111111111111'};
(window as any).authEvent=(event:string,id:string|null)=>{user=id?{id}:null as any;for(const cb of callbacks)cb(event,user?{user}:null);};
export const supabase={auth:{
 getSession:async()=>({data:{session:{user,access_token:'fixture-session-only'}},error:null}),
 getUser:async()=>({data:{user},error:null}),
 mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})},
 onAuthStateChange:(cb:Function)=>{callbacks.add(cb);queueMicrotask(()=>{if(callbacks.has(cb))cb('INITIAL_SESSION',user?{user}:null);});return {data:{subscription:{unsubscribe:()=>callbacks.delete(cb)}}};}
},rpc:()=>{(window as any).rpcCalls=((window as any).rpcCalls??0)+1;return {setHeader:async()=>({error:new Error('Unexpected fixture RPC'),data:null})};},from:()=>({select:()=>({eq:async()=>({data:[{user_id:user?.id}],error:null})})})};
