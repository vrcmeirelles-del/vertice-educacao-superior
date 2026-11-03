import IesPortal, { useIesRoute } from "./components/ies/IesPortal";
import "./components/ebitda.css";
import { lazy, Suspense, useEffect } from "react";
import { Link, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DemoTelemetry from "./components/DemoTelemetry";
import PublicApp, { normalizePublicPath, publicComponents } from "./PublicApp";
import PublicLayout from "./components/PublicLayout";
import { publicPages } from "./lib/consultancy";
import { passwordCallback } from "./lib/supabase";
import ResetPassword from "./pages/public/ResetPassword";
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard"));
const DemoApp = lazy(() => import("./DemoApp"));
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
      (iesActive ? "Cadastro institucional | Vértice Educação Superior" : ["/master","/gestor","/admin-ies","/painel-real"].includes(normalized) ? "Painel institucional | Vértice Educação Superior" : normalized === "/master/aquisicoes" ? "Aquisições e incorporações | Vértice" : normalized === "/redefinir-senha" || passwordCallback ? "Definir nova senha | Vértice Educação Superior" : normalized === "/reitor/reservado" ? "Área reservada do reitor | Vértice Educação Superior" : normalized === "/entrar" ? "Entrar | Vértice Educação Superior" : page?.title) ??
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
  if (iesActive) return <ErrorBoundary>{iesSuspended ? <main className="ies-shell"><p role="status">Área institucional suspensa. Os links de convite foram removidos.</p></main> : <IesPortal key={iesRouteRevision} />}</ErrorBoundary>;
  return (
    <ErrorBoundary>
      <DemoTelemetry />
      {["/master", "/gestor", "/admin-ies", "/painel-real"].includes(normalized) && <nav className="corp-container" aria-label="Cadastro institucional"><a className="corp-button" href="/master#ies=1">Cadastro e convites de instituições</a></nav>}
      {passwordCallback ? <PublicLayout><ResetPassword /></PublicLayout> : normalized === "/master/aquisicoes" ? <Suspense fallback={<p>Verificando acesso…</p>}><OwnerDashboard /></Suspense> : ["/master", "/gestor", "/admin-ies", "/painel-real", "/reitor/reservado"].includes(normalized) ? <PublicLayout><Suspense fallback={<p>Verificando acesso…</p>}><OwnerDashboard /></Suspense></PublicLayout> : isPublic ? (
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
