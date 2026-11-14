"""Real Firefox WebDriver smoke test. Start Geckodriver and pnpm dev first."""
from pathlib import Path
import base64
import hashlib
import json
import os
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
REPORT = Path(os.environ.get('REPORT_DIR', str(ROOT / "artifacts/verification")))
DOWNLOAD = REPORT / "firefox-downloads"
DOWNLOAD.mkdir(parents=True, exist_ok=True)
DRIVER = os.environ.get("WEBDRIVER_URL", "http://127.0.0.1:4458")
BINARY = os.environ.get("FIREFOX_BINARY", "/tmp/imewl-firefox/Firefox.app/Contents/MacOS/firefox")
BASE = os.environ.get("TEST_URL", "http://127.0.0.1:5173/zh-hans/")
checks = []


def request(method, path, data=None):
    req = urllib.request.Request(
        DRIVER + path, data=json.dumps(data).encode() if data is not None else None,
        method=method, headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return json.load(response)["value"]
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error


session = request("POST", "/session", {"capabilities": {"alwaysMatch": {
    "browserName": "firefox", "moz:firefoxOptions": {"binary": BINARY, "args": ["-headless"], "prefs": {
        "browser.download.folderList": 2, "browser.download.dir": str(DOWNLOAD),
        "browser.download.useDownloadDir": True,
        "browser.helperApps.neverAsk.saveToDisk": "application/octet-stream,application/zip",
    }},
}}})
PREFIX = "/session/" + session["sessionId"]


def js(script, args=None):
    return request("POST", PREFIX + "/execute/sync", {"script": script, "args": args or []})


def wait(script, timeout=90):
    start = time.monotonic()
    while time.monotonic() - start < timeout:
        value = js(script)
        if value:
            return value
        time.sleep(0.1)
    raise TimeoutError(script)


def record(name, **detail):
    checks.append({"name": name, "passed": True, **detail})
    print("PASS", name, flush=True)


def wait_download(path, reference):
    expected = reference.read_bytes()
    start = time.monotonic()
    while time.monotonic() - start < 30:
        if path.exists() and path.stat().st_size == len(expected) and not path.with_name(path.name + ".part").exists():
            assert path.read_bytes() == expected
            return
        time.sleep(0.1)
    raise TimeoutError(f"Download did not finish: {path}")


try:
    request("POST", PREFIX + "/url", {"url": BASE})
    wait('return document.querySelector(".engine-status")?.textContent.includes("就绪")')
    record("Firefox worker and WASM runtime startup", version=session["capabilities"]["browserVersion"])
    js('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("用示例试试看")).click()')
    js('document.querySelector(".desktop-action .convert-button").click()')
    wait('return !!document.querySelector(".output-file")')
    assert "导出 8 条" in js('return document.querySelector(".output-summary p").textContent')
    dest = DOWNLOAD / "示例词库.dict.yaml"
    dest.unlink(missing_ok=True)
    js('document.querySelector(".download-button").click()')
    wait_download(dest, REPORT / "demo.dict.yaml")
    record("Firefox TXT conversion and downloaded bytes match Chromium")
    if os.environ.get('EXTENDED_UI'):
        js('document.querySelector("#advanced").open=true')
        rank_input=request('POST',PREFIX+'/element',{'using':'css selector','value':'input[placeholder="原词频"]'})['element-6066-11e4-a52e-4f735466cecf']
        request('POST',PREFIX+'/element/'+rank_input+'/value',{'text':'42'})
        js('document.querySelector(".desktop-action .convert-button").click()')
        wait('return !!document.querySelector(".output-file")')
        assert '\t42' in js('return document.querySelector(".preview pre").textContent')
        record('Advanced form: fixed frequency input changes actual output')
        js('Array.from(document.querySelectorAll("#advanced button")).find(e=>e.textContent.includes("重置")).click()')
        js('document.querySelector(".desktop-action .convert-button").click()')
        wait('return !!document.querySelector(".output-file")')
        assert '没有导出词条' in js('return document.querySelector("#results").textContent')
        record('Advanced reset and zero-entry warning')
        oversized=REPORT/'oversized-validation.txt'
        with oversized.open('wb') as file: file.truncate(51*1024*1024)
        element=request('POST',PREFIX+'/element',{'using':'css selector','value':'input[aria-label="选择词库文件"]'})['element-6066-11e4-a52e-4f735466cecf']
        request('POST',PREFIX+'/element/'+element+'/value',{'text':str(oversized)})
        assert '50 MB' in js('return document.querySelector(".error-panel").textContent')
        assert js('return document.querySelectorAll(".file-list li").length')==1
        record('Over-50MiB input rejected before conversion')
        oversized.unlink()
        js('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="清空").click()')
        js('document.querySelector(".desktop-action .convert-button").click()')
        assert '请先选择词库文件' in js('return document.querySelector(".error-panel").textContent')
        assert js('return document.activeElement.id')=='conversion-error'
        record('Empty input validation and focused error')
        js('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.includes("用示例试试看")).click()')
    js('Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="清空").click()')
    file_input = request("POST", PREFIX + "/element", {"using": "css selector", "value": 'input[aria-label="选择词库文件"]'})["element-6066-11e4-a52e-4f735466cecf"]
    fixture = ROOT / "imewlconverter-wasm/upstream/imewlconverter/src/ImeWlConverterCoreTest/Test/唐诗300首【官方推荐】.scel"
    request("POST", PREFIX + "/element/" + file_input + "/value", {"text": str(fixture)})
    assert "scel" in js('return document.querySelector(".format-picker input").value')
    js('document.querySelector(".desktop-action .convert-button").click()')
    wait('return !!document.querySelector(".output-file")')
    assert "3,563" in js('return document.querySelector(".output-summary p").textContent')
    dest = DOWNLOAD / "唐诗300首【官方推荐】.dict.yaml"
    dest.unlink(missing_ok=True)
    js('document.querySelector(".download-button").click()')
    wait_download(dest, REPORT / "ui-scel.dict.yaml")
    record("Firefox SCEL picker, conversion and downloaded bytes", entries=3563, sha256=hashlib.sha256(dest.read_bytes()).hexdigest())
    for width in [375, 768, 1024, 1440]:
        request("POST", PREFIX + "/window/rect", {"width": width, "height": 1000})
        assert js("return document.documentElement.scrollWidth <= innerWidth")
        record("Firefox responsive layout", width=js("return innerWidth"))
    screenshot = request("GET", PREFIX + "/screenshot")
    (REPORT / "firefox-result.png").write_bytes(base64.b64decode(screenshot))
    (REPORT / "firefox-results.json").write_text(json.dumps({"browser": "Firefox", "checks": checks}, ensure_ascii=False, indent=2))
finally:
    request("DELETE", PREFIX)
