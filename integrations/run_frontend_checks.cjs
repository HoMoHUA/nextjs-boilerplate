/* eslint-disable @typescript-eslint/no-require-imports -- Local test runner; never contacts live services. */
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const suites=fs.readdirSync(path.join(root,'lib'),{recursive:true}).filter(file=>file.endsWith('.test.ts')).sort();
const commands=suites.map(file=>['integrations/run_topic_tests.cjs','../lib/'+file]);
commands.push(['integrations/test_english_ui.cjs'],['integrations/avatar_lod_census.mjs'],['integrations/coffee_socket_contract.mjs']);
for(const args of commands){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);}
console.log(`ALL ${suites.length+1} FRONTEND SUITES AND TWO ASSET CONTRACT CHECKS PASSED`);
