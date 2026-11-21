-- Concede à alta gestão a mesma capacidade de registrar/atualizar planos 5W2H
-- já disponível ao gestor, preservando vínculo institucional, MFA e demais regras.
-- Não amplia acesso a docentes ou cursos de outras instituições.
alter policy vertice_actions_insert on public.vertice_actions
  with check (
    vertice_private.has_role(institution_id, array[
      'gestor', 'equipe', 'reitor', 'diretor_geral',
      'diretor_pedagogico', 'procurador'
    ])
  );

alter policy vertice_actions_update on public.vertice_actions
  using (
    vertice_private.has_role(institution_id, array[
      'gestor', 'equipe', 'reitor', 'diretor_geral',
      'diretor_pedagogico', 'procurador'
    ])
  )
  with check (
    vertice_private.has_role(institution_id, array[
      'gestor', 'equipe', 'reitor', 'diretor_geral',
      'diretor_pedagogico', 'procurador'
    ])
  );
