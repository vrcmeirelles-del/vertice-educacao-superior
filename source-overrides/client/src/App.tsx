import InstitutionDirectoryNotice from "./components/area/InstitutionDirectoryNotice";
import Login from "./pages/public/Login";
import InstitutionEntry from "./pages/public/InstitutionEntry";
import IesPortal, { useIesRoute } from "./components/ies/IesPortal";
import "./components/ebitda.css";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import './styles/portal-design-system.css';
import { Link, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DemoTelemetry from "./components/DemoTelemetry";
import PublicApp, { normalizePublicPath, publicComponents } from "./PublicApp";
import PublicLayout from "./components/PublicLayout";
import IesBrandedLayout from "./components/IesBrandedLayout";
import { publicPages } from "./lib/consultancy";
import { passwordCallback } from "./lib/supabase";
import ResetPassword from "./pages/public/ResetPassword";
const IntegracaoPage = lazy(() => import("./pages/IntegracaoPage"));
const RedePage = lazy(() => import("./pages/RedePage"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const VerticeMobileBI = lazy(() => import("./components/bi/VerticeMobileBI"));
const VerticeMobilePublicPreview = lazy(() => import("./components/bi/VerticeMobilePublicPreview"));
const DemoApp = lazy(() => import("./DemoApp"));
function PortalSurface({ children }: { children: ReactNode }) { return <div className="vertice-portal portal-standalone">{children}</div>; }
const ExperiencePortal = lazy(() => import("./pages/public/ExperiencePortal"));
const VerticeCommand = lazy(() => import("./pages/public/VerticeCommand"));
const ExperienceAdmin = lazy(() => import("./pages/ExperienceAdmin"));
const ExtensaoConvite = lazy(() => import("./pages/public/ExtensaoConvite"));
const ConectaPartnerPortal = lazy(() => import("./components/area/ConectaPartnerPortal"));
const StudentAccess = lazy(() => import("./pages/public/StudentAccess"));
const AcPortalAluno = lazy(() => import("./pages/public/AcPortalAluno"));
const CpaAvaliacao = lazy(() => import("./pages/public/CpaAvaliacao"));
const VerificarCertificado = lazy(() => import("./pages/public/VerificarCertificado"));
const demoPaths = new Set([
  "/demonstracao",
  "/painel",
  "/diagnostico",
  "/regulador",
  "/admin-ies",
  "/gestor",
  "/master",
  "/matriz",
  "/metas",
  "/plano",
  "/competencias",
  "/metodologia",
  "/premissas",
  "/apresentacao",
]);
export default function App() {
  const [path] = useLocation();
  const { active: iesActive, revision: iesRouteRevision, suspended: iesSuspended } = useIesRoute();
  const normalized = normalizePublicPath(path);
  const isPublic = Boolean(publicComponents[normalized]);
  useEffect(() => {
    const page = publicPages.find(p => p.path === normalized);
    document.title =
      (normalized === "/rede" ? "Rede · indicadores de inclusão | Vértice" : normalized === "/integracao" ? "Integração Fato & Ordem × Vértice | Acompanhamento Master" : normalized === "/command" ? "Vértice Command | Sala de Decisão Executiva" : normalized === "/experience" ? "Vértice Experience | Visita demonstrativa" : normalized === "/master/experience" ? "Vértice Experience | Administração Master" : iesActive ? "Cadastro institucional | Vértice Educação Superior" : normalized === "/mobile/apresentacao" ? "Vértice Mobile | Demonstração sem login" : normalized === "/mobile" ? "Vértice Mobile | Inteligência executiva" : ["/master","/gestor","/admin-ies","/painel-real"].includes(normalized) ? "Painel institucional | Vértice Educação Superior" : normalized === "/master/aquisicoes" ? "Aquisições e incorporações | Vértice" : normalized === "/redefinir-senha" || passwordCallback ? "Definir nova senha | Vértice Educação Superior" : normalized === "/reitor/reservado" ? "Área reservada do reitor | Vértice Educação Superior" : normalized === "/conecta-parceiros" ? "Empresas e parceiros | Portal institucional" : normalized === "/acesso-estudante" ? "Acesso do estudante | Portal institucional" : normalized === "/entrar" ? "Entrar | Vértice Educação Superior" : page?.title) ??
      (demoPaths.has(normalized)
        ? "Demonstração de gestão | Vértice Educação Superior"
        : "Página não encontrada | Vértice Educação Superior");
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = !iesActive && isPublic && normalized !== "/entrar" && normalized !== "/redefinir-senha" ? "index,follow" : "noindex,nofollow";
    if (page) {
      const description = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]'
      );
      if (description) description.content = page.description;
    }
  }, [path, normalized, isPublic, iesActive]);
  if (normalized === "/rede") return <ErrorBoundary><Suspense fallback={<main role="status">Verificando acesso à rede…</main>}><PortalSurface><RedePage /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/integracao") return <ErrorBoundary><Suspense fallback={<main role="status">Verificando acesso à integração…</main>}><PortalSurface><IntegracaoPage /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/conecta-parceiros") return <ErrorBoundary><IesBrandedLayout><Suspense fallback={<main style={{padding:40}} role="status">Carregando cadastro de parceiros…</main>}><ConectaPartnerPortal /></Suspense></IesBrandedLayout></ErrorBoundary>;
  if (normalized === "/acesso-estudante") return <ErrorBoundary><IesBrandedLayout><Suspense fallback={<main style={{padding:40}} role="status">Carregando acesso do estudante…</main>}><StudentAccess /></Suspense></IesBrandedLayout></ErrorBoundary>;
  if (normalized === "/ac-aluno") return <ErrorBoundary><Suspense fallback={<main style={{padding:40}} role="status">Carregando portal do aluno…</main>}><PortalSurface><AcPortalAluno /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/extensao-convite") return <ErrorBoundary><Suspense fallback={<main style={{padding:40}} role="status">Carregando convite…</main>}><PortalSurface><ExtensaoConvite /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/verificar-certificado") return <ErrorBoundary><Suspense fallback={<main style={{padding:40}} role="status">Carregando verificação…</main>}><PortalSurface><VerificarCertificado /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/cpa-avaliacao") return <ErrorBoundary><Suspense fallback={<main style={{padding:40}} role="status">Carregando avaliação CPA…</main>}><PortalSurface><CpaAvaliacao /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/mobile/apresentacao") return <ErrorBoundary><Suspense fallback={<main role="status">Carregando apresentação Vértice Mobile…</main>}><PortalSurface><VerticeMobilePublicPreview /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/mobile") return <ErrorBoundary><Suspense fallback={<main role="status">Carregando Vértice Mobile…</main>}><PortalSurface><VerticeMobileBI /></PortalSurface></Suspense></ErrorBoundary>;
  if (normalized === "/command") return <ErrorBoundary><Suspense fallback={<main role="status">Abrindo Vértice Command…</main>}><VerticeCommand /></Suspense></ErrorBoundary>;
  if (normalized === "/experience") return <ErrorBoundary><PublicLayout><Suspense fallback={<main className="corp-container corp-section" role="status">Abrindo Vértice Experience…</main>}><ExperiencePortal /></Suspense></PublicLayout></ErrorBoundary>;
  if (normalized === "/master/experience") return <ErrorBoundary><Suspense fallback={<main className="corp-container corp-section" role="status">Verificando administração Experience…</main>}><ExperienceAdmin /></Suspense></ErrorBoundary>;
  if (iesActive) return <ErrorBoundary>{iesSuspended ? <main className="ies-shell"><p role="status">Área institucional suspensa. Os links de convite foram removidos.</p></main> : <IesPortal key={iesRouteRevision} />}</ErrorBoundary>;
  if (!passwordCallback && ["/gestor", "/admin-ies", "/painel-real"].includes(normalized)) {
    return <ErrorBoundary><PublicLayout><Login institutionalOnly /></PublicLayout></ErrorBoundary>;
  }
  const institutionalPath = normalized.toLowerCase().match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/([a-z0-9_]+(?:-[a-z0-9_]+)*))?$/);
  if (!isPublic && !demoPaths.has(normalized) && !["/painel-real", "/master/aquisicoes", "/reitor/reservado"].includes(normalized) && !passwordCallback && institutionalPath) {
    const [, slug, section] = institutionalPath;
    return <ErrorBoundary><PublicLayout><InstitutionEntry key={slug} slug={slug} section={section} /></PublicLayout></ErrorBoundary>;
  }
  return (
    <ErrorBoundary>
      <DemoTelemetry /><InstitutionDirectoryNotice />

      {passwordCallback ? <PublicLayout portal><ResetPassword /></PublicLayout> : normalized === "/master" ? <Suspense fallback={<p role="status">Verificando acesso…</p>}><OwnerDashboard /></Suspense> : normalized === "/master/aquisicoes" ? <Suspense fallback={<p>Verificando acesso…</p>}><OwnerDashboard /></Suspense> : normalized === "/reitor/reservado" ? <PublicLayout><Suspense fallback={<p>Verificando acesso…</p>}><OwnerDashboard /></Suspense></PublicLayout> : isPublic ? (
        <PublicApp />
      ) : demoPaths.has(normalized) ? (
        <Suspense
          fallback={
            <main className="demo-loading">
              Carregando a demonstração de gestão…
            </main>
          }
        >
          <DemoApp />
        </Suspense>
      ) : (
        <PublicLayout>
          <section className="corp-container corp-section">
            <h1>Página não encontrada.</h1>
            <p>O endereço não corresponde a uma área deste site.</p>
            <Link href="/" className="corp-button">
              Voltar ao início
            </Link>
          </section>
        </PublicLayout>
      )}
    </ErrorBoundary>
  );
}

