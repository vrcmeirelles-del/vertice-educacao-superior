import React from "react";
import PublicLayout from "./components/PublicLayout";
import Home from "./pages/public/Home";
import Services from "./pages/public/Services";
import Method from "./pages/public/Method";
import About from "./pages/public/About";
import Founder from "./pages/public/Founder";
import CaseStudy from "./pages/public/CaseStudy";
import Guide from "./pages/public/Guide";
import Contact from "./pages/public/Contact";
import Login from "./pages/public/Login";
import Privacy from "./pages/public/Privacy";
import ResetPassword from "./pages/public/ResetPassword";
import { useLocation } from "wouter";

export const publicComponents: Record<string, React.ComponentType> = {
  "/": Home,
  "/entrar": Login,
  "/redefinir-senha": ResetPassword,
  "/servicos": Services,
  "/metodo": Method,
  "/sobre": About,
  "/fundador": Founder,
  "/caso-real": CaseStudy,
  "/guia": Guide,
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
