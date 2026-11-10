import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CommercialHero,CommercialShowcase} from '../client/src/components/CommercialShowcase';
import {safePublicUrl} from '../client/src/components/ShowcaseClients';
describe('vitrine comercial pública',()=>{
 it('renderiza dados fictícios e segmentos sem atribuir clientes',()=>{
  const html=renderToStaticMarkup(React.createElement(React.Fragment,null,React.createElement(CommercialHero),React.createElement(CommercialShowcase)));
  expect(html).toContain('Ambiente demonstrativo — dados fictícios');
  expect(html).toContain('Conheça a Vértice por dentro');
  expect(html).toContain('Faculdades');
  expect(html).not.toContain('Instituições que confiam');
  expect(html).not.toMatch(/UNITOP|UNICALDAS|CPF|supabase\.co\/rest/);
  expect(html).toContain('/showcase/reitoria.png');
  expect(html).toContain('/contato.html?frente=demonstracao');
 });
 it('recusa protocolos executáveis, credenciais e URLs incompletas',()=>{
  for(const value of ['javascript:alert(1)','data:image/svg+xml,abc','http://example.com','https://user:pass@example.com','//example.com'])expect(safePublicUrl(value)).toBe('');
  expect(safePublicUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
 });
});
