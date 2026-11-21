alter table public.vertice_registry_contacts
 drop constraint vertice_registry_contacts_position_check,
 drop constraint vertice_registry_contacts_check,
 add constraint registry_position_allowed check (position in (
  'gestor','reitor','vice_reitor','pro_reitor','diretor','procurador',
  'secretaria','cpa','coordenador','nde','colegiado'
 )),
 add constraint registry_position_scope check (
  (position in ('coordenador','nde','colegiado')) = (course_id is not null)
 );
