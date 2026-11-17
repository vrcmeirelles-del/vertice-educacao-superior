// RFC 6238 SHA-1; used only for synthetic Auth accounts in the isolated project.
export async function totpCode(secret, seconds = Math.floor(Date.now()/1000), digits = 6) {
 if (![6,8].includes(digits) || !Number.isSafeInteger(seconds) || seconds < 0) throw Error('invalid_totp_parameters');
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const c of secret.toUpperCase().replace(/=+$/,'')){const n=alphabet.indexOf(c);if(n<0)throw Error('invalid_base32');bits+=n.toString(2).padStart(5,'0');}
 const key=Uint8Array.from((bits.match(/.{8}/g)||[]).map(b=>parseInt(b,2)));
 const time=new Uint8Array(8);new DataView(time.buffer).setBigUint64(0,BigInt(Math.floor(seconds/30)));
 const hmac=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,time));const offset=signature[19]&15;
 const value=((signature[offset]&127)*16777216)+(signature[offset+1]<<16)+(signature[offset+2]<<8)+signature[offset+3];
 return String(value%(10**digits)).padStart(digits,'0');
}
