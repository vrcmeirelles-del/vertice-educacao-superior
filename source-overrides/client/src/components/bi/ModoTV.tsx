/**
 * Modo TV — Carrossel cross-dashboard
 *
 * Cicla entre os BIs selecionados (Reitor, Acadêmico, Captação, Executivo)
 * com fullscreen, tempo configurável, pausa/resume e transições suaves.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Institution, Course, Enrollment } from '@/components/InstitutionArea';
import ReitorBI from './ReitorBI';
import AcademicoBI from './AcademicoBI';
import PainelBI, {type BIReport} from './PainelBI';
import CaptacaoBI from '@/components/area/CaptacaoBI';
import './modo-tv.css';

type BiPanel = 'reitor' | 'academico' | 'captacao' | 'executivo';
const PANELS: { key: BiPanel; label: string; icon: string }[] = [
  { key: 'reitor', label: 'BI do Reitor', icon: '👔' },
  { key: 'academico', label: 'BI Acadêmico', icon: '🎓' },
  { key: 'captacao', label: 'BI de Captação', icon: '📈' },
  { key: 'executivo', label: 'Painel Executivo', icon: '📊' },
];

const INTERVALS = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 120, label: '2 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
];

export default function ModoTV({ institutions, courses, enrollments, session, reports, onClose }: {
  institutions: Institution[]; courses: Course[]; enrollments: Enrollment[];
  session: Session; reports: BIReport[]; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<BiPanel>>(new Set(['reitor', 'academico', 'captacao', 'executivo']));
  const [interval, setInterval_] = useState(120);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(false);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);

  const panels = PANELS.filter(p => selected.has(p.key));
  const currentPanel = panels[current % panels.length];

  const toggle = (key: BiPanel) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const advance = useCallback(() => {
    setFade(true);
    setTimeout(() => {
      setCurrent(c => (c + 1) % panels.length);
      setFade(false);
      progressRef.current = 0;
      setProgress(0);
    }, 400);
  }, [panels.length]);

  // progress animation
  useEffect(() => {
    if (!started || paused) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      progressRef.current += dt / (interval * 1000) * 100;
      setProgress(progressRef.current);
      if (progressRef.current >= 100) {
        advance();
        return;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [started, paused, interval, advance, current]);

  // fullscreen
  useEffect(() => {
    if (started) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
    const onFsChange = () => {
      if (!document.fullscreenElement && started) {
        setStarted(false); setPaused(false);
        onClose();
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [started, onClose]);

  const instId = institutions[0]?.id ?? '';
  const instName = institutions[0]?.name ?? 'Instituição';

  function renderPanel() {
    if (!currentPanel) return null;
    switch (currentPanel.key) {
      case 'reitor':
        return <ReitorBI institutions={institutions} courses={courses} enrollments={enrollments} session={session} reports={reports} />;
      case 'academico':
        return <AcademicoBI institutionId={instId} institutionName={instName} />;
      case 'captacao':
        return <CaptacaoBI institutionId={instId} institutionName={instName} />;
      case 'executivo':
        return <PainelBI institutions={institutions} courses={courses} enrollments={enrollments} session={session} reports={reports} />;
      default:
        return null;
    }
  }

  if (!started) {
    return (
      <div className="mtv-setup">
        <div className="mtv-setup-card">
          <h2>📺 Modo TV</h2>
          <p>Configure o carrossel de dashboards para exibição em tela cheia.</p>

          <div className="mtv-section">
            <h3>Dashboards</h3>
            <div className="mtv-panels">
              {PANELS.map(p => (
                <button key={p.key} type="button"
                  className={`mtv-panel-btn ${selected.has(p.key) ? 'mtv-panel-active' : ''}`}
                  onClick={() => toggle(p.key)}>
                  <span className="mtv-panel-icon">{p.icon}</span>
                  <span>{p.label}</span>
                  <span className="mtv-check">{selected.has(p.key) ? '✓' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mtv-section">
            <h3>Tempo por tela</h3>
            <div className="mtv-intervals">
              {INTERVALS.map(i => (
                <button key={i.value} type="button"
                  className={`mtv-interval-btn ${interval === i.value ? 'mtv-interval-active' : ''}`}
                  onClick={() => setInterval_(i.value)}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mtv-section">
            <p className="mtv-summary">
              {panels.length} dashboard{panels.length > 1 ? 's' : ''} · {INTERVALS.find(i => i.value === interval)?.label} por tela ·
              ciclo completo: {panels.length > 0 ? `${Math.round(panels.length * interval / 60)} min` : '—'}
            </p>
          </div>

          <div className="mtv-actions">
            <button type="button" className="rbi-btn rbi-btn-primary mtv-start" onClick={() => setStarted(true)}
              disabled={panels.length === 0}>
              ▶ Iniciar Modo TV
            </button>
            <button type="button" className="rbi-btn" onClick={onClose}>Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mtv-container">
      {/* progress bar */}
      <div className="mtv-progress-bar">
        <div className="mtv-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* top bar */}
      <div className="mtv-topbar">
        <div className="mtv-topbar-left">
          <span className="mtv-live">● AO VIVO</span>
          <span className="mtv-current-label">{currentPanel?.icon} {currentPanel?.label}</span>
          <span className="mtv-page">{(current % panels.length) + 1} / {panels.length}</span>
        </div>
        <div className="mtv-topbar-right">
          <button type="button" className="mtv-ctrl" onClick={() => setPaused(p => !p)}>
            {paused ? '▶' : '⏸'}
          </button>
          <button type="button" className="mtv-ctrl" onClick={advance}>⏭</button>
          <button type="button" className="mtv-ctrl" onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            setStarted(false);
            onClose();
          }}>✕</button>
        </div>
      </div>

      {/* content */}
      <div className={`mtv-content ${fade ? 'mtv-fade-out' : 'mtv-fade-in'}`}>
        {renderPanel()}
      </div>

      {/* bottom dots */}
      <div className="mtv-dots">
        {panels.map((p, i) => (
          <button key={p.key} type="button" className={`mtv-dot ${i === current % panels.length ? 'mtv-dot-active' : ''}`}
            onClick={() => { setCurrent(i); progressRef.current = 0; setProgress(0); }}
            title={p.label} />
        ))}
      </div>

      {/* paused overlay */}
      {paused && (
        <div className="mtv-paused-overlay" onClick={() => setPaused(false)}>
          <span>⏸ Pausado — clique para retomar</span>
        </div>
      )}
    </div>
  );
}
