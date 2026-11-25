import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildCertificatesPdf, cargaHoraria, fraseCertificado, periodo, verifyUrl } from './certificate-pdf';

const c = { code: 'ABCD-EFGH-JKLM', holderName: 'Ana Souza', activityTitle: 'Projeto Cidadania', minutes: 840, periodStart: '2026-03-01', periodEnd: '2026-06-30',
  issuedAt: '2026-11-25T13:00:00Z', signerName: 'Profa. Maria', signerRole: 'Coordenadora de Extensão' };

describe('certificado', () => {
  it('carga horária e período sem inventar dados ausentes', () => {
    expect(cargaHoraria(840)).toBe('14 horas'); expect(cargaHoraria(150)).toBe('2 horas e 30 minutos');
    expect(cargaHoraria(60)).toBe('1 hora'); expect(cargaHoraria(30)).toBe('30 minutos'); expect(cargaHoraria(61)).toBe('1 hora e 1 minuto');
    expect(periodo('2026-03-01', '2026-06-30')).toBe('no período de 01/03/2026 a 30/06/2026');
    expect(periodo('2026-05-10', '2026-05-10')).toBe('em 10/05/2026'); expect(periodo(null, null)).toBe('');
  });
  it('frase-padrão por tipo e link de verificação', () => {
    expect(fraseCertificado('extensao', c, 'IES X')).toBe('Certificamos que Ana Souza participou do projeto de extensão "Projeto Cidadania", promovido por IES X, no período de 01/03/2026 a 30/06/2026, com carga horária de 14 horas.');
    expect(fraseCertificado('ensino', { ...c, periodStart: null, periodEnd: null }, 'IES X')).toBe('Certificamos que Ana Souza participou da atividade de ensino "Projeto Cidadania", promovido por IES X, com carga horária de 14 horas.');
    expect(verifyUrl(c.code)).toBe('https://www.verticesuperior.com.br/verificar-certificado?codigo=ABCD-EFGH-JKLM');
  });
  it('gera uma página por certificado, com acentos e aspas tipográficas', async () => {
    const bytes = await buildCertificatesPdf({ kind: 'extensao', institution: 'Faculdade São José', certificates: [c, { ...c, code: 'BBBB-CCCC-DDDD', holderName: 'João “Jota” Ávila' }] });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe('Certificados');
  });
});
