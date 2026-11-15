-- Separar planejamento-curso em planejamento-estrategico e planejamento-semestral
-- no catálogo de módulos

UPDATE vertice_module_catalog
SET tabs = array_remove(tabs, 'planejamento-curso') || ARRAY['planejamento-estrategico', 'planejamento-semestral']
WHERE 'planejamento-curso' = ANY(tabs);
