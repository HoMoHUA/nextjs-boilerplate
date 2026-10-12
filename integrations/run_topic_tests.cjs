/* eslint-disable @typescript-eslint/no-require-imports -- Test-only CommonJS transcompiler hook. */
// No network or runtime mutation: transcompile and execute the TS fixture assertions.
const fs=require('node:fs');
const path=require('node:path');
const ts=require('../node_modules/typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpile(fs.readFileSync(file,'utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}),file);
require(path.join(__dirname,'../lib/topic-regression.test.ts'));
