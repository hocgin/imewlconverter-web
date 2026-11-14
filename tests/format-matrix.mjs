// Included by the online runner after the real worker/client has been initialized.
const matrix=[];
const generated={};
for(const format of caps.exporters) {
  const id=format.id;
  const code=({wb86:'Wubi86',wb98:'Wubi98',wbnewage:'WubiNewAge',qqwb:'Wubi86',xywb:'Wubi86',jd:'Wubi86',jdzm:'Zhengma',win10mswb:'Wubi86'})[id] || 'Pinyin';
  try {
    const result=await page.evaluate(arg=>window.runConversion(arg),{text:id==='bdsje'?'hello\nworld\ncloudflare\n':'深蓝词库\n词库转换\n中国\n',to:id,settings:{code,rank:'42'}});
    const output=result.outputs[0];
    if(!output || output.exported===0 || !output.data.length) throw new Error('没有导出有效词条');
    generated[id]=output.data;
    matrix.push({direction:'导出',id,name:format.displayName,status:output.exportErrors?'警告':'通过',entries:output.exported,bytes:output.data.length,source:id==='bdsje'?'三条 ASCII 英文词条':'三条中文词条＋真实引擎生成编码',detail:output.warnings.join('; ')});
  } catch(e) {matrix.push({direction:'导出',id,name:format.displayName,status:'失败',detail:e.message.split('\n')[0]});}
  console.log('EXPORT',id,matrix.at(-1).status);
}
const realSamples={scel:'唐诗300首【官方推荐】.scel',gboard:'GBoard_dictionary.txt',gboardbin:'gboard_user_dict.dict',word:'纯汉字.txt',rime:'rime_luna_pinyin_export.txt',qqpy:'QQPinyin.txt',qqpye:'QQPinyin_English.txt',qcel:'星际战甲.qcel',qpyd:'成语.qpyd',bcd:'记者必备.bcd',bdict:'travel.bdict',bdpybin:'百度拼音备份.bin',sgpybin:'搜狗备份.bin',uwl:'华宇紫光economics.uwl',jdmb:'极点五笔.mb',ld2:'g.ld2',win10mswb:'微软五笔UserDefinedPhrase.dat',win10mspyss:'Win10拼音自学习_ChsPinyinUDL.dat',mspy:'微软拼音.dctx'};
generated.emoji=Array.from(new TextEncoder().encode('😀\t笑脸\n'));
generated.rimedb=Array.from(new TextEncoder().encode('zhong guo\t中国\t42\n'));
for(const format of caps.importers) {
  const id=format.id;
  const fixture=realSamples[id];
  if(!fixture && !generated[id]) {matrix.push({direction:'导入',id,name:format.displayName,status:'未覆盖',detail:'没有独立真实样本，也没有可往返的导出样本'});continue;}
  try {
    const bytes=fixture?[...await readFile(`${fixtureRoot}/${fixture}`)]:generated[id];
    const result=await page.evaluate(arg=>window.runConversion(arg),{source:bytes,name:fixture||`${id}.fixture`,from:id,to:'word'});
    const output=result.outputs[0];
    if(!output || output.imported===0 || output.exported===0)throw new Error('没有识别到有效词条');
    const expected=({bdsje:['hello','world','cloudflare'],emoji:['笑脸'],rimedb:['中国']})[id]||['深蓝词库','词库转换','中国'];
    const words=output.preview?.replace(/^\uFEFF/,'').split(/\r?\n/)||[];
    const missing=fixture?[]:expected.filter(w=>!words.includes(w));
    matrix.push({direction:'导入',id,name:format.displayName,status:missing.length?'失败':output.warnings.length?'警告':'通过',entries:output.imported,source:fixture?'真实样本 '+fixture:['emoji','rimedb'].includes(id)?'构建的最小文本样本（非独立真实样本）':'相同格式导出产物往返（非独立样本）',detail:missing.length?'往返丢失词条：'+missing.join('、'):output.warnings.join('; ')});
  }catch(e){matrix.push({direction:'导入',id,name:format.displayName,status:'失败',source:fixture||'导出产物往返',detail:e.message.split('\n')[0]});}
  console.log('IMPORT',id,matrix.at(-1).status);
}
await writeFile(`${dir}/format-matrix.json`,JSON.stringify({url:'https://dict.aipan.app/',matrix},null,2));
await writeFile(`${dir}/format-matrix.md`,'# 线上格式逐项验证\n\n测试范围：每个导入器与导出器各测试一条路径，不代表全部格式组合或输入法内安装验证。\n\n| 方向 | 格式 | 名称 | 状态 | 条数 | 样本 | 说明 |\n|---|---|---|---|---:|---|---|\n'+matrix.map(r=>`|${r.direction}|${r.id}|${r.name}|${r.status}|${r.entries??''}|${r.source??''}|${(r.detail||'').replaceAll('|','/').replaceAll('\n',' ')}|`).join('\n'));
console.log('FORMAT_MATRIX',JSON.stringify(matrix.reduce((out,r)=>(out[r.status]=(out[r.status]||0)+1,out),{})));
