import { HelpLabel } from '@/components/ContextHelp';
import React, { useState } from "react";
import { Plus, Trash2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emptyInstitution, type Institution } from "@/lib/institutions";
import { usePilot } from "@/contexts/PilotContext";

const sectorOptions = [
  { id: "gestao", label: "Gestão institucional" },
  { id: "academico", label: "Coordenação acadêmica" },
  { id: "academico-colegiado", label: "Colegiado acadêmico" },
  { id: "evidencia", label: "Setor de evidências" },
  { id: "regulacao", label: "Setor regulatório" },
];

export default function InstitutionAdmin() {
  const { institution, setInstitution } = usePilot();
  const [name, setName] = useState(institution.name);
  const [courseRows, setCourseRows] = useState(
    institution.courses.map(c => ({ ...c, _new: false }))
  );

  const updateInstitution = (next: Institution) => {
    setInstitution(next);
    setName(next.name);
    setCourseRows(
      next.courses.map(c => ({ ...c, _new: false }))
    );
  };

  const addCourse = () => {
    const row = {
      id: `curso-${Date.now()}`,
      code: "",
      name: "",
      active: true,
      _new: true,
    };
    updateInstitution({ ...institution, courses: [...institution.courses, row] });
    setCourseRows([...institution.courses, row].map(c => ({ ...c, _new: false })));
  };

  const removeCourse = (id: string) => {
    const courses = institution.courses.filter(c => c.id !== id);
    updateInstitution({ ...institution, courses });
    setCourseRows(courses.map(c => ({ ...c, _new: false })));
  };

  const toggleSector = (sectorId: string, canAnswer: boolean) => {
    const sectors = institution.sectors.map(s =>
      s.sectorId === sectorId ? { ...s, canAnswer, canReview: canAnswer ? s.canReview : false } : s
    );
    updateInstitution({ ...institution, sectors });
  };

  const addSector = () => {
    const next = {
      sectorId: `setor-${Date.now()}`,
      label: "",
      role: "diagnostico" as const,
      canAnswer: true,
      canReview: false,
    };
    updateInstitution({ ...institution, sectors: [...institution.sectors, next] });
  };

  const removeSector = (sectorId: string) => {
    updateInstitution({
      ...institution,
      sectors: institution.sectors.filter(s => s.sectorId !== sectorId),
    });
  };

  return (
    <div className="admin-composition">
      <div className="admin-head">
        <h2>
          <UsersRound size={20} /> Cadastro institucional e acesso por setor
        </h2>
        <p>
          O gestor cadastra a instituição e seus cursos. Depois libera quais
          setores podem responder o diagnóstico e em que nível de revisão.
        </p>
      </div>

      <div className="admin-section">
        <HelpLabel className="field-label" htmlFor="inst-name">
          Nome da instituição de ensino superior
        </HelpLabel>
        <input
          id="inst-name"
          className="text-input"
          value={name}
          onChange={e => updateInstitution({ ...institution, name: e.target.value })}
          placeholder="Ex.: Universidade Exemplo"
        />

        <div className="admin-section-head">
          <strong>Cursos</strong>
          <Button onClick={addCourse} className="button secondary">
            <Plus size={15} /> Adicionar curso
          </Button>
        </div>

        <div className="admin-list">
          {institution.courses.length === 0 && (
            <p className="muted-text">Nenhum curso cadastrado.</p>
          )}
          {institution.courses.map(course => (
            <div key={course.id} className="admin-row">
              <input
                className="text-input"
                value={course.code}
                onChange={e =>
                  updateInstitution({
                    ...institution,
                    courses: institution.courses.map(c =>
                      c.id === course.id ? { ...c, code: e.target.value } : c
                    ),
                  })
                }
                placeholder="Código"
              />
              <input
                className="text-input"
                value={course.name}
                onChange={e =>
                  updateInstitution({
                    ...institution,
                    courses: institution.courses.map(c =>
                      c.id === course.id ? { ...c, name: e.target.value } : c
                    ),
                  })
                }
                placeholder="Nome do curso"
              />
              <button
                className="icon-button"
                onClick={() => removeCourse(course.id)}
                aria-label="Remover curso"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-head">
          <strong>Setores com acesso ao diagnóstico</strong>
          <Button onClick={addSector} className="button secondary">
            <Plus size={15} /> Adicionar setor
          </Button>
        </div>
        <div className="admin-list">
          {institution.sectors.map(s => (
            <div key={s.sectorId} className="admin-row admin-row-column">
              <div>
                <strong>{s.label}</strong>
                <span className="muted-text">{s.sectorId}</span>
              </div>
              <HelpLabel className="admin-check">
                <input
                  type="checkbox"
                  checked={s.canAnswer}
                  onChange={e => toggleSector(s.sectorId, e.target.checked)}
                />
                Pode responder
              </HelpLabel>
              <HelpLabel className="admin-check">
                <input
                  type="checkbox"
                  checked={s.canReview}
                  onChange={e => toggleSector(s.sectorId, true)}
                />
                Pode revisar
              </HelpLabel>
              <button
                className="icon-button"
                onClick={() => removeSector(s.sectorId)}
                aria-label="Remover setor"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-actions">
        <Button onClick={() => updateInstitution({ ...institution, name: name || institution.name })}>
          Salvar configuração
        </Button>
        <Button
          onClick={() => updateInstitution(emptyInstitution)}
          variant="outline"
          className="admin-reset"
        >
          Limpar cadastro
        </Button>
      </div>
    </div>
  );
}
