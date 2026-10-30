import { lazy, Suspense, useEffect } from "react";
import { Link, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
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
  const normalized = normalizePublicPath(path);
  const isPublic = Boolean(publicComponents[normalized]);
  useEffect(() => {
    const page = publicPages.find(p => p.path === normalized);
    document.title =
      (normalized === "/redefinir-senha" || passwordCallback ? "Definir nova senha | Vértice Educação Superior" : normalized === "/entrar" ? "Entrar | Vértice Educação Superior" : page?.title) ??
      (demoPaths.has(normalized)
        ? "Demonstração de gestão | Vértice Educação Superior"
        : "Página não encontrada | Vértice Educação Superior");
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = isPublic && normalized !== "/entrar" && normalized !== "/redefinir-senha" ? "index,follow" : "noindex,nofollow";
    if (page) {
      const description = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]'
      );
      if (description) description.content = page.description;
    }
  }, [path, normalized, isPublic]);
  return (
    <ErrorBoundary>
      {passwordCallback ? <PublicLayout><ResetPassword /></PublicLayout> : ["/master", "/gestor", "/admin-ies", "/painel-real"].includes(normalized) ? <PublicLayout><Suspense fallback={<p>Verificando acesso…</p>}><OwnerDashboard /></Suspense></PublicLayout> : isPublic ? (
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
