import { describe, expect, it } from 'vitest';
import { filtrar, mensagemErro, parsePainel, resumo, rotulo, rotulos } from './modelo';

import { painel } from './fixture';
const I = '00000000-0000-4000-8000-000000000101', C = '00000000-0000-4000-8000-000000000201';

describe('modelo da Central de Automação', () => {
  it('rotula as 47 regras sem identificadores técnicos', () => {
    expect(Object.keys(rotulos)).toHaveLength(47);
    expect(rotulo('instrument.evidence')).toBe('Indicadores do instrumento sem evidência validada');
    expect(rotulo('repo.overdue')).toBe('Documentos do Repositório com prazo vencido');
    expect(rotulo('desconhecida')).toBe('Regra não catalogada');
  });
  it('aceita o contrato e resume estados e fontes sem inventar zeros', () => {
    const p = parsePainel(painel(), I, null);
    expect(resumo(p).porEstado).toEqual({ inactive: 2, shadow: 1, active: 0, blocked: 0 });
    expect(resumo(p).porFonte).toEqual({ validada: 0, identificada: 2, pendente: 1 });
    expect(p.pending).toBeNull();
  });
  it('recusa escopo divergente, catálogo ausente e estados desconhecidos', () => {
    expect(() => parsePainel(painel(), I, C)).toThrow('escopo');
    expect(() => parsePainel(painel({ institutionId: C }), I, null)).toThrow('escopo');
    expect(() => parsePainel(painel({ rules: [] }), I, null)).toThrow('catálogo');
    expect(() => parsePainel(painel({ rules: [regra('x', 'ligada')] }), I, null)).toThrow('regra');
    expect(() => parsePainel(painel({ pending: [{ id: 'não-uuid' }] }), I, null)).toThrow('alerta');
    expect(() => parsePainel(null, I, null)).toThrow();
  });
  it('filtra por texto, situação e prioridade', () => {
    const p = parsePainel(painel(), I, null);
    expect(filtrar(p.rules, { busca: 'vencido' }).map((r) => r.id)).toEqual(['repo.overdue']);
    expect(filtrar(p.rules, { estado: 'shadow' }).map((r) => r.id)).toEqual(['repo.due']);
    expect(filtrar(p.rules, { prioridade: 'P1' })).toHaveLength(1);
  });
  it('traduz erros do servidor sem expor detalhes', () => {
    expect(mensagemErro({ code: 'PGRST202', message: 'Could not find the function' })).toMatch(/ainda não foi instalada/);
    expect(mensagemErro({ message: 'autoaprovação proibida' })).toMatch(/outra pessoa/);
    expect(mensagemErro({ message: 'revisão concorrente: esperada 0, atual 1' })).toMatch(/Outra alteração/);
    expect(mensagemErro({ message: 'acesso negado ou MFA pendente' })).toMatch(/segundo fator/);
    expect(mensagemErro({ message: 'erro interno qualquer com detalhe de tabela' })).toBe('Não foi possível concluir a operação. Nada foi alterado.');
  });
});
