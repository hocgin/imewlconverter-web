"""Targeted Firefox verification of previously ambiguous online format cases."""
import json, time, urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[1]
out=root/'artifacts/verification/online'
base='http://127.0.0.1:4458'
def request(method,path,data=None):
    r=urllib.request.Request(base+path,method=method,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(r,timeout=120) as response:return json.load(response)['value']
session=request('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'firefox','moz:firefoxOptions':{'binary':'/tmp/imewl-firefox/Firefox.app/Contents/MacOS/firefox','args':['-headless']}}}})
prefix='/session/'+session['sessionId']
def js(code,args=[]):return request('POST',prefix+'/execute/sync',{'script':code,'args':args})
def async_js(code,args=[]):return request('POST',prefix+'/execute/async',{'script':code,'args':args})
checks=[]
try:
    request('POST',prefix+'/timeouts',{'script':120000})
    request('POST',prefix+'/url',{'url':'https://dict.aipan.app/'})
    for _ in range(180):
        if js('return document.querySelector(".engine-status")?.textContent.includes("就绪")'):break
        time.sleep(.3)
    modules=json.loads((out/'client-modules.json').read_text())
    initialized=async_js('''const done=arguments[arguments.length-1]; (async()=>{const {Engine}=await import(arguments[0].engine);const {defaults}=await import(arguments[0].config);window.qaEngine=new Engine();window.qaDefaults=defaults;return await window.qaEngine.init();})().then(done,e=>done({error:e.message}));''',[modules])
    assert 'error' not in initialized,initialized
    def convert(data,frm,to,code='NoCode'):
        result=async_js('''const a=arguments[0],done=arguments[arguments.length-1];window.qaEngine.convert({files:[new File([new Uint8Array(a.data)],'fixture.txt')],from:a.from,to:a.to,mode:'merge',settings:{...structuredClone(window.qaDefaults),code:a.code},mapping:null},()=>{}).then(r=>done({errors:r.errors,outputs:r.outputs.map(o=>({...o,data:Array.from(o.data)}))}),e=>done({error:e.message}));''',[{'data':list(data),'from':frm,'to':to,'code':code}])
        assert 'error' not in result,result
        return result['outputs'][0]
    english=convert(b'hello\nworld\ncloudflare\n','word','bdsje')
    back=convert(bytes(english['data']),'bdsje','word')
    assert all(w in back['preview'] for w in ['hello','world','cloudflare'])
    checks.append({'id':'bdsje','entries':back['imported'],'status':'通过','detail':'ASCII 英文样本通过；中文不适用于该英文词库格式'})
    matrix=json.loads((out/'format-matrix.json').read_text())
    for row in matrix['matrix']:
        if row['id']=='bdsje':row.update(status='通过',source='三条 ASCII 英文词条',detail=checks[-1]['detail'])
    cases=[('sgpybin',(root/'imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverterCoreTest/Test/搜狗备份.bin').read_bytes(),'真实样本 搜狗备份.bin',30),('emoji','😀\t笑脸\n'.encode(),'按格式定义构建的最小文本样本（非独立真实样本）',1),('rimedb','zhong guo\t中国\t42\n'.encode(),'按格式定义构建的最小文本样本（非独立真实样本）',1)]
    for ident,data,source,expected in cases:
        result=convert(data,ident,'word');assert result['imported']==expected,result
        checks.append({'id':ident,'entries':expected,'status':'通过','source':source})
        for row in matrix['matrix']:
            if row['direction']=='导入' and row['id']==ident:row.update(status='通过',entries=expected,source=source,detail='')
    (out/'format-matrix-initial.json').write_text((out/'format-matrix.json').read_text())
    (out/'format-matrix.json').write_text(json.dumps(matrix,ensure_ascii=False,indent=2))
    (out/'followup-firefox.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
    print(json.dumps(checks,ensure_ascii=False),flush=True)
finally:request('DELETE',prefix)
