import { Route, Switch, Router } from "wouter";
import { useBrowserLocation } from "wouter/use-browser-location";
import { normalizePublicPath } from "./PublicApp";
import { Toaster } from "./components/ui/sonner";
import { PilotProvider } from "./contexts/PilotContext";
import { GestorProvider } from "./contexts/GestorContext";
import { PilotLayout } from "./components/PilotLayout";
import Overview, { Executive } from "./pages/Overview";
import Diagnosis, { Matrix } from "./pages/Diagnosis";
import ActionPlan from "./pages/ActionPlan";
import Goals from "./pages/Goals";
import Competencies from "./pages/Competencies";
import Methodology from "./pages/Methodology";
import Assumptions from "./pages/Assumptions";
import Presentation from "./pages/Presentation";
import Regulatory from "./pages/Regulatory";
import NotFound from "./pages/NotFound";
function ApplicationPages() {
  return (
    <PilotLayout>
      <Switch>
        <Route path="/demonstracao" component={Overview} />
        <Route path="/painel" component={Executive} />
        <Route path="/diagnostico" component={Diagnosis} />
        <Route path="/regulador" component={Regulatory} />
        <Route path="/matriz" component={Matrix} />
        <Route path="/metas" component={Goals} />
        <Route path="/plano" component={ActionPlan} />
        <Route path="/competencias" component={Competencies} />
        <Route path="/metodologia" component={Methodology} />
        <Route path="/premissas" component={Assumptions} />
        <Route component={NotFound} />
      </Switch>
    </PilotLayout>
  );
}
function useDemoLocation(): ReturnType<typeof useBrowserLocation> {
  const [path, navigate] = useBrowserLocation();
  return [normalizePublicPath(path), navigate];
}
export default function DemoApp() {
  return (
    <Router hook={useDemoLocation}>
      <PilotProvider>
        <GestorProvider>
          <Toaster position="bottom-right" />
          <Switch>
            <Route path="/apresentacao" component={Presentation} />
            <Route component={ApplicationPages} />
          </Switch>
        </GestorProvider>
      </PilotProvider>
    </Router>
  );
}
