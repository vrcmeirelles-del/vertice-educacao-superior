import React from "react";
import CommercialDemo from "./pages/public/CommercialDemo";
import PremiumBIPublic from "./pages/public/PremiumBIPublic";
import PublicLayout from "./components/PublicLayout";
import Home from "./pages/public/Home";
import Aquisicoes from "./pages/public/Aquisicoes";
import Services from "./pages/public/Services";
import Method from "./pages/public/Method";
import About from "./pages/public/About";
import Founder from "./pages/public/Founder";
import CaseStudy from "./pages/public/CaseStudy";
import Reitor from "./pages/public/Reitor";
import Guide from "./pages/public/Guide";
import Contact from "./pages/public/Contact";
import Login from "./pages/public/Login";
import Privacy from "./pages/public/Privacy";
import ResetPassword from "./pages/public/ResetPassword";
import { useLocation } from "wouter";

export const publicComponents: Record<string, React.ComponentType> = {
  "/demonstracao": CommercialDemo,
  "/bi-demonstrativo": PremiumBIPublic,
  "/": Home,
  "/aquisicoes": Aquisicoes,
  "/entrar": Login,
  "/redefinir-senha": ResetPassword,
  "/servicos": Services,
  "/metodo": Method,
  "/sobre": About,
  "/fundador": Founder,
  "/caso-real": CaseStudy,
  "/guia": Guide,
  "/reitor": Reitor,
  "/contato": Contact,
  "/privacidade": Privacy,
};
export function normalizePublicPath(path: string) {
  return path.replace(/\.html$/, "").replace(/\/$/, "") || "/";
}
export function PublicPage({ path }: { path: string }) {
  const Page = publicComponents[normalizePublicPath(path)] ?? Home;
  return (
    <PublicLayout>
      <Page />
    </PublicLayout>
  );
}
export default function PublicApp() {
  const [path] = useLocation();
  return <PublicPage path={path} />;
}
