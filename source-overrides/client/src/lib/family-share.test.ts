import { describe, it, expect } from 'vitest';
import { generateFamilyToken, sha256Hex, isFamilyToken, familyLink, shareState } from './family-share';
describe('family-share',()=>{
 it('token tem 64 hex e não repete',()=>{const a=generateFamilyToken(),b=generateFamilyToken();expect(isFamilyToken(a)).toBe(true);expect(a).not.toBe(b);});
 it('sha256 confere com vetor conhecido',async()=>{expect(await sha256Hex('x')).toBe('2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881');});
 it('rejeita token inválido',()=>{expect(isFamilyToken('abc')).toBe(false);expect(isFamilyToken(null)).toBe(false);expect(isFamilyToken('G'.repeat(64))).toBe(false);});
 it('monta link sem barra dupla',()=>{expect(familyLink('https://x.com/','a'.repeat(64))).toBe('https://x.com/familia?token='+'a'.repeat(64));});
 it('estado do link',()=>{const now=Date.parse('2026-11-20T12:00:00Z');expect(shareState({expires_at:'2026-12-01T00:00:00Z'},now)).toBe('ativo');expect(shareState({expires_at:'2026-11-01T00:00:00Z'},now)).toBe('expirado');expect(shareState({expires_at:'2026-12-01T00:00:00Z',revoked_at:'2026-11-10T00:00:00Z'},now)).toBe('revogado');});
});
