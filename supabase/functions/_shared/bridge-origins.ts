// Bind the temporary ENAMED preview to its isolated Supabase project.
// Production keeps its existing exact-origin allowlist.
const isolatedProject = 'https://rnmkmnrfhvjihsuqziwf.supabase.co';
export function bridgeRemoteAllowed(url: URL, supabaseUrl = ''): boolean {
 return url.protocol === 'https:' && !url.port && !url.username && !url.password
  && ['www.fatoeordem.com.br','fatoeordem.com.br','fato-e-ordem-lab.onrender.com'].includes(url.hostname)
  && (supabaseUrl !== isolatedProject || url.hostname === 'fato-e-ordem-lab.onrender.com');
}
export function bridgeOrigins(supabaseUrl = ''): Set<string> {
 const origins = new Set([
  'https://www.verticesuperior.com.br', 'https://verticesuperior.com.br',
  'https://vertice-portal.onrender.com', 'https://vertice-educacao-superior.onrender.com',
  'https://vertice-educacao-superior-site.onrender.com'
 ]);
 if (supabaseUrl === isolatedProject) {
  origins.add('https://vertice-enamed-homologacao.onrender.com');
 }
 return origins;
}
