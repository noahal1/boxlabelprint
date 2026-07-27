/**
 * zpl-renderer-js 封装模块
 * 使用外部 WASM 加载方式，初始化一次后复用
 */
import { init, zplToBase64Async } from 'zpl-renderer-js/external';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 初始化 ZPL 渲染引擎（只执行一次）
 */
export async function initZplRenderer(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // 开发模式从 Vite dev server 加载，生产模式从打包后的 public 加载
    const base = import.meta.env.BASE_URL || '/';
    const wasmUrl = `${base}zebrash.wasm`;

    await init({ wasmUrl });
    initialized = true;
  })();

  return initPromise;
}

/**
 * 将 ZPL 渲染为 Base64 PNG 图片
 * @param zpl ZPL 指令字符串
 * @param widthMm 标签宽度 (mm)
 * @param heightMm 标签高度 (mm)
 * @param dpmm 打印密度 (dots per mm, 默认 8)
 * @returns Base64 编码的 PNG 图片数据
 */
export async function renderZplToPng(
  zpl: string,
  widthMm: number = 100,
  heightMm: number = 75,
  dpmm: number = 8
): Promise<string> {
  await initZplRenderer();
  const base64 = await zplToBase64Async(zpl, widthMm, heightMm, dpmm, {
    grayscaleOutput: true,
  });
  return `data:image/png;base64,${base64}`;
}
