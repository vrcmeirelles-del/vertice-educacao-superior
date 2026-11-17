-- Additive provenance and reference seed. No grants, policies, auth or results are changed.
ALTER TABLE public.vertice_instrument_catalog ADD COLUMN IF NOT EXISTS source_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.vertice_instrument_objects ADD COLUMN IF NOT EXISTS source_pdf_page integer;
COMMENT ON COLUMN public.vertice_instrument_catalog.source_provenance IS 'Origin and checksum of the received reference; canonical upstream binary equality must be stated separately.';
COMMENT ON COLUMN public.vertice_instrument_objects.source_pdf_page IS 'Physical PDF page of the indicator title in the received reference.';
DO $seed$
DECLARE target uuid; catalog uuid;
BEGIN
 SELECT id INTO STRICT target FROM public.vertice_institutions WHERE emec_code='4969' AND acronym='UNITOP';
 INSERT INTO public.vertice_instrument_catalog(institution_id,instrument_code,instrument_label,instrument_version,is_active,scope,source_provenance)
 VALUES(target,'reconhecimento_curso','IACG 2017 — Reconhecimento e Renovação de Reconhecimento','2017',true,'curso','{"canonical_url": "https://download.inep.gov.br/educacao_superior/avaliacao_cursos_graduacao/instrumentos/2017/curso_reconhecimento.pdf", "obtained_url": "https://ufal.br/estudante/graduacao/avaliacao/e-mec/curso_reconhecimento-instrumento-inep-1.pdf/@@download/file", "publisher": "INEP/DAES", "edition": "outubro/2017", "obtained_at": "2026-11-17T15:27:30.200299+00:00", "bytes_received": 908787, "sha256_received": "bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768", "pdf_pages": 54, "retrieval_kind": "official_university_redistribution", "canonical_binary_sha256": null, "canonical_binary_equality_verified": false, "use": "reference_classification_only", "limitations": ["Cópia da publicação INEP redistribuída pela UFAL; download direto INEP respondeu 503.", "Hash refere-se aos bytes recebidos da UFAL; igualdade binária com servidor INEP não comprovada.", "Catálogo de códigos, títulos, aplicabilidade e páginas; critérios de conceitos não importados.", "Não valida aplicabilidade de indicador a curso específico, não calcula conceito e não aprova vínculo."], "official_status_catalog_url": "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/avaliacao-in-loco/instrumentos-de-avaliacao/2017", "official_status_checked_on": "2026-11-17", "library_pdf_copy": "https://chatgpt.com/library?file_id=libfile_8e760b072a9081919b8f8b8fc6d0d658&account_id=personal", "library_pdf_note": "A cópia PDF disponibilizada pode conter metadados acrescentados no salvamento; SHA recebido refere-se ao original de 908787 bytes da UFAL."}'::jsonb)
 ON CONFLICT(institution_id,instrument_code,instrument_version) DO NOTHING;
 SELECT id INTO STRICT catalog FROM public.vertice_instrument_catalog WHERE institution_id=target AND instrument_code='reconhecimento_curso' AND instrument_version='2017' AND source_provenance->>'sha256_received'='bbac97390a8f7a878fda6b50e92aa41e3f19d2cb3657fe05009050980aa77768';
 INSERT INTO public.vertice_instrument_objects(catalog_id,object_code,dimension,object_label,description,source_pdf_page)
 SELECT catalog,v.* FROM (VALUES
('1.1','1','Políticas institucionais no âmbito do curso',NULL,11),
('1.2','1','Objetivos do curso',NULL,12),
('1.3','1','Perfil profissional do egresso',NULL,12),
('1.4','1','Estrutura curricular','Disciplina de LIBRAS obrigatória para licenciaturas e para Fonoaudiologia, e optativa para os demais cursos (Decreto nº 5.626/2005).',12),
('1.5','1','Conteúdos curriculares',NULL,13),
('1.6','1','Metodologia',NULL,14),
('1.7','1','Estágio curricular supervisionado','Obrigatório para cursos cujas DCN preveem o estágio supervisionado. NSA para cursos que não contemplam estágio no PPC (desde que não esteja previsto nas DCN).',14),
('1.8','1','Estágio curricular supervisionado – relação com a rede de escolas da educação básica','Obrigatório para licenciaturas. NSA para os demais cursos.',15),
('1.9','1','Estágio curricular supervisionado – relação teoria e prática','Obrigatório para licenciaturas. NSA para os demais cursos.',15),
('1.10','1','Atividades complementares','Obrigatório para cursos cujas DCN preveem atividades complementares. NSA para cursos que não contemplam atividades complementares no PPC (desde que não esteja previsto nas DCN).',16),
('1.11','1','Trabalhos de Conclusão de Curso (TCC)','Obrigatório para cursos cujas DCN preveem TCC. NSA para cursos que não contemplam TCC no PPC (desde que não esteja previsto nas DCN).',16),
('1.12','1','Apoio ao discente',NULL,17),
('1.13','1','Gestão do curso e os processos de avaliação interna e externa',NULL,17),
('1.14','1','Atividades de tutoria','Exclusivo para cursos na modalidade a distância e para cursos presenciais que ofertam disciplinas (integral ou parcialmente) na modalidade a distância (conforme Portaria nº 1.134, de 10 de outubro de 2016).1',18),
('1.15','1','Conhecimentos, habilidades e atitudes necessárias às atividades de tutoria','Exclusivo para cursos na modalidade a distância e para cursos presenciais que ofertam disciplinas (integral ou parcialmente) na modalidade a distância (conforme Portaria nº 1.134, de 10 de outubro de 2016).',18),
('1.16','1','Tecnologias de Informação e Comunicação (TIC) no processo ensino-aprendizagem',NULL,19),
('1.17','1','Ambiente Virtual de Aprendizagem (AVA)','Exclusivo para cursos na modalidade a distância e para cursos presenciais que ofertam disciplinas (integral ou parcialmente) na modalidade a distância (conforme Portaria nº 1.134, de 10 de outubro de 2016).',19),
('1.18','1','Material didático','NSA para cursos presenciais que não contemplam material didático no PPC.',20),
('1.19','1','Procedimentos de acompanhamento e de avaliação dos processos de ensino-aprendizagem',NULL,20),
('1.20','1','Número de vagas',NULL,21),
('1.21','1','Integração com as redes públicas de ensino','Obrigatório para licenciaturas. NSA para os cursos que não contemplam integração com as redes públicas de ensino no PPC.',21),
('1.22','1','Integração do curso com o sistema local e regional de saúde (SUS)','Obrigatório para cursos da área da saúde que contemplam, nas DCN e/ou no PPC, a integração com o sistema local e regional de saúde/SUS.',22),
('1.23','1','Atividades práticas de ensino para áreas da saúde','Obrigatório para cursos da área da saúde que contemplam, nas DCN e/ou no PPC, a integração com o sistema local e regional de saúde/SUS.',22),
('1.24','1','Atividades práticas de ensino para licenciaturas','Obrigatório para licenciaturas. NSA para os demais cursos.',23),
('2.1','2','Núcleo Docente Estruturante – NDE',NULL,23),
('2.2','2','Equipe multidisciplinar','Exclusivo para cursos na modalidade a distância e para cursos presenciais que ofertam disciplinas (integral ou parcialmente) na modalidade a distância (conforme Portaria nº 1.134, de 10 de outubro de 2016).',24),
('2.3','2','Atuação do coordenador',NULL,24),
('2.4','2','Regime de trabalho do coordenador de curso',NULL,25),
('2.5','2','Corpo docente: titulação',NULL,25),
('2.6','2','Regime de trabalho do corpo docente do curso',NULL,26),
('2.7','2','Experiência profissional do docente','Excluída a experiência no exercício da docência superior. NSA para cursos de licenciatura.',26),
('2.8','2','Experiência no exercício da docência na educação básica','Obrigatório para cursos de licenciatura e para CST da Rede Federal de Educação Profissional, Científica e Tecnológica. NSA para os demais cursos.',27),
('2.9','2','Experiência no exercício da docência superior',NULL,27),
('2.10','2','Experiência no exercício da docência na educação a distância','NSA para cursos totalmente presenciais.',28),
('2.11','2','Experiência no exercício da tutoria na educação a distância','NSA para cursos totalmente presenciais.',29),
('2.12','2','Atuação do colegiado de curso ou equivalente',NULL,29),
('2.13','2','Titulação e formação do corpo de tutores do curso','NSA para cursos totalmente presenciais.',30),
('2.14','2','Experiência do corpo de tutores em educação a distância','Exclusivo para cursos na modalidade a distância e para cursos presenciais que ofertam disciplinas (integral ou parcialmente) na modalidade a distância (conforme Portaria nº 1.134, de 10 de outubro de 2016).',30),
('2.15','2','Interação entre tutores (presenciais – quando for o caso – e a distância), docentes e coordenadores de curso a distância','Exclusivo para cursos na modalidade a distância e para cursos presenciais que ofertam disciplinas (integral ou parcialmente) na modalidade a distância (conforme Portaria nº 1.134, de 10 de outubro de 2016).',31),
('2.16','2','Produção científica, cultural, artística ou tecnológica',NULL,31),
('3.1','3','Espaço de trabalho para docentes em tempo integral',NULL,32),
('3.2','3','Espaço de trabalho para o coordenador',NULL,32),
('3.3','3','Sala coletiva de professores','NSA para IES que possui espaço de trabalho individual para todos os docentes do curso.',33),
('3.4','3','Salas de aula','NSA pra cursos a distância que não preveem atividades presenciais na sede.',33),
('3.5','3','Acesso dos alunos a equipamentos de informática',NULL,34),
('3.6','3','Bibliografia básica por Unidade Curricular (UC)',NULL,34),
('3.7','3','Bibliografia complementar por Unidade Curricular (UC)',NULL,36),
('3.8','3','Laboratórios didáticos de formação básica','NSA para cursos que não utilizam laboratórios didáticos de formação básica, conforme PPC. Para cursos a distância, verificar os laboratórios especializados da sede e dos polos (cujas informações devem estar disponíveis na sede da instituição).',38),
('3.9','3','Laboratórios didáticos de formação específica','NSA para cursos que não utilizam laboratórios didáticos de formação específica, conforme PPC. Para cursos a distância, verificar os laboratórios especializados da sede e dos polos (cujas informações devem estar disponíveis na sede da instituição).',38),
('3.10','3','Laboratórios de ensino para a área de saúde','Obrigatório para os cursos da área de saúde, desde que contemplado no PPC e nas DCN. NSA para os demais cursos.',39),
('3.11','3','Laboratórios de habilidades','Obrigatório para os cursos da área de saúde, desde que contemplado no PPC. NSA para os demais cursos.',40),
('3.12','3','Unidades hospitalares e complexo assistencial conveniados','Obrigatório para os cursos da área de saúde, desde que contemplado no PPC. NSA para os demais cursos.',40),
('3.13','3','Biotérios','Obrigatório para os cursos da área de saúde, desde que contemplado no PPC. NSA para os demais cursos.',41),
('3.14','3','Processo de controle de produção ou distribuição de material didático (logística)','NSA para cursos presenciais que não contemplam material didático no PPC.',41),
('3.15','3','Núcleo de práticas jurídicas: atividades básicas e arbitragem, negociação, conciliação, mediação e atividades jurídicas reais','Obrigatório para Cursos de Direito, desde que contemplado no PPC. NSA para os demais cursos.',42),
('3.16','3','Comitê de Ética em Pesquisa (CEP)','Obrigatório para todos os cursos que contemplem, no PPC, a realização de pesquisa envolvendo seres humanos.',42),
('3.17','3','Comitê de Ética na Utilização de Animais (CEUA)','Obrigatório para todos os cursos que contemplem no PPC a utilização de animais em suas pesquisas.',43),
('3.18','3','Ambientes profissionais vinculados ao curso','Exclusivo para cursos a distância com previsão no PPC de utilização de ambientes profissionais.',43)
 ) AS v(object_code,dimension,object_label,description,source_pdf_page)
 ON CONFLICT(catalog_id,object_code) DO NOTHING;
 IF (SELECT count(*) FROM public.vertice_instrument_objects WHERE catalog_id=catalog)<>58 THEN
  RAISE EXCEPTION 'Catalog has an unexpected object count; no classifications were overwritten';
 END IF;
END $seed$;
