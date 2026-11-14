// Real pointer and keyboard regression checks, run with pnpm test:formats.
const root = "__PROJECT_ROOT__";
const finish = "__FINISH__";
const { default: assert } = await import('node:assert/strict');
const { writeFile, mkdir } = await import('node:fs/promises');
const task = await taskSpace('词库格式选择闪烁修复');
const page = task.page('p1');
const checks = [];
const record = name => { checks.push({name, passed:true}); console.log(`PASS ${name}`); };
await page.goto('http://127.0.0.1:4173/zh-hans/');
await page.waitForFunction(() => document.querySelector('.engine-status')?.textContent.includes('就绪'), undefined, {timeout:120000});
await page.snapshot();
await page.click('text=用示例试试看');

for (const [index, label] of [[0, '输入格式'], [1, '输出格式']]) {
  await page.click(`.format-picker input >> nth=${index}`);
  // Let the entry animation/focus effects cross multiple animation frames. The
  // original WebKit failure closed the list in the next frame, before selection.
  const stable = await page.evaluate(async index => {
    for (let i=0;i<8;i++) await new Promise(requestAnimationFrame);
    const input = document.querySelectorAll('.format-picker input')[index];
    const option = document.querySelector('[role="listbox"] [role="option"][data-key="scel"]');
    const rect = option?.getBoundingClientRect();
    return {open:input.getAttribute('aria-expanded'), point:rect ? {x:rect.x + 40, y:rect.y + rect.height/2} : null};
  }, index);
  assert.equal(stable.open, 'true', `${label} should stay open until a user selects/dismisses it`);
  assert.ok(stable.point);
  await page.mouse.click(stable.point.x, stable.point.y, {label:`选择${label}搜狗词库`});
  const state = await page.evaluate(index => {
    const input=document.querySelectorAll('.format-picker input')[index];
    return {value:input.value,open:input.getAttribute('aria-expanded')};
  }, index);
  assert.match(state.value,/scel/); assert.equal(state.open,'false');
  record(`${label}: pointer open, stable list, pointer selection`);
}
for (const [index, query] of [[0,'word'],[1,'rime']]) {
  const selector=`.format-picker input >> nth=${index}`;
  await page.fill(selector,query); await page.press(selector,'ArrowDown'); await page.press(selector,'Enter');
  assert.match(await page.evaluate(index=>document.querySelectorAll('.format-picker input')[index].value,index),new RegExp(query));
  record(`${query}: search and keyboard selection`);
}
await page.click('.format-picker button >> nth=1');
assert.equal(await page.evaluate(()=>document.querySelectorAll('.format-picker input')[1].getAttribute('aria-expanded')),'true');
await page.press('.format-picker input >> nth=1','Escape');
assert.equal(await page.evaluate(()=>document.querySelectorAll('.format-picker input')[1].getAttribute('aria-expanded')),'false');
record('Escape dismisses the output menu');
await page.click('.format-picker button >> nth=0');
await page.mouse.click(4, 4, {label:'点击页面空白处关闭菜单'});
assert.equal(await page.evaluate(()=>document.querySelector('.format-picker input').getAttribute('aria-expanded')),'false');
record('Outside click dismisses the input menu');
await mkdir(`${root}/artifacts/verification`,{recursive:true});
await writeFile(`${root}/artifacts/verification/format-picker-results.json`,JSON.stringify({browser:'Chromium',checks},null,2));
console.log(JSON.stringify({passed:checks.length}));
if(finish) await task.finish({keep:[]});
