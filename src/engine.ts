import type {
  Capabilities,
  ConversionRequest,
  Output,
  Progress,
} from "./types";

export class Engine {
  private worker: Worker | null = null;
  private serial = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      progress?: (value: Progress) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private createWorker() {
    if (this.worker) return this.worker;
    const worker = new Worker(`${import.meta.env.BASE_URL}engine/worker.js`, {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      const entry = this.pending.get(data.id);
      if (!entry) return;
      if (data.type === "progress") {
        entry.progress?.(data.progress);
        return;
      }
      if (data.fatal) {
        this.reset(data.error || "引擎初始化失败，请重试。");
        return;
      }
      clearTimeout(entry.timer);
      this.pending.delete(data.id);
      if (data.error) entry.reject(new Error(data.error));
      else entry.resolve(data.result);
    };
    worker.onerror = () => {
      if (this.worker === worker) this.reset("转换引擎加载失败，请检查网络连接后重试。");
    };
    worker.onmessageerror = () => {
      if (this.worker === worker) this.reset("转换结果传输失败，请重试。");
    };
    this.worker = worker;
    return worker;
  }
  private send(
    type: string,
    payload: object = {},
    progress?: (value: Progress) => void,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(
        () => this.reset("引擎响应超时，请重试或使用更小的词库。"),
        type === "init" ? 120000 : 600000,
      );
      this.pending.set(id, { resolve, reject, progress, timer });
      try {
        this.createWorker().postMessage({ id, type, ...payload });
      } catch (error) {
        this.reset(
          error instanceof Error ? error.message : "无法启动转换引擎。",
        );
      }
    });
  }
  init(): Promise<Capabilities> {
    return this.send("init");
  }
  convert(
    request: ConversionRequest,
    progress: (value: Progress) => void,
  ): Promise<{ outputs: Output[]; errors: string[] }> {
    return this.send("convert", { request }, progress);
  }
  reset(reason = "已取消转换。") {
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.onmessageerror = null;
    }
    this.worker?.terminate();
    this.worker = null;
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
