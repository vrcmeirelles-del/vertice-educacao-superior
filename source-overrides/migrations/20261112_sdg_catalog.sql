-- ============================================================
-- Catálogo ODS/SDG Oficial — 17 Objetivos + 169 Metas
-- Fonte: UN Statistics Division / IATI Standard codelist
-- Data de referência: Agenda 2030 (A/RES/70/1, Set 2015)
-- ============================================================

-- 1. Tabela de Objetivos (Goals)
CREATE TABLE IF NOT EXISTS vertice_sdg_goals (
  id smallint PRIMARY KEY,
  code text NOT NULL UNIQUE,        -- '1', '2', ... '17'
  title_en text NOT NULL,            -- título original em inglês
  title_pt text NOT NULL,            -- tradução oficial para português
  icon_color text,                   -- cor oficial do ODS
  source text NOT NULL DEFAULT 'UN A/RES/70/1',
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de Metas (Targets)
CREATE TABLE IF NOT EXISTS vertice_sdg_targets (
  id serial PRIMARY KEY,
  goal_id smallint NOT NULL REFERENCES vertice_sdg_goals(id),
  code text NOT NULL UNIQUE,        -- '1.1', '1.2', '1.a', etc.
  title_en text NOT NULL,
  title_pt text,                    -- tradução quando disponível
  is_means_of_implementation boolean DEFAULT false,  -- metas com letra (a, b, c)
  source text NOT NULL DEFAULT 'UN A/RES/70/1',
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabela de vinculação projeto-ODS com fundamentação obrigatória
CREATE TABLE IF NOT EXISTS vertice_extension_sdg_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES vertice_institutions(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES vertice_extension_projects(id) ON DELETE CASCADE,
  target_id int NOT NULL REFERENCES vertice_sdg_targets(id),

  -- Fundamentação obrigatória (plano Impacto exige)
  justification text NOT NULL,        -- por que este projeto se vincula a esta meta
  contribution_type text NOT NULL DEFAULT 'produto'
    CHECK (contribution_type IN ('produto', 'resultado', 'impacto_demonstrado')),
  evidence_doc_id uuid,               -- documento de evidência

  -- Auditoria
  linked_by uuid NOT NULL,            -- auth.uid()
  linked_at timestamptz DEFAULT now(),
  validated_by uuid,                  -- quem validou a vinculação
  validated_at timestamptz,

  UNIQUE(project_id, target_id)
);

-- 4. Inserir os 17 Objetivos
INSERT INTO vertice_sdg_goals (id, code, title_en, title_pt, icon_color) VALUES
(1,  '1',  'No Poverty',                                 'Erradicação da Pobreza',                    '#E5243B'),
(2,  '2',  'Zero Hunger',                                'Fome Zero e Agricultura Sustentável',       '#DDA63A'),
(3,  '3',  'Good Health and Well-being',                  'Saúde e Bem-Estar',                        '#4C9F38'),
(4,  '4',  'Quality Education',                           'Educação de Qualidade',                    '#C5192D'),
(5,  '5',  'Gender Equality',                             'Igualdade de Gênero',                      '#FF3A21'),
(6,  '6',  'Clean Water and Sanitation',                  'Água Potável e Saneamento',                '#26BDE2'),
(7,  '7',  'Affordable and Clean Energy',                 'Energia Limpa e Acessível',                '#FCC30B'),
(8,  '8',  'Decent Work and Economic Growth',             'Trabalho Decente e Crescimento Econômico', '#A21942'),
(9,  '9',  'Industry, Innovation and Infrastructure',     'Indústria, Inovação e Infraestrutura',     '#FD6925'),
(10, '10', 'Reduced Inequalities',                        'Redução das Desigualdades',                '#DD1367'),
(11, '11', 'Sustainable Cities and Communities',           'Cidades e Comunidades Sustentáveis',       '#FD9D24'),
(12, '12', 'Responsible Consumption and Production',       'Consumo e Produção Responsáveis',          '#BF8B2E'),
(13, '13', 'Climate Action',                              'Ação contra a Mudança Global do Clima',    '#3F7E44'),
(14, '14', 'Life Below Water',                            'Vida na Água',                             '#0A97D9'),
(15, '15', 'Life on Land',                                'Vida Terrestre',                           '#56C02B'),
(16, '16', 'Peace, Justice and Strong Institutions',       'Paz, Justiça e Instituições Eficazes',     '#00689D'),
(17, '17', 'Partnerships for the Goals',                   'Parcerias e Meios de Implementação',       '#19486A')
ON CONFLICT (id) DO NOTHING;

-- 5. Inserir as 169 Metas
-- Metas numéricas são de conteúdo; metas com letra são meios de implementação
INSERT INTO vertice_sdg_targets (goal_id, code, title_en, is_means_of_implementation) VALUES
-- ODS 1
(1, '1.1', 'Eradicate extreme poverty (under $1.25/day) by 2030', false),
(1, '1.2', 'Reduce by half poverty in all dimensions per national definitions', false),
(1, '1.3', 'Implement nationally appropriate social protection systems', false),
(1, '1.4', 'Equal rights to economic resources, basic services, land and finance', false),
(1, '1.5', 'Build resilience of the poor to climate and economic shocks', false),
(1, '1.a', 'Mobilize resources for poverty programs in developing countries', true),
(1, '1.b', 'Create pro-poor and gender-sensitive policy frameworks', true),
-- ODS 2
(2, '2.1', 'End hunger and ensure access to safe, nutritious food year-round', false),
(2, '2.2', 'End all forms of malnutrition', false),
(2, '2.3', 'Double productivity and incomes of small-scale food producers', false),
(2, '2.4', 'Ensure sustainable and resilient food production systems', false),
(2, '2.5', 'Maintain genetic diversity of seeds, plants and livestock', false),
(2, '2.a', 'Invest in rural infrastructure and agricultural research', true),
(2, '2.b', 'Correct and prevent agricultural trade restrictions and distortions', true),
(2, '2.c', 'Ensure proper functioning of food commodity markets', true),
-- ODS 3
(3, '3.1', 'Reduce maternal mortality to less than 70 per 100,000 live births', false),
(3, '3.2', 'End preventable deaths of newborns and children under 5', false),
(3, '3.3', 'End AIDS, tuberculosis, malaria and neglected tropical diseases', false),
(3, '3.4', 'Reduce premature mortality from noncommunicable diseases by one third', false),
(3, '3.5', 'Strengthen prevention and treatment of substance abuse', false),
(3, '3.6', 'Halve global deaths and injuries from road traffic accidents', false),
(3, '3.7', 'Ensure universal access to sexual and reproductive health services', false),
(3, '3.8', 'Achieve universal health coverage and access to essential medicines', false),
(3, '3.9', 'Reduce deaths and illness from hazardous chemicals and pollution', false),
(3, '3.a', 'Strengthen implementation of tobacco control', true),
(3, '3.b', 'Support vaccine and medicine R&D for developing countries', true),
(3, '3.c', 'Increase health financing and health workforce in developing countries', true),
(3, '3.d', 'Strengthen early warning and risk management of health emergencies', true),
-- ODS 4
(4, '4.1', 'Ensure free, equitable, quality primary and secondary education for all', false),
(4, '4.2', 'Ensure access to quality early childhood development and pre-primary education', false),
(4, '4.3', 'Equal access to affordable technical, vocational and tertiary education', false),
(4, '4.4', 'Increase youth and adults with relevant skills for employment', false),
(4, '4.5', 'Eliminate gender disparities in education and ensure equal access', false),
(4, '4.6', 'Ensure all youth and adults achieve literacy and numeracy', false),
(4, '4.7', 'Ensure learners acquire knowledge for sustainable development', false),
(4, '4.a', 'Build and upgrade safe, inclusive, effective learning environments', true),
(4, '4.b', 'Expand scholarships available to developing countries', true),
(4, '4.c', 'Increase supply of qualified teachers in developing countries', true),
-- ODS 5
(5, '5.1', 'End all forms of discrimination against women and girls', false),
(5, '5.2', 'Eliminate all violence against women and girls', false),
(5, '5.3', 'Eliminate harmful practices such as child marriage and FGM', false),
(5, '5.4', 'Recognize and value unpaid care and domestic work', false),
(5, '5.5', 'Ensure full participation in leadership and decision-making', false),
(5, '5.6', 'Ensure universal access to sexual and reproductive health and rights', false),
(5, '5.a', 'Give women equal rights to economic resources, land and property', true),
(5, '5.b', 'Enhance use of enabling technology to promote empowerment of women', true),
(5, '5.c', 'Adopt and strengthen policies and legislation for gender equality', true),
-- ODS 6
(6, '6.1', 'Achieve universal access to safe and affordable drinking water', false),
(6, '6.2', 'Achieve adequate sanitation and hygiene for all', false),
(6, '6.3', 'Improve water quality by reducing pollution and untreated wastewater', false),
(6, '6.4', 'Increase water-use efficiency and ensure freshwater supply', false),
(6, '6.5', 'Implement integrated water resources management', false),
(6, '6.6', 'Protect and restore water-related ecosystems', false),
(6, '6.a', 'Expand international cooperation on water and sanitation', true),
(6, '6.b', 'Strengthen community participation in water and sanitation', true),
-- ODS 7
(7, '7.1', 'Ensure universal access to affordable, reliable modern energy', false),
(7, '7.2', 'Increase substantially the share of renewable energy', false),
(7, '7.3', 'Double the global rate of improvement in energy efficiency', false),
(7, '7.a', 'Enhance international cooperation on clean energy R&D', true),
(7, '7.b', 'Expand and upgrade energy infrastructure in developing countries', true),
-- ODS 8
(8, '8.1', 'Sustain per capita economic growth, at least 7% GDP in LDCs', false),
(8, '8.2', 'Achieve higher productivity through diversification and innovation', false),
(8, '8.3', 'Promote policies for decent job creation and entrepreneurship', false),
(8, '8.4', 'Improve resource efficiency and decouple growth from degradation', false),
(8, '8.5', 'Achieve full and productive employment and equal pay', false),
(8, '8.6', 'Substantially reduce youth not in employment, education or training', false),
(8, '8.7', 'End forced labour, modern slavery, trafficking and child labour', false),
(8, '8.8', 'Protect labour rights and promote safe working environments', false),
(8, '8.9', 'Promote sustainable tourism that creates jobs and local culture', false),
(8, '8.10', 'Strengthen capacity of domestic financial institutions', false),
(8, '8.a', 'Increase Aid for Trade support for developing countries', true),
(8, '8.b', 'Develop and operationalize a global strategy for youth employment', true),
-- ODS 9
(9, '9.1', 'Develop quality, reliable, sustainable and resilient infrastructure', false),
(9, '9.2', 'Promote inclusive and sustainable industrialization', false),
(9, '9.3', 'Increase access of small-scale enterprises to financial services', false),
(9, '9.4', 'Upgrade infrastructure and retrofit industries for sustainability', false),
(9, '9.5', 'Enhance scientific research and technological capabilities', false),
(9, '9.a', 'Facilitate sustainable infrastructure development for developing countries', true),
(9, '9.b', 'Support domestic technology development and innovation', true),
(9, '9.c', 'Increase access to ICT and the Internet in LDCs', true),
-- ODS 10
(10, '10.1', 'Progressively achieve income growth of the bottom 40%', false),
(10, '10.2', 'Empower and promote social, economic and political inclusion', false),
(10, '10.3', 'Ensure equal opportunity and reduce outcome inequalities', false),
(10, '10.4', 'Adopt fiscal, wage and social protection policies for equality', false),
(10, '10.5', 'Improve regulation and monitoring of global financial markets', false),
(10, '10.6', 'Enhanced representation for developing countries in global institutions', false),
(10, '10.7', 'Facilitate orderly, safe, regular and responsible migration', false),
(10, '10.a', 'Implement special and differential treatment for developing countries', true),
(10, '10.b', 'Encourage ODA and financial flows to states where need is greatest', true),
(10, '10.c', 'Reduce transaction costs of migrant remittances to less than 3%', true),
-- ODS 11
(11, '11.1', 'Ensure access to adequate, safe and affordable housing', false),
(11, '11.2', 'Provide safe, affordable, accessible and sustainable transport', false),
(11, '11.3', 'Enhance inclusive and sustainable urbanization', false),
(11, '11.4', 'Strengthen efforts to protect cultural and natural heritage', false),
(11, '11.5', 'Reduce deaths and economic losses caused by disasters', false),
(11, '11.6', 'Reduce adverse per capita environmental impact of cities', false),
(11, '11.7', 'Provide universal access to safe, inclusive, green public spaces', false),
(11, '11.a', 'Support positive economic, social and environmental links between areas', true),
(11, '11.b', 'Increase cities with integrated policies for inclusion and resilience', true),
(11, '11.c', 'Support LDCs in building sustainable and resilient buildings', true),
-- ODS 12
(12, '12.1', 'Implement the 10-year framework on sustainable consumption and production', false),
(12, '12.2', 'Achieve sustainable management and efficient use of natural resources', false),
(12, '12.3', 'Halve per capita global food waste at retail and consumer levels', false),
(12, '12.4', 'Achieve environmentally sound management of chemicals and wastes', false),
(12, '12.5', 'Substantially reduce waste generation through prevention and recycling', false),
(12, '12.6', 'Encourage companies to adopt sustainable practices and reporting', false),
(12, '12.7', 'Promote sustainable public procurement practices', false),
(12, '12.8', 'Ensure people have information and awareness for sustainable lifestyles', false),
(12, '12.a', 'Support developing countries scientific and technological capacity', true),
(12, '12.b', 'Develop and implement tools to monitor sustainable tourism', true),
(12, '12.c', 'Rationalize inefficient fossil-fuel subsidies', true),
-- ODS 13
(13, '13.1', 'Strengthen resilience and adaptive capacity to climate hazards', false),
(13, '13.2', 'Integrate climate change measures into national policies and planning', false),
(13, '13.3', 'Improve education, awareness and capacity on climate change', false),
(13, '13.a', 'Implement commitment to mobilize $100B annually for climate needs', true),
(13, '13.b', 'Promote mechanisms for effective climate planning in LDCs and SIDS', true),
-- ODS 14
(14, '14.1', 'Prevent and significantly reduce marine pollution', false),
(14, '14.2', 'Sustainably manage and protect marine and coastal ecosystems', false),
(14, '14.3', 'Minimize and address the impacts of ocean acidification', false),
(14, '14.4', 'Effectively regulate harvesting and end overfishing', false),
(14, '14.5', 'Conserve at least 10% of coastal and marine areas', false),
(14, '14.6', 'Prohibit fisheries subsidies that contribute to overcapacity', false),
(14, '14.7', 'Increase the economic benefits from sustainable use of marine resources', false),
(14, '14.a', 'Increase scientific knowledge and research capacity for ocean health', true),
(14, '14.b', 'Provide access for small-scale artisanal fishers to marine resources', true),
(14, '14.c', 'Enhance conservation and sustainable use of oceans through international law', true),
-- ODS 15
(15, '15.1', 'Ensure conservation and sustainable use of terrestrial ecosystems', false),
(15, '15.2', 'Promote sustainable management of all types of forests', false),
(15, '15.3', 'Combat desertification and restore degraded land and soil', false),
(15, '15.4', 'Ensure conservation of mountain ecosystems and their biodiversity', false),
(15, '15.5', 'Take action to reduce degradation of natural habitats and halt biodiversity loss', false),
(15, '15.6', 'Promote fair and equitable sharing of benefits from genetic resources', false),
(15, '15.7', 'Take action to end poaching and trafficking of protected species', false),
(15, '15.8', 'Introduce measures to prevent and control invasive alien species', false),
(15, '15.9', 'Integrate ecosystem and biodiversity values into national planning', false),
(15, '15.a', 'Mobilize financial resources for biodiversity and ecosystems', true),
(15, '15.b', 'Mobilize resources for sustainable forest management', true),
(15, '15.c', 'Enhance global support to combat poaching and trafficking', true),
-- ODS 16
(16, '16.1', 'Significantly reduce all forms of violence and related death rates', false),
(16, '16.2', 'End abuse, exploitation, trafficking and violence against children', false),
(16, '16.3', 'Promote the rule of law and ensure equal access to justice', false),
(16, '16.4', 'Significantly reduce illicit financial and arms flows', false),
(16, '16.5', 'Substantially reduce corruption and bribery in all their forms', false),
(16, '16.6', 'Develop effective, accountable and transparent institutions', false),
(16, '16.7', 'Ensure responsive, inclusive, participatory decision-making', false),
(16, '16.8', 'Broaden and strengthen developing country participation in global governance', false),
(16, '16.9', 'Provide legal identity for all, including birth registration', false),
(16, '16.10', 'Ensure public access to information and protect fundamental freedoms', false),
(16, '16.a', 'Strengthen relevant national institutions to prevent violence and combat crime', true),
(16, '16.b', 'Promote and enforce non-discriminatory laws and policies', true),
-- ODS 17
(17, '17.1', 'Strengthen domestic resource mobilization including tax collection', false),
(17, '17.2', 'Developed countries to fulfill ODA commitments', false),
(17, '17.3', 'Mobilize additional financial resources for developing countries', false),
(17, '17.4', 'Assist developing countries in attaining long-term debt sustainability', false),
(17, '17.5', 'Adopt and implement investment promotion regimes for LDCs', false),
(17, '17.6', 'Enhance North-South, South-South and triangular cooperation on S&T', false),
(17, '17.7', 'Promote development and transfer of environmentally sound technologies', false),
(17, '17.8', 'Operationalize the technology bank and STI capacity-building mechanism for LDCs', false),
(17, '17.9', 'Enhance international support for capacity-building in developing countries', false),
(17, '17.10', 'Promote a universal, rules-based, open, non-discriminatory trading system', false),
(17, '17.11', 'Significantly increase the exports of developing countries', false),
(17, '17.12', 'Realize timely duty-free and quota-free market access for LDCs', false),
(17, '17.13', 'Enhance global macroeconomic stability through policy coordination', false),
(17, '17.14', 'Enhance policy coherence for sustainable development', false),
(17, '17.15', 'Respect each country''s policy space and leadership for poverty eradication', false),
(17, '17.16', 'Enhance the Global Partnership for Sustainable Development', false),
(17, '17.17', 'Encourage and promote effective public, public-private and civil society partnerships', false),
(17, '17.18', 'Enhance capacity-building support for high-quality, timely and reliable disaggregated data', false),
(17, '17.19', 'Build on existing initiatives to develop measurements of progress beyond GDP', false)
ON CONFLICT (code) DO NOTHING;

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_sdg_targets_goal ON vertice_sdg_targets(goal_id);
CREATE INDEX IF NOT EXISTS idx_sdg_links_project ON vertice_extension_sdg_links(project_id);
CREATE INDEX IF NOT EXISTS idx_sdg_links_target ON vertice_extension_sdg_links(target_id);
CREATE INDEX IF NOT EXISTS idx_sdg_links_inst ON vertice_extension_sdg_links(institution_id);

-- 7. RLS para vinculações
ALTER TABLE vertice_extension_sdg_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sdg_links_read" ON vertice_extension_sdg_links
  FOR SELECT USING (vertice_private.can_read_institution(institution_id));
CREATE POLICY "sdg_links_write" ON vertice_extension_sdg_links
  FOR INSERT WITH CHECK (vertice_private.can_read_institution(institution_id));
CREATE POLICY "sdg_links_update" ON vertice_extension_sdg_links
  FOR UPDATE USING (vertice_private.can_read_institution(institution_id));

-- Catálogo ODS é público (leitura para todos)
-- Sem RLS em vertice_sdg_goals e vertice_sdg_targets
