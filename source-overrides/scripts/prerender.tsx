import React from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
import { PublicPage } from "../client/src/PublicApp";
import { publicPages } from "../client/src/lib/consultancy";

const dir = resolve("dist/public");
const template = readFileSync(resolve(dir, "index.html"), "utf8");
const config = existsSync("site.config.json")
  ? JSON.parse(readFileSync("site.config.json", "utf8"))
  : {};
const origin = (
  process.env.PUBLIC_SITE_ORIGIN ||
  process.env.RENDER_EXTERNAL_URL ||
  config.origin ||
  ""
).replace(/\/$/, "");
const image = config.brandImage || "";
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const publicUrl = (path: string) => (path === "/" ? "/" : `${path}.html`);
function document(
  page: { path: string; title: string; description: string },
  body: string,
  noindex = false
) {
  const url = origin ? origin + publicUrl(page.path) : "";
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Vértice Educação Superior" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(page.title)}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
    ...(image
      ? [
          `<meta property="og:image" content="${escape(image)}" />`,
          `<meta name="twitter:image" content="${escape(image)}" />`,
        ]
      : []),
    ...(url
      ? [
          `<link rel="canonical" href="${escape(url)}" />`,
          `<meta property="og:url" content="${escape(url)}" />`,
        ]
      : []),
  ].join("\n    ");
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/?>/,
      `<meta name="description" content="${escape(page.description)}" />`
    )
    .replace(
      /<meta name="robots" content="[^"]*"\s*\/?\s*>/,
      `<meta name="robots" content="${noindex ? "noindex,nofollow" : "index,follow"}" />`
    )
    .replace("</head>", `${tags}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}
for (const page of publicPages) {
  const body = renderToString(
    <Router ssrPath={publicUrl(page.path)}>
      <PublicPage path={page.path} />
    </Router>
  );
  const html = document(page, body);
  if (page.path === "/") writeFileSync(resolve(dir, "index.html"), html);
  else {
    writeFileSync(resolve(dir, `${page.path.slice(1)}.html`), html);
    const folder = resolve(dir, page.path.slice(1));
    mkdirSync(folder, { recursive: true });
    writeFileSync(resolve(folder, "index.html"), html);
  }
}
const demos = [
  "reitor/reservado",
  "demonstracao",
  "painel",
  "diagnostico",
  "regulador",
  "admin-ies",
  "gestor",
  "master",
  "entrar",
  "redefinir-senha",
  "matriz",
  "metas",
  "plano",
  "competencias",
  "metodologia",
  "premissas",
  "apresentacao",
];
for (const path of demos) {
  const page = {
    path: `/${path}`,
    title: path === "redefinir-senha" ? "Definir nova senha | Vértice Educação Superior" : path === "entrar" ? "Entrar | Vértice Educação Superior" : "Demonstração de gestão | Vértice Educação Superior",
    description:
      "Cenário fictício de diagnóstico, metas e ações. Sem avaliação oficial. Alterações ficam somente neste navegador.",
  };
  const html = document(page, "", true);
  writeFileSync(resolve(dir, `${path}.html`), html);
  const folder = resolve(dir, path);
  mkdirSync(folder, { recursive: true });
  writeFileSync(resolve(folder, "index.html"), html);
}
const exclude = demos
  .flatMap(path => [`Disallow: /${path}\n`, `Disallow: /${path}.html\n`])
  .join("");
writeFileSync(
  resolve(dir, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /api/\n${exclude}${origin ? `Sitemap: ${origin}/sitemap.xml\n` : ""}`
);
if (origin)
  writeFileSync(
    resolve(dir, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPages.map(p => `<url><loc>${escape(origin + publicUrl(p.path))}</loc></url>`).join("")}</urlset>\n`
  );
console.log(
  `HTML inicial criado para ${publicPages.length} páginas públicas; ${demos.length} áreas demonstrativas com noindex.`
);

const unusedPlatformConfig = resolve(dir, "api/platform/config.js");
if (existsSync(unusedPlatformConfig)) unlinkSync(unusedPlatformConfig);
writeFileSync(
  resolve(dir, "404.html"),
  document(
    {
      path: "/404",
      title: "Página não encontrada | Vértice Educação Superior",
      description:
        "O endereço solicitado não corresponde a uma página da Vértice Educação Superior.",
    },
    '<main style="max-width:720px;margin:80px auto;padding:24px;font-family:Inter,Arial,sans-serif;color:#243653"><h1>Página não encontrada.</h1><p>O endereço solicitado não corresponde a uma área deste site.</p><a href="/">Voltar ao início da Vértice</a></main>',
    true
  )
);
