// stdin-only bridge for an already authorized monitoring execution.
// Produces SQL for the existing Supabase connector; does not store credentials,
// create a scheduler, publish a plan or approve a strategic suggestion.
const [institution,course]=process.argv.slice(2);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!uuid.test(institution??'')||!uuid.test(course??''))throw new Error('Usage: node scripts/competitive-report-sql.mjs INSTITUTION_UUID COURSE_UUID < REPORT.json');
const chunks=[];let size=0;
for await(const chunk of process.stdin){size+=chunk.length;if(size>1000000)throw new Error('Report exceeds 1 MB');chunks.push(chunk);}
const raw=Buffer.concat(chunks).toString('utf8');
const report=JSON.parse(raw);
if(!Array.isArray(report.findings)||!report.findings.length)throw new Error('No findings to import');
const literal=JSON.stringify(report).replaceAll("'","''");
process.stdout.write(`SELECT vertice_planning.ingest_competitive_report('${institution}'::uuid,'${course}'::uuid,'${literal}'::jsonb);\n`);
