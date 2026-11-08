import "@/lib/ies/preAuthGuard";
import "@/lib/master-invitation-bootstrap";
import './pages/public/commercial-demo.css';
import './components/bi/premium-bi.css';
import "./styles/aquisicoes.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import SuperJSON from "superjson";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./styles/fonts.css";
import "./index.css";
import "./styles/corporate.css";
import "./styles/management.css";
import "./components/demo-showroom.css";
import "./styles/vertice-polish.css";

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: SuperJSON,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
