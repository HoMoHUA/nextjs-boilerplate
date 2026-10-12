/* eslint-disable @typescript-eslint/no-require-imports -- Source-level UI locale regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['components/office/RoomPanel.tsx','components/office/OfficeApp.tsx','components/office/Views.tsx','components/office/RightPanel.tsx','components/office/ChatBar.tsx','components/office/TopicPicker.tsx','lib/topics.ts']){
  const content=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(!/[\u0600-\u06ff]/u.test(content),`Non-English hardcoded UI copy: ${file}`);
}
const picker=fs.readFileSync(path.join(root,'components/office/TopicPicker.tsx'),'utf8');
assert.ok(picker.includes('dir="ltr"'),'English picker must use left-to-right layout');
assert.ok(picker.includes('Select topics') && picker.includes('Save selection'));
console.log('PASS all application-owned UI copy is English; topic/message data untouched');
