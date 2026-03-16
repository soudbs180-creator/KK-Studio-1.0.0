const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      "./tauriDownloader-BG3Xb0u0.js",
      "./vendor-DXn3GjvW.js",
      "./jszip-CXr7zspi.js",
      "./index-CgWMCHZL.js",
      "./react-vendor-BdR1mPDY.js",
      "./icons-JEGxNKJM.js",
      "./index-BYSgAgk4.css",
      "./memoryMonitor-CM3ZHV5J.js",
      "./nodeCleanup-3c9JKgtG.js",
    ]),
) => i.map((i) => d[i]);
var e,
  t,
  o,
  i,
  r,
  a,
  s,
  l,
  c,
  d = Object.defineProperty,
  u = (e, key, value) =>
    ((e, key, value) =>
      key in e
        ? d(e, key, {
            enumerable: !0,
            configurable: !0,
            writable: !0,
            value: value,
          })
        : (e[key] = value))(e, "symbol" != typeof key ? key + "" : key, value);
import { r as g, j as m } from "./react-vendor-BdR1mPDY.js";
import {
  a as invoke,
  r as h,
  m as p,
  w as writeTextFile,
  b as f,
  c as w,
  o as open,
  l as y,
  f as v,
  p as b,
  B as _,
} from "./vendor-DXn3GjvW.js";
import { C as I, X as S, A as j, F as A } from "./icons-JEGxNKJM.js";
const P = {},
  x = function (e, t, o) {
    let i = Promise.resolve();
    if (t && t.length > 0) {
      let e = function (e) {
        return Promise.all(
          e.map((e) =>
            Promise.resolve(e).then(
              (value) => ({ status: "fulfilled", value: value }),
              (e) => ({ status: "rejected", reason: e }),
            ),
          ),
        );
      };
      const r = document.getElementsByTagName("link"),
        a = document.querySelector("meta[property=csp-nonce]"),
        s =
          (null == a ? void 0 : a.nonce) ||
          (null == a ? void 0 : a.getAttribute("nonce"));
      i = e(
        t.map((e) => {
          if (
            ((e = (function (e, t) {
              return new URL(e, t).href;
            })(e, o)),
            e in P)
          )
            return;
          P[e] = !0;
          const t = e.endsWith(".css"),
            i = t ? '[rel="stylesheet"]' : "";
          if (!!o)
            for (let o = r.length - 1; o >= 0; o--) {
              const i = r[o];
              if (i.href === e && (!t || "stylesheet" === i.rel)) return;
            }
          else if (document.querySelector(`link[href="${e}"]${i}`)) return;
          const a = document.createElement("link");
          return (
            (a.rel = t ? "stylesheet" : "modulepreload"),
            t || (a.as = "script"),
            (a.crossOrigin = ""),
            (a.href = e),
            s && a.setAttribute("nonce", s),
            document.head.appendChild(a),
            t
              ? new Promise((t, o) => {
                  (a.addEventListener("load", t),
                    a.addEventListener("error", () =>
                      o(new Error(`Unable to preload CSS for ${e}`)),
                    ));
                })
              : void 0
          );
        }),
      );
    }
    function r(e) {
      const t = new Event("vite:preloadError", { cancelable: !0 });
      if (((t.payload = e), window.dispatchEvent(t), !t.defaultPrevented))
        throw e;
    }
    return i.then((t) => {
      for (const e of t || []) "rejected" === e.status && r(e.reason);
      return e().catch(r);
    });
  },
  k = [
    {
      id: "comfly",
      name: "Comfly AI",
      baseUrl: "https://ai.comfly.chat",
      description: "默认 API 端点",
      isDefault: !0,
    },
    {
      id: "t8star",
      name: "T8Star",
      baseUrl: "https://ai.t8star.cn",
      description: "备用 API 端点",
    },
    {
      id: "midjourney",
      name: "Midjourney",
      baseUrl: "https://api.midjourney.com",
      description: "Midjourney 官方",
    },
    {
      id: "custom",
      name: "自定义",
      baseUrl: "",
      description: "用户自定义端点",
    },
  ],
  T = "https://ai.comfly.chat",
  $ = "https://generativelanguage.googleapis.com",
  M = {
    API_BASE_URL: "http://localhost:5100",
    SESSION_STORAGE_KEY: "qiaodoumayi_jimeng_session_id",
    USE_LOCAL_FILE_KEY: "qiaodoumayi_jimeng_use_local_file",
  },
  C = { SERVER_URL: "http://127.0.0.1:9528", PING_INTERVAL: 3e4 },
  U = [
    "gemini-image",
    "qwen-image",
    "doubao-seedream",
    "jimeng",
    "kling-v1-6",
    "wan-2.5",
    "google-veo3.1",
  ],
  O = ["Auto", "1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "3:2", "2:3"],
  E = ["3:2", "2:3", "1:1"],
  L = ["Auto", "1:1", "16:9", "9:16", "3:2", "2:3"],
  R = ["Auto", "1K", "2K", "4K"],
  N = [
    { label: "MJ V7", value: "--v 7" },
    { label: "MJ V6.1", value: "--v 6.1" },
    { label: "MJ V6", value: "--v 6" },
    { label: "MJ V5.2", value: "--v 5.2" },
    { label: "MJ V5.1", value: "--v 5.1" },
    { label: "Niji V7", value: "--niji 7" },
    { label: "Niji V6", value: "--niji 6" },
    { label: "Niji V5", value: "--niji 5" },
    { label: "Niji V4", value: "--niji 4" },
  ],
  D = [
    { label: "v3.0", value: "suno-v3.0" },
    { label: "v3.5", value: "suno-v3.5" },
    { label: "v4", value: "suno-v4" },
    { label: "v4.5", value: "suno-v4.5" },
    { label: "v4.5+", value: "suno-v4.5+" },
    { label: "v5", value: "suno-v5" },
  ],
  F = [
    {
      id: "gemini-3-pro",
      provider: "Gemini 3 Pro",
      modelName: "gemini-3-pro-preview",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gemini-3.1-pro",
      provider: "Gemini 3.1 Pro",
      modelName: "gemini-3.1-pro-preview",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gemini-3-flash-thinking",
      provider: "Gemini 3 Flash Thinking",
      modelName: "gemini-3-flash-preview-thinking-128",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gemini-3.1-flash-lite-preview",
      provider: "Gemini 3.1 Flash Lite",
      modelName: "gemini-3.1-flash-lite-preview",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gpt-5-1",
      provider: "GPT 5.1",
      modelName: "gpt-5.1",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gpt-5-2",
      provider: "GPT 5.2",
      modelName: "gpt-5.2",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gpt-5-3-codex",
      provider: "GPT 5.3",
      modelName: "gpt-5.3-codex",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gpt-5.4",
      provider: "GPT 5.4",
      modelName: "gpt-5.4",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gpt-5.4-pro",
      provider: "GPT 5.4 Pro",
      modelName: "gpt-5.4-pro",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "deepseek-v3",
      provider: "DeepSeek V3",
      modelName: "deepseek-v3-1-250821-thinking",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "gpt-4o",
      provider: "GPT-4o",
      modelName: "gpt-4o",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "claude-opus-4-5",
      provider: "Claude 4.5",
      modelName: "claude-opus-4-5-20251101-thinking",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "claude-opus-4-6",
      provider: "Claude 4.6",
      modelName: "claude-opus-4-6",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "kimi-k2.5",
      provider: "Kimi K2.5",
      modelName: "kimi-k2.5",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "grok-4",
      provider: "Grok 4",
      modelName: "grok-4",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "grok-4-fast-non-reasoning",
      provider: "Grok 4 Fast",
      modelName: "grok-4-fast-non-reasoning",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "minimax-m2.5-highspeed",
      provider: "MiniMax M2.5 Highspeed",
      modelName: "MiniMax-M2.5-highspeed",
      type: "Chat",
      key: "",
      url: T,
    },
    {
      id: "nano-banana",
      provider: "Nano Banana",
      modelName: "nano-banana",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "nano-banana-2",
      provider: "Nano Banana Pro",
      modelName: "nano-banana-2",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "gemini-3.1-flash-image-preview",
      provider: "Nano Banana 2",
      modelName: "gemini-3.1-flash-image-preview",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "gemini-3.1-flash-image-official",
      provider: "Gemini 3.1 Flash Image 官",
      modelName: "gemini-3.1-flash-image-preview",
      type: "Image",
      key: "",
      url: $,
    },
    {
      id: "gemini-3-pro-image-official",
      provider: "Gemini 3 Pro Image 官",
      modelName: "gemini-3-pro-image-preview",
      type: "Image",
      key: "",
      url: $,
    },
    {
      id: "gemini-2.5-flash-image-official",
      provider: "Gemini 2.5 Flash Image 官",
      modelName: "gemini-2.5-flash-image",
      type: "Image",
      key: "",
      url: $,
    },
    {
      id: "gpt-image",
      provider: "GPT-4o Image",
      modelName: "gpt-4o-image",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "gpt-image-1.5",
      provider: "GPT Image 1.5",
      modelName: "gpt-image-1.5",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "flux-kontext",
      provider: "Flux Kontext",
      modelName: "flux-kontext-pro",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "grok-4.1-image",
      provider: "Grok 4.1 Image",
      modelName: "grok-4.1-image",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "grok-4.2-image",
      provider: "Grok 4.2 Image",
      modelName: "grok-4.2-image",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "z-image-official",
      provider: "Z-Image Official",
      modelName: "z-image-turbo",
      type: "Image",
      key: "",
      url: "http://127.0.0.1:9527/api/proxy",
      resolutions: [
        "1024*1024",
        "1024*1536",
        "1536*1024",
        "1280*720",
        "720*1280",
        "1120*1440",
        "1440*1120",
        "864*1536",
        "1536*864",
      ],
    },
    {
      id: "z-image-turbo",
      provider: "Z-Image Turbo (第三方)",
      modelName: "z-image-turbo",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "mj-v6",
      provider: "Midjourney",
      modelName: "MJ V6",
      type: "Image",
      key: "",
      url: T,
    },
    {
      id: "jimeng-5.0",
      provider: "Jimeng 5.0",
      modelName: "jimeng-5.0",
      type: "Image",
      key: "",
      url: M.API_BASE_URL,
    },
    {
      id: "jimeng-4.6",
      provider: "Jimeng 4.6",
      modelName: "jimeng-4.6",
      type: "Image",
      key: "",
      url: M.API_BASE_URL,
    },
    {
      id: "jimeng-4.5",
      provider: "Jimeng 4.5",
      modelName: "jimeng-4.5",
      type: "Image",
      key: "",
      url: M.API_BASE_URL,
    },
    {
      id: "jimeng-4.1",
      provider: "Jimeng 4.1",
      modelName: "jimeng-4.1",
      type: "Image",
      key: "",
      url: M.API_BASE_URL,
    },
    {
      id: "jimeng-4.0",
      provider: "Jimeng 4.0",
      modelName: "jimeng-4.0",
      type: "Image",
      key: "",
      url: M.API_BASE_URL,
    },
    {
      id: "jimeng-3.1",
      provider: "Jimeng 3.1",
      modelName: "jimeng-3.1",
      type: "Image",
      key: "",
      url: M.API_BASE_URL,
    },
    {
      id: "wan-2.6-image-official",
      provider: "Wan 2.6 Image Official",
      modelName: "wan2.6-image",
      type: "Image",
      key: "",
      url: "http://127.0.0.1:9527/api/proxy",
      resolutions: [
        "1280*1280",
        "1024*1024",
        "800*1200",
        "1200*800",
        "960*1280",
        "1280*960",
        "720*1280",
        "1280*720",
        "1344*576",
      ],
    },
    {
      id: "seedream-4.5",
      provider: "Seedream 4.5",
      modelName: "doubao-seedream-4-5-251128",
      type: "Image",
      key: "",
      url: "http://127.0.0.1:9530",
    },
    {
      id: "seedream-4.0",
      provider: "Seedream 4.0",
      modelName: "doubao-seedream-4-0-250828",
      type: "Image",
      key: "",
      url: "http://127.0.0.1:9530",
    },
    {
      id: "sora-2",
      provider: "Sora 2",
      modelName: "sora-2",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s", "15s"],
      resolutions: ["720P", "1080P", "2K", "4K"],
    },
    {
      id: "sora-2-pro",
      provider: "Sora 2 Pro",
      modelName: "sora-2-pro",
      type: "Video",
      key: "",
      url: T,
      durations: ["10s", "15s", "25s"],
      resolutions: ["720P", "1080P", "2K", "4K"],
    },
    {
      id: "google-veo3",
      provider: "Google Veo 3.1",
      modelName: "veo3.1-components",
      type: "Video",
      key: "",
      url: T,
      durations: ["8s"],
      resolutions: ["720P", "4K"],
    },
    {
      id: "google-veo3.1-pro",
      provider: "Google Veo 3.1 Pro",
      modelName: "veo3.1-pro",
      type: "Video",
      key: "",
      url: T,
      durations: ["8s"],
      resolutions: ["720P", "1080P", "4K"],
    },
    {
      id: "google-veo3.1-fast",
      provider: "Google Veo 3.1 Fast",
      modelName: "veo3.1-fast",
      type: "Video",
      key: "",
      url: T,
      durations: ["8s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "grok-3",
      provider: "Grok3 Video",
      modelName: "grok-video-3",
      type: "Video",
      key: "",
      url: T,
      durations: ["15s", "10s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "jimeng-video-3.0",
      provider: "Jimeng Video 3.0",
      modelName: "jimeng-video-3.0",
      type: "Video",
      key: "",
      url: M.API_BASE_URL,
      durations: ["5s", "10s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "jimeng-video-3.0-fast",
      provider: "Jimeng Video 3.0 Fast",
      modelName: "jimeng-video-3.0-fast",
      type: "Video",
      key: "",
      url: M.API_BASE_URL,
      durations: ["5s", "10s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "jimeng-video-3.0-pro",
      provider: "Jimeng Video 3.0 Pro",
      modelName: "jimeng-video-3.0-pro",
      type: "Video",
      key: "",
      url: M.API_BASE_URL,
      durations: ["5s", "10s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "jimeng-video-3.5-pro",
      provider: "Jimeng Video 3.5 Pro",
      modelName: "jimeng-video-3.5-pro",
      type: "Video",
      key: "",
      url: M.API_BASE_URL,
      durations: ["5s", "10s", "12s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "jimeng-video-seedance-2.0",
      provider: "Jimeng Seedance 2.0",
      modelName: "jimeng-video-seedance-2.0",
      type: "Video",
      key: "",
      url: M.API_BASE_URL,
      durations: [
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
        "13s",
        "14s",
        "15s",
      ],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "jimeng-video-seedance-2.0-fast",
      provider: "Jimeng Seedance 2.0 Fast",
      modelName: "jimeng-video-seedance-2.0-fast",
      type: "Video",
      key: "",
      url: M.API_BASE_URL,
      durations: [
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
        "13s",
        "14s",
        "15s",
      ],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "hailuo-2.3",
      provider: "Hailuo 2.3",
      modelName: "MiniMax-Hailuo-2.3",
      type: "Video",
      key: "",
      url: T,
      durations: ["6s", "10s"],
      resolutions: ["768P", "1080P"],
    },
    {
      id: "hailuo-2.3-fast",
      provider: "Hailuo 2.3-Fast",
      modelName: "MiniMax-Hailuo-2.3-Fast",
      type: "Video",
      key: "",
      url: T,
      durations: ["6s", "10s"],
      resolutions: ["768P", "1080P"],
    },
    {
      id: "hailuo-2.0",
      provider: "Hailuo 2.0",
      modelName: "MiniMax-Hailuo-02",
      type: "Video",
      key: "",
      url: T,
      durations: ["6s", "10s"],
      resolutions: ["512P", "768P", "1080P"],
    },
    {
      id: "wan-2.6",
      provider: "Wan 2.6",
      modelName: "wan2.6-i2v",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s", "15s"],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "wan-2.6-official",
      provider: "Wan 2.6 Official",
      modelName: "wan2.6-i2v-flash",
      type: "Video",
      key: "",
      url: "http://127.0.0.1:9527/api/proxy",
      durations: [
        "2s",
        "3s",
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
        "13s",
        "14s",
        "15s",
      ],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "seedance-1.5-pro",
      provider: "Seedance 1.5 pro",
      modelName: "doubao-seedance-1-5-pro-251215",
      type: "Video",
      key: "",
      url: "http://127.0.0.1:9530",
      durations: ["4s", "5s", "6s", "7s", "8s", "9s", "10s", "11s", "12s"],
      resolutions: ["480P", "720P", "1080P"],
    },
    {
      id: "seedance-1-0-pro",
      provider: "Seedance 1.0 pro",
      modelName: "doubao-seedance-1-0-pro-250528",
      type: "Video",
      key: "",
      url: "http://127.0.0.1:9530",
      durations: [
        "2s",
        "3s",
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
      ],
      resolutions: ["480P", "720P", "1080P"],
    },
    {
      id: "seedance-1-0-pro-fast",
      provider: "Seedance 1.0 pro fast",
      modelName: "doubao-seedance-1-0-pro-fast-251015",
      type: "Video",
      key: "",
      url: "http://127.0.0.1:9530",
      durations: [
        "2s",
        "3s",
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
      ],
      resolutions: ["480P", "720P", "1080P"],
    },
    {
      id: "seedance-1-0-lite-t2v",
      provider: "Seedance 1.0 lite (文生)",
      modelName: "doubao-seedance-1-0-lite-t2v-250428",
      type: "Video",
      key: "",
      url: "http://127.0.0.1:9530",
      durations: [
        "2s",
        "3s",
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
      ],
      resolutions: ["480P", "720P", "1080P"],
    },
    {
      id: "seedance-1-0-lite-i2v",
      provider: "Seedance 1.0 lite (图生)",
      modelName: "doubao-seedance-1-0-lite-i2v-250428",
      type: "Video",
      key: "",
      url: "http://127.0.0.1:9530",
      durations: [
        "2s",
        "3s",
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
      ],
      resolutions: ["480P", "720P", "1080P"],
    },
    {
      id: "kling-o1",
      provider: "Kling O1",
      modelName: "kling-video-o1",
      type: "Video",
      key: "",
      url: T,
      durations: ["3s", "4s", "5s", "6s", "7s", "8s", "9s", "10s"],
      resolutions: ["720p", "1080p"],
    },
    {
      id: "kling-v2-5-turbo",
      provider: "Kling v2.5 Turbo",
      modelName: "kling-v2-5-turbo",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s"],
      resolutions: ["std", "pro"],
    },
    {
      id: "kling-video-v2-6",
      provider: "Kling v2.6",
      modelName: "kling-v2-6",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s"],
      resolutions: ["std", "pro"],
    },
    {
      id: "kling-v3",
      provider: "Kling 3.0",
      modelName: "kling-v3",
      type: "Video",
      key: "",
      url: T,
      durations: [
        "3s",
        "4s",
        "5s",
        "6s",
        "7s",
        "8s",
        "9s",
        "10s",
        "11s",
        "12s",
        "13s",
        "14s",
        "15s",
      ],
      resolutions: ["720P", "1080P"],
    },
    {
      id: "vidu-q2",
      provider: "Vidu Q2",
      modelName: "viduq2-pro",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s"],
      resolutions: ["360p", "540p", "720p", "1080p"],
    },
    {
      id: "vidu-q2-turbo",
      provider: "Vidu Q2 Turbo",
      modelName: "viduq2-turbo",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s"],
      resolutions: ["360p", "540p", "720p", "1080p"],
    },
    {
      id: "vidu-2.0",
      provider: "Vidu 2.0",
      modelName: "vidu2.0",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s"],
      resolutions: ["360p", "540p", "720p", "1080p"],
    },
    {
      id: "vidu-q3-pro",
      provider: "Vidu Q3 Pro",
      modelName: "viduq3-pro",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s", "10s"],
      resolutions: ["360p", "540p", "720p", "1080p"],
    },
    {
      id: "mj-video",
      provider: "MJ Video",
      modelName: "mj-video",
      type: "Video",
      key: "",
      url: T,
      durations: ["5s"],
    },
    {
      id: "suno-v3.0",
      provider: "Suno v3.0",
      modelName: "suno-v3.0",
      type: "Music",
      key: "",
      url: T,
    },
    {
      id: "suno-v3.5",
      provider: "Suno v3.5",
      modelName: "suno-v3.5",
      type: "Music",
      key: "",
      url: T,
    },
    {
      id: "suno-v4",
      provider: "Suno v4",
      modelName: "suno-v4",
      type: "Music",
      key: "",
      url: T,
    },
    {
      id: "suno-v4.5",
      provider: "Suno v4.5",
      modelName: "suno-v4.5",
      type: "Music",
      key: "",
      url: T,
    },
    {
      id: "suno-v4.5+",
      provider: "Suno v4.5+",
      modelName: "suno-v4.5+",
      type: "Music",
      key: "",
      url: T,
    },
    {
      id: "suno-v5",
      provider: "Suno v5",
      modelName: "suno-v5",
      type: "Music",
      key: "",
      url: T,
    },
  ],
  W = [
    "Auto",
    "1:1",
    "1:4",
    "1:8",
    "2:3",
    "3:2",
    "3:4",
    "4:1",
    "4:3",
    "4:5",
    "5:4",
    "8:1",
    "9:16",
    "16:9",
    "21:9",
  ],
  z = [
    "Auto",
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
  ];
function B(modelId) {
  return modelId
    ? "grok-4.1-image" === modelId || "grok-4.2-image" === modelId
      ? L
      : modelId.includes("grok")
        ? E
        : "gemini-3.1-flash-image-preview" === modelId ||
            "gemini-3.1-flash-image-official" === modelId
          ? W
          : "gemini-3-pro-image-official" === modelId ||
              "gemini-2.5-flash-image-official" === modelId
            ? z
            : O
    : O;
}
function G(modelId, duration) {
  return modelId
    ? modelId.includes("sora-2")
      ? []
      : modelId.includes("jimeng-5.0") ||
          modelId.includes("jimeng-4.6") ||
          modelId.includes("jimeng-4.5")
        ? ["2K", "4K"]
        : "jimeng-video-3.5-pro" === modelId ||
            "jimeng-video-3.0-pro" === modelId ||
            "jimeng-video-3.0-fast" === modelId ||
            "jimeng-video-3.0" === modelId ||
            "jimeng-video-seedance-2.0" === modelId ||
            "jimeng-video-seedance-2.0-fast" === modelId
          ? ["720P", "1080P"]
          : "grok-4.1-image" === modelId || "grok-4.2-image" === modelId
            ? []
            : modelId.includes("grok")
              ? ["1080P", "720P"]
              : oe(modelId)
                ? ["720P", "1080P", "4K"]
                : ne(modelId)
                  ? ["720P", "1080P"]
                  : q(modelId) && !oe(modelId)
                    ? ["720P", "1080P", "4K"]
                    : "hailuo-2.0" === modelId
                      ? ["512P", "768P", "1080P"]
                      : "hailuo-2.3" === modelId ||
                          "hailuo-2.3-fast" === modelId
                        ? ["768P", "1080P"]
                        : ge(modelId)
                          ? ["720P", "1080P"]
                          : Q(modelId)
                            ? ["480P", "720P", "1080P"]
                            : ae(modelId)
                              ? ["720p", "1080p"]
                              : se(modelId) || le(modelId)
                                ? ["std", "pro"]
                                : ce(modelId)
                                  ? ["720P", "1080P"]
                                  : de(modelId)
                                    ? "vidu-q3-pro" === modelId ||
                                      "vidu-q2" === modelId ||
                                      "vidu-q2-turbo" === modelId
                                      ? ["540p", "720p", "1080p"]
                                      : "vidu-2.0" === modelId
                                        ? "8s" === duration
                                          ? ["720p"]
                                          : ["360p", "720p", "1080p"]
                                        : ["540p", "720p", "1080p"]
                                    : "z-image-official" === modelId
                                      ? []
                                      : "gemini-3.1-flash-image-preview" ===
                                            modelId ||
                                          "gemini-3.1-flash-image-official" ===
                                            modelId
                                        ? ["Auto", "512px", "1K", "2K", "4K"]
                                        : "gemini-3-pro-image-official" ===
                                            modelId
                                          ? ["Auto", "1K", "2K", "4K"]
                                          : "gemini-2.5-flash-image-official" ===
                                              modelId
                                            ? ["Auto"]
                                            : "seedream-4.5" === modelId ||
                                                "seedream-4.5-api" === modelId
                                              ? ["2K", "4K"]
                                              : "seedream-4.0" === modelId ||
                                                  "seedream-4.0-api" === modelId
                                                ? ["1K", "2K", "4K"]
                                                : R
    : R;
}
function J(modelId) {
  return !!modelId && modelId.includes("jimeng-video");
}
function V(modelId) {
  return (
    !!modelId &&
    ("jimeng-video-seedance-2.0" === modelId ||
      "jimeng-video-seedance-2.0-fast" === modelId)
  );
}
function K(modelId, e) {
  if (!modelId) return ["5s", "10s", "15s"];
  if (ae(modelId)) return ["3s", "4s", "5s", "6s", "7s", "8s", "9s", "10s"];
  if (se(modelId)) return ["5s", "10s"];
  if (le(modelId)) return ["5s", "10s"];
  if (ce(modelId))
    return [
      "3s",
      "4s",
      "5s",
      "6s",
      "7s",
      "8s",
      "9s",
      "10s",
      "11s",
      "12s",
      "13s",
      "14s",
      "15s",
    ];
  if ("hailuo-2.3" === modelId || "hailuo-2.3-fast" === modelId)
    return "1080P" === e ? ["6s"] : ["6s", "10s"];
  if ("hailuo-2.0" === modelId) return "1080P" === e ? ["6s"] : ["6s", "10s"];
  if ("vidu-q3-pro" === modelId)
    return [
      "1s",
      "2s",
      "3s",
      "4s",
      "5s",
      "6s",
      "7s",
      "8s",
      "9s",
      "10s",
      "11s",
      "12s",
      "13s",
      "14s",
      "15s",
      "16s",
    ];
  if ("vidu-q2" === modelId || "vidu-q2-turbo" === modelId)
    return ["1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s", "10s"];
  if ("vidu-2.0" === modelId) return ["4s", "8s"];
  const t = F.find((e) => e.id === modelId);
  return (null == t ? void 0 : t.durations)
    ? t.durations
    : "jimeng-video-3.0" === modelId ||
        "jimeng-video-3.0-fast" === modelId ||
        "jimeng-video-3.0-pro" === modelId
      ? ["5s", "10s"]
      : "jimeng-video-3.5-pro" === modelId
        ? ["5s", "10s", "12s"]
        : "jimeng-video-seedance-2.0" === modelId ||
            "jimeng-video-seedance-2.0-fast" === modelId
          ? [
              "4s",
              "5s",
              "6s",
              "7s",
              "8s",
              "9s",
              "10s",
              "11s",
              "12s",
              "13s",
              "14s",
              "15s",
            ]
          : modelId.includes("sora-2-pro")
            ? ["15s", "25s"]
            : modelId.includes("sora")
              ? ["5s", "10s", "15s"]
              : modelId.includes("veo")
                ? ["8s"]
                : modelId.includes("grok")
                  ? ["15s", "10s"]
                  : modelId.startsWith("hailuo-")
                    ? ["6s", "10s"]
                    : ge(modelId)
                      ? ["5s", "10s", "15s"]
                      : "seedance-1.5-pro" === modelId ||
                          "seedance-1.5-pro-api" === modelId
                        ? [
                            "4s",
                            "5s",
                            "6s",
                            "7s",
                            "8s",
                            "9s",
                            "10s",
                            "11s",
                            "12s",
                          ]
                        : X(modelId)
                          ? ["5s", "10s"]
                          : Q(modelId)
                            ? [
                                "2s",
                                "3s",
                                "4s",
                                "5s",
                                "6s",
                                "7s",
                                "8s",
                                "9s",
                                "10s",
                                "11s",
                                "12s",
                              ]
                            : ["5s", "10s", "15s"];
}
function H(modelId) {
  return K(modelId)[0] || "5s";
}
function q(modelId) {
  return (
    !!modelId && (modelId.includes("veo3") || modelId.includes("google-veo"))
  );
}
function Z(modelId) {
  return !!modelId && modelId.includes("grok");
}
function Q(modelId) {
  return !!modelId && modelId.includes("seedance");
}
function X(modelId) {
  return !!modelId && modelId.includes("seedance") && modelId.endsWith("-api");
}
function Y(modelId) {
  if (!modelId) return !1;
  const e = modelId.replace(/-api$/, "");
  return (
    "seedance-1.5-pro" === e ||
    "seedance-1-0-pro" === e ||
    "seedance-1-0-lite-i2v" === e
  );
}
function ee(modelId) {
  return (
    !!modelId &&
    ("seedance-1.5-pro" === modelId || "seedance-1.5-pro-api" === modelId)
  );
}
function te(modelId) {
  return !!modelId && modelId.startsWith("seedream-");
}
function oe(modelId) {
  return (
    !!modelId &&
    (modelId.includes("veo3.1-pro") || modelId.includes("google-veo3.1-pro"))
  );
}
function ne(modelId) {
  return (
    !!modelId &&
    (modelId.includes("veo3.1-fast") || modelId.includes("google-veo3.1-fast"))
  );
}
function ie(modelId) {
  return (
    q(modelId) ||
    (function (modelId) {
      return !!modelId && "hailuo-2.0" === modelId;
    })(modelId) ||
    J(modelId) ||
    se(modelId) ||
    le(modelId) ||
    ce(modelId) ||
    (Q(modelId) && Y(modelId)) ||
    (de(modelId) &&
      (function (modelId) {
        return (
          !!modelId &&
          ("vidu-q2" === modelId ||
            "vidu-q2-turbo" === modelId ||
            "vidu-2.0" === modelId)
        );
      })(modelId))
  );
}
function re(modelId) {
  return !!modelId && modelId.startsWith("hailuo-");
}
function ae(modelId) {
  return (
    !!modelId && (modelId.includes("kling-o1") || modelId.includes("kling_o1"))
  );
}
function se(modelId) {
  return (
    !!modelId &&
    (modelId.includes("kling-v2-5-turbo") ||
      modelId.includes("kling-video-v2-5-turbo"))
  );
}
function le(modelId) {
  return (
    !!modelId &&
    (modelId.includes("kling-video-v2-6") || modelId.includes("kling-v2-6"))
  );
}
function ce(modelId) {
  return !!modelId && ("kling-v3" === modelId || modelId.includes("kling-v3"));
}
function de(modelId) {
  return (
    !!modelId &&
    ("vidu-q2" === modelId ||
      "vidu-q2-turbo" === modelId ||
      "vidu-2.0" === modelId ||
      "vidu-q3-pro" === modelId)
  );
}
function ue(modelId) {
  return !!modelId && "mj-video" === modelId;
}
function ge(modelId) {
  return (
    !!modelId &&
    ("wan-2.6" === modelId ||
      "wan-2.6-official" === modelId ||
      "wan-2.6-image-official" === modelId ||
      modelId.includes("wan2.6"))
  );
}
function me(modelId) {
  return !!modelId && "wan-2.6-official" === modelId;
}
function he(modelId) {
  return !!modelId && "wan-2.6-image-official" === modelId;
}
function pe(modelId) {
  return !!modelId && "z-image-official" === modelId;
}
function fe(modelId) {
  return (
    !!modelId &&
    ("gemini-3.1-flash-image-official" === modelId ||
      "gemini-3-pro-image-official" === modelId ||
      "gemini-2.5-flash-image-official" === modelId)
  );
}
const we = {
    API_CONFIGS: "qiaodoumayi_api_configs",
    GLOBAL_KEY: "qiaodoumayi_global_key",
    GLOBAL_BASE_URL: "qiaodoumayi_global_base_url",
    ACTIVE_ENDPOINT: "qiaodoumayi_active_endpoint",
    JIMENG_SESSION: M.SESSION_STORAGE_KEY,
    JIMENG_USE_LOCAL: M.USE_LOCAL_FILE_KEY,
    JIMENG_SUPER_RESOLUTION_URL: "qiaodoumayi_jimeng_super_resolution_url",
    JIMENG_SUPER_RESOLUTION_API_KEY:
      "qiaodoumayi_jimeng_super_resolution_api_key",
  },
  ye = class e {
    constructor() {
      (u(this, "configs", []),
        u(this, "globalApiKey", ""),
        u(this, "globalBaseUrl", ""),
        u(this, "activeEndpointId", "comfly"),
        u(this, "jimengSessionId", ""),
        u(this, "jimengUseLocalFile", !0),
        u(this, "jimengSuperResUrl", ""),
        u(this, "jimengSuperResApiKey", ""),
        u(this, "listeners", new Set()),
        this.loadFromStorage());
    }
    loadFromStorage() {
      try {
        const e = localStorage.getItem(we.API_CONFIGS);
        let t = e ? JSON.parse(e) : [...F];
        ((t = t.filter((e) => !U.includes(e.id))),
          (t = this.ensureDefaultModels(t)),
          (this.jimengSessionId =
            localStorage.getItem(we.JIMENG_SESSION) || ""),
          (t = t.map((e) =>
            this.isJimengConfig(e) ? { ...e, key: this.jimengSessionId } : e,
          )));
        const { configs: o, hasChanges: i } = this.fixBaseUrls(t);
        ((t = o),
          (this.configs = t),
          i && this.saveConfigsOnly(t),
          (this.globalApiKey = localStorage.getItem(we.GLOBAL_KEY) || ""),
          (this.globalBaseUrl = localStorage.getItem(we.GLOBAL_BASE_URL) || T),
          (t = t.map((e) => {
            if (
              "z-image-official" === e.id ||
              "wan-2.6-official" === e.id ||
              "wan-2.6-image-official" === e.id
            )
              return { ...e, url: "http://127.0.0.1:9527/api/proxy" };
            if (
              [
                "seedance-1.5-pro",
                "seedance-1-0-pro",
                "seedance-1-0-pro-fast",
                "seedance-1-0-lite-t2v",
                "seedance-1-0-lite-i2v",
              ].includes(e.id) ||
              ["seedream-4.5", "seedream-4.0"].includes(e.id)
            ) {
              const t = { url: "http://127.0.0.1:9530" };
              return (
                "seedream-4.5" === e.id &&
                  (t.modelName = "doubao-seedream-4-5-251128"),
                "seedream-4.0" === e.id &&
                  (t.modelName = "doubao-seedream-4-0-250828"),
                { ...e, ...t }
              );
            }
            return e;
          })),
          (this.configs = t),
          this.saveConfigsOnly(t),
          this.globalBaseUrl &&
            this.globalBaseUrl !== T &&
            ((t = t.map((e) => {
              if (
                [
                  "jimeng-5.0",
                  "jimeng-4.6",
                  "jimeng-4.5",
                  "jimeng-4.1",
                  "jimeng-3.1",
                ].includes(e.id)
              )
                return e;
              return "wan-2.6-official" === e.id ||
                "wan-2.6-image-official" === e.id ||
                "z-image-official" === e.id ||
                [
                  "seedance-1.5-pro",
                  "seedance-1-0-pro",
                  "seedance-1-0-pro-fast",
                  "seedance-1-0-lite-t2v",
                  "seedance-1-0-lite-i2v",
                ].includes(e.id) ||
                ["seedream-4.5", "seedream-4.0"].includes(e.id) ||
                [
                  "gemini-3.1-flash-image-official",
                  "gemini-3-pro-image-official",
                  "gemini-2.5-flash-image-official",
                ].includes(e.id)
                ? e
                : { ...e, url: this.globalBaseUrl };
            })),
            (this.configs = t)),
          (this.activeEndpointId =
            localStorage.getItem(we.ACTIVE_ENDPOINT) || "comfly"));
        const r = localStorage.getItem(we.JIMENG_USE_LOCAL);
        ((this.jimengUseLocalFile = null === r || "true" === r),
          (this.jimengSuperResUrl =
            localStorage.getItem(we.JIMENG_SUPER_RESOLUTION_URL) || ""),
          (this.jimengSuperResApiKey =
            localStorage.getItem(we.JIMENG_SUPER_RESOLUTION_API_KEY) || ""));
      } catch (e) {
        (console.error("加载 API 配置失败:", e), (this.configs = [...F]));
      }
    }
    saveConfigsOnly(e) {
      try {
        const t = ["jimeng-5.0", "jimeng-4.6", "jimeng-4.5"],
          o = e.filter((e) => !t.includes(e.id));
        localStorage.setItem(we.API_CONFIGS, JSON.stringify(o));
      } catch (t) {
        console.error("保存 API 配置失败:", t);
      }
    }
    saveToStorage() {
      try {
        const e = ["jimeng-5.0", "jimeng-4.6", "jimeng-4.5"],
          t = this.configs.filter((t) => !e.includes(t.id));
        (localStorage.setItem(we.API_CONFIGS, JSON.stringify(t)),
          localStorage.setItem(we.GLOBAL_KEY, this.globalApiKey),
          localStorage.setItem(we.GLOBAL_BASE_URL, this.globalBaseUrl),
          localStorage.setItem(we.ACTIVE_ENDPOINT, this.activeEndpointId),
          localStorage.setItem(we.JIMENG_SESSION, this.jimengSessionId),
          localStorage.setItem(
            we.JIMENG_USE_LOCAL,
            String(this.jimengUseLocalFile),
          ),
          localStorage.setItem(
            we.JIMENG_SUPER_RESOLUTION_URL,
            this.jimengSuperResUrl,
          ),
          localStorage.setItem(
            we.JIMENG_SUPER_RESOLUTION_API_KEY,
            this.jimengSuperResApiKey,
          ));
      } catch (e) {
        console.error("保存 API 配置失败:", e);
      }
    }
    ensureDefaultModels(e) {
      const t = [
          {
            id: "seedance-1.5-pro-api",
            provider: "Seedance 1.5 pro API",
            modelName: "doubao-seedance-1-5-pro-251215",
            type: "Video",
            key: "",
            url: "https://ai.comfly.chat",
            durations: [
              "4s",
              "5s",
              "6s",
              "7s",
              "8s",
              "9s",
              "10s",
              "11s",
              "12s",
            ],
          },
          {
            id: "seedance-1-0-pro-api",
            provider: "Seedance 1.0 pro API",
            modelName: "doubao-seedance-1-0-pro-250528",
            type: "Video",
            key: "",
            url: "https://ai.comfly.chat",
            durations: ["5s", "10s"],
          },
          {
            id: "seedance-1-0-lite-t2v-api",
            provider: "Seedance 1.0 lite (文生) API",
            modelName: "doubao-seedance-1-0-lite-t2v-250428",
            type: "Video",
            key: "",
            url: "https://ai.comfly.chat",
            durations: ["5s", "10s"],
          },
          {
            id: "seedance-1-0-lite-i2v-api",
            provider: "Seedance 1.0 lite (图生) API",
            modelName: "doubao-seedance-1-0-lite-i2v-250428",
            type: "Video",
            key: "",
            url: "https://ai.comfly.chat",
            durations: ["5s", "10s"],
          },
        ],
        o = new Set(e.map((e) => e.id));
      for (const model of t) o.has(model.id) || e.push(model);
      const i = new Map();
      e.forEach((e) => i.set(e.id, e));
      const r = [];
      for (const s of F) {
        const e = i.get(s.id);
        e
          ? "wan-2.6-official" === s.id ||
            "wan-2.6-image-official" === s.id ||
            "z-image-official" === s.id
            ? r.push({
                ...s,
                key: e.key || s.key,
                url: "http://127.0.0.1:9527/api/proxy",
              })
            : [
                  "seedance-1.5-pro",
                  "seedance-1-0-pro",
                  "seedance-1-0-pro-fast",
                  "seedance-1-0-lite-t2v",
                  "seedance-1-0-lite-i2v",
                  "seedream-4.5",
                  "seedream-4.0",
                ].includes(s.id)
              ? r.push({
                  ...s,
                  key: e.key || s.key,
                  url: "http://127.0.0.1:9530",
                })
              : r.push({ ...s, key: e.key || s.key, url: e.url || s.url })
          : "wan-2.6-official" === s.id ||
              "wan-2.6-image-official" === s.id ||
              "z-image-official" === s.id
            ? r.push({ ...s, url: "http://127.0.0.1:9527/api/proxy" })
            : [
                  "seedance-1.5-pro",
                  "seedance-1-0-pro",
                  "seedance-1-0-pro-fast",
                  "seedance-1-0-lite-t2v",
                  "seedance-1-0-lite-i2v",
                  "seedream-4.5",
                  "seedream-4.0",
                ].includes(s.id)
              ? r.push({ ...s, url: "http://127.0.0.1:9530" })
              : r.push({ ...s });
      }
      const a = new Set(r.map((e) => e.id));
      for (const model of t)
        if (!a.has(model.id)) {
          const e = i.get(model.id);
          e
            ? r.push({ ...model, key: e.key || model.key })
            : r.push({ ...model });
        }
      return r;
    }
    isJimengConfig(e) {
      var t;
      return (
        e.id.includes("jimeng") ||
        (null == (t = e.provider) ? void 0 : t.includes("Jimeng"))
      );
    }
    isLocalUrl(url) {
      if (!url) return !1;
      const e = url.toLowerCase().trim();
      return (
        e.includes("localhost") ||
        e.includes("127.0.0.1") ||
        e.startsWith("file://")
      );
    }
    fixBaseUrls(e) {
      let t = !1;
      return {
        configs: e.map((e) =>
          "wan-2.6-official" === e.id ||
          "wan-2.6-image-official" === e.id ||
          "z-image-official" === e.id ||
          "gemini-3.1-flash-image-official" === e.id ||
          "gemini-3-pro-image-official" === e.id ||
          "gemini-2.5-flash-image-official" === e.id
            ? e
            : e.url && !this.isLocalUrl(e.url) && e.url !== T
              ? ((t = !0), { ...e, url: T })
              : e,
        ),
        hasChanges: t,
      };
    }
    getConfigs() {
      return [...this.configs];
    }
    getConfigsByType(type) {
      return this.configs.filter((e) => e.type === type);
    }
    getConfigById(e) {
      return this.configs.find((t) => t.id === e);
    }
    getGlobalApiKey() {
      return this.globalApiKey;
    }
    getGlobalBaseUrl() {
      return this.globalBaseUrl || T;
    }
    getEffectiveApiKey(e) {
      const t = this.getConfigById(e);
      return (t && t.key) || this.globalApiKey;
    }
    getEndpoints() {
      return [...k];
    }
    getActiveEndpoint() {
      return k.find((e) => e.id === this.activeEndpointId) || k[0];
    }
    getJimengSessionId() {
      return this.jimengSessionId;
    }
    getJimengUseLocalFile() {
      return this.jimengUseLocalFile;
    }
    getJimengSuperResUrl() {
      return this.jimengSuperResUrl || e.JIMENG_SUPER_RES_DEFAULT_URL;
    }
    getJimengSuperResApiKey() {
      return this.jimengSuperResApiKey || "";
    }
    updateConfig(e, t) {
      ((this.configs = this.configs.map((o) =>
        o.id === e ? { ...o, ...t } : o,
      )),
        this.saveToStorage(),
        this.notifyListeners());
    }
    updateConfigs(e) {
      ((this.configs = e), this.saveToStorage(), this.notifyListeners());
    }
    syncWithDefaults() {
      ((this.configs = this.ensureDefaultModels(this.configs)),
        this.saveToStorage(),
        this.notifyListeners());
    }
    setGlobalApiKey(key) {
      ((this.globalApiKey = key), this.saveToStorage(), this.notifyListeners());
    }
    switchEndpoint(e) {
      const endpoint = k.find((t) => t.id === e);
      endpoint &&
        ((this.activeEndpointId = e),
        endpoint.baseUrl &&
          (this.configs = this.configs.map((e) =>
            this.isJimengConfig(e) ||
            "mj-v6" === e.id ||
            "wan-2.6-official" === e.id ||
            "wan-2.6-image-official" === e.id ||
            "z-image-official" === e.id ||
            "gemini-3.1-flash-image-official" === e.id ||
            "gemini-3-pro-image-official" === e.id ||
            "gemini-2.5-flash-image-official" === e.id ||
            (e.url && e.url !== T)
              ? e
              : { ...e, url: endpoint.baseUrl },
          )),
        this.saveToStorage(),
        this.notifyListeners());
    }
    setGlobalBaseUrl(baseUrl) {
      const e = baseUrl.trim().replace(/\/+$/, "");
      ((this.globalBaseUrl = e),
        (this.configs = this.configs.map((t) =>
          [
            "jimeng-5.0",
            "jimeng-4.6",
            "jimeng-4.5",
            "jimeng-4.1",
            "jimeng-3.1",
          ].includes(t.id) ||
          "wan-2.6-official" === t.id ||
          "wan-2.6-image-official" === t.id ||
          "z-image-official" === t.id ||
          [
            "gemini-3.1-flash-image-official",
            "gemini-3-pro-image-official",
            "gemini-2.5-flash-image-official",
          ].includes(t.id)
            ? t
            : { ...t, url: e },
        )),
        this.saveToStorage(),
        this.notifyListeners());
    }
    setJimengSessionId(e) {
      ((this.jimengSessionId = e),
        (this.configs = this.configs.map((t) =>
          this.isJimengConfig(t) ? { ...t, key: e } : t,
        )),
        this.saveToStorage(),
        this.notifyListeners());
    }
    setJimengUseLocalFile(e) {
      ((this.jimengUseLocalFile = e),
        this.saveToStorage(),
        this.notifyListeners());
    }
    setJimengSuperResUrl(url) {
      ((this.jimengSuperResUrl = (url || "").trim().replace(/\/+$/, "")),
        this.saveToStorage(),
        this.notifyListeners());
    }
    setJimengSuperResApiKey(key) {
      ((this.jimengSuperResApiKey = key || ""),
        this.saveToStorage(),
        this.notifyListeners());
    }
    addCustomConfig(e) {
      const t = { ...e, isCustom: !0 };
      (this.configs.push(t), this.saveToStorage(), this.notifyListeners());
    }
    removeCustomConfig(e) {
      const t = this.getConfigById(e);
      (null == t ? void 0 : t.isCustom) &&
        ((this.configs = this.configs.filter((t) => t.id !== e)),
        this.saveToStorage(),
        this.notifyListeners());
    }
    resetToDefaults() {
      ((this.configs = [...F]),
        (this.activeEndpointId = "comfly"),
        this.saveToStorage(),
        this.notifyListeners());
    }
    subscribe(e) {
      return (this.listeners.add(e), () => this.listeners.delete(e));
    }
    notifyListeners() {
      this.listeners.forEach((e) => e());
    }
  };
u(ye, "JIMENG_SUPER_RES_DEFAULT_URL", "http://127.0.0.1:9529");
const ve = new ye(),
  be = {
    OVERSCAN: 1e3,
    OVERSCAN_INTERACTIVE: 300,
    OVERSCAN_LARGE_PROJECT: 500,
    OVERSCAN_HUGE_PROJECT: 150,
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 2,
    ZOOM_STEP: 0.1,
    DEFAULT_ZOOM: 1,
    DEFAULT_VIEW: { x: 0, y: 0, zoom: 1 },
    LARGE_PROJECT_THRESHOLD: 100,
    HUGE_PROJECT_THRESHOLD: 200,
  },
  _e = 0.12,
  Ie = {
    PERF_MODE_THRESHOLD: 50,
    MAX_HISTORY_SIZE: 60,
    DEBOUNCE_DELAY: {
      HISTORY_SAVE: 500,
      STORAGE_SAVE: 1e3,
      CHARACTER_SAVE: 500,
    },
  };
function Se(e, t) {
  e -= 0;
  return Pe()[e];
}
function je(e) {
  return e <= _e ? Se(0) : "";
}
function Ae(e, t = !1) {
  const o = Se;
  return t
    ? be.OVERSCAN_INTERACTIVE
    : e >= be[o(1)]
      ? be[o(2)]
      : e >= be.LARGE_PROJECT_THRESHOLD
        ? be.OVERSCAN_LARGE_PROJECT
        : be.OVERSCAN;
}
function Pe() {
  const e = ["zoom-tiny", "HUGE_PROJECT_THRESHOLD", "OVERSCAN_HUGE_PROJECT"];
  return (Pe = function () {
    return e;
  })();
}
function xe(e, t) {
  e -= 0;
  return Ee()[e];
}
const ke = {
  "quality-first": {
    enableRenderQuality: !0,
    enableImageThumbnails: !0,
    enableVideoLazyLoad: !0,
    enableConnectionAnimations: !0,
    tinyZoomThreshold: 0.1,
    overscanBuffer: 500,
    edgeUpdateThrottle: 8,
    nodePositionCommitDelay: 100,
  },
  balanced: {
    enableRenderQuality: !0,
    enableImageThumbnails: !0,
    enableVideoLazyLoad: !0,
    enableConnectionAnimations: !0,
    tinyZoomThreshold: 0.15,
    overscanBuffer: 500,
    edgeUpdateThrottle: 16,
    nodePositionCommitDelay: 200,
  },
  "speed-first": {
    enableRenderQuality: !0,
    enableImageThumbnails: !0,
    enableVideoLazyLoad: !0,
    enableConnectionAnimations: !1,
    tinyZoomThreshold: 0.25,
    overscanBuffer: 100,
    edgeUpdateThrottle: 32,
    nodePositionCommitDelay: 300,
  },
};
let Te = "balanced",
  $e = { ...ke.balanced };
const Me = () => ({ ...$e }),
  Ce = () => Te,
  Ue = (e) => {
    const t = xe;
    ((Te = e),
      ($e = { ...ke[e] }),
      console[t(0)]("[Performance] Preset changed to: " + e, $e),
      "undefined" != typeof window &&
        window.dispatchEvent(
          new CustomEvent(t(1), { detail: { preset: e, config: $e } }),
        ));
  },
  Oe = (e) => {
    const t = xe;
    (($e = { ...$e, ...e }),
      console[t(0)]("[Performance] Config updated:", $e));
  };
function Ee() {
  const e = [
    "log",
    "performancePresetChanged",
    "[Performance] Config reset to ",
    "enableConnectionAnimations",
    "tinyZoomThreshold",
    "overscanBuffer",
  ];
  return (Ee = function () {
    return e;
  })();
}
const Le = () => $e.enableRenderQuality,
  Re = () => $e[xe(3)],
  Ne = () => $e[xe(4)],
  De = () => $e[xe(5)],
  Fe = () => $e.edgeUpdateThrottle,
  We = () => $e.nodePositionCommitDelay;
"undefined" != typeof window &&
  (window.performanceConfig = {
    get: Me,
    getCurrentPreset: Ce,
    setPreset: Ue,
    update: Oe,
    reset: () => {
      const e = xe;
      (($e = { ...ke[Te] }), console[e(0)](e(2) + Te + " preset", $e));
    },
    presets: Object.keys(ke),
  });
const ze = "assets";
const Be = new (class {
    constructor() {
      (u(this, "db", null),
        u(this, "initPromise", null),
        u(this, "initFailed", !1),
        u(this, "listeners", new Set()),
        u(this, "blobUrlCache", new Map()),
        u(this, "BLOB_URL_CACHE_TTL", 144e5),
        u(
          this,
          "MAX_BLOB_URL_CACHE_SIZE",
          "undefined" != typeof navigator &&
            /win/i.test(navigator.platform + navigator.userAgent)
            ? 30
            : 80,
        ));
    }
    evictOldestBlobUrlsIfNeeded() {
      if (this.blobUrlCache.size <= this.MAX_BLOB_URL_CACHE_SIZE) return;
      Array.from(this.blobUrlCache.entries())
        .sort((e, t) => e[1].createdAt - t[1].createdAt)
        .slice(0, this.blobUrlCache.size - this.MAX_BLOB_URL_CACHE_SIZE)
        .forEach(([key]) => {
          const e = this.blobUrlCache.get(key);
          e && (URL.revokeObjectURL(e.url), this.blobUrlCache.delete(key));
        });
    }
    cleanupExpiredBlobUrls() {
      const e = Date.now(),
        t = [];
      (this.blobUrlCache.forEach((value, key) => {
        e - value.createdAt > this.BLOB_URL_CACHE_TTL && t.push(key);
      }),
        t.forEach((key) => {
          const e = this.blobUrlCache.get(key);
          e &&
            (URL.revokeObjectURL(e.url),
            this.blobUrlCache.delete(key),
            console.log("[AssetStore] Cleaned up expired blob URL:", key));
        }));
    }
    addListener(e) {
      return (this.listeners.add(e), () => this.listeners.delete(e));
    }
    notifyListeners(e, t) {
      this.listeners.forEach((o) => {
        try {
          o(e, t);
        } catch (error) {
          console.error("[AssetStore] Listener error:", error);
        }
      });
    }
    _saveToLocalCache(e, blob, mimeType, t) {
      (async () => {
        try {
          const { localCacheManager: o } = await x(
            async () => {
              const { localCacheManager: e } = await Promise.resolve().then(
                () => pr,
              );
              return { localCacheManager: e };
            },
            void 0,
            import.meta.url,
          );
          if ((await o.ensureRestored(), o.isAvailable())) {
            (await o.saveAsset(e, blob, mimeType, t)) &&
              console.log(`[AssetStore] ✅ Also saved to local cache: ${e}`);
          }
        } catch {}
      })();
    }
    async init() {
      if (this.initFailed)
        return void console.warn(
          "[AssetStore] IndexedDB init previously failed, running in degraded mode",
        );
      if (this.db) return void this.cleanupExpiredBlobUrls();
      if (this.initPromise) return this.initPromise;
      const e = new Promise((e, t) => {
          setTimeout(() => {
            t(new Error("IndexedDB initialization timeout (5s)"));
          }, 5e3);
        }),
        t = new Promise((e, t) => {
          try {
            if ("undefined" == typeof indexedDB)
              return (
                console.warn("[AssetStore] IndexedDB not available"),
                void e()
              );
            const o = indexedDB.open("TapnowAssetCache", 1);
            ((o.onerror = () => {
              (console.error("[AssetStore] Failed to open IndexedDB:", o.error),
                t(o.error));
            }),
              (o.onsuccess = () => {
                ((this.db = o.result),
                  console.log(
                    "[AssetStore] IndexedDB initialized successfully",
                  ),
                  e());
              }),
              (o.onupgradeneeded = (e) => {
                const t = e.target.result;
                if (!t.objectStoreNames.contains(ze)) {
                  const e = t.createObjectStore(ze, { keyPath: "id" });
                  (e.createIndex("remoteUrl", "remoteUrl", { unique: !1 }),
                    e.createIndex("cachedAt", "cachedAt", { unique: !1 }),
                    console.log("[AssetStore] Object store created"));
                }
              }));
          } catch (error) {
            (console.error("[AssetStore] Error during IndexedDB init:", error),
              t(error));
          }
        });
      return (
        (this.initPromise = Promise.race([t, e]).catch((error) => {
          (console.error("[AssetStore] IndexedDB init failed:", error),
            (this.initFailed = !0));
        })),
        this.initPromise
      );
    }
    invalidateBlobUrlCacheFor(e) {
      const t = this.blobUrlCache.get(e);
      t && (URL.revokeObjectURL(t.url), this.blobUrlCache.delete(e));
    }
    async saveBlobAsset(e, blob, t) {
      try {
        await this.init();
        const o = await this.getAsset(e);
        if (o) {
          if (o.remoteUrl === t)
            return (
              console.log("[AssetStore] Asset already cached (same URL):", e),
              !0
            );
          this.invalidateBlobUrlCacheFor(e);
        }
        const mimeType = blob.type || "application/octet-stream",
          i = {
            id: e,
            blob: blob,
            mimeType: mimeType,
            size: blob.size,
            remoteUrl: t,
            cachedAt: Date.now(),
          };
        return (
          await this.putAsset(i),
          console.log(
            "[AssetStore] Blob asset cached successfully:",
            e,
            `(${(blob.size / 1024 / 1024).toFixed(2)} MB)`,
          ),
          this.notifyListeners(e, i),
          this._saveToLocalCache(e, blob, mimeType, t),
          !0
        );
      } catch (error) {
        return !1;
      }
    }
    async saveAsset(e, t) {
      try {
        await this.init();
        const r = await this.getAsset(e);
        if (r) {
          if (r.remoteUrl === t)
            return (
              console.log("[AssetStore] Asset already cached (same URL):", e),
              !0
            );
          this.invalidateBlobUrlCacheFor(e);
        }
        if (
          (console.log("[AssetStore] Downloading asset:", t),
          t.startsWith("blob:"))
        )
          try {
            const { getAssetIdForDisplayBlobUrl: o } = await x(
                async () => {
                  const { getAssetIdForDisplayBlobUrl: e } =
                    await Promise.resolve().then(() => Io);
                  return { getAssetIdForDisplayBlobUrl: e };
                },
                void 0,
                import.meta.url,
              ),
              i = o(t);
            if (i) {
              const o = await this.getAsset(i),
                r = o ? await this.getAssetBlob(i) : null;
              if (r) {
                const i = r.type || "application/octet-stream",
                  a = {
                    id: e,
                    blob: r,
                    mimeType: i,
                    size: r.size,
                    remoteUrl: (null == o ? void 0 : o.remoteUrl) || t,
                    cachedAt: Date.now(),
                  };
                (await this.putAsset(a), this.notifyListeners(e, a));
                const s =
                  (null == o ? void 0 : o.remoteUrl) &&
                  (o.remoteUrl.startsWith("http://") ||
                    o.remoteUrl.startsWith("https://"))
                    ? o.remoteUrl
                    : void 0;
                return (this._saveToLocalCache(e, r, i, s), !0);
              }
            }
          } catch (o) {
            console.warn(
              "[AssetStore] Resolve original from display URL failed, fallback to fetch:",
              o,
            );
          }
        const a =
          t.includes(".mp4") ||
          t.includes(".webm") ||
          t.includes("video") ||
          t.includes("/v/") ||
          t.includes("amazonaws") ||
          t.includes("prod-sa-vidu") ||
          t.includes("prod-ss-vidu");
        let blob;
        if (a && this.isTauriEnvironment())
          try {
            const { downloadWithFallback: e } = await x(
              async () => {
                const { downloadWithFallback: e } =
                  await import("./tauriDownloader-BG3Xb0u0.js");
                return { downloadWithFallback: e };
              },
              __vite__mapDeps([0, 1, 2]),
              import.meta.url,
            );
            ((blob = await e(t, 12e4)),
              blob.type ||
                (!t.includes(".mp4") && !t.includes(".webm")) ||
                (blob = new Blob([await blob.arrayBuffer()], {
                  type: "video/mp4",
                })));
          } catch (i) {
            console.warn(
              "[AssetStore] Tauri video download failed, fallback to fetch:",
              i,
            );
            const e = await fetch(t, { mode: "cors", credentials: "omit" });
            if (!e.ok) throw new Error(`HTTP ${e.status}: ${e.statusText}`);
            blob = await e.blob();
          }
        else {
          const e = await fetch(t, { mode: "cors", credentials: "omit" });
          if (!e.ok) throw new Error(`HTTP ${e.status}: ${e.statusText}`);
          blob = await e.blob();
        }
        const mimeType =
            blob.type || (a ? "video/mp4" : "application/octet-stream"),
          s = {
            id: e,
            blob: blob,
            mimeType: mimeType,
            size: blob.size,
            remoteUrl: t,
            cachedAt: Date.now(),
          };
        return (
          await this.putAsset(s),
          console.log(
            "[AssetStore] Asset cached successfully:",
            e,
            `(${(blob.size / 1024 / 1024).toFixed(2)} MB)`,
          ),
          this.notifyListeners(e, s),
          this._saveToLocalCache(e, blob, mimeType, t),
          !0
        );
      } catch (error) {
        return (
          console.debug("[AssetStore] Failed to save asset:", e, error),
          !1
        );
      }
    }
    isTauriEnvironment() {
      return (
        "undefined" != typeof window &&
        ("__TAURI_INTERNALS__" in window ||
          "__TAURI__" in window ||
          "tauri:" === window.location.protocol)
      );
    }
    async convertTauriFileSrc(e) {
      if (!this.isTauriEnvironment()) return e;
      try {
        const { convertFileSrc: t } = await x(
          async () => {
            const { convertFileSrc: e } =
              await import("./vendor-DXn3GjvW.js").then((n) => n.k);
            return { convertFileSrc: e };
          },
          __vite__mapDeps([1, 2]),
          import.meta.url,
        );
        return t(e);
      } catch (error) {
        return (
          console.warn("[AssetStore] Failed to convert Tauri file src:", error),
          e
        );
      }
    }
    isAbsoluteFilePath(path) {
      return !!path.match(/^[A-Za-z]:[\\\/]/) || !!path.startsWith("/");
    }
    async getAssetUrl(e, content) {
      try {
        if (
          content &&
          this.isTauriEnvironment() &&
          this.isAbsoluteFilePath(content)
        ) {
          const e = await this.convertTauriFileSrc(content);
          return (
            console.log(
              `[AssetStore] Using Tauri file path: ${content} -> ${e}`,
            ),
            e
          );
        }
        await this.init();
        const t = this.blobUrlCache.get(e);
        if (t) {
          if (Date.now() - t.createdAt < this.BLOB_URL_CACHE_TTL)
            return ((t.createdAt = Date.now()), t.url);
          (URL.revokeObjectURL(t.url), this.blobUrlCache.delete(e));
        }
        try {
          const { localCacheManager: t } = await x(
            async () => {
              const { localCacheManager: e } = await Promise.resolve().then(
                () => pr,
              );
              return { localCacheManager: e };
            },
            void 0,
            import.meta.url,
          );
          if (t.isAvailable() && t.hasAsset(e)) {
            const result = await t.readAsset(e);
            if (result) {
              const t = URL.createObjectURL(result.blob);
              return (
                this.blobUrlCache.set(e, {
                  url: t,
                  blob: result.blob,
                  createdAt: Date.now(),
                }),
                this.evictOldestBlobUrlsIfNeeded(),
                t
              );
            }
          }
        } catch {}
        const o = await this.getAsset(e);
        if (o) {
          const t = URL.createObjectURL(o.blob);
          return (
            this.blobUrlCache.set(e, {
              url: t,
              blob: o.blob,
              createdAt: Date.now(),
            }),
            this.evictOldestBlobUrlsIfNeeded(),
            t
          );
        }
        return null;
      } catch (error) {
        return null;
      }
    }
    async getAssetBlob(e) {
      try {
        await this.init();
        try {
          const { localCacheManager: t } = await x(
            async () => {
              const { localCacheManager: e } = await Promise.resolve().then(
                () => pr,
              );
              return { localCacheManager: e };
            },
            void 0,
            import.meta.url,
          );
          if (t.isAvailable() && t.hasAsset(e)) {
            const result = await t.readAsset(e);
            if (result) return result.blob;
          }
        } catch {}
        const t = await this.getAsset(e);
        return (null == t ? void 0 : t.blob) ? t.blob : null;
      } catch (error) {
        return null;
      }
    }
    async getAssetRecord(e) {
      try {
        await this.init();
        try {
          const { localCacheManager: t } = await x(
            async () => {
              const { localCacheManager: e } = await Promise.resolve().then(
                () => pr,
              );
              return { localCacheManager: e };
            },
            void 0,
            import.meta.url,
          );
          if (t.isAvailable() && t.hasAsset(e)) {
            const result = await t.readAsset(e);
            if (result) {
              const o = t.getManifest(),
                i = null == o ? void 0 : o.assets[e];
              return {
                id: e,
                blob: result.blob,
                mimeType: result.mimeType,
                size: result.blob.size,
                remoteUrl: (null == i ? void 0 : i.remoteUrl) || "",
                cachedAt: (null == i ? void 0 : i.cachedAt) || Date.now(),
              };
            }
          }
        } catch {}
        const t = await this.getAsset(e);
        return t || null;
      } catch (error) {
        return null;
      }
    }
    async getAssetBlobByRemoteUrl(e) {
      try {
        if ((await this.init(), !this.db)) return null;
        let t = "";
        try {
          t = new URL(e).pathname;
        } catch {}
        let o = await new Promise((t, o) => {
          const i = this.db
            .transaction([ze], "readonly")
            .objectStore(ze)
            .index("remoteUrl")
            .get(e);
          ((i.onsuccess = () => t(i.result || null)),
            (i.onerror = () => o(i.error)));
        });
        if (
          !(null == o ? void 0 : o.blob) &&
          t &&
          (e.includes("prod-ss-vidu") ||
            e.includes("prod-sa-vidu") ||
            e.includes("amazonaws"))
        ) {
          o =
            (await this.getAllAssets()).find((e) => {
              if (!e.remoteUrl) return !1;
              try {
                return new URL(e.remoteUrl).pathname === t;
              } catch {
                return !1;
              }
            }) || null;
        }
        if (null == o ? void 0 : o.blob) return o.blob;
        try {
          const { localCacheManager: o } = await x(
            async () => {
              const { localCacheManager: e } = await Promise.resolve().then(
                () => pr,
              );
              return { localCacheManager: e };
            },
            void 0,
            import.meta.url,
          );
          if (o.isAvailable()) {
            const i = o.getManifest();
            let r =
              (null == i ? void 0 : i.assets) &&
              Object.entries(i.assets).find(
                ([, t]) => (null == t ? void 0 : t.remoteUrl) === e,
              );
            if (
              (!r &&
                t &&
                (r =
                  (null == i ? void 0 : i.assets) &&
                  Object.entries(i.assets).find(([, e]) => {
                    try {
                      return !(
                        !(null == e ? void 0 : e.remoteUrl) ||
                        new URL(e.remoteUrl).pathname !== t
                      );
                    } catch {
                      return !1;
                    }
                  })),
              r)
            ) {
              const [e] = r,
                result = await o.readAsset(e);
              if (result) return result.blob;
            }
          }
        } catch {}
        return null;
      } catch {
        return null;
      }
    }
    async hasAsset(e) {
      try {
        await this.init();
        return !!(await this.getAsset(e));
      } catch (error) {
        return !1;
      }
    }
    async deleteAsset(e) {
      try {
        const t = this.blobUrlCache.get(e);
        return (
          t && (URL.revokeObjectURL(t.url), this.blobUrlCache.delete(e)),
          await this.init(),
          !!this.db &&
            new Promise((t, o) => {
              const i = this.db
                .transaction([ze], "readwrite")
                .objectStore(ze)
                .delete(e);
              ((i.onsuccess = () => {
                (console.log("[AssetStore] Asset deleted:", e), t(!0));
              }),
                (i.onerror = () => {
                  (console.error(
                    "[AssetStore] Failed to delete asset:",
                    e,
                    i.error,
                  ),
                    o(i.error));
                }));
            })
        );
      } catch (error) {
        return (
          console.error("[AssetStore] Failed to delete asset:", e, error),
          !1
        );
      }
    }
    async deleteAssets(e) {
      let t = 0;
      for (const o of e) {
        (await this.deleteAsset(o)) && t++;
      }
      return t;
    }
    async getAllAssetIds() {
      try {
        return (
          await this.init(),
          this.db
            ? new Promise((e, t) => {
                const o = this.db
                  .transaction([ze], "readonly")
                  .objectStore(ze)
                  .getAllKeys();
                ((o.onsuccess = () => {
                  e(o.result);
                }),
                  (o.onerror = () => {
                    (console.error(
                      "[AssetStore] Failed to get all asset IDs:",
                      o.error,
                    ),
                      t(o.error));
                  }));
              })
            : []
        );
      } catch (error) {
        return (
          console.error("[AssetStore] Failed to get all asset IDs:", error),
          []
        );
      }
    }
    async getStorageUsage() {
      try {
        if ((await this.init(), !this.db))
          return {
            totalSize: 0,
            count: 0,
            formattedSize: "0 B",
            blobUrlCacheSize: 0,
          };
        const e = await this.getAllAssets(),
          t = e.reduce((e, t) => e + t.size, 0);
        return {
          totalSize: t,
          count: e.length,
          formattedSize: this.formatBytes(t),
          blobUrlCacheSize: this.blobUrlCache.size,
        };
      } catch (error) {
        return (
          console.error("[AssetStore] Failed to get storage usage:", error),
          { totalSize: 0, count: 0, formattedSize: "0 B", blobUrlCacheSize: 0 }
        );
      }
    }
    clearBlobUrlCache() {
      try {
        (this.blobUrlCache.forEach(({ url: url }) => {
          try {
            URL.revokeObjectURL(url);
          } catch {}
        }),
          this.blobUrlCache.clear(),
          console.log("[AssetStore] Blob URL cache cleared"));
      } catch (e) {
        console.warn("[AssetStore] clearBlobUrlCache failed:", e);
      }
    }
    async clearAll() {
      try {
        return (
          this.blobUrlCache.forEach(({ url: url }) => {
            URL.revokeObjectURL(url);
          }),
          this.blobUrlCache.clear(),
          await this.init(),
          !!this.db &&
            new Promise((e, t) => {
              const o = this.db
                .transaction([ze], "readwrite")
                .objectStore(ze)
                .clear();
              ((o.onsuccess = () => {
                (console.log("[AssetStore] All assets cleared"), e(!0));
              }),
                (o.onerror = () => {
                  (console.error(
                    "[AssetStore] Failed to clear assets:",
                    o.error,
                  ),
                    t(o.error));
                }));
            })
        );
      } catch (error) {
        return (
          console.error("[AssetStore] Failed to clear assets:", error),
          !1
        );
      }
    }
    async getAsset(e) {
      return this.db
        ? new Promise((t, o) => {
            const i = this.db
              .transaction([ze], "readonly")
              .objectStore(ze)
              .get(e);
            ((i.onsuccess = () => {
              t(i.result || null);
            }),
              (i.onerror = () => {
                (console.error("[AssetStore] Failed to get asset:", e, i.error),
                  o(i.error));
              }));
          })
        : null;
    }
    async putAsset(e) {
      if (!this.db) throw new Error("Database not initialized");
      return new Promise((t, o) => {
        const i = this.db.transaction([ze], "readwrite").objectStore(ze).put(e);
        ((i.onsuccess = () => {
          t();
        }),
          (i.onerror = () => {
            (console.error("[AssetStore] Failed to put asset:", e.id, i.error),
              o(i.error));
          }));
      });
    }
    async getAllAssets() {
      return this.db
        ? new Promise((e, t) => {
            const o = this.db
              .transaction([ze], "readonly")
              .objectStore(ze)
              .getAll();
            ((o.onsuccess = () => {
              e(o.result || []);
            }),
              (o.onerror = () => {
                (console.error(
                  "[AssetStore] Failed to get all assets:",
                  o.error,
                ),
                  t(o.error));
              }));
          })
        : [];
    }
    formatBytes(e) {
      if (0 === e) return "0 B";
      const t = Math.floor(Math.log(e) / Math.log(1024));
      return `${(e / Math.pow(1024, t)).toFixed(2)} ${["B", "KB", "MB", "GB"][t]}`;
    }
  })(),
  Ge = Object.freeze(
    Object.defineProperty(
      { __proto__: null, assetStore: Be },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  Je = new Map(),
  Ve = new Map();
function Ke(value) {
  return (
    "string" == typeof value &&
    (value.startsWith("data:image/") ||
      value.startsWith("data:video/") ||
      value.startsWith("data:audio/"))
  );
}
function He(value) {
  return "string" == typeof value && value.startsWith("blob:");
}
function qe(value) {
  return (
    "string" == typeof value &&
    !value.startsWith("data:") &&
    (!!value.startsWith("blob:") ||
      !(!value.startsWith("http://") && !value.startsWith("https://")))
  );
}
function Ze(e) {
  var t;
  if (!(null == e ? void 0 : e.startsWith("data:"))) return null;
  const o = e.lastIndexOf(";base64,");
  if (-1 === o) return null;
  return {
    mime:
      (null == (t = e.slice(0, e.indexOf(",")).match(/:(.*?);/))
        ? void 0
        : t[1]) || "image/png",
    base64: e.slice(o + 8).replace(/\s/g, ""),
  };
}
function Qe(url) {
  if (!(null == url ? void 0 : url.startsWith("data:image"))) return url;
  const e = Ze(url);
  if (!e) return url;
  try {
    return (atob(e.base64), `data:${e.mime};base64,${e.base64}`);
  } catch {
    return url;
  }
}
function Xe(e) {
  if (!(null == e ? void 0 : e.startsWith("data:")) || !e.includes(";base64,"))
    return e;
  try {
    const t = Ze(e);
    if (!t) return e;
    const o = atob(t.base64),
      i = new Uint8Array(o.length);
    for (let e = 0; e < o.length; e++) i[e] = o.charCodeAt(e);
    const blob = new Blob([i], { type: t.mime });
    return URL.createObjectURL(blob);
  } catch (t) {
    return (
      console.warn("[BlobSerialization] dataUrlToBlobUrlSync failed:", t),
      e
    );
  }
}
function Ye(url) {
  if (!(null == url ? void 0 : url.startsWith("data:image"))) return url;
  const e = Qe(url);
  return e.length <= 2097152 ? e : Xe(e);
}
async function et(base64) {
  if (Je.has(base64)) return Je.get(base64);
  if (Ve.has(base64)) return Ve.get(base64);
  const e = (async () => {
    try {
      let e = base64.trim();
      e.startsWith("data:") &&
        e.includes(";base64,") &&
        (e = e.replace(/;base64,\s+/, ";base64,"));
      const t = await fetch(e),
        blob = await t.blob(),
        o = URL.createObjectURL(blob);
      return (Je.set(base64, o), Ve.delete(base64), o);
    } catch (error) {
      return (
        console.error(
          "[Hydration] Failed to convert Base64 to Blob URL:",
          error,
        ),
        Ve.delete(base64),
        base64
      );
    }
  })();
  return (Ve.set(base64, e), e);
}
async function tt(e) {
  if (Je.has(e)) return Je.get(e);
  if (Ve.has(e)) return Ve.get(e);
  const t = (async () => {
    try {
      if (e.startsWith("http://") || e.startsWith("https://")) {
        const t = await fetch(e);
        if (!t.ok) throw new Error(`HTTP ${t.status}: ${t.statusText}`);
        const o = await t.blob(),
          i = await new Promise((e, t) => {
            const i = new FileReader();
            ((i.onloadend = () => {
              const result = i.result;
              e(result);
            }),
              (i.onerror = t),
              i.readAsDataURL(o));
          });
        return (Je.set(e, i), Ve.delete(e), i);
      }
      const t = await fetch(e),
        blob = await t.blob(),
        base64 = await new Promise((e, t) => {
          const o = new FileReader();
          ((o.onloadend = () => {
            const result = o.result;
            e(result);
          }),
            (o.onerror = t),
            o.readAsDataURL(blob));
        });
      return (Je.set(e, base64), Ve.delete(e), base64);
    } catch (error) {
      return (
        console.error(
          "[Serialization] Failed to convert URL to Base64:",
          error,
        ),
        console.warn(`[Serialization] 保留原始URL: ${e.substring(0, 50)}...`),
        Ve.delete(e),
        e
      );
    }
  })();
  return (Ve.set(e, t), t);
}
async function ot(data, e = 10) {
  console.log("[Hydration] Starting Base64 → Blob URL conversion...");
  const t = { converted: 0, skipped: 0, totalSize: 0 },
    o = [];
  Array.isArray(data)
    ? data.forEach((e, t) => {
        o.push({ obj: e, key: t, parent: data, depth: 0 });
      })
    : "object" == typeof data &&
      null !== data &&
      Object.keys(data).forEach((key) => {
        o.push({ obj: data[key], key: key, parent: data, depth: 0 });
      });
  const i = [];
  for (; o.length > 0; ) {
    const { obj: r, key: key, parent: a, depth: s } = o.shift();
    if (s > e) t.skipped++;
    else if (Ke(r)) {
      const base64 = r,
        size = base64.length;
      t.totalSize += size;
      const e = et(base64)
        .then((e) => {
          ((a[key] = e),
            t.converted++,
            t.converted % 10 == 0 &&
              console.log(
                `[Hydration] Converted ${t.converted} images, saved ${(t.totalSize / 1024 / 1024).toFixed(2)}MB`,
              ));
        })
        .catch((error) => {
          (console.error(
            `[Hydration] Failed to convert Base64 at key "${key}":`,
            error,
          ),
            (a[key] = base64),
            t.skipped++);
        });
      i.push(e);
    } else
      Array.isArray(r)
        ? r.forEach((e, t) => {
            o.push({ obj: e, key: t, parent: r, depth: s + 1 });
          })
        : "object" == typeof r &&
          null !== r &&
          Object.keys(r).forEach((e) => {
            o.push({ obj: r[e], key: e, parent: r, depth: s + 1 });
          });
  }
  return (
    await Promise.all(i),
    console.log("[Hydration] Conversion complete:", {
      converted: t.converted,
      skipped: t.skipped,
      savedMemory: `${(t.totalSize / 1024 / 1024).toFixed(2)}MB`,
    }),
    { data: data, stats: t }
  );
}
function nt(data) {
  const e = JSON.stringify(data).substring(0, 5e4);
  return (
    e.includes("data:image/") ||
    e.includes("data:video/") ||
    e.includes("data:audio/")
  );
}
function it(data) {
  let e = 0;
  const t = JSON.stringify(data).match(/data:image\/[^"]+/g);
  return (
    t &&
      t.forEach((t) => {
        e += t.length;
      }),
    e
  );
}
const rt = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        base64ToBlobUrl: et,
        containsBase64Media: nt,
        dataUrlToBlobUrlSync: Xe,
        estimateBase64Size: it,
        getDisplaySafeImageUrlSync: Ye,
        hydrateProjectData: ot,
        hydrateProjectDataStreaming: async function (data, e, t = 10) {
          console.log(
            "[StreamingHydration] Starting streaming Base64 → Blob URL conversion...",
          );
          const o = { converted: 0, skipped: 0, totalSize: 0 },
            i = [],
            r = (e, o, key, a, s) => {
              a > t ||
                (Ke(e)
                  ? i.push({ obj: e, key: key, parent: o, priority: s })
                  : Array.isArray(e)
                    ? e.forEach((t, o) => {
                        r(t, e, o, a + 1, s);
                      })
                    : "object" == typeof e &&
                      null !== e &&
                      Object.keys(e).forEach((t) => {
                        let o = s;
                        ("nodes" === t
                          ? (o = 100)
                          : "connections" === t
                            ? (o = 90)
                            : "history" === t && (o = 50),
                          r(e[t], e, t, a + 1, o));
                      }));
            };
          (Array.isArray(data)
            ? data.forEach((e, t) => {
                r(e, data, t, 0, 50);
              })
            : "object" == typeof data &&
              null !== data &&
              Object.keys(data).forEach((key) => {
                let e = 50;
                ("nodes" === key
                  ? (e = 100)
                  : "connections" === key
                    ? (e = 90)
                    : "history" === key && (e = 50),
                  r(data[key], data, key, 0, e));
              }),
            console.log(
              `[StreamingHydration] Found ${i.length} Base64 items to convert`,
            ),
            null == e || e(5, `发现 ${i.length} 个图片需要转换`),
            i.sort((e, t) => t.priority - e.priority));
          const a = Math.ceil(i.length / 5);
          for (let s = 0; s < a; s++) {
            const t = 5 * s,
              r = Math.min(t + 5, i.length),
              a = i.slice(t, r).map(async ({ obj: e, key: key, parent: t }) => {
                try {
                  const base64 = e,
                    size = base64.length;
                  o.totalSize += size;
                  const i = await et(base64);
                  ((t[key] = i), o.converted++);
                } catch (error) {
                  (console.error(
                    "[StreamingHydration] Failed to convert Base64:",
                    error,
                  ),
                    o.skipped++);
                }
              });
            await Promise.all(a);
            const l = Math.round((r / i.length) * 100);
            (null == e ||
              e(5 + 0.9 * l, `已转换 ${o.converted}/${i.length} 个图片`),
              await new Promise((e) => setTimeout(e, 10)));
          }
          return (
            console.log("[StreamingHydration] Conversion complete:", {
              converted: o.converted,
              skipped: o.skipped,
              savedMemory: `${(o.totalSize / 1024 / 1024).toFixed(2)}MB`,
            }),
            null == e || e(95, "图片转换完成"),
            { data: data, stats: o }
          );
        },
        normalizeDataUrl: Qe,
        serializeProjectData: async function (data, e = 10) {
          console.log(
            "[Serialization] Starting Blob URL → Base64 conversion...",
          );
          const t = { converted: 0, skipped: 0 },
            o = JSON.parse(JSON.stringify(data, (key, value) => value)),
            i = [];
          Array.isArray(o)
            ? o.forEach((e, t) => {
                i.push({ obj: e, key: t, parent: o, depth: 0 });
              })
            : "object" == typeof o &&
              null !== o &&
              Object.keys(o).forEach((key) => {
                i.push({ obj: o[key], key: key, parent: o, depth: 0 });
              });
          const r = [];
          for (; i.length > 0; ) {
            const { obj: o, key: key, parent: a, depth: s } = i.shift();
            if (s > e) t.skipped++;
            else if (He(o)) {
              const e = tt(o)
                .then((base64) => {
                  ((a[key] = base64),
                    t.converted++,
                    t.converted % 10 == 0 &&
                      console.log(
                        `[Serialization] Converted ${t.converted} Blob URLs to Base64`,
                      ));
                })
                .catch((error) => {
                  (console.error(
                    `[Serialization] Failed to convert Blob URL at key "${key}":`,
                    error,
                  ),
                    t.skipped++);
                });
              r.push(e);
            } else if (qe(o)) {
              const e = tt(o)
                .then((base64) => {
                  ((a[key] = base64),
                    t.converted++,
                    t.converted % 10 == 0 &&
                      console.log(
                        `[Serialization] Converted ${t.converted} remote URLs to Base64`,
                      ));
                })
                .catch((error) => {
                  (console.error(
                    `[Serialization] Failed to convert remote URL at key "${key}":`,
                    error,
                  ),
                    t.skipped++);
                });
              r.push(e);
            } else
              Array.isArray(o)
                ? o.forEach((e, t) => {
                    i.push({ obj: e, key: t, parent: o, depth: s + 1 });
                  })
                : "object" == typeof o &&
                  null !== o &&
                  Object.keys(o).forEach((e) => {
                    i.push({ obj: o[e], key: e, parent: o, depth: s + 1 });
                  });
          }
          return (
            await Promise.all(r),
            console.log("[Serialization] Conversion complete:", {
              converted: t.converted,
              skipped: t.skipped,
            }),
            { data: o, stats: t }
          );
        },
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  at = "thumbnails",
  st = "previews",
  lt = "sizes",
  ct = "metadata",
  dt = 128,
  ut = 0.5,
  gt = 896,
  mt = 0.4,
  ht = 256,
  pt = [128, 256, 512, 1024, 2048],
  ft = { 128: 0.4, 256: 0.55, 512: 0.65, 1024: 0.72, 2048: 0.78 },
  wt =
    "undefined" != typeof navigator &&
    /win/i.test(navigator.platform + navigator.userAgent),
  yt =
    "undefined" != typeof navigator &&
    (navigator.platform.toLowerCase().includes("mac") ||
      navigator.platform.toLowerCase().includes("win") ||
      navigator.userAgent.toLowerCase().includes("mac") ||
      navigator.userAgent.toLowerCase().includes("win")),
  vt = wt ? 250 : yt ? 420 : 120,
  bt = wt ? 35 : yt ? 60 : 25,
  _t = new Map(),
  It = new Map(),
  St = new Map(),
  jt = new Map(),
  At = [],
  Pt = [],
  xt = [];
const kt = new (class {
    constructor() {
      (u(this, "db", null),
        u(this, "initPromise", null),
        u(this, "initFailed", !1),
        u(this, "workerRef", null),
        u(this, "workerReady", !1),
        u(this, "workerQueue", []));
    }
    async init() {
      if (this.initFailed) return;
      if (this.db) return;
      if (this.initPromise) return this.initPromise;
      this.initPromise = new Promise((e, t) => {
        try {
          if ("undefined" == typeof indexedDB)
            return (
              console.warn("[ThumbnailStore] IndexedDB not available"),
              void e()
            );
          const t = indexedDB.open("qiaodoumayi_thumbnail_store", 3);
          ((t.onerror = () => {
            (console.error(
              "[ThumbnailStore] Failed to open IndexedDB:",
              t.error,
            ),
              (this.initFailed = !0),
              e());
          }),
            (t.onsuccess = () => {
              ((this.db = t.result),
                console.log("[ThumbnailStore] IndexedDB initialized"),
                e());
            }),
            (t.onupgradeneeded = (e) => {
              const t = e.target.result;
              if (
                (t.objectStoreNames.contains(at) ||
                  t.createObjectStore(at, { keyPath: "id" }),
                t.objectStoreNames.contains(st) ||
                  t.createObjectStore(st, { keyPath: "id" }),
                !t.objectStoreNames.contains(lt))
              ) {
                const e = t.createObjectStore(lt, { keyPath: ["id", "size"] });
                (e.createIndex("byId", "id", { unique: !1 }),
                  e.createIndex("bySize", "size", { unique: !1 }));
              }
              if (!t.objectStoreNames.contains(ct)) {
                t.createObjectStore(ct, { keyPath: "id" }).createIndex(
                  "createdAt",
                  "createdAt",
                  { unique: !1 },
                );
              }
              console.log("[ThumbnailStore] Object stores created");
            }));
        } catch (error) {
          (console.error("[ThumbnailStore] Init error:", error),
            (this.initFailed = !0),
            e());
        }
      });
      const e = new Promise((e, t) => {
        setTimeout(() => t(new Error("Timeout")), 5e3);
      });
      try {
        await Promise.race([this.initPromise, e]);
      } catch {
        this.initFailed = !0;
      }
    }
    generateId(e, type) {
      return `${type}_${e}`;
    }
    async initWorker() {
      if (this.workerRef && this.workerReady) return this.workerRef;
      if ("undefined" == typeof OffscreenCanvas || "undefined" == typeof Worker)
        return (
          console.warn(
            "[ThumbnailStore] OffscreenCanvas or Worker not supported, falling back to main thread",
          ),
          null
        );
      try {
        return (
          (this.workerRef = new Worker(
            new URL(
              "" + new URL("thumbnailWorker-Cja4CBy7.js", import.meta.url).href,
              import.meta.url,
            ),
            { type: "module" },
          )),
          (this.workerRef.onmessage = (e) => {
            const result = e.data,
              t = this.workerQueue.find((e) => e.id === result.id);
            t &&
              (result.error
                ? this.generateThumbnailMainThread(
                    t.imageData,
                    t.maxSize,
                    t.quality,
                  )
                    .then(t.resolve)
                    .catch(t.reject)
                : t.resolve(result.thumbnailData),
              (this.workerQueue = this.workerQueue.filter(
                (e) => e.id !== result.id,
              )));
          }),
          (this.workerRef.onerror = (error) => {
            (console.error("[ThumbnailStore] Worker error:", error),
              this.workerQueue.forEach((e) => {
                this.generateThumbnailMainThread(
                  e.imageData,
                  e.maxSize,
                  e.quality,
                )
                  .then(e.resolve)
                  .catch(e.reject);
              }),
              (this.workerQueue = []),
              (this.workerRef = null),
              (this.workerReady = !1));
          }),
          (this.workerReady = !0),
          this.workerRef
        );
      } catch (error) {
        return (
          console.warn(
            "[ThumbnailStore] Failed to create Worker, falling back to main thread:",
            error,
          ),
          null
        );
      }
    }
    async generateThumbnailMainThread(e, t, o) {
      return new Promise((i, r) => {
        const a = new Image();
        a.crossOrigin = "anonymous";
        const s = Ye(e);
        ((a.onload = () => {
          try {
            if (s !== e)
              try {
                URL.revokeObjectURL(s);
              } catch {}
            const r = document.createElement("canvas"),
              l = r.getContext("2d", { alpha: !0 });
            if (!l) return void i(e);
            let width = a.naturalWidth,
              height = a.naturalHeight;
            if (width > t || height > t) {
              const e = Math.min(t / width, t / height);
              ((width = Math.round(width * e)),
                (height = Math.round(height * e)));
            }
            ((r.width = width),
              (r.height = height),
              (l.imageSmoothingEnabled = !0),
              (l.imageSmoothingQuality = "medium"),
              l.drawImage(a, 0, 0, width, height));
            const result = r.toDataURL("image/jpeg", o);
            i(result);
          } catch (r) {
            (console.warn("[ThumbnailStore] Generate thumbnail failed:", r),
              i(e));
          }
        }),
          (a.onerror = () => {
            if ((console.warn("[ThumbnailStore] Image load failed"), s !== e))
              try {
                URL.revokeObjectURL(s);
              } catch {}
            i(e);
          }),
          (a.src = s));
      });
    }
    async generateThumbnail(e, t = dt, o = ut) {
      const i = await this.initWorker();
      return i && this.workerReady
        ? new Promise((r, a) => {
            const s = `thumb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            (this.workerQueue.push({
              id: s,
              imageData: e,
              maxSize: t,
              quality: o,
              resolve: r,
              reject: a,
            }),
              i.postMessage({
                type: "generate",
                id: s,
                imageData: e,
                maxSize: t,
                quality: o,
              }),
              setTimeout(() => {
                this.workerQueue.find((e) => e.id === s) &&
                  ((this.workerQueue = this.workerQueue.filter(
                    (e) => e.id !== s,
                  )),
                  this.generateThumbnailMainThread(e, t, o).then(r).catch(a));
              }, 5e3));
          })
        : "undefined" != typeof requestIdleCallback
          ? new Promise((i) => {
              requestIdleCallback(() => {
                this.generateThumbnailMainThread(e, t, o)
                  .then(i)
                  .catch(() => i(e));
              });
            })
          : this.generateThumbnailMainThread(e, t, o);
    }
    async getImageDimensions(e) {
      return new Promise((t) => {
        const o = new Image();
        ((o.onload = () => {
          t({ width: o.naturalWidth, height: o.naturalHeight });
        }),
          (o.onerror = () => {
            t({ width: 0, height: 0 });
          }),
          (o.src = e));
      });
    }
    async generateAndStoreStandardSizes(e, t) {
      if ((await this.init(), !t.startsWith("data:image"))) return;
      const o = await this.getImageDimensions(t),
        i = o.width,
        r = o.height,
        a = i > ht || r > ht ? pt.filter((size) => i > size || r > size) : [];
      if (0 !== a.length)
        try {
          const o = a.map((size) =>
              this.generateThumbnail(t, size, ft[size] || 0.7).then((data) => ({
                size: size,
                data: data,
              })),
            ),
            s = await Promise.all(o);
          if (this.db) {
            const o = this.db.transaction([lt, ct], "readwrite"),
              a = o.objectStore(lt),
              l = o.objectStore(ct);
            s.forEach(({ size: size, data: data }) => {
              const t = {
                id: e,
                size: size,
                data: data,
                size_bytes: 2 * data.length,
                createdAt: Date.now(),
              };
              a.put(t);
              const o = `${e}_${size}`;
              this.updateSizeThumbnailCache(o, data);
            });
            const c = jt.get(e) || {
              id: e,
              originalSize: 2 * t.length,
              width: i,
              height: r,
              type: "image",
              hasThumbnail: !1,
              hasPreview: !1,
              availableSizes: [],
              createdAt: Date.now(),
            };
            ((c.availableSizes = s.map((e) => e.size)),
              jt.set(e, c),
              l.put(c),
              await new Promise((e, t) => {
                ((o.oncomplete = () => e()), (o.onerror = () => t(o.error)));
              }));
          }
          console.log(
            `[ThumbnailStore] ✅ Stored ${s.length} standard sizes for ${e}:`,
            a,
          );
        } catch (error) {
          console.warn(
            "[ThumbnailStore] Failed to generate standard sizes:",
            error,
          );
        }
    }
    async updateAccessTime(e) {
      const t = jt.get(e);
      t && (t.lastAccessed = Date.now());
    }
    async getBestMatchThumbnail(e, t) {
      (await this.init(), this.updateAccessTime(e).catch(() => {}));
      const o = `${e}_${t}`;
      if (St.has(o)) {
        const e = xt.indexOf(o);
        return (e > -1 && (xt.splice(e, 1), xt.push(o)), St.get(o) || null);
      }
      const i = jt.get(e),
        r = (null == i ? void 0 : i.availableSizes) || [];
      if (0 === r.length && this.db) {
        const t = await new Promise((t) => {
          try {
            const o = this.db.transaction([ct], "readonly"),
              i = o.objectStore(ct).get(e);
            ((i.onsuccess = () => t(i.result || null)),
              (i.onerror = () => t(null)));
          } catch {
            t(null);
          }
        });
        t && (jt.set(e, t), r.push(...(t.availableSizes || [])));
      }
      let a = null;
      if (r.length > 0) {
        const e = r.filter((e) => e <= t);
        a = e.length > 0 ? Math.max(...e) : Math.min(...r);
      }
      return a && this.db
        ? new Promise((t) => {
            try {
              const o = this.db.transaction([lt], "readonly"),
                i = o.objectStore(lt).get([e, a]);
              ((i.onsuccess = () => {
                const o = i.result;
                if (o) {
                  const i = `${e}_${a}`;
                  (this.updateSizeThumbnailCache(i, o.data), t(o.data));
                } else t(null);
              }),
                (i.onerror = () => t(null)));
            } catch {
              t(null);
            }
          })
        : null;
    }
    updateSizeThumbnailCache(e, data) {
      const t = xt.indexOf(e);
      (t > -1 && xt.splice(t, 1), xt.push(e));
      for (; St.size >= 500 && xt.length > 0; ) {
        const e = xt.shift();
        e && St.delete(e);
      }
      St.set(e, data);
    }
    async storeWithThumbnails(e, t) {
      if ((await this.init(), !t.startsWith("data:image"))) return;
      const o = 2 * t.length;
      try {
        const i = await this.getImageDimensions(t);
        if (!(o >= 51200 || i.width > ht || i.height > ht)) return;
        const [r, a] = await Promise.all([
            this.generateThumbnail(t, dt, ut),
            this.generateThumbnail(t, gt, mt),
          ]),
          s = {
            id: e,
            originalSize: o,
            width: i.width,
            height: i.height,
            type: "image",
            hasThumbnail: !0,
            hasPreview: !0,
            createdAt: Date.now(),
          };
        if (this.db) {
          const t = this.db.transaction([at, st, ct], "readwrite"),
            o = t.objectStore(at),
            i = t.objectStore(st),
            l = t.objectStore(ct);
          (o.put({ id: e, data: r, size: 2 * r.length }),
            i.put({ id: e, data: a, size: 2 * a.length }),
            l.put(s),
            await new Promise((e, o) => {
              ((t.oncomplete = () => e()), (t.onerror = () => o(t.error)));
            }));
        }
        (this.updateThumbnailCache(e, r),
          this.updatePreviewCache(e, a),
          jt.set(e, s),
          x(
            async () => {
              const { localCacheManager: e } = await Promise.resolve().then(
                () => pr,
              );
              return { localCacheManager: e };
            },
            void 0,
            import.meta.url,
          )
            .then(({ localCacheManager: t }) => {
              t.isAvailable() &&
                t.saveThumbnail(e, a, "preview").catch((e) => {
                  console.warn(
                    "[ThumbnailStore] 预览图(896px)保存到本地失败:",
                    e,
                  );
                });
            })
            .catch((e) => {
              console.warn("[ThumbnailStore] 加载 LocalCacheManager 失败:", e);
            }),
          console.log(
            "[ThumbnailStore] Stored thumbnails for:",
            e,
            "thumb:",
            Math.round(r.length / 1024),
            "KB",
            "preview:",
            Math.round(a.length / 1024),
            "KB",
          ));
      } catch (error) {
        console.warn("[ThumbnailStore] Store failed:", error);
      }
    }
    updateThumbnailCache(e, data) {
      const t = At.indexOf(e);
      for (
        t > -1 && At.splice(t, 1), At.push(e);
        _t.size >= vt && At.length > 0;
      ) {
        const e = At.shift();
        e && _t.delete(e);
      }
      _t.set(e, data);
    }
    updatePreviewCache(e, data) {
      const t = Pt.indexOf(e);
      for (
        t > -1 && Pt.splice(t, 1), Pt.push(e);
        It.size >= bt && Pt.length > 0;
      ) {
        const e = Pt.shift();
        e && It.delete(e);
      }
      It.set(e, data);
    }
    async getThumbnail(e) {
      if (_t.has(e)) {
        const t = At.indexOf(e);
        return (t > -1 && (At.splice(t, 1), At.push(e)), _t.get(e) || null);
      }
      return (
        await this.init(),
        this.db
          ? new Promise((t) => {
              try {
                const o = this.db.transaction([at], "readonly"),
                  i = o.objectStore(at).get(e);
                ((i.onsuccess = () => {
                  const o = i.result;
                  o
                    ? (this.updateThumbnailCache(e, o.data), t(o.data))
                    : t(null);
                }),
                  (i.onerror = () => t(null)));
              } catch {
                t(null);
              }
            })
          : null
      );
    }
    async getPreview(e) {
      if (It.has(e)) {
        const t = Pt.indexOf(e);
        return (t > -1 && (Pt.splice(t, 1), Pt.push(e)), It.get(e) || null);
      }
      return (
        await this.init(),
        this.db
          ? new Promise((t) => {
              try {
                const o = this.db.transaction([st], "readonly"),
                  i = o.objectStore(st).get(e);
                ((i.onsuccess = () => {
                  const o = i.result;
                  o ? (this.updatePreviewCache(e, o.data), t(o.data)) : t(null);
                }),
                  (i.onerror = () => t(null)));
              } catch {
                t(null);
              }
            })
          : null
      );
    }
    async getImageForZoom(e, t, o) {
      if (t < 0.3) {
        const t = await this.getThumbnail(e);
        if (t) return t;
      }
      if (t < 0.8) {
        const t = await this.getPreview(e);
        if (t) return t;
      }
      return o || null;
    }
    hasThumbnail(e) {
      var t;
      return (
        _t.has(e) || !0 === (null == (t = jt.get(e)) ? void 0 : t.hasThumbnail)
      );
    }
    hasPreview(e) {
      var t;
      return (
        It.has(e) || !0 === (null == (t = jt.get(e)) ? void 0 : t.hasPreview)
      );
    }
    async delete(e) {
      (_t.delete(e), It.delete(e), jt.delete(e));
      const t = At.indexOf(e);
      t > -1 && At.splice(t, 1);
      const o = Pt.indexOf(e);
      if ((o > -1 && Pt.splice(o, 1), await this.init(), this.db))
        try {
          const t = this.db.transaction([at, st, ct], "readwrite");
          (t.objectStore(at).delete(e),
            t.objectStore(st).delete(e),
            t.objectStore(ct).delete(e));
        } catch (error) {
          console.warn("[ThumbnailStore] Delete failed:", error);
        }
    }
    async clear() {
      if (
        (_t.clear(),
        It.clear(),
        jt.clear(),
        (At.length = 0),
        (Pt.length = 0),
        await this.init(),
        this.db)
      )
        try {
          const e = this.db.transaction([at, st, ct], "readwrite");
          (e.objectStore(at).clear(),
            e.objectStore(st).clear(),
            e.objectStore(ct).clear(),
            console.log("[ThumbnailStore] All data cleared"));
        } catch (error) {
          console.warn("[ThumbnailStore] Clear failed:", error);
        }
    }
    getStats() {
      return { thumbnails: _t.size, previews: It.size, metadata: jt.size };
    }
    async clearMemoryCache() {
      (console.log("[ThumbnailStore] Clearing memory cache"),
        _t.clear(),
        It.clear(),
        jt.clear(),
        (At.length = 0),
        (Pt.length = 0),
        this.clearSizeThumbnailCache());
    }
    async preloadThumbnails(e) {
      if ((await this.init(), !this.db)) return;
      const t = e.filter((e) => !_t.has(e));
      if (0 !== t.length) {
        console.log("[ThumbnailStore] Preloading", t.length, "thumbnails");
        try {
          const e = this.db.transaction([at], "readonly").objectStore(at);
          await Promise.all(
            t.map(
              (t) =>
                new Promise((o) => {
                  const i = e.get(t);
                  ((i.onsuccess = () => {
                    const e = i.result;
                    (e && this.updateThumbnailCache(t, e.data), o());
                  }),
                    (i.onerror = () => o()));
                }),
            ),
          );
        } catch (error) {
          console.warn("[ThumbnailStore] Preload failed:", error);
        }
      }
    }
    clearSizeThumbnailCache() {
      (St.clear(), (xt.length = 0));
    }
  })(),
  Tt = Object.freeze(
    Object.defineProperty(
      { __proto__: null, SCALE_THRESHOLD_PX: ht, thumbnailStore: kt },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  $t = "qiaodoumayi_content_store",
  Mt = "contents",
  Ct =
    "undefined" != typeof navigator &&
    /win/i.test(navigator.platform + navigator.userAgent),
  Ut =
    "undefined" != typeof navigator &&
    (navigator.platform.toLowerCase().includes("mac") ||
      navigator.platform.toLowerCase().includes("win") ||
      navigator.userAgent.toLowerCase().includes("mac") ||
      navigator.userAgent.toLowerCase().includes("win")),
  Ot = new Map(),
  Et = Ct ? 52428800 : Ut ? 83886080 : 31457280,
  Lt = Ct ? 80 : Ut ? 150 : 50;
let Rt = 0;
const Nt = [],
  Dt = new Map(),
  Ft = Ct ? 48 : 96,
  Wt = new Map(),
  zt = [];
const Bt = new (class {
    constructor() {
      (u(this, "db", null),
        u(this, "initPromise", null),
        u(this, "initFailed", !1));
    }
    async init() {
      if (this.initFailed)
        return void console.warn(
          "[ContentStore] IndexedDB init previously failed, running in degraded mode",
        );
      if (this.db) {
        if (this.db.objectStoreNames.contains(Mt)) return;
        (console.warn(
          "[ContentStore] Object store not found, reinitializing...",
        ),
          this.db.close(),
          (this.db = null),
          (this.initPromise = null));
      }
      if (this.initPromise) return this.initPromise;
      const e = new Promise((e, t) => {
          setTimeout(() => {
            t(new Error("IndexedDB initialization timeout (5s)"));
          }, 5e3);
        }),
        t = new Promise((e, t) => {
          try {
            if ("undefined" == typeof indexedDB)
              return (
                console.warn("[ContentStore] IndexedDB not available"),
                void e()
              );
            const o = indexedDB.open($t);
            ((o.onsuccess = () => {
              const i = o.result,
                r = !i.objectStoreNames.contains(Mt),
                a = i.version;
              if ((i.close(), r)) {
                console.log(
                  "[ContentStore] Object store missing, upgrading database...",
                );
                const o = indexedDB.open($t, a + 1);
                ((o.onerror = () => {
                  (console.error(
                    "[ContentStore] Failed to upgrade IndexedDB:",
                    o.error,
                  ),
                    t(o.error));
                }),
                  (o.onsuccess = () => {
                    ((this.db = o.result),
                      console.log(
                        "[ContentStore] IndexedDB upgraded and initialized",
                      ),
                      e());
                  }),
                  (o.onupgradeneeded = (e) => {
                    const t = e.target.result;
                    if (!t.objectStoreNames.contains(Mt)) {
                      const e = t.createObjectStore(Mt, { keyPath: "id" });
                      (e.createIndex("type", "type", { unique: !1 }),
                        e.createIndex("createdAt", "createdAt", { unique: !1 }),
                        console.log(
                          "[ContentStore] Object store created during upgrade",
                        ));
                    }
                  }));
              } else {
                const o = indexedDB.open($t, a);
                ((o.onerror = () => {
                  (console.error(
                    "[ContentStore] Failed to open IndexedDB:",
                    o.error,
                  ),
                    t(o.error));
                }),
                  (o.onsuccess = () => {
                    ((this.db = o.result),
                      console.log("[ContentStore] IndexedDB initialized"),
                      e());
                  }));
              }
            }),
              (o.onerror = () => {
                (console.error(
                  "[ContentStore] Failed to check IndexedDB:",
                  o.error,
                ),
                  t(o.error));
              }),
              (o.onupgradeneeded = (e) => {
                const t = e.target.result;
                if (!t.objectStoreNames.contains(Mt)) {
                  const e = t.createObjectStore(Mt, { keyPath: "id" });
                  (e.createIndex("type", "type", { unique: !1 }),
                    e.createIndex("createdAt", "createdAt", { unique: !1 }),
                    console.log(
                      "[ContentStore] Object store created (new database)",
                    ));
                }
              }));
          } catch (error) {
            (console.error(
              "[ContentStore] Error during IndexedDB init:",
              error,
            ),
              t(error));
          }
        });
      return (
        (this.initPromise = Promise.race([t, e]).catch((error) => {
          (console.error("[ContentStore] IndexedDB init failed:", error),
            (this.initFailed = !0));
        })),
        this.initPromise
      );
    }
    generateId() {
      return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    detectType(content) {
      return content.startsWith("data:image")
        ? "image"
        : content.startsWith("data:video")
          ? "video"
          : content.startsWith("data:audio")
            ? "audio"
            : content.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)
              ? "image"
              : content.match(/\.(mp4|webm|ogg|mov)$/i)
                ? "video"
                : content.match(/\.(mp3|wav|ogg|m4a|aac)$/i)
                  ? "audio"
                  : "unknown";
    }
    estimateSize(content) {
      return 2 * content.length;
    }
    shouldStore(content) {
      return (
        !!content &&
        !!content.startsWith("data:") &&
        this.estimateSize(content) > 51200
      );
    }
    isContentRef(value) {
      return "string" == typeof value && value.startsWith("content_ref:");
    }
    extractId(e) {
      return e.replace("content_ref:", "");
    }
    createRef(e) {
      return `content_ref:${e}`;
    }
    updateMemoryCache(e, content) {
      const size = this.estimateSize(content);
      if (size > Et / 2) return void this.addToLargeCache(e, content);
      for (; (Rt + size > Et || Ot.size >= Lt) && Nt.length > 0; ) {
        const e = Nt.shift();
        if (e && Ot.has(e)) {
          const t = Ot.get(e);
          (t && (Rt -= this.estimateSize(t)), Ot.delete(e));
        }
      }
      const t = Nt.indexOf(e);
      (t > -1 && Nt.splice(t, 1),
        Nt.push(e),
        Ot.has(e) || (Ot.set(e, content), (Rt += size)));
    }
    addToLargeCache(e, content) {
      if (Wt.has(e)) {
        const t = zt.indexOf(e);
        return (t > -1 && zt.splice(t, 1), void zt.push(e));
      }
      for (; zt.length >= Ft && zt.length > 0; ) {
        const e = zt.shift();
        e && Wt.delete(e);
      }
      (Wt.set(e, content), zt.push(e));
    }
    async store(content) {
      await this.init();
      const e = this.generateId(),
        size = this.estimateSize(content),
        type = this.detectType(content);
      if (
        ("image" === type &&
          size > 102400 &&
          kt.storeWithThumbnails(e, content).catch((e) => {
            console.warn("[ContentStore] Failed to generate thumbnails:", e);
          }),
        !this.db || !this.db.objectStoreNames.contains(Mt))
      )
        return (
          console.warn(
            "[ContentStore] IndexedDB not available, using memory cache only",
          ),
          this.updateMemoryCache(e, content),
          e
        );
      const t = {
        id: e,
        content: content,
        type: type,
        size: size,
        createdAt: Date.now(),
      };
      return (
        console.log(
          "[ContentStore] Storing content:",
          e,
          "size:",
          content.length,
          "type:",
          t.type,
        ),
        new Promise((o, i) => {
          try {
            const i = this.db.transaction([Mt], "readwrite"),
              r = i.objectStore(Mt).put(t);
            ((r.onsuccess = () => {
              (console.log("[ContentStore] Content stored successfully:", e),
                this.updateMemoryCache(e, content),
                size > 512e3 &&
                  invoke("rust_cache_set", { id: e, value: content }).catch(
                    (e) => {
                      console.warn("[ContentStore] Rust cache set failed:", e);
                    },
                  ),
                o(e));
            }),
              (r.onerror = () => {
                (console.error(
                  "[ContentStore] Failed to store content:",
                  r.error,
                ),
                  this.updateMemoryCache(e, content),
                  o(e));
              }));
          } catch (error) {
            (console.warn(
              "[ContentStore] Store failed, using memory cache:",
              error,
            ),
              this.updateMemoryCache(e, content),
              o(e));
          }
        })
      );
    }
    async storeImageUrlAsRef(url) {
      if (this.isContentRef(url)) return url;
      let e = url;
      if (url.startsWith("blob:")) {
        const t = await fetch(url),
          blob = await t.blob();
        e = await new Promise((e, t) => {
          const o = new FileReader();
          ((o.onload = () => e(o.result)),
            (o.onerror = t),
            o.readAsDataURL(blob));
        });
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      if (!e.startsWith("data:")) return url;
      const t = await this.store(e);
      return this.createRef(t);
    }
    async getForZoom(e, t) {
      if (void 0 !== t && t < 0.8) {
        const o = await kt.getImageForZoom(e, t);
        if (o) return o;
      }
      return this.get(e);
    }
    getFromCacheSync(e) {
      if (Ot.has(e)) {
        const t = Nt.indexOf(e);
        return (t > -1 && Nt.splice(t, 1), Nt.push(e), Ot.get(e) || null);
      }
      if (Wt.has(e)) {
        const t = zt.indexOf(e);
        return (t > -1 && zt.splice(t, 1), zt.push(e), Wt.get(e) || null);
      }
      return null;
    }
    async get(e) {
      if (Ot.has(e)) {
        const t = Nt.indexOf(e);
        return (t > -1 && Nt.splice(t, 1), Nt.push(e), Ot.get(e) || null);
      }
      if (Wt.has(e)) {
        const t = zt.indexOf(e);
        return (t > -1 && zt.splice(t, 1), zt.push(e), Wt.get(e) || null);
      }
      const t = Dt.get(e);
      if (t) return t;
      const o = this.getInternal(e);
      return (
        Dt.set(e, o),
        o.finally(() => {
          Dt.delete(e);
        }),
        o
      );
    }
    async getInternal(e) {
      try {
        const t = await invoke("rust_cache_get", { id: e });
        if (null != t && t.length > 0) return (this.updateMemoryCache(e, t), t);
      } catch (t) {}
      if (Ot.has(e)) {
        const t = Nt.indexOf(e);
        return (t > -1 && Nt.splice(t, 1), Nt.push(e), Ot.get(e) || null);
      }
      return (
        await this.init(),
        this.db && this.db.objectStoreNames.contains(Mt)
          ? new Promise((t) => {
              try {
                const o = this.db.transaction([Mt], "readonly"),
                  i = o.objectStore(Mt).get(e);
                ((i.onsuccess = () => {
                  const o = i.result;
                  o
                    ? (this.updateMemoryCache(e, o.content), t(o.content))
                    : t(null);
                }),
                  (i.onerror = () => t(null)));
              } catch {
                t(null);
              }
            })
          : null
      );
    }
    async delete(e) {
      try {
        await invoke("rust_cache_remove", { id: e });
      } catch (t) {}
      if (Ot.has(e)) {
        const content = Ot.get(e);
        (content && (Rt -= this.estimateSize(content)), Ot.delete(e));
        const t = Nt.indexOf(e);
        t > -1 && Nt.splice(t, 1);
      }
      if ((await this.init(), this.db && this.db.objectStoreNames.contains(Mt)))
        return new Promise((t, o) => {
          try {
            const o = this.db.transaction([Mt], "readwrite"),
              i = o.objectStore(Mt).delete(e);
            ((i.onsuccess = () => t()),
              (i.onerror = () => {
                (console.warn("[ContentStore] Delete failed:", i.error), t());
              }));
          } catch (error) {
            (console.warn("[ContentStore] Delete failed:", error), t());
          }
        });
    }
    async clear() {
      if ((Ot.clear(), (Nt.length = 0), (Rt = 0), await this.init(), this.db)) {
        if (this.db.objectStoreNames.contains(Mt))
          return new Promise((e, t) => {
            try {
              const o = this.db.transaction([Mt], "readwrite"),
                i = o.objectStore(Mt).clear();
              ((i.onsuccess = () => {
                (console.log("[ContentStore] All contents cleared"), e());
              }),
                (i.onerror = () => t(i.error)));
            } catch (error) {
              (console.warn(
                "[ContentStore] Failed to clear, object store may not exist:",
                error,
              ),
                e());
            }
          });
        console.warn("[ContentStore] Object store not found, skipping clear");
      }
    }
    async getStats() {
      return (
        await this.init(),
        this.db && this.db.objectStoreNames.contains(Mt)
          ? new Promise((e) => {
              try {
                const t = this.db.transaction([Mt], "readonly"),
                  o = t.objectStore(Mt),
                  i = o.count();
                let r = 0;
                ((o.openCursor().onsuccess = (e) => {
                  const t = e.target.result;
                  t && ((r += t.value.size), t.continue());
                }),
                  (i.onsuccess = () => {
                    t.oncomplete = () => {
                      e({ count: i.result, totalSize: r, memoryCacheSize: Rt });
                    };
                  }),
                  (i.onerror = () => {
                    (console.warn("[ContentStore] getStats count error"),
                      e({ count: 0, totalSize: 0, memoryCacheSize: Rt }));
                  }));
              } catch (error) {
                (console.warn("[ContentStore] getStats failed:", error),
                  e({ count: 0, totalSize: 0, memoryCacheSize: Rt }));
              }
            })
          : { count: 0, totalSize: 0, memoryCacheSize: Rt }
      );
    }
    clearMemoryCache() {
      (Ot.clear(),
        (Nt.length = 0),
        (Rt = 0),
        Wt.clear(),
        (zt.length = 0),
        console.log("[ContentStore] Memory cache cleared"));
    }
  })(),
  Gt = Object.freeze(
    Object.defineProperty(
      { __proto__: null, contentStore: Bt },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
function Jt(e, t) {
  let o = null;
  return function (...args) {
    (o && clearTimeout(o),
      (o = setTimeout(() => {
        ((o = null), e(...args));
      }, t)));
  };
}
let Vt = 0;
function Kt() {
  const e = performance.now(),
    t = Vt++;
  return (
    Vt > Number.MAX_SAFE_INTEGER - 1e3 && (Vt = 0),
    `${Math.floor(e)}-${t}-${Math.random().toString(36).substr(2, 9)}`
  );
}
function Ht(value, e = "未命名项目") {
  var t;
  const o = (value || "").trim();
  if (!o) return e;
  const parts = o.split(/[/\\]/);
  return (null == (t = parts[parts.length - 1]) ? void 0 : t.trim()) || o || e;
}
function qt(e = new Date()) {
  const t = -e.getTimezoneOffset(),
    o = Math.floor(Math.abs(t) / 60),
    i = Math.abs(t) % 60,
    r = t >= 0 ? "+" : "-",
    a = (e) => String(e).padStart(2, "0");
  return `${e.getFullYear()}-${a(e.getMonth() + 1)}-${a(e.getDate())}T${a(e.getHours())}:${a(e.getMinutes())}:${a(e.getSeconds())}.${String(e.getMilliseconds()).padStart(3, "0")}${r}${a(o)}:${a(i)}`;
}
function Zt(format = "compact", e = new Date()) {
  const t = (e) => String(e).padStart(2, "0"),
    o = e.getFullYear(),
    i = t(e.getMonth() + 1),
    r = t(e.getDate()),
    a = t(e.getHours()),
    s = t(e.getMinutes()),
    l = t(e.getSeconds());
  return "standard" === format
    ? `${o}-${i}-${r}_${a}-${s}-${l}`
    : `${o}${i}${r}_${a}${s}${l}`;
}
function Qt(e = new Date()) {
  const t = (e) => String(e).padStart(2, "0");
  return `${e.getFullYear()}-${t(e.getMonth() + 1)}-${t(e.getDate())}`;
}
const Xt = [
  "vlabvod.com",
  "dreamina.jimeng.com",
  "dreamnia.jimeng.com",
  "byteimg.com",
  "v3-dreamnia.jimeng.com",
  "v9-dreamnia.jimeng.com",
];
function Yt(url) {
  if (!url || "string" != typeof url) return !1;
  try {
    const e = new URL(url).hostname.toLowerCase();
    return Xt.some((t) => e === t || e.endsWith("." + t));
  } catch {
    return !1;
  }
}
function eo(url, e) {
  if (!url || "string" != typeof url) return "";
  if (!Yt(url)) return url;
  const t = (null == M ? void 0 : M.API_BASE_URL).replace(/\/+$/, "");
  return t ? `${t}/v1/videos/proxy?url=${encodeURIComponent(url)}` : url;
}
async function to(url, e, filename) {
  if (url)
    try {
      let blob;
      if (url.startsWith("data:")) {
        const e = await fetch(url);
        blob = await e.blob();
      } else {
        if (!url.startsWith("http://") && !url.startsWith("https://")) return;
        if ("undefined" != typeof window && "__TAURI__" in window)
          try {
            const { downloadWithFallback: e } = await x(
              async () => {
                const { downloadWithFallback: e } =
                  await import("./tauriDownloader-BG3Xb0u0.js");
                return { downloadWithFallback: e };
              },
              __vite__mapDeps([0, 1, 2]),
              import.meta.url,
            );
            if (
              ((blob = await e(url, 12e4)),
              !blob.type &&
                (url.includes(".mp4") ||
                  url.includes("/video") ||
                  (function (url) {
                    const e = url.toLowerCase();
                    return (
                      (e.includes("prod-ss-vidu") ||
                        (e.includes("s3") && e.includes("amazonaws"))) &&
                      (e.includes(".mp4") || e.includes("/video"))
                    );
                  })(url)))
            )
              blob = new Blob([await blob.arrayBuffer()], {
                type: "video/mp4",
              });
            else if (
              !blob.type &&
              (url.includes(".png") ||
                url.includes(".jpg") ||
                url.includes(".jpeg") ||
                url.includes(".webp") ||
                url.includes(".gif"))
            ) {
              const e = url.includes(".png")
                ? "image/png"
                : url.includes(".webp")
                  ? "image/webp"
                  : url.includes(".gif")
                    ? "image/gif"
                    : "image/jpeg";
              blob = new Blob([await blob.arrayBuffer()], { type: e });
            }
          } catch (t) {
            const e = await fetch(url);
            if (!e.ok) throw new Error(`HTTP ${e.status}`);
            blob = await e.blob();
          }
        else {
          const e = await fetch(url);
          if (!e.ok) throw new Error(`HTTP ${e.status}`);
          blob = await e.blob();
        }
      }
      await Be.saveBlobAsset(e, blob, url);
    } catch (error) {
      console.error("[downloadUrlToLocal] ❌ 处理失败:", error);
    }
}
const oo = 1024,
  no = 0.75,
  io = new Map(),
  ro = new Map();
async function ao(blob) {
  if (!blob.type.startsWith("image/"))
    return Promise.resolve({ width: 0, height: 0 });
  const url = URL.createObjectURL(blob);
  return new Promise((e) => {
    const t = new Image();
    ((t.onload = () => {
      (URL.revokeObjectURL(url),
        e({ width: t.naturalWidth, height: t.naturalHeight }));
    }),
      (t.onerror = () => {
        (URL.revokeObjectURL(url), e({ width: 0, height: 0 }));
      }),
      (t.src = url));
  });
}
function so(e) {
  return ro.get(e) ?? null;
}
function lo(e, t) {
  (null == e ? void 0 : e.startsWith("blob:")) && t && io.set(e, t);
}
async function co(blob, e = 1024, t = 0.75) {
  if (!blob.type.startsWith("image/")) return blob;
  if ("function" == typeof createImageBitmap)
    try {
      const o = await createImageBitmap(blob, {
          resizeWidth: e,
          resizeQuality: "high",
        }),
        i = o.width,
        r = o.height;
      if (i <= 0 || r <= 0) return (o.close(), blob);
      const a = document.createElement("canvas");
      ((a.width = i), (a.height = r));
      const s = a.getContext("2d");
      if (!s) return (o.close(), blob);
      (s.drawImage(o, 0, 0), o.close());
      return (
        (await new Promise((e) => {
          a.toBlob((t) => e(t), "image/jpeg", t);
        })) || blob
      );
    } catch {}
  const o = URL.createObjectURL(blob);
  return new Promise((i) => {
    const r = new Image();
    ((r.onload = () => {
      URL.revokeObjectURL(o);
      let a = r.naturalWidth,
        s = r.naturalHeight;
      if (a <= e && s <= e) return void i(blob);
      const l = Math.min(e / a, e / s);
      ((a = Math.round(a * l)), (s = Math.round(s * l)));
      const c = document.createElement("canvas");
      ((c.width = a), (c.height = s));
      const d = c.getContext("2d");
      d
        ? ((d.imageSmoothingEnabled = !0),
          (d.imageSmoothingQuality = "high"),
          d.drawImage(r, 0, 0, a, s),
          c.toBlob((e) => i(e || blob), "image/jpeg", t))
        : i(blob);
    }),
      (r.onerror = () => {
        (URL.revokeObjectURL(o), i(blob));
      }),
      (r.src = o));
  });
}
async function uo(e, t) {
  let o = io.get(e) ?? t ?? null;
  if (!o) return null;
  try {
    return await Be.getAssetBlob(o);
  } catch {
    return null;
  }
}
async function go(e) {
  if (!e) return e;
  if (e.startsWith("content_ref:")) {
    await Bt.init();
    const t = Bt.extractId(e);
    let o = await Bt.get(t);
    if (
      (o ||
        (await new Promise((e) => setTimeout(e, 200)), (o = await Bt.get(t))),
      o)
    )
      return o;
  }
  if (e.startsWith("blob:")) {
    const t = await uo(e);
    if (t) return URL.createObjectURL(t);
  }
  return e;
}
async function mo(e) {
  let t = e;
  if (e.startsWith("content_ref:")) {
    await Bt.init();
    const o = Bt.extractId(e),
      i = await Bt.get(o);
    if (!i) throw new Error(`content_ref 不存在: ${o}`);
    t = i;
  }
  const blob = await fetch(t).then((e) => e.blob());
  if (blob.size <= 819200)
    return new Promise((e, t) => {
      const o = new FileReader();
      ((o.onload = () => e(o.result)), (o.onerror = t), o.readAsDataURL(blob));
    });
  const { processLargeData: o } = await x(
    async () => {
      const { processLargeData: e } = await Promise.resolve().then(() => On);
      return { processLargeData: e };
    },
    void 0,
    import.meta.url,
  );
  return `data:image/jpeg;base64,${await o("process_image", blob, { maxDimension: 1536, quality: 0.78 })}`;
}
async function ho(e, t = 1024) {
  const { url: o, revoke: i } = await fo(e);
  return new Promise((e, r) => {
    const a = new Image();
    a.crossOrigin = "anonymous";
    const s = setTimeout(() => {
      (i && o.startsWith("blob:") && URL.revokeObjectURL(o),
        r(new Error("图片加载超时")));
    }, 3e4);
    ((a.onload = () => {
      (clearTimeout(s), i && o.startsWith("blob:") && URL.revokeObjectURL(o));
      let l = a.naturalWidth,
        c = a.naturalHeight;
      if (l <= 0 || c <= 0) return void r(new Error("图片尺寸无效"));
      const d = Math.min(1, t / Math.max(l, c)),
        u = Math.round(l * d),
        g = Math.round(c * d),
        m = document.createElement("canvas");
      ((m.width = u), (m.height = g));
      const h = m.getContext("2d");
      if (!h) return void r(new Error("无法创建 canvas"));
      ((h.imageSmoothingEnabled = !0),
        (h.imageSmoothingQuality = "high"),
        h.drawImage(a, 0, 0, l, c, 0, 0, u, g));
      const url = m.toDataURL("image/jpeg", 0.88);
      e({ url: url, width: u, height: g });
    }),
      (a.onerror = () => {
        (clearTimeout(s),
          i && o.startsWith("blob:") && URL.revokeObjectURL(o),
          r(new Error("图片加载失败")));
      }),
      (a.src = o));
  });
}
async function po(url, e, filename, t) {
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return url;
  if (Yt(url)) {
    let o = null;
    try {
      const e = await fetch(url, { mode: "cors", credentials: "omit" });
      e.ok && (o = await e.blob());
    } catch {}
    if (!o)
      try {
        o = await new Promise((e, t) => {
          const o = new Image();
          o.crossOrigin = "anonymous";
          const i = setTimeout(() => t(new Error("timeout")), 15e3);
          ((o.onload = () => {
            clearTimeout(i);
            const r = document.createElement("canvas");
            ((r.width = o.naturalWidth), (r.height = o.naturalHeight));
            const a = r.getContext("2d");
            a
              ? (a.drawImage(o, 0, 0),
                r.toBlob(
                  (o) => (o ? e(o) : t(new Error("toBlob"))),
                  "image/png",
                ))
              : t(new Error("no ctx"));
          }),
            (o.onerror = () => {
              (clearTimeout(i), t(new Error("load fail")));
            }),
            (o.src = url));
        });
      } catch {}
    if (o)
      try {
        await Be.saveBlobAsset(e, o, url);
        if (o.type.startsWith("image/")) {
          const i = (null == t ? void 0 : t.usePreviewQuality) ? 896 : oo,
            r = (null == t ? void 0 : t.usePreviewQuality) ? 0.4 : no,
            a = await co(o, i, r),
            s = URL.createObjectURL(a);
          return (
            io.set(s, e),
            ao(o)
              .then((e) => {
                e.width > 0 && e.height > 0 && ro.set(s, e);
              })
              .catch(() => {}),
            s
          );
        }
        return URL.createObjectURL(o);
      } catch (i) {
        console.warn("[downloadAndGetLocalUrl] 原始 URL 下载后保存失败:", i);
      }
    url = eo(url) || url;
  } else {
    const e = eo(url) || url;
    e !== url && (url = e);
  }
  let blob = null;
  try {
    const e = await fetch(url, { mode: "cors", credentials: "omit" });
    e.ok && (blob = await e.blob());
  } catch {
    console.log(
      "[downloadAndGetLocalUrl] fetch CORS 失败，尝试 Image + Canvas 方式",
    );
  }
  if (!blob && "undefined" != typeof window)
    try {
      const e = new URL(url);
      if (
        e.origin === window.location.origin &&
        e.pathname.includes("/v1/videos/proxy")
      ) {
        const e = await fetch(url);
        e.ok && (blob = await e.blob());
      }
    } catch {}
  if (!blob)
    try {
      blob = await new Promise((e, t) => {
        const o = new Image();
        o.crossOrigin = "anonymous";
        const r = setTimeout(() => {
          t(new Error("图片加载超时"));
        }, 3e4);
        ((o.onload = () => {
          clearTimeout(r);
          try {
            const i = document.createElement("canvas");
            ((i.width = o.naturalWidth), (i.height = o.naturalHeight));
            const r = i.getContext("2d");
            if (!r) return void t(new Error("无法创建 canvas context"));
            (r.drawImage(o, 0, 0),
              i.toBlob((o) => {
                o ? e(o) : t(new Error("Canvas toBlob 失败"));
              }, "image/png"));
          } catch (i) {
            t(i);
          }
        }),
          (o.onerror = () => {
            (clearTimeout(r), t(new Error("图片加载失败")));
          }),
          (o.src = url));
      });
    } catch (i) {
      console.warn("[downloadAndGetLocalUrl] Image + Canvas 方式也失败:", i);
    }
  const o =
    "undefined" != typeof window &&
    (() => {
      try {
        const e = new URL(url),
          t = e.pathname.includes("/v1/videos/proxy"),
          o =
            "localhost" === e.hostname ||
            "127.0.0.1" === e.hostname ||
            "" === e.hostname,
          i = e.origin === window.location.origin;
        return t && (o || i);
      } catch {
        return !1;
      }
    })();
  if (!blob && !o && (url.startsWith("http://") || url.startsWith("https://")))
    try {
      const e = `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`;
      console.log("[downloadAndGetLocalUrl] 尝试 wsrv.nl 代理下载...");
      const t = await fetch(e, { mode: "cors", credentials: "omit" });
      t.ok &&
        ((blob = await t.blob()),
        console.log("[downloadAndGetLocalUrl] ✅ wsrv.nl 代理下载成功"));
    } catch (i) {
      console.warn("[downloadAndGetLocalUrl] wsrv.nl 代理也失败:", i);
    }
  if (blob)
    try {
      await Be.saveBlobAsset(e, blob, url);
      if (blob.type.startsWith("image/")) {
        const o = (null == t ? void 0 : t.usePreviewQuality) ? 896 : oo,
          i = (null == t ? void 0 : t.usePreviewQuality) ? 0.4 : no,
          r = await co(blob, o, i),
          a = URL.createObjectURL(r);
        return (
          io.set(a, e),
          ao(blob)
            .then((e) => {
              e.width > 0 && e.height > 0 && ro.set(a, e);
            })
            .catch(() => {}),
          a
        );
      }
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("[downloadAndGetLocalUrl] ❌ 保存失败:", error);
    }
  return (
    console.warn("[downloadAndGetLocalUrl] ⚠️ 无法下载图片，返回原始 URL"),
    url
  );
}
async function fo(e) {
  if (e.startsWith("blob:")) {
    const t = await uo(e);
    if (t) return { url: URL.createObjectURL(t), revoke: !0 };
  }
  let t = e;
  if (e.startsWith("content_ref:"))
    try {
      await Bt.init();
      const o = Bt.extractId(e);
      let i = await Bt.get(o);
      if (
        (i ||
          (await new Promise((e) => setTimeout(e, 300)), (i = await Bt.get(o))),
        !i)
      )
        throw new Error(`content_ref 不存在: ${o}`);
      t = i;
    } catch (o) {
      throw (
        console.error("[getLoadableImageUrl] content_ref 解析失败:", o),
        new Error("图片加载失败：无法解析 content_ref")
      );
    }
  if (!t.startsWith("http://") && !t.startsWith("https://"))
    return { url: t, revoke: !1 };
  try {
    const e = await fetch(t, { mode: "cors", credentials: "omit" });
    if (e.ok) {
      const t = await e.blob();
      return { url: URL.createObjectURL(t), revoke: !0 };
    }
  } catch {
    console.log("[getLoadableImageUrl] fetch CORS 失败，尝试 Tauri/代理");
  }
  let blob = null;
  try {
    const { downloadWithFallback: e } = await x(
      async () => {
        const { downloadWithFallback: e } =
          await import("./tauriDownloader-BG3Xb0u0.js");
        return { downloadWithFallback: e };
      },
      __vite__mapDeps([0, 1, 2]),
      import.meta.url,
    );
    blob = await e(t, 6e4);
  } catch (o) {
    console.warn("[getLoadableImageUrl] Tauri/ fetch 失败:", o);
  }
  if (!blob)
    try {
      const e = `https://wsrv.nl/?url=${encodeURIComponent(t)}&output=png&fit=inside&w=99999&h=99999`,
        o = await fetch(e);
      o.ok && (blob = await o.blob());
    } catch {}
  if (!blob)
    try {
      const e = `https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`,
        o = await fetch(e);
      o.ok && (blob = await o.blob());
    } catch {}
  if (blob) return { url: URL.createObjectURL(blob), revoke: !0 };
  if (
    "undefined" != typeof window &&
    ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
  )
    throw new Error("无法下载图片，请检查网络或使用打包版以绕过 CORS");
  return new Promise((e, i) => {
    const r = new Image();
    r.crossOrigin = "anonymous";
    const a = setTimeout(() => {
      i(new Error("图片加载超时"));
    }, 3e4);
    ((r.onload = () => {
      clearTimeout(a);
      try {
        const t = document.createElement("canvas");
        ((t.width = r.naturalWidth), (t.height = r.naturalHeight));
        const a = t.getContext("2d");
        if (!a) return void i(new Error("无法创建 canvas context"));
        (a.drawImage(r, 0, 0),
          t.toBlob((r) => {
            if (r) e({ url: URL.createObjectURL(r), revoke: !0 });
            else
              try {
                const o = t.toDataURL("image/png");
                e({ url: o, revoke: !1 });
              } catch (o) {
                i(new Error("Canvas 导出失败（可能是 CORS 限制）"));
              }
          }, "image/png"));
      } catch (o) {
        (console.warn(
          "[getLoadableImageUrl] Canvas 导出失败，返回已解析 URL:",
          o,
        ),
          e({ url: t, revoke: !1 }));
      }
    }),
      (r.onerror = () => {
        (clearTimeout(a),
          console.warn("[getLoadableImageUrl] 图片加载失败，返回原始 URL"),
          e({ url: t, revoke: !1 }));
      }),
      (r.src = t));
  });
}
async function wo(e, t) {
  if (!t.length) return [];
  const { url: o, revoke: i } = await fo(e);
  return new Promise((e, r) => {
    const a = new Image();
    a.crossOrigin = "anonymous";
    const s = setTimeout(() => {
      (i && URL.revokeObjectURL(o), r(new Error("图片加载超时")));
    }, 3e4);
    ((a.onload = () => {
      clearTimeout(s);
      const l = a.width,
        c = a.height;
      Promise.all(
        t.map((e, t) => {
          return (
            (o = e),
            new Promise((e, t) => {
              const i = Math.max(0, Math.min(o.x, l - 1)),
                r = Math.max(0, Math.min(o.y, c - 1)),
                s = Math.min(Math.max(1, o.w), l - i),
                d = Math.min(Math.max(1, o.h), c - r),
                u = document.createElement("canvas");
              ((u.width = s), (u.height = d));
              const g = u.getContext("2d");
              g &&
                ((g.fillStyle = "#ffffff"),
                g.fillRect(0, 0, s, d),
                g.drawImage(a, i, r, s, d, 0, 0, s, d));
              try {
                u.toBlob((blob) => {
                  e(
                    blob
                      ? { url: URL.createObjectURL(blob), width: s, height: d }
                      : { url: u.toDataURL("image/png"), width: s, height: d },
                  );
                }, "image/png");
              } catch {
                e({ url: u.toDataURL("image/png"), width: s, height: d });
              }
            })
          );
          var o;
        }),
      )
        .then((t) => {
          (i && URL.revokeObjectURL(o), e(t));
        })
        .catch((e) => {
          (i && URL.revokeObjectURL(o), r(e));
        });
    }),
      (a.onerror = () => {
        (clearTimeout(s),
          i && URL.revokeObjectURL(o),
          r(new Error("图片加载失败")));
      }),
      (a.src = o));
  });
}
async function yo(e, t = 3, o = 3) {
  console.log("[splitGridImage] Starting split:", {
    imageUrl: e.substring(0, 100),
    cols: t,
    rows: o,
  });
  let i = e,
    r = !1;
  if (e.startsWith("blob:")) {
    const t = await uo(e);
    t && ((i = URL.createObjectURL(t)), (r = !0));
  }
  if (i.startsWith("content_ref:"))
    try {
      await Bt.init();
      const t = Bt.extractId(e);
      let o = await Bt.get(t);
      if (
        (o ||
          (await new Promise((e) => setTimeout(e, 300)), (o = await Bt.get(t))),
        !o)
      )
        throw new Error(`content_ref 不存在: ${t}`);
      ((i = o), console.log("[splitGridImage] content_ref 已解析"));
    } catch (a) {
      throw (
        console.error("[splitGridImage] content_ref 解析失败:", a),
        new Error("图片加载失败：无法解析 content_ref")
      );
    }
  return new Promise(async (e, s) => {
    var l;
    try {
      let d = i,
        u = r;
      if (i.startsWith("http://") || i.startsWith("https://")) {
        console.log(
          "[splitGridImage] Downloading remote image to create clean blob...",
        );
        try {
          const e = await fetch(i, { mode: "cors", credentials: "omit" });
          if (!e.ok) throw new Error(`HTTP ${e.status}`);
          const blob = await e.blob();
          ((d = URL.createObjectURL(blob)),
            (u = !0),
            console.log(
              "[splitGridImage] Clean blob created:",
              d.substring(0, 50),
            ));
        } catch (c) {
          console.warn(
            "[splitGridImage] Fetch failed, trying dev proxy / Tauri then proxies:",
            c,
          );
          let blob = null;
          const e = i;
          if (
            "undefined" != typeof window &&
            (null == (l = window.location) ? void 0 : l.origin) &&
            /^https?:\/\/localhost(:\d+)?$/.test(window.location.origin)
          )
            try {
              const t = `${window.location.origin}/api/image-proxy?url=${encodeURIComponent(e)}`,
                o = await fetch(t);
              o.ok && (blob = await o.blob());
            } catch (a) {
              console.warn("[splitGridImage] Dev image-proxy failed:", a);
            }
          if (!blob)
            try {
              const { downloadWithFallback: t } = await x(
                async () => {
                  const { downloadWithFallback: e } =
                    await import("./tauriDownloader-BG3Xb0u0.js");
                  return { downloadWithFallback: e };
                },
                __vite__mapDeps([0, 1, 2]),
                import.meta.url,
              );
              blob = await t(e, 6e4);
            } catch (a) {
              console.warn(
                "[splitGridImage] Tauri download failed, trying proxies:",
                a,
              );
            }
          if (!blob)
            try {
              const t = `https://wsrv.nl/?url=${encodeURIComponent(e)}&output=png&fit=inside&w=99999&h=99999`,
                o = await fetch(t);
              o.ok && (blob = await o.blob());
            } catch (a) {
              console.warn("[splitGridImage] wsrv.nl failed:", a);
            }
          if (!blob)
            try {
              const t = `https://api.allorigins.win/raw?url=${encodeURIComponent(e)}`,
                o = await fetch(t);
              o.ok && (blob = await o.blob());
            } catch (a) {
              console.warn("[splitGridImage] allorigins proxy failed:", a);
            }
          if (!blob)
            return (
              console.error("[splitGridImage] All download attempts failed"),
              void s(
                new Error("无法下载图片，请检查网络或使用打包版以绕过 CORS"),
              )
            );
          ((d = URL.createObjectURL(blob)),
            (u = !0),
            console.log(
              "[splitGridImage] Clean blob from Tauri/proxy:",
              d.substring(0, 50),
            ));
        }
      }
      const g = new Image(),
        m = setTimeout(() => {
          (console.error("[splitGridImage] Timeout after 30s"),
            u && URL.revokeObjectURL(d),
            s(new Error("图片加载超时")));
        }, 3e4);
      ((g.onload = () => {
        (clearTimeout(m),
          console.log("[splitGridImage] Image loaded successfully:", {
            width: g.width,
            height: g.height,
          }));
        try {
          const i = Math.floor(g.width / t),
            r = Math.floor(g.height / o);
          console.log("[splitGridImage] Calculated dimensions:", {
            singleWidth: i,
            singleHeight: r,
          });
          const a = [];
          for (let e = 0; e < o; e++)
            for (let o = 0; o < t; o++) {
              const t = Math.max(0, Math.min(o * i, g.width - i)),
                s = Math.max(0, Math.min(e * r, g.height - r)),
                l = Math.min(i, g.width - t),
                c = Math.min(r, g.height - s);
              console.log(`[splitGridImage] Creating crop [${e},${o}]:`, {
                cropX: t,
                cropY: s,
                cropW: l,
                cropH: c,
              });
              const d = document.createElement("canvas");
              ((d.width = l), (d.height = c));
              const u = d.getContext("2d");
              u &&
                ((u.fillStyle = "#ffffff"),
                u.fillRect(0, 0, l, c),
                u.drawImage(g, t, s, l, c, 0, 0, l, c));
              const m = new Promise((t, i) => {
                try {
                  d.toBlob((blob) => {
                    if (blob) {
                      const i = URL.createObjectURL(blob);
                      (console.log(
                        `[splitGridImage] Crop [${e},${o}] created:`,
                        i.substring(0, 50),
                      ),
                        t({ url: i, width: l, height: c }));
                    } else {
                      console.warn(
                        `[splitGridImage] Crop [${e},${o}] toBlob returned null, trying toDataURL`,
                      );
                      try {
                        const e = d.toDataURL("image/png");
                        t({ url: e, width: l, height: c });
                      } catch (r) {
                        (console.error(
                          `[splitGridImage] Crop [${e},${o}] toDataURL also failed:`,
                          r,
                        ),
                          i(new Error("Canvas 导出失败")));
                      }
                    }
                  }, "image/png");
                } catch (r) {
                  console.warn(
                    `[splitGridImage] Crop [${e},${o}] toBlob threw error, trying toDataURL:`,
                    r,
                  );
                  try {
                    const e = d.toDataURL("image/png");
                    t({ url: e, width: l, height: c });
                  } catch (a) {
                    (console.error(
                      `[splitGridImage] Crop [${e},${o}] toDataURL also failed:`,
                      a,
                    ),
                      i(new Error("Canvas 导出失败")));
                  }
                }
              });
              a.push(m);
            }
          Promise.all(a)
            .then((t) => {
              (console.log("[splitGridImage] All crops completed:", t.length),
                u && URL.revokeObjectURL(d),
                e(t));
            })
            .catch((e) => {
              (console.error("[splitGridImage] Crop promise failed:", e),
                u && URL.revokeObjectURL(d),
                s(e));
            });
        } catch (error) {
          (console.error("[splitGridImage] Error during split:", error),
            u && URL.revokeObjectURL(d),
            s(error));
        }
      }),
        (g.onerror = (e) => {
          (clearTimeout(m),
            console.error("[splitGridImage] Image load error:", e),
            u && URL.revokeObjectURL(d),
            s(new Error("图片加载失败")));
        }),
        console.log(
          "[splitGridImage] Setting image src to:",
          d.substring(0, 50),
        ),
        (g.src = d));
    } catch (error) {
      (console.error("[splitGridImage] Unexpected error:", error), s(error));
    }
  });
}
async function vo(e) {
  return yo(e, 2, 2);
}
const bo = new Set([
  "key",
  "apikey",
  "api_key",
  "api_key_encrypted",
  "secret",
  "apisecret",
  "api_secret",
  "token",
  "accesstoken",
  "access_token",
  "authtoken",
  "auth_token",
  "bearertoken",
  "bearer_token",
  "sessionid",
  "session_id",
  "jimengsessionid",
  "jimeng_session_id",
  "jimengsession",
  "jimeng_session",
  "sessiontoken",
  "session_token",
  "sid",
  "password",
  "passwd",
  "pwd",
  "authorization",
  "credentials",
  "credential",
  "privatekey",
  "private_key",
  "clientsecret",
  "client_secret",
  "refreshtoken",
  "refresh_token",
  "globalapikey",
  "global_api_key",
  "rhapikey",
  "rh_api_key",
]);
function _o(data) {
  if (null == data) return data;
  if (Array.isArray(data)) return data.map((e) => _o(e));
  if ("object" == typeof data) {
    const e = { ...data },
      t = [
        "key",
        "apiKey",
        "api_key",
        "API_KEY",
        "apikey",
        "secret",
        "apiSecret",
        "api_secret",
        "API_SECRET",
        "token",
        "accessToken",
        "access_token",
        "ACCESS_TOKEN",
        "authToken",
        "auth_token",
        "AUTH_TOKEN",
        "bearerToken",
        "bearer_token",
        "BEARER_TOKEN",
        "sessionId",
        "session_id",
        "SESSION_ID",
        "sessionid",
        "jimengSessionId",
        "jimeng_session_id",
        "JIMENG_SESSION_ID",
        "jimengSession",
        "jimeng_session",
        "JIMENG_SESSION",
        "sessionToken",
        "session_token",
        "SESSION_TOKEN",
        "sid",
        "SID",
        "password",
        "passwd",
        "pwd",
        "PASSWORD",
        "authorization",
        "Authorization",
        "AUTHORIZATION",
        "credentials",
        "credential",
        "privateKey",
        "private_key",
        "PRIVATE_KEY",
        "clientSecret",
        "client_secret",
        "CLIENT_SECRET",
        "refreshToken",
        "refresh_token",
        "REFRESH_TOKEN",
        "globalApiKey",
        "global_api_key",
        "GLOBAL_API_KEY",
        "rhApiKey",
        "rh_api_key",
        "RH_API_KEY",
      ];
    for (const o of t) o in e && delete e[o];
    for (const key of Object.keys(e))
      bo.has(key.toLowerCase()) && delete e[key];
    if (
      "apiConfig" in e &&
      "object" == typeof e.apiConfig &&
      null !== e.apiConfig
    ) {
      const o = { ...e.apiConfig };
      for (const e of t) e in o && delete o[e];
      for (const e of Object.keys(o)) bo.has(e.toLowerCase()) && delete o[e];
      e.apiConfig = _o(o);
    }
    if (
      ("apiConfigs" in e &&
        Array.isArray(e.apiConfigs) &&
        (e.apiConfigs = e.apiConfigs.map((e) => {
          if (null !== e && "object" == typeof e && !Array.isArray(e)) {
            const o = { ...e };
            for (const e of t) e in o && delete o[e];
            for (const e of Object.keys(o))
              bo.has(e.toLowerCase()) && delete o[e];
            return _o(o);
          }
          return e;
        })),
      "settings" in e && "object" == typeof e.settings && null !== e.settings)
    ) {
      const o = { ...e.settings };
      for (const e of t) e in o && delete o[e];
      for (const e of Object.keys(o)) bo.has(e.toLowerCase()) && delete o[e];
      ("_executeTrigger" in o && delete o._executeTrigger,
        (e.settings = _o(o)));
    }
    for (const key in e)
      "object" == typeof e[key] && null !== e[key] && (e[key] = _o(e[key]));
    return e;
  }
  return data;
}
const Io = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      PREVIEW_CALLBACK_MAX_DIM: 896,
      PREVIEW_CALLBACK_QUALITY: 0.4,
      compressImageForCanvas: mo,
      createThumbnailForAi: ho,
      debounce: Jt,
      downloadAndGetLocalUrl: po,
      downloadUrlToLocal: to,
      generateId: Kt,
      getAssetIdForDisplayBlobUrl: function (e) {
        return (null == e ? void 0 : e.startsWith("blob:"))
          ? (io.get(e) ?? null)
          : null;
      },
      getDisplayProjectName: Ht,
      getFullBlobForDisplayUrl: uo,
      getFullBlobUrlForDisplayUrl: async function (e, t) {
        const blob = await uo(e, t);
        return blob ? URL.createObjectURL(blob) : null;
      },
      getImageDimensionsFromBlob: ao,
      getLocalDateString: Qt,
      getLocalISOString: qt,
      getLocalTimestamp: Zt,
      getOriginalDimensionsForDisplayUrl: so,
      getVideoDisplayUrl: eo,
      isJimengCdnVideoUrl: Yt,
      registerDisplayUrlAssetId: lo,
      resolveImageUrlForDisplay: go,
      sanitizeSensitiveData: _o,
      split2x2Image: vo,
      splitGridImage: yo,
      splitImageByRegions: wo,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
function So(e) {
  return (
    {
      "1:1": 1,
      "16:9": 16 / 9,
      "9:16": 9 / 16,
      "4:3": 4 / 3,
      "3:4": 3 / 4,
      "3:2": 1.5,
      "2:3": 2 / 3,
    }[e] ?? 1
  );
}
function jo(e, t, o, i, r) {
  const a = xo;
  let s, l;
  switch (r || "center") {
    case a(0):
      ((s = Math.round((e - o) / 2)), (l = 0));
      break;
    case a(1):
      ((s = Math.round((e - o) / 2)), (l = t - i));
      break;
    case "left":
      ((s = 0), (l = Math.round((t - i) / 2)));
      break;
    case a(2):
      ((s = e - o), (l = Math.round((t - i) / 2)));
      break;
    default:
      ((s = Math[a(3)]((e - o) / 2)), (l = Math[a(3)]((t - i) / 2)));
  }
  return { offsetX: s, offsetY: l };
}
function Ao() {
  const e = [
    "top",
    "bottom",
    "right",
    "round",
    "原比例",
    "max",
    "onload",
    "图片尺寸无效",
    "ceil",
    "min",
    "createElement",
    "canvas",
    "width",
    "无法创建蒙版 Canvas 上下文",
    "fillStyle",
    "fillRect",
  ];
  return (Ao = function () {
    return e;
  })();
}
function Po(e, t, o, i = 1.5, r, a, s) {
  const l = xo,
    c = o === l(4) || "Auto" === o;
  let d, u;
  if (c)
    if (null != r && null != a) {
      const o = Math[l(5)](1, Math.min(5, r)),
        i = Math[l(5)](1, Math.min(5, a));
      ((d = Math.round(e * o)), (u = Math[l(3)](t * i)));
    } else {
      const o = Math.max(1.1, Math.min(5, i));
      ((d = Math.round(e * o)), (u = Math.round(t * o)));
    }
  else {
    const r = So(o);
    ((u = Math.max(t, Math.ceil(e / r))),
      (d = Math.round(u * r)),
      d < e && ((d = e), (u = Math[l(5)](t, Math.ceil(e / r)))));
    const a = Math.max(1, Math.min(5, i));
    ((d = Math[l(3)](d * a)), (u = Math.round(u * a)));
  }
  const { offsetX: g, offsetY: m } = jo(d, u, e, t, c ? void 0 : s);
  return { targetW: d, targetH: u, offsetX: g, offsetY: m };
}
function xo(e, t) {
  e -= 0;
  return Ao()[e];
}
const ko = [
    {
      id: "arri-alexa-35",
      name: "阿莱 Alexa 35",
      image: "arri-alexa-35-hW6-4chH.webp",
      prompt:
        "shot on Arri Alexa 35, legendary color science, organic highlights",
    },
    {
      id: "arricam-lt",
      name: "Arricam LT",
      image: "arricam-lt-DEzXr_FR.webp",
      prompt: "shot on Arricam LT, 35mm movie film, authentic cinema texture",
    },
    {
      id: "arriflex-435",
      name: "阿莱 435",
      image: "arriflex-435-DqI5jc3N.webp",
      prompt: "shot on Arriflex 435, high-speed cinematography, sharp grain",
    },
    {
      id: "imax-keighley",
      name: "IMAX Keighley",
      image: "imax-keighley-Cu9FJnlP.webp",
      prompt:
        "shot on IMAX Keighley camera, ultra-large format, extreme immersion",
    },
    {
      id: "panavision-dxl2",
      name: "潘那维申 DXL2",
      image: "panavision-dxl2-nu2CVKjg .webp",
      prompt:
        "shot on Panavision Millennium DXL2, 8K large format, cinematic depth",
    },
    {
      id: "red-v-raptor",
      name: "RED 猛禽",
      image: "red-v-raptor-DOT1sij6.webp",
      prompt: "shot on Red V-Raptor, 8K raw texture, high dynamic range",
    },
    {
      id: "sony-venice",
      name: "索尼 威尼斯",
      image: "sony-venice-BgicSddP.webp",
      prompt: "shot on Sony Venice, filmic skin tones, rich shadow detail",
    },
    {
      id: "imax-film",
      name: "IMAX 胶片机",
      image: "IMAX Film Camera.webp",
      prompt: "shot on 70mm IMAX film camera, massive scale, detailed grain",
    },
    {
      id: "arriflex-16sr",
      name: "阿莱 16SR",
      image: "Arriflex 16SR.webp",
      prompt: "shot on 16mm Arriflex 16SR, vintage film grain, 16mm look",
    },
    {
      id: "arri-alexa-65",
      name: "阿莱 Alexa 65",
      image: "Alexa 65.webp",
      prompt:
        "shot on Arri Alexa 65, crystal clear optics, high dynamic range, stunning highlights roll-off, professional color grading, 8K resolution",
    },
  ],
  To = [
    {
      id: "lensbaby",
      name: "Lensbaby",
      image: "Lensbaby.webp",
      prompt:
        "Lensbaby lens, selective focus, dreamy blur, creative tilt-shift",
      characteristics: "移轴虚化、梦幻焦点",
    },
    {
      id: "hawk-v-lite",
      name: "Hawk V-Lite",
      image: "Hawk V-Lite.webp",
      prompt:
        "Hawk V-Lite anamorphic lens, blue streak flares, oval bokeh, cinematic widescreen",
      characteristics: "电影宽幅、椭圆光斑",
    },
    {
      id: "hawk-class-x",
      name: "Hawk Class X",
      image: "hawk-class-x-CD3GvtF4.webp",
      prompt:
        "Hawk Class X anamorphic lens, vintage anamorphic character, soft flares",
      characteristics: "经典变形、柔和炫光",
    },
    {
      id: "laowa-macro",
      name: "老蛙 宏观",
      image: "Laowa Macro.webp",
      prompt: "Laowa Macro lens, extreme close-up detail, razor-sharp focus",
      characteristics: "极限微距、细节纹理",
    },
    {
      id: "canon-k35",
      name: "佳能 K-35",
      image: "canon-k35-BhokCUBz.webp",
      prompt:
        "vintage Canon K-35 lens, soft flares, 70s cinematic glow, warm highlights",
      characteristics: "复古柔光、暖调光晕",
    },
    {
      id: "jdc-xtal",
      name: "JDC 变形镜头",
      image: "JDC Xtal Xpress.webp",
      prompt:
        "JDC Xtal Xpress anamorphic, vintage anamorphic texture, artistic flares",
      characteristics: "经典变形、艺术炫光",
    },
    {
      id: "arri-signature",
      name: "阿莱 签名定焦",
      image: "arri-signature-prime-ZwjUyRcz.webp",
      prompt:
        "ARRI Signature Prime lens, natural bokeh, creamy fall-off, cinema-grade clarity",
      characteristics: "顶级通透、纯净质感",
    },
    {
      id: "cooke-s4",
      name: "库克 S4",
      image: "cooke-s4-BKM_5Nte.webp",
      prompt: '"Cooke Look", warm skin tones, smooth organic texture',
      characteristics: "温暖肤色、有机质感",
    },
    {
      id: "cooke-sf-18x",
      name: "库克 SF 18x",
      image: "cooke-sf-18x-BegGlnlc.webp",
      prompt:
        "Cooke SF 18x zoom lens, cinematic zoom character, smooth focus breathing",
      characteristics: "电影变焦、呼吸感",
    },
    {
      id: "cooke-speed-panchro",
      name: "库克 Speed Panchro",
      image: "cooke-speed-panchro-jWogQ6i5.webp",
      prompt:
        "Cooke Speed Panchro vintage lens, classic Hollywood look, soft bokeh",
      characteristics: "复古库克、经典好莱坞",
    },
    {
      id: "petzval",
      name: "佩兹瓦尔",
      image: "Petzval.webp",
      prompt: "Petzval lens, swirly bokeh, sharp center focus",
      characteristics: "旋转焦外、中心锐利",
    },
    {
      id: "helios",
      name: "八羽怪",
      image: "helios-CWg35ubk.webp",
      prompt: "Helios 44-2 lens, distinctive swirly bokeh, vintage character",
      characteristics: "俄产老镜、独特旋焦",
    },
    {
      id: "zeiss-ultra",
      name: "蔡司 Ultra Prime",
      image: "zeiss-ultra-prime-DdBHzrBr.webp",
      prompt: "Zeiss Ultra Prime lens, high contrast, clinical sharpness",
      characteristics: "手术刀般的锐利清晰",
    },
    {
      id: "panavision-c",
      name: "潘那维申 C系列",
      image: "panavision-c-series-LLl1Xpct.webp",
      prompt: "Panavision C-Series anamorphic, classic blue flares",
      characteristics: "好莱坞经典蓝炫光",
    },
    {
      id: "panavision-primo",
      name: "潘那维申 Primo",
      image: "panavision-primo-Cui4J6lP.webp",
      prompt: "Panavision Primo lens, high color saturation, iconic sharpness",
      characteristics: "高饱和、标志性锐利",
    },
  ],
  $o = [
    {
      id: "fl-8",
      value: 8,
      name: "超广角",
      prompt: "ultra-wide angle, expansive perspective",
    },
    {
      id: "fl-14",
      value: 14,
      name: "超广角",
      prompt: "ultra-wide angle, expansive perspective",
    },
    {
      id: "fl-24",
      value: 24,
      name: "叙事广角",
      prompt: "wide angle, storytelling environment",
    },
    {
      id: "fl-35",
      value: 35,
      name: "叙事广角",
      prompt: "wide angle, storytelling environment",
    },
    {
      id: "fl-50",
      value: 50,
      name: "标准镜头",
      prompt: "standard lens, human eye perspective",
    },
    {
      id: "fl-85",
      value: 85,
      name: "肖像长焦",
      prompt: "telephoto, shallow depth of field, creamy bokeh",
    },
    {
      id: "fl-135",
      value: 135,
      name: "肖像长焦",
      prompt: "telephoto, shallow depth of field, creamy bokeh",
    },
  ],
  Mo = [
    {
      id: "f1.4",
      value: "f/1.4",
      image: "f1_4-DoQLC9Jc.webp",
      name: "大光圈",
      prompt:
        "f/1.4 aperture, extremely shallow depth of field, creamy bokeh, subject isolation, dreamy background blur",
    },
    {
      id: "f4",
      value: "f/4",
      image: "f4-Or-YmP2I.webp",
      name: "中光圈",
      prompt:
        "f/4 aperture, balanced depth of field, moderate bokeh, natural subject separation",
    },
    {
      id: "f11",
      value: "f/11",
      image: "f-11.webp",
      name: "小光圈",
      prompt:
        "f/11 aperture, deep depth of field, sharp foreground and background, landscape clarity",
    },
  ],
  Co = (e) => {
    const parts = [],
      t = ko.find((t) => t.id === e.cameraId),
      o = To.find((t) => t.id === e.lensId),
      i = $o.find((t) => t.id === e.focalLengthId),
      r = Mo.find((t) => t.id === e.apertureId);
    return (
      t && parts.push(t.prompt),
      o && parts.push(o.prompt),
      i && parts.push(`${i.value}mm, ${i.prompt}`),
      r && parts.push(r.prompt),
      parts.join(", ")
    );
  };
g.memo(
  ({
    isOpen: e,
    onClose: t,
    isDark: o,
    cinemaConfig: i,
    onConfigChange: r,
  }) => {
    if (!e) return null;
    const a = ko.find((e) => e.id === i.cameraId),
      s = To.find((e) => e.id === i.lensId),
      l = $o.find((e) => e.id === i.focalLengthId),
      c = Mo.find((e) => e.id === i.apertureId);
    return m.jsxs("div", {
      className: "fixed inset-0 z-50 flex items-center justify-center",
      children: [
        m.jsx("div", {
          className: "absolute inset-0 bg-black/60 backdrop-blur-sm",
          onClick: t,
        }),
        m.jsxs("div", {
          className:
            "relative w-[800px] max-h-[85vh] bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-zinc-700/50 shadow-2xl overflow-hidden flex flex-col",
          children: [
            m.jsxs("div", {
              className:
                "flex items-center justify-between p-4 border-b border-zinc-700/50",
              children: [
                m.jsxs("div", {
                  className: "flex items-center gap-3",
                  children: [
                    m.jsx(I, { size: 20, className: "text-blue-400" }),
                    m.jsx("span", {
                      className: "text-white font-medium text-lg",
                      children: "专业摄像机配置",
                    }),
                  ],
                }),
                m.jsx("button", {
                  onClick: t,
                  className:
                    "p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors",
                  children: m.jsx(S, { size: 18 }),
                }),
              ],
            }),
            m.jsx("div", {
              className: "px-4 py-3 bg-zinc-800/50 border-b border-zinc-700/30",
              children: m.jsxs("div", {
                className: "flex items-center gap-4 text-sm",
                children: [
                  m.jsx("span", {
                    className: "text-zinc-500",
                    children: "当前配置:",
                  }),
                  m.jsxs("div", {
                    className: "flex items-center gap-3",
                    children: [
                      m.jsxs("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                          m.jsx(I, { size: 14, className: "text-blue-400" }),
                          m.jsx("span", {
                            className: a ? "text-white" : "text-zinc-500",
                            children: (null == a ? void 0 : a.name) || "未选择",
                          }),
                        ],
                      }),
                      m.jsx("span", {
                        className: "text-zinc-600",
                        children: "+",
                      }),
                      m.jsxs("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                          m.jsx(j, { size: 14, className: "text-purple-400" }),
                          m.jsx("span", {
                            className: s ? "text-white" : "text-zinc-500",
                            children: (null == s ? void 0 : s.name) || "未选择",
                          }),
                        ],
                      }),
                      m.jsx("span", {
                        className: "text-zinc-600",
                        children: "+",
                      }),
                      m.jsxs("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                          m.jsx(A, { size: 14, className: "text-green-400" }),
                          m.jsx("span", {
                            className: l ? "text-white" : "text-zinc-500",
                            children: l ? `${l.value}mm` : "未选择",
                          }),
                        ],
                      }),
                      m.jsx("span", {
                        className: "text-zinc-600",
                        children: "+",
                      }),
                      m.jsxs("div", {
                        className: "flex items-center gap-1.5",
                        children: [
                          m.jsx(j, { size: 14, className: "text-orange-400" }),
                          m.jsx("span", {
                            className: c ? "text-white" : "text-zinc-500",
                            children:
                              (null == c ? void 0 : c.value) || "未选择",
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            }),
            m.jsxs("div", {
              className: "flex-1 overflow-y-auto p-4 space-y-6",
              children: [
                m.jsxs("div", {
                  children: [
                    m.jsxs("div", {
                      className: "flex items-center gap-2 mb-3",
                      children: [
                        m.jsx(I, { size: 16, className: "text-blue-400" }),
                        m.jsx("span", {
                          className: "text-white font-medium",
                          children: "摄像机",
                        }),
                        m.jsxs("span", {
                          className: "text-zinc-500 text-xs",
                          children: ["(", ko.length, "款)"],
                        }),
                      ],
                    }),
                    m.jsx("div", {
                      className:
                        "flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent",
                      children: ko.map((e) =>
                        m.jsxs(
                          "div",
                          {
                            onClick: () => {
                              return (
                                (t = e.id),
                                void r({
                                  ...i,
                                  cameraId: i.cameraId === t ? null : t,
                                })
                              );
                              var t;
                            },
                            className:
                              "flex-shrink-0 w-32 cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 " +
                              (i.cameraId === e.id
                                ? "border-blue-500 ring-2 ring-blue-500/30 scale-105"
                                : "border-zinc-700/50 hover:border-zinc-600"),
                            children: [
                              m.jsx("div", {
                                className:
                                  "w-32 h-32 bg-zinc-800 flex items-center justify-center overflow-hidden",
                                children: m.jsx("img", {
                                  src: `/cinema/${e.image}`,
                                  alt: e.name,
                                  className: "w-full h-full object-cover",
                                  onError: (e) => {
                                    e.target.style.display = "none";
                                  },
                                }),
                              }),
                              m.jsx("div", {
                                className: "p-2 bg-zinc-800/80 text-center",
                                children: m.jsx("span", {
                                  className: "text-white text-sm font-medium",
                                  children: e.name,
                                }),
                              }),
                            ],
                          },
                          e.id,
                        ),
                      ),
                    }),
                  ],
                }),
                m.jsxs("div", {
                  children: [
                    m.jsxs("div", {
                      className: "flex items-center gap-2 mb-3",
                      children: [
                        m.jsx(j, { size: 16, className: "text-purple-400" }),
                        m.jsx("span", {
                          className: "text-white font-medium",
                          children: "镜头",
                        }),
                        m.jsxs("span", {
                          className: "text-zinc-500 text-xs",
                          children: ["(", To.length, "款)"],
                        }),
                      ],
                    }),
                    m.jsx("div", {
                      className:
                        "flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent",
                      children: To.map((e) =>
                        m.jsxs(
                          "div",
                          {
                            onClick: () => {
                              return (
                                (t = e.id),
                                void r({
                                  ...i,
                                  lensId: i.lensId === t ? null : t,
                                })
                              );
                              var t;
                            },
                            className:
                              "flex-shrink-0 w-28 cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 " +
                              (i.lensId === e.id
                                ? "border-purple-500 ring-2 ring-purple-500/30 scale-105"
                                : "border-zinc-700/50 hover:border-zinc-600"),
                            children: [
                              m.jsx("div", {
                                className:
                                  "w-28 h-28 bg-zinc-800 flex items-center justify-center overflow-hidden",
                                children: m.jsx("img", {
                                  src: `/cinema/${e.image}`,
                                  alt: e.name,
                                  className: "w-full h-full object-cover",
                                  onError: (e) => {
                                    e.target.style.display = "none";
                                  },
                                }),
                              }),
                              m.jsxs("div", {
                                className: "p-2 bg-zinc-800/80 text-center",
                                children: [
                                  m.jsx("span", {
                                    className:
                                      "text-white text-xs font-medium block",
                                    children: e.name,
                                  }),
                                  m.jsx("span", {
                                    className:
                                      "text-zinc-400 text-[10px] block mt-0.5",
                                    children: e.characteristics,
                                  }),
                                ],
                              }),
                            ],
                          },
                          e.id,
                        ),
                      ),
                    }),
                  ],
                }),
                m.jsxs("div", {
                  children: [
                    m.jsxs("div", {
                      className: "flex items-center gap-2 mb-3",
                      children: [
                        m.jsx(A, { size: 16, className: "text-green-400" }),
                        m.jsx("span", {
                          className: "text-white font-medium",
                          children: "焦段",
                        }),
                        m.jsxs("span", {
                          className: "text-zinc-500 text-xs",
                          children: ["(", $o.length, "个)"],
                        }),
                      ],
                    }),
                    m.jsx("div", {
                      className:
                        "flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent",
                      children: $o.map((e) =>
                        m.jsxs(
                          "div",
                          {
                            onClick: () => {
                              return (
                                (t = e.id),
                                void r({
                                  ...i,
                                  focalLengthId:
                                    i.focalLengthId === t ? null : t,
                                })
                              );
                              var t;
                            },
                            className:
                              "flex-shrink-0 w-20 h-20 cursor-pointer rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center " +
                              (i.focalLengthId === e.id
                                ? "border-green-500 ring-2 ring-green-500/30 bg-green-500/10 scale-105"
                                : "border-zinc-700/50 hover:border-zinc-600 bg-zinc-800/50"),
                            children: [
                              m.jsx("span", {
                                className:
                                  "text-2xl font-bold " +
                                  (i.focalLengthId === e.id
                                    ? "text-green-400"
                                    : "text-white"),
                                children: e.value,
                              }),
                              m.jsx("span", {
                                className: "text-zinc-500 text-xs",
                                children: "mm",
                              }),
                              m.jsx("span", {
                                className: "text-zinc-400 text-[10px] mt-1",
                                children: e.name,
                              }),
                            ],
                          },
                          e.id,
                        ),
                      ),
                    }),
                  ],
                }),
                m.jsxs("div", {
                  children: [
                    m.jsxs("div", {
                      className: "flex items-center gap-2 mb-3",
                      children: [
                        m.jsx(j, { size: 16, className: "text-orange-400" }),
                        m.jsx("span", {
                          className: "text-white font-medium",
                          children: "光圈",
                        }),
                        m.jsxs("span", {
                          className: "text-zinc-500 text-xs",
                          children: ["(", Mo.length, "个)"],
                        }),
                      ],
                    }),
                    m.jsx("div", {
                      className:
                        "flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent",
                      children: Mo.map((e) =>
                        m.jsxs(
                          "div",
                          {
                            onClick: () => {
                              return (
                                (t = e.id),
                                void r({
                                  ...i,
                                  apertureId: i.apertureId === t ? null : t,
                                })
                              );
                              var t;
                            },
                            className:
                              "flex-shrink-0 w-32 cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 " +
                              (i.apertureId === e.id
                                ? "border-orange-500 ring-2 ring-orange-500/30 scale-105"
                                : "border-zinc-700/50 hover:border-zinc-600"),
                            children: [
                              m.jsx("div", {
                                className:
                                  "w-32 h-32 bg-zinc-800 flex items-center justify-center overflow-hidden",
                                children: m.jsx("img", {
                                  src: `/cinema/${e.image}`,
                                  alt: e.value,
                                  className: "w-full h-full object-cover",
                                  onError: (e) => {
                                    e.target.style.display = "none";
                                  },
                                }),
                              }),
                              m.jsxs("div", {
                                className: "p-2 bg-zinc-800/80 text-center",
                                children: [
                                  m.jsx("span", {
                                    className:
                                      "text-white text-sm font-medium block",
                                    children: e.value,
                                  }),
                                  m.jsx("span", {
                                    className:
                                      "text-zinc-400 text-[10px] block mt-0.5",
                                    children: e.name,
                                  }),
                                ],
                              }),
                            ],
                          },
                          e.id,
                        ),
                      ),
                    }),
                  ],
                }),
                (i.cameraId || i.lensId || i.focalLengthId || i.apertureId) &&
                  m.jsxs("div", {
                    className:
                      "mt-4 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/30",
                    children: [
                      m.jsx("div", {
                        className: "text-zinc-400 text-xs mb-2",
                        children: "生成的提示词补充:",
                      }),
                      m.jsx("div", {
                        className: "text-blue-300 text-sm font-mono",
                        children: Co(i),
                      }),
                    ],
                  }),
              ],
            }),
            m.jsxs("div", {
              className:
                "p-4 border-t border-zinc-700/50 flex justify-between items-center",
              children: [
                m.jsx("button", {
                  onClick: () =>
                    r({
                      cameraId: null,
                      lensId: null,
                      focalLengthId: null,
                      apertureId: null,
                    }),
                  className:
                    "px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors",
                  children: "清空选择",
                }),
                m.jsx("button", {
                  onClick: t,
                  className:
                    "px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors",
                  children: "确认应用",
                }),
              ],
            }),
          ],
        }),
      ],
    });
  },
);
const Uo = Eo,
  Oo = [
    { id: Uo(0), name: "定", nameEn: "Static", icon: Uo(1), prompt: Uo(2) },
    {
      id: "dolly-in",
      name: "推",
      nameEn: "Dolly In",
      icon: "move-right",
      prompt: "dolly in, camera moving closer to subject, dynamic push-in",
    },
    {
      id: "dolly-out",
      name: "拉",
      nameEn: "Dolly Out",
      icon: "move-left",
      prompt: "dolly out, camera pulling back, expanding perspective",
    },
    {
      id: "pan",
      name: "摇",
      nameEn: "Pan",
      icon: "rotate-cw",
      prompt: "smooth horizontal panning shot, rotating on X-axis",
    },
    { id: "truck", name: "移", nameEn: "Truck", icon: Uo(3), prompt: Uo(4) },
    {
      id: "follow",
      name: "跟",
      nameEn: "Follow",
      icon: Uo(5),
      prompt: "tracking shot, following the subject from behind or side",
    },
    {
      id: "orbit",
      name: "绕",
      nameEn: "Orbit",
      icon: "circle",
      prompt: "360-degree orbital shot, camera circling the subject",
    },
    {
      id: "whip-pan",
      name: "甩",
      nameEn: Uo(6),
      icon: Uo(7),
      prompt: "rapid whip pan, motion blur during transition",
    },
    {
      id: Uo(8),
      name: "冲",
      nameEn: "Crash Zoom",
      icon: "target",
      prompt: Uo(9),
    },
  ];
function Eo(e, t) {
  e -= 0;
  return zo()[e];
}
const Lo = [
    {
      id: Uo(10),
      name: "向前",
      nameEn: "Forward",
      icon: "arrow-right",
      prompt: "moving forward, retreating backward",
    },
    {
      id: "backward",
      name: "向后",
      nameEn: Uo(11),
      icon: "arrow-left",
      prompt: "retreating backward",
    },
    { id: Uo(12), name: "向左", nameEn: "Left", icon: Uo(13), prompt: Uo(14) },
    {
      id: "right",
      name: "向右",
      nameEn: Uo(15),
      icon: "arrow-right",
      prompt: Uo(16),
    },
    {
      id: "up",
      name: "向上",
      nameEn: "Up",
      icon: "arrow-up",
      prompt: "boom up, ascending",
    },
    {
      id: Uo(17),
      name: "向下",
      nameEn: "Down",
      icon: "arrow-down",
      prompt: Uo(18),
    },
  ],
  Ro = [
    {
      id: Uo(19),
      name: "平视",
      nameEn: Uo(20),
      icon: Uo(21),
      prompt: "eye-level shot, neutral perspective",
    },
    {
      id: "low-angle",
      name: "低昂",
      nameEn: Uo(22),
      icon: Uo(23),
      prompt: "low angle shot, heroic perspective, looking up",
    },
    {
      id: Uo(24),
      name: "高俯",
      nameEn: "High Angle",
      icon: "trending-down",
      prompt: "high angle shot, looking down at the subject",
    },
    {
      id: "overhead",
      name: "上帝视角",
      nameEn: Uo(25),
      icon: Uo(26),
      prompt: "top-down shot, overhead view, vertical down angle",
    },
    {
      id: "birds-eye",
      name: "鸟瞰",
      nameEn: "Bird's Eye",
      icon: "navigation",
      prompt: "bird's eye view, high altitude aerial perspective",
    },
    {
      id: Uo(27),
      name: "POV",
      nameEn: "POV",
      icon: "user",
      prompt: "first-person perspective, subjective camera, POV",
    },
    {
      id: "dutch",
      name: Uo(28),
      nameEn: "Dutch Angle",
      icon: "rotate-ccw",
      prompt: Uo(29),
    },
  ],
  No = [
    {
      id: Uo(30),
      name: "快速",
      nameEn: "Fast",
      icon: "fast-forward",
      prompt: "cinematic fast motion",
    },
    {
      id: "slow",
      name: "慢速",
      nameEn: Uo(31),
      icon: "rewind",
      prompt: "slow gentle camera drift",
    },
    {
      id: Uo(32),
      name: Uo(33),
      nameEn: "Subtle",
      icon: "corner-up-right",
      prompt: "subtle 30-degree turn",
    },
    {
      id: "turn-90",
      name: "90°",
      nameEn: "Quarter",
      icon: "corner-right-down",
      prompt: "90-degree quarter turn",
    },
    {
      id: "turn-180",
      name: "180°",
      nameEn: "Half",
      icon: "refresh-cw",
      prompt: "180-degree half rotation",
    },
    {
      id: Uo(34),
      name: "360°",
      nameEn: "Full",
      icon: "rotate-cw",
      prompt: Uo(35),
    },
  ],
  Do = [
    {
      id: Uo(36),
      name: "单点透视",
      nameEn: Uo(37),
      icon: "box",
      prompt: "one-point perspective, symmetrical composition, Kubrick style",
    },
    {
      id: Uo(38),
      name: Uo(39),
      nameEn: "Dolly Zoom",
      icon: "maximize-2",
      prompt: "Hitchcock zoom, vertigo effect, simultaneous track and zoom",
    },
    {
      id: Uo(40),
      name: "昆汀快速变焦",
      nameEn: "Snap Zoom",
      icon: Uo(41),
      prompt: "snap zoom, sudden rapid zoom-in on subject",
    },
    {
      id: "inception",
      name: Uo(42),
      nameEn: "Inception",
      icon: Uo(43),
      prompt: Uo(44),
    },
    {
      id: Uo(45),
      name: "子弹时间",
      nameEn: "Bullet Time",
      icon: "clock",
      prompt: "bullet time, frozen time, rotating around still subject",
    },
    {
      id: "slow-motion",
      name: "升格慢动作",
      nameEn: Uo(46),
      icon: "clock",
      prompt: "cinematic slow motion, high frame rate, overcranked",
    },
  ],
  Fo = [
    {
      id: "fpv-drone",
      name: Uo(47),
      nameEn: "FPV Drone",
      icon: "navigation-2",
      prompt: "FPV drone shot, fast low-altitude agile flight",
    },
    {
      id: "aerial",
      name: "航拍",
      nameEn: "Aerial",
      icon: Uo(48),
      prompt: "wide aerial drone shot, high altitude sweeping view",
    },
    {
      id: "handheld",
      name: Uo(49),
      nameEn: "Handheld",
      icon: "smartphone",
      prompt: "handheld movement, organic camera shake, raw texture",
    },
    {
      id: "crane",
      name: "摇臂",
      nameEn: "Crane",
      icon: "git-branch",
      prompt: "jib/crane shot, smooth vertical and sweeping movement",
    },
    {
      id: "robot-arm",
      name: "机械臂",
      nameEn: "Robot Arm",
      icon: Uo(50),
      prompt: "robot arm shot, precise mechanical movement",
    },
    {
      id: Uo(51),
      name: Uo(52),
      nameEn: "Action Cam",
      icon: "video",
      prompt: Uo(53),
    },
  ],
  Wo = (e) => {
    const t = Eo,
      o = [],
      i = Oo.find((t) => t.id === e.movementId),
      r = Lo[t(54)]((t) => t.id === e.directionId),
      a = Ro.find((t) => t.id === e.angleId),
      s = No.find((t) => t.id === e.speedId),
      l = Do.find((t) => t.id === e.styleId),
      c = Fo.find((t) => t.id === e.deviceId);
    return (
      i && o.push(i.prompt),
      r && o.push(r.prompt),
      a && o.push(a[t(55)]),
      s && o.push(s[t(55)]),
      l && o[t(56)](l[t(55)]),
      c && o[t(56)](c[t(55)]),
      o.join(", ")
    );
  };
function zo() {
  const e = [
    "static",
    "pause",
    "stable static shot, no camera movement, fixed frame",
    "move-horizontal",
    "lateral trucking shot, side-to-side tracking movement",
    "user",
    "Whip Pan",
    "zap",
    "crash",
    "fast crash zoom, sudden dramatic focal length change",
    "forward",
    "Backward",
    "left",
    "arrow-left",
    "sliding left",
    "Right",
    "sliding right",
    "down",
    "boom down, descending",
    "eye-level",
    "Eye Level",
    "eye",
    "Low Angle",
    "trending-up",
    "high-angle",
    "Overhead",
    "maximize",
    "pov",
    "荷兰角",
    "dutch angle, canted frame, tilted horizon line",
    "fast",
    "Slow",
    "turn-30",
    "30°",
    "turn-360",
    "full 360-degree circular rotation",
    "one-point",
    "One-point",
    "dolly-zoom",
    "希区柯克变焦",
    "snap-zoom",
    "zoom-in",
    "盗梦空间旋转",
    "refresh-ccw",
    "inception style roll, 360-degree barrel roll, rotating frame",
    "bullet-time",
    "Slow Motion",
    "FPV穿越机",
    "plane",
    "手持运镜",
    "cpu",
    "action-cam",
    "运动相机",
    "GoPro style, wide-angle distortion, action-cam aesthetic",
    "find",
    "prompt",
    "push",
    "directionId",
    "speedId",
    "styleId",
    "deviceId",
    "name",
    "join",
    " + ",
  ];
  return (zo = function () {
    return e;
  })();
}
const Bo = (e) =>
    e.replace(/【([^】]+)】/g, (e, t) => {
      const o = ((e) => {
        const t = [...Oo, ...Lo, ...Ro, ...No, ...Do, ...Fo];
        let o = e;
        e.includes("：") && (o = e.split("：")[1]);
        const i = t.find((e) => e.name === o);
        return i ? i.prompt : null;
      })(t);
      return o || e;
    }),
  Go = (e) => {
    const t = Eo,
      o = [],
      i = Oo.find((t) => t.id === e.movementId),
      r = Lo.find((o) => o.id === e[t(57)]),
      a = Ro.find((t) => t.id === e.angleId),
      s = No.find((o) => o.id === e[t(58)]),
      l = Do[t(54)]((o) => o.id === e[t(59)]),
      c = Fo.find((o) => o.id === e[t(60)]);
    return (
      i && o.push("[" + i.name + "]"),
      r && o.push("[" + r.name + "]"),
      a && o[t(56)]("[" + a.name + "]"),
      s && o.push("[" + s.name + "]"),
      l && o.push("[" + l.name + "]"),
      c && o.push("[" + c[t(61)] + "]"),
      o[t(62)](t(63))
    );
  };
const Jo = async (url, e) => {
    const t = (null == e ? void 0 : e.compressForApi) ?? !0,
      o = (blob) =>
        t
          ? (async function (blob, e = 2048, t = 0.88) {
              if (!blob.type.startsWith("image/")) return blob;
              const o = URL.createObjectURL(blob);
              return new Promise((i) => {
                const r = new Image();
                ((r.onload = () => {
                  URL.revokeObjectURL(o);
                  let a = r.naturalWidth,
                    s = r.naturalHeight;
                  if (a <= e && s <= e) return void i(blob);
                  const l = Math.min(e / a, e / s);
                  ((a = Math.round(a * l)), (s = Math.round(s * l)));
                  const c = document.createElement("canvas");
                  ((c.width = a), (c.height = s));
                  const d = c.getContext("2d");
                  d
                    ? ((d.imageSmoothingEnabled = !0),
                      (d.imageSmoothingQuality = "high"),
                      d.drawImage(r, 0, 0, a, s),
                      c.toBlob((e) => i(e || blob), "image/jpeg", t))
                    : i(blob);
                }),
                  (r.onerror = () => {
                    (URL.revokeObjectURL(o), i(blob));
                  }),
                  (r.src = o));
              });
            })(blob, 2048, 0.88)
          : Promise.resolve(blob);
    if (url.startsWith("content_ref:"))
      try {
        const { contentStore: t } = await x(
          async () => {
            const { contentStore: e } = await Promise.resolve().then(() => Gt);
            return { contentStore: e };
          },
          void 0,
          import.meta.url,
        );
        await t.init();
        const o = t.extractId(url),
          i = await t.get(o);
        if (i) return Jo(i, e);
        throw new Error(`content_ref 不存在: ${o}`);
      } catch (error) {
        throw new Error(
          `content_ref 解析失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    if (url.startsWith("data:"))
      try {
        const e = await fetch(url);
        return o(await e.blob());
      } catch (i) {
        console.warn("[getBlobFromUrl] Fetch data URL 失败，尝试手动解析:", i);
        try {
          const e = url.match(/^data:([^;]+);base64,(.+)$/);
          if (e) {
            const mimeType = e[1],
              t = e[2],
              i = atob(t),
              r = new Uint8Array(i.length);
            for (let e = 0; e < i.length; e++) r[e] = i.charCodeAt(e);
            return o(new Blob([r], { type: mimeType }));
          }
          const t = url.indexOf(",");
          if (t > 0) {
            const e = url.substring(0, t),
              i = url.substring(t + 1),
              r = e.match(/data:([^;]+)/),
              mimeType = r ? r[1] : "application/octet-stream",
              a = atob(i),
              s = new Uint8Array(a.length);
            for (let t = 0; t < a.length; t++) s[t] = a.charCodeAt(t);
            return o(new Blob([s], { type: mimeType }));
          }
          throw new Error("无法解析 base64 data URL 格式");
        } catch (r) {
          console.error("[getBlobFromUrl] 手动解析 base64 失败:", r);
          try {
            const e = await fetch(url);
            return o(await e.blob());
          } catch (a) {
            throw new Error(
              `Base64 data URL 转换失败: ${r instanceof Error ? r.message : String(r)}`,
            );
          }
        }
      }
    if (url.startsWith("http://") || url.startsWith("https://"))
      try {
        const e = await fetch(url, { mode: "cors" });
        if (!e.ok) throw new Error(`HTTP ${e.status}: ${e.statusText}`);
        return o(await e.blob());
      } catch (error) {
        throw new Error(
          `HTTP URL 获取失败: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    if (url.startsWith("blob:"))
      try {
        const e = await fetch(url);
        return o(await e.blob());
      } catch (error) {
        throw new Error(
          `Blob URL 已失效或无法访问，请使用原始URL或从缓存重新加载: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    throw new Error(`不支持的 URL 类型: ${url.substring(0, 50)}...`);
  },
  Vo = (blob) =>
    new Promise((e, t) => {
      const o = new FileReader();
      ((o.onloadend = () => e(o.result)),
        (o.onerror = t),
        o.readAsDataURL(blob));
    }),
  Ko = (e, t = 0) => {
    if (t > 5) return null;
    if (!e || "object" != typeof e) return null;
    const o = e,
      i = ["url", "image_url", "imageUrl", "image", "src"];
    for (const r of i)
      if (o[r] && "string" == typeof o[r] && o[r].startsWith("http"))
        return o[r];
    if (Array.isArray(e) && e.length > 0) {
      const result = Ko(e[0], t + 1);
      if (result) return result;
    }
    for (const key in o)
      if (Object.prototype.hasOwnProperty.call(o, key) && !i.includes(key)) {
        const result = Ko(o[key], t + 1);
        if (result) return result;
      }
    return null;
  },
  Ho = (e, t, o) => {
    var i, r, a, s, l, c, d, u, g, m, h, p, f, w, y, v;
    let b = [];
    if (
      (console.log("[extractResultUrls] Input:", {
        isVideoGeneration: t,
        isMidjourney: o,
        hasImageUrl: !!e.imageUrl,
        pollDataKeys: Object.keys(e),
        pollDataSample: JSON.stringify(e).substring(0, 200),
      }),
      !t)
    ) {
      const t = e.choices ?? (null == (i = e.data) ? void 0 : i.choices),
        o = Array.isArray(t) ? t : void 0;
      if (o && o.length > 0) {
        const e = null == (r = o[0]) ? void 0 : r.message,
          content = null == e ? void 0 : e.content;
        if (
          "string" == typeof content &&
          (content.startsWith("http") || content.startsWith("data:"))
        )
          return (
            (b = [content.trim()]),
            console.log(
              "[Chat Completions] 从 choices[0].message.content 字符串提取到图片",
            ),
            b
          );
        if (Array.isArray(content)) {
          for (const e of content)
            "image_url" === (null == e ? void 0 : e.type) &&
            (null == (a = e.image_url) ? void 0 : a.url)
              ? b.push(e.image_url.url)
              : "image" === (null == e ? void 0 : e.type) &&
                e.image &&
                b.push(e.image);
          if (b.length > 0)
            return (
              console.log(
                "[Chat Completions] 从 choices[0].message.content 数组提取到图片:",
                b.length,
              ),
              b
            );
        }
      }
    }
    if (!t && e.output && "object" == typeof e.output) {
      const t = e.output.choices;
      if (
        (console.log("[Wan 2.6 Image] 检查 output.choices:", {
          hasChoices: !!t,
          choicesLength: (null == t ? void 0 : t.length) || 0,
          choicesSample: t ? JSON.stringify(t).substring(0, 500) : "null",
        }),
        t && Array.isArray(t) && t.length > 0)
      ) {
        for (let e = 0; e < t.length; e++) {
          const o = t[e];
          if (
            (console.log(`[Wan 2.6 Image] 处理 choice[${e}]:`, {
              hasMessage: !!o.message,
              hasContent: !!(null == (s = o.message) ? void 0 : s.content),
              contentLength:
                (null == (c = null == (l = o.message) ? void 0 : l.content)
                  ? void 0
                  : c.length) || 0,
              contentSample: (null == (d = o.message) ? void 0 : d.content)
                ? JSON.stringify(o.message.content).substring(0, 200)
                : "null",
            }),
            (null == (u = o.message) ? void 0 : u.content) &&
              Array.isArray(o.message.content))
          )
            for (const e of o.message.content)
              "image" === e.type &&
                e.image &&
                (b.push(e.image),
                console.log(
                  `[Wan 2.6 Image] ✓ 提取到图片 ${b.length}:`,
                  e.image.substring(0, 100),
                ));
        }
        if (b.length > 0)
          return (
            console.log(
              "[Wan 2.6 Image] 从 output.choices[].message.content 提取到图片:",
              b.length,
              "张",
            ),
            console.log("[Wan 2.6 Image] 所有图片URL:", b),
            b
          );
      }
    }
    if (t) {
      const t = e.data,
        o = null == t ? void 0 : t.task_result,
        i = null == o ? void 0 : o.videos;
      if (i && Array.isArray(i) && i.length > 0)
        return (
          (b = i.map((e) => e.url).filter(Boolean)),
          console.log(
            "[Kling O1] 从 data.task_result.videos 提取到视频:",
            b.length,
            "个",
          ),
          b
        );
      const r = e.videos,
        a = e.videoUrls;
      if (r && Array.isArray(r) && r.length > 0)
        return (
          (b = r
            .map((e) => ("string" == typeof e ? e : e.url))
            .filter(Boolean)),
          console.log("[MJ Video] 从 videos 数组提取到视频:", b.length, "个"),
          b
        );
      if (a && Array.isArray(a) && a.length > 0)
        return (
          (b = a
            .map((e) => ("string" == typeof e ? e : null == e ? void 0 : e.url))
            .filter(Boolean)),
          console.log(
            "[MJ Video] 从 videoUrls 数组提取到视频:",
            b.length,
            "个",
          ),
          b
        );
      const s = e.videoUrl;
      if (s)
        return (
          (b = [s]),
          console.log("[MJ Video] 从 videoUrl 提取到单个视频:", s),
          b
        );
      const l =
        (null == (g = e.data) ? void 0 : g.output) ||
        e.output ||
        (null == (m = e.data) ? void 0 : m.video_url) ||
        e.video_url ||
        (null == (h = e.data) ? void 0 : h.videoUrl) ||
        e.videoUrl ||
        (null == (p = e.data) ? void 0 : p.url) ||
        e.url ||
        (null == (w = null == (f = e.data) ? void 0 : f.data)
          ? void 0
          : w.output) ||
        (null == (v = null == (y = e.data) ? void 0 : y.data)
          ? void 0
          : v.video_url);
      l &&
        "string" == typeof l &&
        ((b = [l]), console.log("[Async Video] 提取到视频URL:", l));
    }
    if (!t && o && e.imageUrl)
      return (
        (b = [e.imageUrl]),
        console.log("[extractResultUrls] 从 MJ imageUrl 提取到图片:", b[0]),
        b
      );
    if (0 === b.length) {
      const data = e.data;
      if (
        (null == data ? void 0 : data.data) &&
        Array.isArray(data.data) &&
        data.data.length > 0
      )
        ((b = data.data.map((e) => e.url).filter(Boolean)),
          console.log(
            "[Async Image] 从 data.data.data 提取到图片:",
            b.length,
            "张",
          ));
      else if (
        (null == data ? void 0 : data.images) &&
        Array.isArray(data.images) &&
        data.images.length > 0
      )
        ((b = data.images
          .map((e) => ("string" == typeof e ? e : e.url))
          .filter(Boolean)),
          console.log(
            "[Async Image] 从 data.data.images 提取到图片:",
            b.length,
            "张",
          ));
      else if (e.images && Array.isArray(e.images) && e.images.length > 0)
        ((b = e.images
          .map((e) => ("string" == typeof e ? e : e.url))
          .filter(Boolean)),
          console.log(
            "[Async Image] 从 data.images 提取到图片:",
            b.length,
            "张",
          ));
      else if (e.data && Array.isArray(e.data) && e.data.length > 0) {
        ((b = e.data
          .map((e) => {
            if (e.url) return e.url;
            if (e.b64_json) {
              let mimeType = "image/png";
              return (
                e.b64_json.startsWith("/9j/")
                  ? (mimeType = "image/jpeg")
                  : e.b64_json.startsWith("R0lGOD")
                    ? (mimeType = "image/gif")
                    : e.b64_json.startsWith("UklGR") &&
                      (mimeType = "image/webp"),
                console.log(
                  "[Async Image] ✓ 检测到 base64 图片数据，转换为 data URL",
                ),
                `data:${mimeType};base64,${e.b64_json}`
              );
            }
            return null;
          })
          .filter(Boolean)),
          console.log(
            "[Async Image] 从 data.data 提取到图片:",
            b.length,
            "张",
          ));
      }
    }
    if (0 === b.length) {
      console.log("[extractResultUrls] 常规方式未找到图片，尝试深度搜索...");
      const t = Ko(e);
      t
        ? ((b = [t]),
          console.log("[extractResultUrls] 深度搜索找到图片URL:", t))
        : console.warn(
            "[extractResultUrls] 深度搜索也未找到图片，响应数据:",
            JSON.stringify(e).substring(0, 500),
          );
    }
    return (console.log("[extractResultUrls] Final result:", b), b);
  },
  qo = (e) => {
    const data = e.data;
    if (e.output && "object" == typeof e.output) {
      const t = e.output;
      if (t.task_status) return String(t.task_status).toUpperCase();
    }
    const t =
      (null == data ? void 0 : data.task_status) ||
      (null == data ? void 0 : data.status) ||
      e.status ||
      e.task_status ||
      "";
    return String(t).toUpperCase();
  },
  Zo = (e, t) => {
    const data = e.data,
      o = e.progress || (null == data ? void 0 : data.progress);
    return "string" == typeof o
      ? parseInt(o.replace("%", ""), 10) || Math.min(10 + 2 * t, 90)
      : o || Math.min(10 + 2 * t, 90);
  },
  Qo = (e, t) => {
    const data = e.data,
      o =
        e.failReason ||
        e.fail_reason ||
        (null == data ? void 0 : data.failReason) ||
        (null == data ? void 0 : data.fail_reason) ||
        e.message ||
        e.error ||
        "";
    if ("string" == typeof o) return o || `任务失败: ${t}`;
    if ("object" == typeof o && null !== o) {
      const e = o;
      return e.message && "string" == typeof e.message
        ? e.message
        : JSON.stringify(o);
    }
    return `任务失败: ${t}`;
  };
function Xo(blob) {
  return new Promise((e, t) => {
    const o = new FileReader();
    ((o.onloadend = () => e(o.result)), (o.onerror = t), o.readAsDataURL(blob));
  });
}
const Yo = "https://ai.comfly.chat";
const en = new (class {
  constructor(baseUrl = Yo, apiKey = "", e = []) {
    (u(this, "baseUrl"),
      u(this, "apiKey"),
      u(this, "configs"),
      (this.baseUrl = baseUrl.replace(/\/+$/, "")),
      (this.apiKey = apiKey),
      (this.configs = e));
  }
  updateConfig(baseUrl, apiKey, e) {
    (baseUrl && (this.baseUrl = baseUrl.replace(/\/+$/, "")),
      apiKey && (this.apiKey = apiKey),
      e && (this.configs = e));
  }
  getModelConfig(modelId) {
    return this.configs.find((e) => e.id === modelId);
  }
  getApiKey(modelId) {
    const e = this.getModelConfig(modelId);
    return (null == e ? void 0 : e.key) || this.apiKey;
  }
  getBaseUrl(modelId) {
    const e = this.getModelConfig(modelId);
    return ((null == e ? void 0 : e.url) || this.baseUrl).replace(/\/+$/, "");
  }
  async request(endpoint, e = {}, modelId) {
    const baseUrl = modelId ? this.getBaseUrl(modelId) : this.baseUrl,
      apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    try {
      const t = await fetch(`${baseUrl}${endpoint}`, {
        ...e,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...e.headers,
        },
      });
      if (!t.ok) {
        const e = await t.text();
        return { success: !1, error: `HTTP ${t.status}: ${e}` };
      }
      return { success: !0, data: await t.json() };
    } catch (error) {
      return { success: !1, error: String(error) };
    }
  }
  async imageToBase64(e) {
    if (e.startsWith("data:")) return e;
    try {
      const t = await fetch(e),
        blob = await t.blob();
      return new Promise((e, t) => {
        const o = new FileReader();
        ((o.onload = () => e(o.result)),
          (o.onerror = t),
          o.readAsDataURL(blob));
      });
    } catch (error) {
      return (console.error("图片转 Base64 失败:", error), e);
    }
  }
  fileToBase64(file) {
    return new Promise((e, t) => {
      const o = new FileReader();
      ((o.onload = () => e(o.result)), (o.onerror = t), o.readAsDataURL(file));
    });
  }
  async chatCompletion(e) {
    return this.request(
      "/v1/chat/completions",
      { method: "POST", body: JSON.stringify(e) },
      e.model,
    );
  }
  async generateImage(e) {
    const t = this.getModelConfig(e.model);
    return (
      this.getBaseUrl(e.model),
      this.getApiKey(e.model),
      e.model.startsWith("jimeng")
        ? this.request(
            "/api/generate",
            {
              method: "POST",
              body: JSON.stringify({
                prompt: e.prompt,
                model: (null == t ? void 0 : t.modelName) || e.model,
                size: e.size,
                images: e.referenceImages,
              }),
            },
            e.model,
          )
        : this.request(
            "/v1/images/generations",
            {
              method: "POST",
              body: JSON.stringify({
                model: (null == t ? void 0 : t.modelName) || e.model,
                prompt: e.prompt,
                size: e.size || "1024x1024",
                n: e.n || 1,
              }),
            },
            e.model,
          )
    );
  }
  async generateImageAsync(e) {
    const t = this.getModelConfig(e.model);
    return this.request(
      "/v1/images/generations",
      {
        method: "POST",
        body: JSON.stringify({
          model: (null == t ? void 0 : t.modelName) || e.model,
          prompt: e.prompt,
          size: e.size || "1024x1024",
          n: e.n || 1,
        }),
      },
      e.model,
    );
  }
  async generateVideo(e) {
    var t, o, i;
    const r = this.getModelConfig(e.model),
      baseUrl = this.getBaseUrl(e.model);
    if (e.model.includes("jimeng-video")) {
      const payload = {
        model: (null == r ? void 0 : r.modelName) || e.model,
        prompt: e.prompt.trim(),
        duration: parseInt(
          (null == (t = e.duration) ? void 0 : t.replace("s", "")) || "5",
        ),
      };
      e.size &&
        "jimeng-video-3.0-pro" !== e.model &&
        (payload.resolution = e.size.toLowerCase());
      const images = [];
      if (e.firstFrame)
        try {
          let t;
          if (e.firstFrame.startsWith("data:")) t = e.firstFrame;
          else if (
            e.firstFrame.startsWith("http://") ||
            e.firstFrame.startsWith("https://")
          ) {
            const blob = await Jo(e.firstFrame);
            t = await Xo(blob);
          } else {
            const blob = await Jo(e.firstFrame);
            t = await Xo(blob);
          }
          images.push(t);
        } catch (error) {
          console.error("[API Service] 首帧图片转换失败:", error);
        }
      if (e.lastFrame)
        try {
          let t;
          if (e.lastFrame.startsWith("data:")) t = e.lastFrame;
          else if (
            e.lastFrame.startsWith("http://") ||
            e.lastFrame.startsWith("https://")
          ) {
            const blob = await Jo(e.lastFrame);
            t = await Xo(blob);
          } else {
            const blob = await Jo(e.lastFrame);
            t = await Xo(blob);
          }
          images.push(t);
        } catch (error) {
          console.error("[API Service] 尾帧图片转换失败:", error);
        }
      return (
        images.length > 0 &&
          ((payload.images = images),
          console.log(
            "[API Service] Jimeng 视频生成，已添加",
            images.length,
            "张图片（首尾帧）",
          )),
        this.request(
          "/v1/videos/generations",
          { method: "POST", body: JSON.stringify(payload) },
          e.model,
        )
      );
    }
    if (e.model.startsWith("sora")) {
      if (baseUrl.includes("api.openai.com"))
        return this.request(
          "/videos",
          {
            method: "POST",
            body: JSON.stringify({
              model: (null == r ? void 0 : r.modelName) || e.model,
              prompt: e.prompt,
              seconds: parseInt(
                (null == (i = e.duration) ? void 0 : i.replace("s", "")) || "5",
              ),
              size: e.size || "1920x1080",
            }),
          },
          e.model,
        );
      {
        const payload = {
          model: (null == r ? void 0 : r.modelName) || e.model,
          prompt: e.prompt,
          aspect_ratio: e.size || "16:9",
          duration:
            (null == (o = e.duration) ? void 0 : o.replace("s", "")) || "10",
        };
        if (e.referenceImages && e.referenceImages.length > 0) {
          const t = await Promise.all(
            e.referenceImages.map(async (e) => {
              if (e.startsWith("data:")) return e;
              if (e.startsWith("http://") || e.startsWith("https://")) return e;
              try {
                const blob = await Jo(e);
                return await Xo(blob);
              } catch (error) {
                return (console.error("[API Service] 图片转换失败:", error), e);
              }
            }),
          );
          ((payload.images = t),
            console.log("[API Service] 图生视频，已添加图片数据"));
        }
        return this.request(
          "/v2/videos/generations",
          { method: "POST", body: JSON.stringify(payload) },
          e.model,
        );
      }
    }
    if (e.model.includes("veo")) {
      const images = [];
      return (
        e.firstFrame && images.push(e.firstFrame),
        e.lastFrame && images.push(e.lastFrame),
        this.request(
          "/v1/video/generations",
          {
            method: "POST",
            body: JSON.stringify({
              model: (null == r ? void 0 : r.modelName) || e.model,
              prompt: e.prompt,
              duration: e.duration || "8s",
              images: images.length > 0 ? images : void 0,
            }),
          },
          e.model,
        )
      );
    }
    return this.request(
      "/v1/video/generations",
      {
        method: "POST",
        body: JSON.stringify({
          model: (null == r ? void 0 : r.modelName) || e.model,
          prompt: e.prompt,
          duration: e.duration,
          size: e.size,
        }),
      },
      e.model,
    );
  }
  async getTaskStatus(taskId, modelId) {
    modelId && this.getModelConfig(modelId);
    const baseUrl = modelId ? this.getBaseUrl(modelId) : this.baseUrl;
    if (null == modelId ? void 0 : modelId.startsWith("sora")) {
      return baseUrl.includes("api.openai.com")
        ? this.request(`/videos/${taskId}`, { method: "GET" }, modelId)
        : this.request(
            `/v2/videos/generations/${taskId}`,
            { method: "GET" },
            modelId,
          );
    }
    return this.request(`/v1/tasks/${taskId}`, { method: "GET" }, modelId);
  }
  async pollTaskUntilComplete(taskId, modelId, e, t = 120, o = 5e3) {
    for (let i = 0; i < t; i++) {
      const result = await this.getTaskStatus(taskId, modelId);
      if (!result.success) return result;
      const task = result.data;
      if (
        ((null == task ? void 0 : task.progress) && e && e(task.progress),
        "completed" === (null == task ? void 0 : task.status))
      )
        return result;
      if ("failed" === (null == task ? void 0 : task.status))
        return { success: !1, error: task.error || "任务失败" };
      await new Promise((e) => setTimeout(e, o));
    }
    return { success: !1, error: "任务超时" };
  }
  async generateMusic(e) {
    const modelId = e.model || "suno-v4";
    this.getBaseUrl(modelId);
    const apiKey = this.getApiKey(modelId),
      t = modelId.includes("v3.0")
        ? "chirp-v3-0"
        : modelId.includes("v3.5")
          ? "chirp-v3-5"
          : modelId.includes("v4.5")
            ? "chirp-v4-5"
            : modelId.includes("v5")
              ? "chirp-v5"
              : "chirp-v4";
    let body;
    body = e.make_instrumental
      ? "inspiration" === e.mode
        ? {
            gpt_description_prompt: e.prompt || "",
            mv: t,
            prompt: "",
            make_instrumental: !0,
          }
        : {
            prompt: e.prompt || "",
            tags: e.tags || "",
            mv: t,
            title: e.title || "",
            continue_clip_id: e.continue_clip_id || null,
            continue_at: e.continue_at || null,
            infill_start_s: e.infill_start_s || null,
            infill_end_s: e.infill_end_s || null,
          }
      : {
          prompt: e.prompt || "",
          mv: t,
          title: e.title || "",
          tags: e.tags || "",
          continue_at: e.continue_at || 0,
          continue_clip_id: e.continue_clip_id || "",
          ...("extend" === e.task ? { task: "extend" } : {}),
          make_instrumental: !1,
        };
    const o = await this.request(
      "/suno/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      modelId,
    );
    if (o.success && o.data) {
      const e = o.data;
      if ("object" == typeof e && Array.isArray(e.clips)) {
        const t = e.clips,
          o = t.map((e) => e.id).filter((e) => e);
        if (o.length > 0)
          return (
            console.log(
              "[generateMusic] Got clips array, extracted clip_ids:",
              o,
            ),
            { success: !0, data: { task_id: "", clip_ids: o, clips: t } }
          );
      }
      if ("object" == typeof e && "data" in e) {
        const data = e.data;
        if (Array.isArray(data))
          return { success: !0, data: { task_id: "", clip_ids: data } };
        if ("string" == typeof data)
          return { success: !0, data: { task_id: data } };
      }
      if ("string" == typeof e) return { success: !0, data: { task_id: e } };
      if (Array.isArray(e))
        return { success: !0, data: { task_id: "", clip_ids: e } };
      if ("object" == typeof e) {
        const t = e.task_id || e.taskId || e.id,
          o = e.clip_ids || e.clipIds || e.ids;
        if (t) return { success: !0, data: { task_id: String(t) } };
        if (Array.isArray(o) && o.length > 0)
          return { success: !0, data: { task_id: "", clip_ids: o } };
      }
    }
    return (
      console.error("[generateMusic] Failed to parse response:", o.data),
      {
        success: !1,
        error: `无法解析 API 响应: ${JSON.stringify(o.data).substring(0, 200)}...`,
      }
    );
  }
  async getMusicTaskStatus(taskId, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      `/suno/fetch/${taskId}`,
      { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
      modelId,
    );
  }
  async getMusicByClipIds(e, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey,
      t = e.join(",");
    return this.request(
      `/suno/feed/${t}`,
      { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
      modelId,
    );
  }
  async getBackendTaskStatus(taskId, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      `/v1/tasks/${taskId}`,
      { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
      modelId,
    );
  }
  async getAudioUploadSignature(e = "mp3", modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      "/suno/uploads/audio",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ extension: e }),
      },
      modelId,
    );
  }
  async uploadAudioToS3(e, t, file, o) {
    try {
      const formData = new FormData();
      return (
        Object.keys(t).forEach((key) => {
          formData.append(key, t[key]);
        }),
        formData.append("file", file),
        new Promise((t, i) => {
          const r = new XMLHttpRequest();
          (r.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable && o) {
              const t = Math.round((e.loaded / e.total) * 100);
              o(t);
            }
          }),
            r.addEventListener("load", () => {
              r.status >= 200 && r.status < 300
                ? t(!0)
                : i(new Error(`Upload failed with status ${r.status}`));
            }),
            r.addEventListener("error", () => {
              i(new Error("Upload failed"));
            }),
            r.addEventListener("abort", () => {
              i(new Error("Upload aborted"));
            }),
            r.open("POST", e),
            r.send(formData));
        })
      );
    } catch (error) {
      return (console.error("[Upload Audio] Error:", error), !1);
    }
  }
  async reportUploadFinish(e, filename, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      `/suno/uploads/audio/${e}/upload-finish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          upload_type: "file_upload",
          upload_filename: filename,
        }),
      },
      modelId,
    );
  }
  async getUploadStatus(e, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      `/suno/uploads/audio/${e}`,
      { method: "GET", headers: { Authorization: `Bearer ${apiKey}` } },
      modelId,
    );
  }
  async initializeAudioClip(e, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      `/suno/uploads/audio/${e}/initialize-clip`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({}),
      },
      modelId,
    );
  }
  async generateLyrics(prompt, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      "/suno/submit/lyrics",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt: prompt }),
      },
      modelId,
    );
  }
  async extendMusic(e) {
    const modelId = e.model || "suno-v4";
    this.getBaseUrl(modelId);
    const apiKey = this.getApiKey(modelId),
      body = {
        prompt: e.prompt,
        mv: e.mv,
        title: e.title,
        tags: e.tags,
        continue_at: e.continue_at,
        continue_clip_id: e.continue_clip_id,
        task: e.task,
        make_instrumental: e.make_instrumental,
      },
      t = await this.request(
        "/suno/submit/music",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        },
        modelId,
      );
    if (t.success && t.data) {
      if ("object" == typeof t.data && "data" in t.data)
        return { success: !0, data: { task_id: t.data.data } };
      if ("string" == typeof t.data)
        return { success: !0, data: { task_id: t.data } };
    }
    return t;
  }
  async splitMusic(e) {
    const modelId = e.model || "suno-v4";
    this.getBaseUrl(modelId);
    const apiKey = this.getApiKey(modelId),
      body = {
        task: e.task,
        generation_type: e.generation_type,
        title: e.title,
        mv: e.mv,
        prompt: e.prompt,
        make_instrumental: e.make_instrumental,
        continue_clip_id: e.continue_clip_id,
        continued_aligned_prompt: e.continued_aligned_prompt,
        continue_at: e.continue_at,
        stem_type_id: e.stem_type_id,
        stem_type_group_name: e.stem_type_group_name,
        stem_task: e.stem_task,
      },
      t = await this.request(
        "/suno/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        },
        modelId,
      );
    if (t.success && t.data) {
      const e = t.data;
      if ("object" == typeof e && Array.isArray(e.clips)) {
        const t = e.clips,
          o = t.map((e) => e.id).filter((e) => e);
        if (o.length > 0)
          return { success: !0, data: { task_id: "", clip_ids: o, clips: t } };
      }
      if ("object" == typeof e && "data" in e) {
        const data = e.data;
        if (Array.isArray(data))
          return { success: !0, data: { task_id: "", clip_ids: data } };
        if ("string" == typeof data)
          return { success: !0, data: { task_id: data } };
      }
      if ("string" == typeof e) return { success: !0, data: { task_id: e } };
      if (Array.isArray(e))
        return { success: !0, data: { task_id: "", clip_ids: e } };
      if ("object" == typeof e) {
        const t = e.task_id || e.taskId || e.id,
          o = e.clip_ids || e.clipIds || e.ids;
        if (t) return { success: !0, data: { task_id: String(t) } };
        if (Array.isArray(o) && o.length > 0)
          return { success: !0, data: { task_id: "", clip_ids: o } };
      }
    }
    return {
      success: !1,
      error: `无法解析声曲分离 API 响应: ${JSON.stringify(t.data).substring(0, 200)}...`,
    };
  }
  async getMusicTiming(e, modelId) {
    const apiKey = modelId ? this.getApiKey(modelId) : this.apiKey;
    return this.request(
      `/suno/act/timing/${e}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
      modelId,
    );
  }
  async testConnection(modelId) {
    try {
      return (await this.request("/v1/models", { method: "GET" }, modelId))
        .success;
    } catch {
      return !1;
    }
  }
})();
function tn(e) {
  const t = e.toLowerCase();
  return (
    t.includes("failed to fetch") ||
    t.includes("network") ||
    t.includes("connection") ||
    t.includes("refused") ||
    t.includes("econnrefused") ||
    t.includes("econnreset") ||
    t.includes("net::err_") ||
    t.includes("load failed")
  );
}
function on() {
  return "undefined" != typeof window && "__TAURI__" in window;
}
function nn(blob) {
  return new Promise((e, t) => {
    const o = new FileReader();
    ((o.onload = () => {
      const base64 = o.result.split(",")[1];
      e(base64 || "");
    }),
      (o.onerror = () => t(o.error)),
      o.readAsDataURL(blob));
  });
}
function rn(e) {
  const headers = {};
  return e.headers
    ? (e.headers instanceof Headers
        ? e.headers.forEach((value, key) => {
            headers[key] = value;
          })
        : Array.isArray(e.headers)
          ? e.headers.forEach(([key, value]) => {
              headers[key] = value;
            })
          : Object.assign(headers, e.headers),
      headers)
    : headers;
}
async function an(url, e = {}) {
  const t = url.includes("dashscope.aliyuncs.com"),
    o = (function (url) {
      try {
        return url.toLowerCase().includes("/vidu/");
      } catch {
        return !1;
      }
    })(url),
    i = on();
  if (o) {
    const t = on() && !0,
      headers = rn(e);
    let body, formData;
    null != e.body &&
      ("string" == typeof e.body
        ? (body = e.body)
        : e.body instanceof FormData
          ? (formData = await (async function (e) {
              const result = [];
              for (const [name, value] of e.entries())
                if ("string" == typeof value)
                  result.push({ name: name, value: value });
                else if (value instanceof Blob) {
                  const base64 = await nn(value),
                    filename = value instanceof File ? value.name : void 0;
                  result.push({
                    name: name,
                    blob_base64: base64,
                    filename: filename,
                  });
                }
              return result;
            })(e.body))
          : (body =
              "function" == typeof e.body.text ? await e.body.text() : void 0));
    const method = (e.method || "GET").toUpperCase();
    try {
      if (t) {
        const e = async () => {
            const e = await invoke("proxy_fetch", {
              args: {
                url: url,
                method: method,
                headers: headers,
                body: body ?? void 0,
                formData: (null == formData ? void 0 : formData.length)
                  ? formData
                  : void 0,
                timeoutSecs: "POST" === method ? 300 : 60,
              },
            });
            return new Response(e, {
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "application/json" },
            });
          },
          t = async () => {
            const e = await (async function (
              url,
              method,
              headers,
              body,
              formData,
              e = 4,
            ) {
              const payload = JSON.stringify({
                url: url,
                method: method.toUpperCase(),
                headers: headers,
                body: body ?? void 0,
                formData: (null == formData ? void 0 : formData.length)
                  ? formData
                  : void 0,
              });
              let t = null;
              for (let i = 0; i <= e; i++)
                try {
                  const e = await fetch("http://127.0.0.1:41600/proxy", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: payload,
                    }),
                    text = await e.text();
                  if (!e.ok)
                    throw new Error(
                      text || `Proxy request failed: ${e.status}`,
                    );
                  return text;
                } catch (o) {
                  t = o instanceof Error ? o : new Error(String(o));
                  const r = t.message;
                  if (i < e && tn(r)) {
                    const e = 500 + 600 * (i + 1);
                    await new Promise((t) => setTimeout(t, e));
                    continue;
                  }
                  throw t;
                }
              throw t || new Error("Proxy request failed");
            })(url, method, headers, body, formData);
            return new Response(e, {
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": "application/json" },
            });
          };
        try {
          return await e();
        } catch (a) {
          try {
            return await t();
          } catch (s) {
            try {
              return await e();
            } catch {
              throw a;
            }
          }
        }
      }
      const e = await invoke("proxy_fetch", {
        args: {
          url: url,
          method: method,
          headers: headers,
          body: body ?? void 0,
          formData: (null == formData ? void 0 : formData.length)
            ? formData
            : void 0,
          timeoutSecs: "POST" === method ? 300 : 60,
        },
      });
      return new Response(e, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const t = error instanceof Error ? error.message : String(error),
        o = on() && !0,
        i =
          /capability|permission|denied|allow|not allowed|unauthorized|IPC/i.test(
            t,
          ),
        r =
          t.includes("HTTP ") ||
          t.includes("502") ||
          t.includes("Bad Gateway") ||
          t.includes("timeout") ||
          t.includes("Timeout") ||
          t.includes("Request failed");
      if (i)
        return new Response(
          JSON.stringify({
            error: "打包版需要后端代理权限。请重新安装应用或确认应用未损坏。",
          }),
          {
            status: 403,
            statusText: "Capability",
            headers: { "Content-Type": "application/json" },
          },
        );
      if (r) {
        let e = t;
        return (
          t.includes("502") || t.includes("Bad Gateway")
            ? (e = "API 服务暂时不可用 (502)，请稍后重试或检查 API 服务状态。")
            : (t.includes("timeout") || t.includes("Timeout")) &&
              (e = "请求超时，请检查网络后重试。"),
          new Response(JSON.stringify({ error: e }), {
            status: 500,
            statusText: "Proxy Error",
          })
        );
      }
      if (o)
        return new Response(
          JSON.stringify({
            error:
              "打包版 Vidu 需通过 Tauri 后端代理。请确认应用已正确安装；若仍失败可尝试重新安装。可检查本机 41600 端口是否被占用、或安全软件是否拦截。",
          }),
          {
            status: 403,
            statusText: "Proxy",
            headers: { "Content-Type": "application/json" },
          },
        );
      try {
        const t = new URL(url),
          o = `/api/vidu-proxy${t.pathname}${t.search}`,
          i = await fetch(o, {
            method: e.method || "GET",
            headers: e.headers,
            body: e.body,
          }),
          text = await i.text();
        return /^\s*<(!DOCTYPE|html|head|<)/i.test(text) ||
          (404 === i.status && text.length > 0)
          ? new Response(
              JSON.stringify({
                error:
                  "打包版 Vidu 需通过 Tauri 后端代理。请确认应用已正确安装；若仍失败，可尝试重新安装。",
              }),
              {
                status: 403,
                statusText: "Proxy",
                headers: { "Content-Type": "application/json" },
              },
            )
          : new Response(text, {
              status: i.status,
              statusText: i.statusText,
              headers: i.headers,
            });
      } catch (l) {
        return new Response(
          JSON.stringify({
            error:
              "Vidu 图生视频需在 Tauri 桌面版中运行（tauri dev 或打包后启动），或确保使用 npm run dev 启动开发服务器以通过代理访问。",
          }),
          {
            status: 403,
            statusText: "CORS",
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  }
  const r = url.includes("generativelanguage.googleapis.com");
  if (i && r)
    try {
      const headers = rn(e);
      let body;
      null != e.body &&
        ("string" == typeof e.body
          ? (body = e.body)
          : "function" == typeof e.body.text && (body = await e.body.text()));
      const method = (e.method || "GET").toUpperCase(),
        t = await invoke("proxy_fetch", {
          args: {
            url: url,
            method: method,
            headers: headers,
            body: body ?? void 0,
            timeoutSecs: "POST" === method ? 180 : 60,
          },
        });
      return new Response(t, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error instanceof Error ? error.message : String(error),
        t = /HTTP |502|timeout|Timeout|Request failed/i.test(e);
      return new Response(
        JSON.stringify({ error: t ? e : `Gemini 官方 API 代理请求失败: ${e}` }),
        {
          status: 500,
          statusText: "Proxy Error",
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  if (i && t)
    try {
      const t = new URL(url),
        path = t.pathname + t.search,
        headers = rn(e),
        o = await (async function (path, e = {}) {
          const {
              method: method = "GET",
              headers: headers = {},
              body: body,
            } = e,
            t = path.startsWith("/") ? path : `/${path}`,
            o = body
              ? "string" == typeof body
                ? body
                : JSON.stringify(body)
              : void 0;
          try {
            const e = await invoke("proxy_dashscope_request", {
              path: t,
              method: method.toUpperCase(),
              headers: headers,
              body: o,
            });
            try {
              return JSON.parse(e);
            } catch {
              return e;
            }
          } catch (error) {
            throw error;
          }
        })(path, { method: e.method || "GET", headers: headers, body: e.body }),
        i = "string" == typeof o ? o : JSON.stringify(o);
      return new Response(i, {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      const e = error instanceof Error ? error.message : String(error);
      return new Response(
        JSON.stringify({
          error: e,
          details:
            "Tauri proxy failed. Check if proxy_dashscope_request command is registered.",
        }),
        { status: 500, statusText: "Proxy Error" },
      );
    }
  return fetch(url, e);
}
function sn(e, t) {
  e -= 0;
  return dn()[e];
}
const ln = (e, t) => {
    const o = sn;
    return "architecture" === e ? Math.max(t, 0.8 + 0.05 * Math[o(7)]()) : t;
  },
  cn = (e, t = 1) => 0.35 + 0.1 * Math.random();
function dn() {
  const e = [
    "push",
    "(Two-point perspective:1.4), dramatically shifting the vanishing point to the opposite far diagonal corner, re-modeling the interior from alternate corner view, architectural wide-angle lens",
    "(One-point perspective:1.2), frontal architectural view, centered vanishing point",
    "slightly elevated camera position, gentle downward angle on the interior layout",
    "(Ultra-wide 14mm lens:1.3), extreme interior perspective, expanding the sense of space",
    "wider architectural framing, revealing more spatial context",
    "join",
    "random",
    "room",
    "interior",
    "lobby",
    "staircase",
    "people",
    "portrait",
    "face",
    "some",
    "character",
  ];
  return (dn = function () {
    return e;
  })();
}
function un() {
  const e = [
    "camera slightly right of center, subtle off-axis angle, near-frontal shot",
    "camera behind and to the right, rear three-quarter orbit, over-the-shoulder angle",
    "camera behind subject angled from right, strong rear orbit, following angle",
    "camera at left front three-quarter position, classic 45-degree orbit from left, diagonal viewpoint mirrored",
    "near profile, nose tip extending past cheek contour, far eye barely visible, strong facial depth, ear becoming prominent",
    "back of head and right ear visible, jawline edge barely showing, shoulder and upper back prominent, hair/back detail focus",
    "perfect left side profile, right eye visible, left ear centered, nose silhouette from left, mirrored profile composition",
    "background starting to angle, left side of environment receding slightly deeper, gentle perspective shift, vanishing point drifting right of center",
    "2-point perspective, left background wall receding sharply into depth, right background wall angling toward camera, strong diagonal leading lines, vanishing point shifted far right, corner of room or environment visible",
    "maximum depth perspective mirrored, environment extends in front of and behind subject, vanishing point on right side, parallel environment lines converge to distant right",
    "extreme low angle, worm's eye view, camera on ground pointing straight up",
    "slight low angle, camera just below eye level, subtle upward gaze",
    "steep overhead angle, drone shot, camera far above looking almost straight down",
    "top-down view, bird's eye view, camera directly above pointing straight down, 90-degree vertical",
    "natural proportions, no perspective distortion, neutral and balanced view",
    "top of head/object visible, body foreshortened downward, shoulders/top surface prominent",
    "low horizon line at bottom 20% of frame, sky or ceiling occupies upper 60% of frame, vertical lines slightly converging upward, buildings/walls appear to lean back, ground plane compressed to thin strip at bottom",
    "horizon line slightly below center at 40% height, slightly more sky/ceiling than ground visible, vertical lines nearly parallel with minimal upward convergence, natural street-level spatial feel",
    "horizon line at exact center of frame, equal sky and ground distribution, vertical lines perfectly parallel, horizontal lines converge to center vanishing point, natural human-eye spatial relationship",
    "high horizon line at top 20% of frame, ground plane dominates 70% of frame, floor texture fully visible, ground shadows clearly cast, objects on ground visible, minimal sky, vertical lines converging downward",
    "ground plane fills 90% of frame, horizon nearly gone, floor layout fully readable, shadows directly below objects, spatial layout like a map beginning to form, architectural footprints visible, paths and roads readable as lines",
    "vast environment visible, expanded spatial feel, wide field of view, slight barrel distortion at edges, room/landscape feels larger than reality, extensive background detail, multiple depth layers visible",
    "background softening, shallow depth of field beginning, environment becomes abstract color and shape, spatial compression increasing, background elements appear closer together",
    "background fully blurred into bokeh, no environmental detail readable, extreme shallow depth of field, compressed spatial layers merge into soft color wash, only subject plane in focus",
    "sceneMode",
    "character",
    "isActive",
    ", strictly maintaining the character and environment from the reference image, consistent lighting and style",
  ];
  return (un = function () {
    return e;
  })();
}
function gn(e, t) {
  e -= 0;
  return un()[e];
}
const mn = (e) => {
    const t = gn,
      o = ((e % 360) + 360) % 360;
    return o <= 15 || o >= 346
      ? "front-facing camera, head-on shot, camera directly in front of subject"
      : o <= 30
        ? t(0)
        : o <= 60
          ? "camera at right front three-quarter position, classic 45-degree orbit, diagonal viewpoint"
          : o <= 85
            ? "camera approaching right side, strong lateral orbit, near-profile viewpoint"
            : o <= 95
              ? "camera at exact right side, 90-degree lateral position, pure profile shot"
              : o <= 120
                ? t(1)
                : o <= 160
                  ? t(2)
                  : o <= 195
                    ? "camera directly behind subject, 180-degree rear position, following shot"
                    : o <= 240
                      ? "camera behind subject angled from left, rear orbit mirrored, following angle from left"
                      : o <= 265
                        ? "camera at exact left side, 270-degree orbit, left profile shot"
                        : o <= 300
                          ? t(3)
                          : "camera slightly left of center, subtle off-axis from left, near-frontal shot";
  },
  hn = (e) => {
    const t = gn,
      o = ((e % 360) + 360) % 360;
    return o <= 15 || o >= 346
      ? "subject facing camera, symmetrical view, both eyes visible, centered composition"
      : o <= 30
        ? "slight rightward turn relative to camera, face mostly visible, left ear beginning to hide, subtle asymmetry"
        : o <= 60
          ? "three-quarter view, classic portrait angle, far eye partially occluded by nose bridge, near cheekbone prominent, one ear hidden"
          : o <= 85
            ? t(4)
            : o <= 95
              ? "perfect side profile, single eye visible, nose silhouette sharp, ear centered in frame, jawline to chin contour clean"
              : o <= 120
                ? t(5)
                : o <= 160
                  ? "mostly back view, spine line off-center, right shoulder closer to camera, back of head dominant, no facial features visible"
                  : o <= 195
                    ? "full back view, symmetrical shoulders, spine centered, back of head centered, no face visible, dorsal view"
                    : o <= 240
                      ? "mostly back view, left shoulder closer to camera, spine line off-center left, back of head dominant, no facial features"
                      : o <= 265
                        ? t(6)
                        : o <= 300
                          ? "three-quarter view from left, right ear hidden, left cheekbone prominent, classic portrait angle mirrored"
                          : "slight leftward turn relative to camera, face mostly visible, right ear beginning to hide, subtle asymmetry from left";
  },
  pn = (e) => {
    const t = gn,
      o = ((e % 360) + 360) % 360;
    return o <= 15 || o >= 346
      ? "1-point perspective, background parallel to camera plane, symmetrical depth, walls/environment receding evenly on both sides, centered vanishing point"
      : o <= 30
        ? t(7)
        : o <= 60
          ? t(8)
          : o <= 85
            ? "deep perspective tunnel effect, environment stretching into distance ahead of subject, strong depth of field, foreground-background separation dramatic, leading lines converging to single distant vanishing point on left"
            : o <= 95
              ? "maximum depth perspective, environment extends infinitely in front of and behind subject, foreground and background layers clearly separated, strong atmospheric perspective, parallel lines of environment converge to distant vanishing point"
              : o <= 120
                ? "camera now sees what is in front of subject, environment ahead of subject becoming visible, over-the-shoulder depth, foreground is subject's back, background is subject's forward view, reversed spatial relationship"
                : o <= 160
                  ? "full forward environment visible past subject, subject silhouetted against their own view, third-person game perspective, depth extends ahead into scene, ground plane and distant background both visible"
                  : o <= 195
                    ? "entire forward scene visible, subject looking into the depth of environment, 1-point perspective from behind, centered vanishing point ahead, road/path/corridor stretching forward, immersive third-person depth"
                    : o <= 240
                      ? "forward environment visible past subject from left bias, depth extends ahead, left side of forward scene more visible, asymmetric third-person view"
                      : o <= 265
                        ? t(9)
                        : o <= 300
                          ? "2-point perspective mirrored, right background wall receding into depth, left background wall angling toward camera, vanishing point shifted far left, corner of environment visible from left"
                          : "background starting to angle from left, right side of environment receding slightly deeper, vanishing point drifting left of center";
  },
  fn = (e) => {
    const t = gn;
    return e <= -60
      ? t(10)
      : e <= -30
        ? "low angle shot, hero angle, camera below subject eye level, looking up"
        : e <= -10
          ? t(11)
          : e <= 9
            ? "eye level shot, camera at subject eye height, neutral horizontal angle"
            : e <= 29
              ? "slight high angle, camera just above eye level, gentle downward look"
              : e <= 59
                ? "high angle shot, camera significantly above subject, looking down at scene"
                : t(e <= 80 ? 12 : 13);
  },
  wn = (e) => {
    const t = gn;
    return e <= -60
      ? "subject towering above, chin and underside visible, dramatic foreshortening, legs massive if full body"
      : e <= -30
        ? "subject appears tall and powerful, chin slightly prominent, body elongated upward, imposing presence"
        : e <= -10
          ? "flattering upward perspective, jawline defined, subtle power dynamic, natural and confident"
          : e <= 9
            ? t(14)
            : e <= 29
              ? "forehead slightly more visible, approachable and intimate, subject appears slightly smaller"
              : e <= 59
                ? t(15)
                : e <= 80
                  ? "top of head/roof dominant, extreme vertical foreshortening, body compressed to near-flat shape"
                  : "only top surface visible, flat silhouette, no side surfaces, plan view of subject";
  },
  yn = (e) => {
    const t = gn;
    return e <= -60
      ? "no ground visible, sky or ceiling fills background, vertical lines converging upward to overhead vanishing point, 3-point perspective with upward convergence, buildings/walls/trees stretching toward sky, no horizon line"
      : e <= -30
        ? t(16)
        : e <= -10
          ? t(17)
          : e <= 9
            ? t(18)
            : e <= 29
              ? "horizon line slightly above center at 60% height, more ground/floor visible than sky, ground texture becoming readable, floor pattern or surface detail emerging, vertical lines nearly parallel with minimal downward convergence"
              : e <= 59
                ? t(19)
                : e <= 80
                  ? t(20)
                  : "no horizon line, no sky, entire frame is ground plane, pure floor/ground layout, map view, flat lay composition, all shadows directly beneath objects, no perspective convergence, orthographic spatial feel, architectural plan perspective";
  },
  vn = (e) => {
    const t = gn;
    return e <= 0.7
      ? t(21)
      : e <= 0.95
        ? "natural spatial proportions, moderate environment context, background readable but not dominant, 2-3 depth layers, standard room/scene feel"
        : e <= 1.2
          ? "background present but secondary, natural depth of field, environment provides context without dominating, realistic human-eye spatial compression"
          : t(e <= 1.5 ? 22 : 23);
  },
  bn = (e) => {
    const t = gn;
    if (!e || !e[t(26)]) return { augmentedPrompt: "", angleMetadata: null };
    const { rotation: o, tilt: i, scale: r } = e,
      a = (360 - (((o % 360) + 360) % 360)) % 360,
      { fullPrompt: s } = ((e, t, o) => {
        const i = [
            mn(e),
            fn(t),
            ((l = o),
            l <= 0.7
              ? "wide angle lens, 24mm equivalent, camera far from subject, establishing shot"
              : l <= 0.95
                ? "standard wide shot, 35mm equivalent, full body framing"
                : l <= 1.2
                  ? "medium shot, 50mm equivalent, natural field of view, waist-up or knee-up framing"
                  : l <= 1.5
                    ? "medium close-up, 85mm equivalent, portrait lens, head and shoulders framing"
                    : "close-up shot, 100mm equivalent, tight framing, face or detail filling frame"),
          ].join(", "),
          r = [
            hn(e),
            wn(t),
            ((s = o),
            s <= 0.7
              ? "subject small in frame occupying less than 30% of image, full body with space around, environmental portrait"
              : s <= 0.95
                ? "full body visible head to toe, subject occupies 40-60% of frame height, complete form readable"
                : s <= 1.2
                  ? "upper body focus, waist or knees up, facial expression readable, gesture visible"
                  : s <= 1.5
                    ? "head and shoulders dominant, facial detail clear, skin texture visible, expression is focal point"
                    : "face filling frame or specific detail dominant, pores and fine texture visible, intimate and immersive"),
          ].join(", "),
          a = [pn(e), yn(t), vn(o)].join(", ");
        var s, l;
        return {
          cameraLayer: i,
          subjectLayer: r,
          spaceLayer: a,
          fullPrompt: i + ", " + r + ", " + a,
        };
      })(a, i, r);
    return {
      augmentedPrompt: "(Professional re-shot:1.3), " + s + t(27),
      angleMetadata: { rotation: o, tilt: i, scale: r },
    };
  };
async function _n(e, t, o, i) {
  var r;
  const a = jn;
  if (
    (console.log("[AudioUploader] 上传音频文件:", {
      name: e.name,
      size: e.size,
      type: e.type,
      segment: t,
    }),
    i && i.includes("dashscope"))
  )
    return (
      console.log("[AudioUploader] 检测到阿里云官方 API，使用 Base64 编码"),
      In(e, t)
    );
  if (o && i)
    try {
      let l = e;
      if (t) {
        console[a(0)]("[AudioUploader] 裁剪音频片段:", t);
        const o = await Sn(e, t.startTime, t.endTime);
        l = new File([o], e[a(1)], { type: "audio/wav" });
      }
      const c = [
        i + "/v1/uploads",
        i + "/api/v1/uploads",
        i + "/v1/files",
        i + "/uploads",
      ];
      console.log("[AudioUploader] 文件信息:", {
        name: l.name,
        size: l.size,
        type: l.type,
      });
      let d = null;
      for (const e of c)
        try {
          console[a(0)](a(2), e);
          const t = new FormData();
          (t.append("file", l), t.append("purpose", a(3)));
          const s = await fetch(e, {
            method: "POST",
            headers: { Authorization: "Bearer " + o },
            body: t,
          });
          if (!s.ok) {
            const t = await s.text();
            (console.warn("[AudioUploader] 端点失败:", e, s.status, t),
              (d = new Error("HTTP " + s.status + ": " + t)));
            continue;
          }
          const c = await s[a(4)]();
          console.log(a(5), c);
          let u =
            c[a(6)] ||
            c[a(7)] ||
            c.download_url ||
            (null == (r = c.data) ? void 0 : r.url);
          if ((!u && c.id && (u = i + "/v1/files/" + c.id + "/content"), !u)) {
            (console[a(8)](a(9)), (d = new Error("响应中未找到文件 URL")));
            continue;
          }
          return (console.log(a(10), u), u);
        } catch (s) {
          (console.warn("[AudioUploader] 端点请求失败:", e, s),
            (d = s instanceof Error ? s : new Error(String(s))));
          continue;
        }
      return (
        console.warn(
          "[AudioUploader] 所有上传端点都失败，使用 Base64 编码作为备选方案",
        ),
        In(e, t)
      );
    } catch (l) {
      return (console.error("[AudioUploader] 上传到服务器失败:", l), In(e, t));
    }
  return In(e, t);
}
async function In(e, t) {
  const o = jn;
  (console.warn("[AudioUploader] 使用 Base64 编码"),
    console[o(8)]("[AudioUploader] 注意：Base64 编码会增加文件大小约 33%"));
  try {
    let i = e;
    if (t) {
      console.log("[AudioUploader] 裁剪音频片段:", t);
      const r = await Sn(e, t[o(11)], t.endTime);
      i = new File([r], e[o(1)], { type: "audio/wav" });
    }
    const r = await i.arrayBuffer(),
      a = new Uint8Array(r);
    let s = "";
    for (let e = 0; e < a.byteLength; e++) s += String[o(12)](a[e]);
    const l = btoa(s),
      c = i.type || "audio/wav",
      d = o(13) + c + ";base64," + l;
    return (console.log(o(14), d.length, "字符"), d);
  } catch (i) {
    throw (
      console.error(o(15), i),
      new Error("音频处理失败：无法上传文件且 Base64 编码失败")
    );
  }
}
async function Sn(e, t, o) {
  const i = jn,
    r = new (window[i(16)] || window[i(17)])(),
    a = await e.arrayBuffer(),
    s = await r.decodeAudioData(a),
    l = s[i(18)],
    c = Math.floor(t * l),
    d = o - t,
    u = s.numberOfChannels,
    g = r[i(19)](u, Math.floor(d * l), l);
  for (let m = 0; m < u; m++) {
    const e = s[i(20)](m),
      t = g.getChannelData(m);
    for (let o = 0; o < t.length; o++) t[o] = e[c + o] || 0;
  }
  return await (async function (e) {
    const t = jn,
      o = e.numberOfChannels,
      i = e.sampleRate,
      r = 1,
      a = 16,
      s = a / 8,
      l = o * s,
      c = new Float32Array(e[t(21)] * o);
    for (let m = 0; m < o; m++) {
      const t = e.getChannelData(m);
      for (let i = 0; i < e.length; i++) c[i * o + m] = t[i];
    }
    const d = c.length * s,
      u = new ArrayBuffer(44 + d),
      g = new DataView(u);
    return (
      Pn(g, 0, "RIFF"),
      g.setUint32(4, 36 + d, !0),
      Pn(g, 8, "WAVE"),
      Pn(g, 12, t(22)),
      g.setUint32(16, 16, !0),
      g.setUint16(20, r, !0),
      g.setUint16(22, o, !0),
      g.setUint32(24, i, !0),
      g.setUint32(28, i * l, !0),
      g.setUint16(32, l, !0),
      g.setUint16(34, a, !0),
      Pn(g, 36, t(23)),
      g[t(24)](40, d, !0),
      (function (e, t, o) {
        const i = jn;
        for (let r = 0; r < o[i(21)]; r++, t += 2) {
          const i = Math.max(-1, Math.min(1, o[r]));
          e.setInt16(t, i < 0 ? 32768 * i : 32767 * i, !0);
        }
      })(g, 44, c),
      new Blob([u], { type: "audio/wav" })
    );
  })(g);
}
function jn(e, t) {
  e -= 0;
  return An()[e];
}
function An() {
  const e = [
    "log",
    "name",
    "[AudioUploader] 尝试上传接口:",
    "assistants",
    "json",
    "[AudioUploader] 上传成功:",
    "url",
    "file_url",
    "warn",
    "[AudioUploader] 响应中未找到文件 URL，尝试下一个端点",
    "[AudioUploader] 文件 URL:",
    "startTime",
    "fromCharCode",
    "data:",
    "[AudioUploader] Base64 编码完成，大小:",
    "[AudioUploader] Base64 编码失败:",
    "AudioContext",
    "webkitAudioContext",
    "sampleRate",
    "createBuffer",
    "getChannelData",
    "length",
    "fmt ",
    "data",
    "setUint32",
    "setUint8",
  ];
  return (An = function () {
    return e;
  })();
}
function Pn(e, t, o) {
  const i = jn;
  for (let r = 0; r < o.length; r++) e[i(25)](t + r, o.charCodeAt(r));
}
function xn(e, t) {
  e -= 0;
  return kn()[e];
}
function kn() {
  const e = [
    "length",
    "size",
    "includes",
    "split",
    "toFixed",
    "内存使用率触发",
    "stringify",
    "[LargeDataProcessor] 降级到 JavaScript 处理",
    "maxDimension",
    "charCodeAt",
    ";base64,",
    "src",
    "naturalHeight",
    "min",
    "floor",
    "createElement",
    "height",
    "getContext",
    "drawImage",
    "toDataURL",
    "[LargeDataProcessor] Canvas 压缩完成（含缩放）: ",
    "warn",
    "[LargeDataProcessor] 压缩后仍约 ",
    "ceil",
    "error",
    "[LargeDataProcessor] 获取系统内存信息失败:",
    "无法获取内存信息",
    "totalJSHeapSize",
    "jsHeapSizeLimit",
    " KB",
    " MB",
  ];
  return (kn = function () {
    return e;
  })();
}
async function Tn(e, t, o, i) {
  const r = xn,
    a = (function (e) {
      const t = xn;
      return "string" == typeof e
        ? Math.ceil((3 * e[t(0)]) / 4)
        : e instanceof File || e instanceof Blob
          ? e[t(1)]
          : 0;
    })(t),
    s = a >= 104857600,
    l = Cn(),
    c = (null == l ? void 0 : l.usagePercent) || 0,
    d = s || i || c > 70;
  let u;
  if (
    (console.log(
      "[LargeDataProcessor] 处理数据: " +
        e +
        ", 大小: " +
        (a / 1024 / 1024).toFixed(2) +
        " MB",
    ),
    console.log(
      "[LargeDataProcessor] JavaScript 堆使用率: " + c[r(4)](2) + "%",
    ),
    console.log(
      "[LargeDataProcessor] 使用: " +
        (d ? "Rust后端" : "JavaScript") +
        " (" +
        (d ? (s ? "数据大小触发" : r(5)) : "正常处理") +
        ")",
    ),
    (u =
      "string" == typeof t
        ? t
        : await (async function (e) {
            return new Promise((t, o) => {
              const i = new FileReader();
              ((i.onload = () => {
                const e = xn,
                  o = i.result,
                  r = o[e(2)](",") ? o[e(3)](",")[1] : o;
                t(r);
              }),
                (i.onerror = o),
                i.readAsDataURL(e));
            });
          })(t)),
    d)
  )
    try {
      const t = await invoke("process_large_data_rust", {
        operation: e,
        data: u,
        options: o ? JSON[r(6)](o) : void 0,
      });
      return (console.log("[LargeDataProcessor] Rust 后端处理完成"), t);
    } catch (g) {
      return (
        console.error("[LargeDataProcessor] Rust 后端处理失败:", g),
        console.warn(r(7)),
        $n(e, u, o)
      );
    }
  return $n(e, u, o);
}
async function $n(e, t, o) {
  switch (e) {
    case "process_image":
      return (async function (e, t) {
        const o = xn,
          i = (null == t ? void 0 : t[o(8)]) ?? 4096,
          r = (null == t ? void 0 : t.maxSize) ?? 4718592,
          a = (null == t ? void 0 : t.quality) ?? 0.9,
          s = (e.includes(",") && e.split(",")[1]) || e;
        let l = "image/jpeg";
        try {
          const e = atob(s);
          if (e.length >= 2) {
            const t = e[o(9)](0),
              i = e.charCodeAt(1);
            255 === t && 216 === i
              ? (l = "image/jpeg")
              : 137 === t && 80 === i && (l = "image/png");
          }
        } catch {}
        const c = "data:" + l + o(10) + s,
          d = await new Promise((e, t) => {
            const o = xn,
              i = new Image();
            ((i.onload = () => e(i)),
              (i.onerror = () => t(new Error("图片加载失败"))),
              (i[o(11)] = c));
          });
        let u = d.naturalWidth,
          g = d[o(12)];
        if (u > i || g > i) {
          const e = Math[o(13)](i / u, i / g);
          ((u = Math[o(14)](u * e)), (g = Math.floor(g * e)));
        }
        const m = document[o(15)]("canvas");
        ((m.width = u), (m[o(16)] = g));
        const h = m[o(17)]("2d");
        if (!h) return e;
        h[o(18)](d, 0, 0, u, g);
        const p = 0.25;
        let f = Math[o(13)](a, 0.95);
        for (; f >= p; ) {
          const e = m[o(19)]("image/jpeg", f),
            t = e.split(",")[1] || e,
            i = Math.ceil((3 * t.length) / 4);
          if (i <= r)
            return (
              console.log(
                "[LargeDataProcessor] Canvas 压缩完成: 质量" +
                  (100 * f).toFixed(0) +
                  "%, 约" +
                  (i / 1024 / 1024).toFixed(2) +
                  "MB",
              ),
              t
            );
          f -= 0.1;
        }
        let w = 0.85;
        for (; w >= 0.3; ) {
          const e = Math.floor(u * w),
            t = Math[o(14)](g * w);
          ((m.width = e), (m[o(16)] = t), h.drawImage(d, 0, 0, e, t));
          const i = m.toDataURL("image/jpeg", p),
            a = i.split(",")[1] || i,
            s = Math.ceil((3 * a.length) / 4);
          if (s <= r)
            return (
              console.log(
                o(20) +
                  e +
                  "x" +
                  t +
                  ", 约" +
                  (s / 1024 / 1024).toFixed(2) +
                  "MB",
              ),
              a
            );
          w -= 0.1;
        }
        const y = m.toDataURL("image/jpeg", p),
          v = y[o(3)](",")[1] || y;
        return (
          console[o(21)](
            o(22) +
              (Math[o(23)]((3 * v[o(0)]) / 4) / 1024 / 1024).toFixed(2) +
              "MB",
          ),
          v
        );
      })(t, o);
    case "process_video":
    case "process_file":
    case "compress_data":
      return t;
    default:
      throw new Error("不支持的操作: " + e);
  }
}
async function Mn() {
  const e = xn;
  try {
    return await invoke("get_system_memory_info");
  } catch (t) {
    return (
      console[e(24)](e(25), t),
      { total_memory_gb: 0, platform: "unknown", message: e(26) }
    );
  }
}
function Cn() {
  const e = xn,
    t = performance.memory;
  if (!t) return null;
  const o = t.usedJSHeapSize,
    i = t[e(27)],
    r = t[e(28)];
  return { used: o, total: i, limit: r, usagePercent: (o / r) * 100 };
}
function Un(e) {
  const t = xn;
  return e < 1024
    ? e + " B"
    : e < 1048576
      ? (e / 1024)[t(4)](2) + t(29)
      : e < 1073741824
        ? (e / 1024 / 1024).toFixed(2) + t(30)
        : (e / 1024 / 1024 / 1024)[t(4)](2) + " GB";
}
const On = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      formatMemorySize: Un,
      getJSHeapMemory: Cn,
      getSystemMemoryInfo: Mn,
      processLargeData: Tn,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
async function En() {
  const e = Rn,
    t = Cn(),
    o = await Mn(),
    i = (null == t ? void 0 : t[e(0)]) || 0,
    r = (null == t ? void 0 : t.limit) || 0,
    a = (null == t ? void 0 : t.usagePercent) || 0,
    s = a > 70;
  let l = "";
  return (
    (l =
      a > 90
        ? e(1)
        : a > 75
          ? e(2)
          : a > 50
            ? "🟢 内存使用正常，可以继续使用 JavaScript 处理"
            : e(3)),
    {
      jsHeapUsed: i,
      jsHeapLimit: r,
      jsHeapUsagePercent: a,
      systemTotalGB: o[e(4)],
      shouldUseRust: s,
      recommendation: l,
    }
  );
}
async function Ln() {
  const e = Rn,
    t = await En();
  (console.log(e(5)),
    console[e(6)]("📊 内存状态报告"),
    console.log(e(5)),
    console[e(6)]("JavaScript 堆内存:"),
    console[e(6)]("  已使用: " + Un(t.jsHeapUsed)),
    console[e(6)]("  限制: " + Un(t[e(7)])),
    console.log(e(8) + t[e(9)][e(10)](2) + "%"),
    console[e(6)]("系统总内存: " + t[e(11)].toFixed(2) + e(12)),
    console.log(e(13) + t.recommendation),
    console[e(6)](e(14) + (t.shouldUseRust ? "是" : "否")),
    console.log(e(5)));
}
function Rn(e, t) {
  e -= 0;
  return Fn()[e];
}
async function Nn(e, t, o) {
  const i = Rn,
    r = await En(),
    a = r.shouldUseRust;
  return (
    a &&
      console.log(
        "[MemoryBypass] 内存使用率 " +
          r[i(9)].toFixed(2) +
          "%，强制使用 Rust 后端处理",
      ),
    Tn(e, t, o, a)
  );
}
async function Dn(e) {
  const t = Rn,
    o = await En(),
    i = e / 1024 / 1024,
    r = (o[t(7)] - o.jsHeapUsed) / 1024 / 1024;
  return i > r
    ? {
        canProcess: !1,
        reason: "数据大小 (" + i.toFixed(2) + t(15) + r.toFixed(2) + t(16),
        suggestion: "建议使用 Rust 后端处理，不受 JavaScript 堆限制",
      }
    : o.jsHeapUsagePercent > 80
      ? {
          canProcess: !0,
          reason: t(17) + o[t(9)][t(10)](2) + "%)",
          suggestion: "建议使用 Rust 后端处理，避免内存溢出",
        }
      : {
          canProcess: !0,
          reason: "内存充足，可以安全处理",
          suggestion: "可以使用 JavaScript 处理",
        };
}
function Fn() {
  const e = [
    "used",
    "🔴 内存使用率极高！强烈建议使用 Rust 后端处理大数据",
    "🟡 内存使用率较高，建议使用 Rust 后端处理大数据",
    "✅ 内存使用率很低，可以正常使用",
    "total_memory_gb",
    "═══════════════════════════════════════════════════════",
    "log",
    "jsHeapLimit",
    "  使用率: ",
    "jsHeapUsagePercent",
    "toFixed",
    "systemTotalGB",
    " GB",
    "建议: ",
    "是否使用 Rust 后端: ",
    " MB) 超过可用 JavaScript 堆内存 (",
    " MB)",
    "内存使用率较高 (",
  ];
  return (Fn = function () {
    return e;
  })();
}
"undefined" != typeof window &&
  ((window.memoryBypass = {
    getMemoryStatus: En,
    logMemoryStatus: Ln,
    smartProcessData: Nn,
    canSafelyProcess: Dn,
    getSystemMemoryInfo: Mn,
    getJSHeapMemory: Cn,
  }),
  console.log("💡 内存绕过工具已加载！在控制台中使用 window.memoryBypass 访问"),
  console.log("   例如: await window.memoryBypass.logMemoryStatus()"));
const Wn = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        canSafelyProcess: Dn,
        getMemoryStatus: En,
        getSystemMemoryInfo: Mn,
        logMemoryStatus: Ln,
        smartProcessData: Nn,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  zn = 5242880;
async function Bn(e) {
  const t = qn;
  if (e.startsWith(t(0))) {
    return e.split(",")[1] || "";
  }
  return (async function (e) {
    const t = await (async function (e) {
      const t = qn;
      return (await fetch(e))[t(18)]();
    })(e);
    return new Promise((e, o) => {
      const i = new FileReader();
      ((i.onloadend = () => {
        const t = i.result,
          o = t.split(",")[1] || t;
        e(o);
      }),
        (i.onerror = o),
        i.readAsDataURL(t));
    });
  })(e);
}
function Gn(e) {
  return new Promise((t, o) => {
    const i = qn,
      r = new Image();
    ((r.onload = () => t({ w: r.naturalWidth, h: r.naturalHeight })),
      (r.onerror = () => o(new Error("Failed to load image"))),
      (r[i(1)] = e));
  });
}
function Jn(e) {
  var t, o;
  const i = qn;
  if (!e) return !1;
  if (e.startsWith("data:video")) return !0;
  if (e[i(5)]("force_video_display=true")) return !0;
  const r =
    (null == (o = null == (t = e.split(".").pop()) ? void 0 : t[i(6)]("?")[0])
      ? void 0
      : o.toLowerCase()) || "";
  return [i(7), "webm", "ogg", "mov"].includes(r);
}
async function Vn(e, t = 4718592, o = 4096, i) {
  const r = qn,
    a = (e) => {
      (console.log("[压缩] " + e), null == i || i(e));
    };
  try {
    const i = await Bn(e),
      s = Math.ceil((3 * i.length) / 4),
      l = await En();
    if (s >= zn || l[r(30)]) {
      a(r(31));
      const e = await Tn(
          "process_image",
          i,
          { maxDimension: o, maxSize: t, quality: 0.9 },
          !0,
        ),
        s = Math.ceil((3 * e[r(32)]) / 4);
      if (s <= t) return (a("压缩完成"), e);
      a(r(33) + (s / 1024 / 1024).toFixed(2) + "MB，超限，降级 Canvas 重压");
    }
  } catch (w) {
    console.warn(r(34), w);
  }
  const s = await new Promise((t, o) => {
    const i = qn,
      r = new Image();
    ((r.crossOrigin = i(35)),
      (r.onload = () => t(r)),
      (r.onerror = () => o(new Error(i(36)))),
      (r.src = e));
  });
  let { naturalWidth: l, naturalHeight: c } = s;
  if ((a("原始尺寸: " + l + "x" + c), l > o || c > o)) {
    const e = Math.min(o / l, o / c);
    ((l = Math[r(37)](l * e)),
      (c = Math[r(37)](c * e)),
      a(r(38) + l + "x" + c));
  }
  const d = document.createElement("canvas");
  ((d[r(15)] = l), (d.height = c));
  const u = d[r(22)]("2d");
  if (!u) throw new Error(r(39));
  u.drawImage(s, 0, 0, l, c);
  let g = 0.95;
  const m = 0.3;
  let h;
  for (; g >= m; ) {
    const e = d.toDataURL("image/jpeg", g);
    h = e.split(",")[1] || e;
    const o = Math.ceil((3 * h[r(32)]) / 4);
    if (
      (a(
        "质量 " +
          (100 * g).toFixed(0) +
          "%: 约 " +
          (o / 1024 / 1024).toFixed(2) +
          "MB",
      ),
      o <= t)
    )
      return (
        a("压缩完成，最终大小约 " + (o / 1024 / 1024)[r(40)](2) + "MB"),
        h
      );
    g -= 0.1;
  }
  a(r(41));
  let p = 0.8;
  for (; p >= 0.3; ) {
    const e = Math[r(37)](l * p),
      o = Math.floor(c * p);
    ((d.width = e), (d.height = o), u.drawImage(s, 0, 0, e, o));
    const i = d.toDataURL("image/jpeg", m);
    h = i[r(6)](",")[1] || i;
    const g = Math.ceil((3 * h[r(32)]) / 4);
    if (
      (a(
        "尺寸 " +
          e +
          "x" +
          o +
          r(42) +
          (30).toFixed(0) +
          "%: 约 " +
          (g / 1024 / 1024)[r(40)](2) +
          "MB",
      ),
      g <= t)
    )
      return (
        a(
          "压缩完成，最终尺寸 " +
            e +
            "x" +
            o +
            "，大小约 " +
            (g / 1024 / 1024)[r(40)](2) +
            "MB",
        ),
        h
      );
    p -= 0.1;
  }
  a(r(43));
  const f = d.toDataURL("image/jpeg", m);
  return f.split(",")[1] || f;
}
function Kn() {
  const e = [
    "data:",
    "src",
    "startsWith",
    "canvas",
    "toDataURL",
    "includes",
    "split",
    "mp4",
    "video",
    "preload",
    "muted",
    "duration",
    "videoWidth",
    "videoHeight",
    "createElement",
    "width",
    "max",
    "image/jpeg",
    "blob",
    "normal",
    "maxSize",
    "height",
    "getContext",
    "onerror",
    "1080P",
    "720P",
    "abs",
    "Auto",
    "1080p",
    "grok",
    "shouldUseRust",
    "使用 Rust 后端压缩",
    "length",
    "processLargeData 返回 ",
    "[compressImageForSuperRes] 处理失败，降级为 Canvas:",
    "anonymous",
    "图片加载失败",
    "floor",
    "尺寸超限，缩放至: ",
    "无法创建 Canvas 上下文",
    "toFixed",
    "质量压缩不足，尝试缩小尺寸...",
    ", 质量 ",
    "警告：无法将图片压缩到目标大小，使用最小尺寸",
    "ceil",
    ")，按原尺寸发送",
    "log",
    "[compressImageForAPI] 原始尺寸: ",
    "min",
    "%, 大小",
    "MB, 尺寸",
    "[compressImageForKling] 图片尺寸 ",
    "Vidu 图片加载失败",
    "naturalWidth",
    "drawImage",
    " → ",
    "slice",
    "message",
  ];
  return (Kn = function () {
    return e;
  })();
}
async function Hn(e, t = 1572864, o = 3145728, i = 1920, r = 0) {
  const a = qn;
  if (e.startsWith("data:")) {
    const t = e.split(",")[1] || "",
      s = Math[a(44)]((3 * t.length) / 4);
    try {
      const t = await Gn(e),
        l = t.w <= i && t.h <= i,
        c = r <= 0 || (t.w >= r && t.h >= r);
      if (s >= 102400 && s <= 4718592 && l && c)
        return (
          console.log(
            "[compressImageForAPI] 图片未超过4.5MB (" +
              (s / 1024).toFixed(0) +
              "KB, " +
              t.w +
              "x" +
              t.h +
              a(45),
          ),
          e
        );
      if (s >= 102400 && s <= o && l && c)
        return (
          console[a(46)](
            "[compressImageForAPI] 图片已满足要求 (" +
              (s / 1024)[a(40)](0) +
              "KB, " +
              t.w +
              "x" +
              t.h +
              ")，跳过压缩",
          ),
          e
        );
    } catch {}
  }
  try {
    const o = await Bn(e),
      r = Math[a(44)]((3 * o.length) / 4),
      s = await En();
    if (r >= zn || s.shouldUseRust) {
      const e = await Tn("process_image", o, {
        maxDimension: i,
        maxSize: t,
        quality: 0.92,
      });
      return (
        console.log("[compressImageForAPI] Rust 后端压缩完成"),
        "data:image/jpeg;base64," + e
      );
    }
  } catch (v) {
    console.warn("[compressImageForAPI] Rust 处理失败，降级为 Canvas 压缩:", v);
  }
  const s = await new Promise((t, o) => {
    const i = new Image();
    ((i.crossOrigin = "anonymous"),
      (i.onload = () => t(i)),
      (i.onerror = () => o(new Error("图片加载失败"))),
      (i.src = e));
  });
  let { naturalWidth: l, naturalHeight: c } = s;
  if ((console[a(46)](a(47) + l + "x" + c), l > i || c > i)) {
    const e = Math[a(48)](i / l, i / c);
    let t = Math.floor(l * e),
      o = Math[a(37)](c * e);
    if (r > 0) {
      const e = Math[a(48)](t, o);
      if (e < r) {
        const i = r / e;
        ((t = Math[a(48)](Math.ceil(t * i), l)),
          (o = Math.min(Math.ceil(o * i), c)));
      }
    }
    ((l = t),
      (c = o),
      console.log("[compressImageForAPI] 缩放至: " + l + "x" + c));
  }
  const d = document.createElement("canvas");
  ((d[a(15)] = l), (d.height = c));
  const u = d[a(22)]("2d");
  if (!u) throw new Error("无法创建 Canvas 上下文");
  u.drawImage(s, 0, 0, l, c);
  let g = 0.92;
  for (; g >= 0.75; ) {
    const e = d.toDataURL("image/jpeg", g),
      t = e.split(",")[1] || "",
      i = Math.ceil((3 * t.length) / 4);
    if (i >= 102400 && i <= o)
      return (
        console[a(46)](
          "[compressImageForAPI] 压缩完成: 质量" +
            (100 * g).toFixed(0) +
            a(49) +
            (i / 1024 / 1024)[a(40)](2) +
            a(50) +
            l +
            "x" +
            c,
        ),
        e
      );
    if (!(i > o)) break;
    g -= 0.03;
  }
  let m = 0.9;
  for (; m >= 0.7; ) {
    let e = Math.floor(l * m),
      t = Math.floor(c * m);
    if (r > 0 && (e < r || t < r)) break;
    ((d.width = e), (d.height = t), u.drawImage(s, 0, 0, e, t));
    const i = d.toDataURL(a(17), 0.85),
      g = i.split(",")[1] || "",
      h = Math.ceil((3 * g.length) / 4);
    if (h >= 102400 && h <= o)
      return (
        console.log(
          "[compressImageForAPI] 压缩完成（含缩放）: 质量85%, 大小" +
            (h / 1024 / 1024)[a(40)](2) +
            a(50) +
            e +
            "x" +
            t,
        ),
        i
      );
    if (!(h > o)) break;
    m -= 0.05;
  }
  let h = Math.floor(0.7 * l),
    p = Math.floor(0.7 * c);
  if (r > 0) {
    const e = Math.min(h, p);
    if (e < r) {
      const t = r / e;
      ((h = Math[a(48)](Math[a(44)](h * t), l)),
        (p = Math[a(48)](Math.ceil(p * t), c)));
    }
  }
  ((d.width = h), (d[a(21)] = p), u.drawImage(s, 0, 0, h, p));
  const f = d.toDataURL(a(17), 0.8),
    w = f.split(",")[1] || "",
    y = Math[a(44)]((3 * w.length) / 4);
  return (
    console[a(46)](
      "[compressImageForAPI] 使用最小参数: 尺寸" +
        h +
        "x" +
        p +
        ", 质量80%, 大小" +
        (y / 1024 / 1024)[a(40)](2) +
        "MB",
    ),
    f
  );
}
function qn(e, t) {
  e -= 0;
  return Kn()[e];
}
const Zn = 10485760;
const Qn = 11534336,
  Xn = 0.25;
function Yn(e) {
  try {
    const t = JSON.stringify(e);
    return new Blob([t]).size;
  } catch {
    return 0;
  }
}
function ei(e, t = 3e4, o = 2e4, i = 5e3) {
  const r = qn;
  if (e.length <= t) return { text: e, wasTruncated: !1 };
  const a =
    e.slice(0, o) +
    "\n\n...[内容过长，已省略中间 " +
    (e[r(32)] - o - i) +
    " 个字符]...\n\n" +
    e[r(56)](-i);
  return (
    console[r(46)](
      "[truncatePrompt] 文本从 " + e[r(32)] + " 截断至 " + a.length + " 字符",
    ),
    { text: a, wasTruncated: !0 }
  );
}
function ti() {
  const e = [
    "queue",
    "idleCallbackId",
    "has",
    "now",
    "stats",
    "scheduleProcessing",
    "enqueue",
    "getStats",
    "clear",
    "pause",
    "paused",
    "[AssetCacheQueue] 队列已暂停",
    "resume",
    "log",
    "processing",
    "size",
    "config",
    "maxProcessTime",
    "error",
    "processItem",
    "remoteUrl",
    "skipped",
    "[AssetCacheQueue] ❌ 处理项出错: ",
  ];
  return (ti = function () {
    return e;
  })();
}
const oi = ni;
function ni(e, t) {
  e -= 0;
  return ti()[e];
}
class ii {
  constructor(o = {}) {
    (u(this, t, new Map()),
      u(this, "processing", !1),
      u(this, e, null),
      u(this, "config"),
      u(this, "stats", { queued: 0, processed: 0, failed: 0, skipped: 0 }),
      u(this, "paused", !1),
      (this.config = {
        batchSize: o.batchSize ?? 5,
        maxRetries: o.maxRetries ?? 3,
        itemTimeout: o.itemTimeout ?? 3e4,
        maxProcessTime: o.maxProcessTime ?? 5e3,
      }));
  }
  enqueue(e, t, o = "image", i = 50) {
    const r = ni;
    if (this.queue[r(2)](e)) {
      const t = this.queue.get(e);
      return void (i > t.priority && (t.priority = i));
    }
    (this[r(0)].set(e, {
      id: e,
      url: t,
      type: o,
      priority: Math.max(0, Math.min(100, i)),
      timestamp: Date[r(3)](),
      retries: 0,
    }),
      this[r(4)].queued++,
      this[r(5)]());
  }
  enqueueBatch(e) {
    e.forEach((e) => {
      this[ni(6)](e.id, e.url, e.type || "image", e.priority || 50);
    });
  }
  getQueueSize() {
    return this.queue.size;
  }
  [((t = oi(0)), (e = oi(1)), oi(7))]() {
    return { ...this.stats };
  }
  clear() {
    const e = ni;
    (this[e(0)][e(8)](),
      null !== this[e(1)] &&
        (cancelIdleCallback(this.idleCallbackId), (this[e(1)] = null)),
      (this.processing = !1));
  }
  [oi(9)]() {
    const e = ni;
    ((this[e(10)] = !0),
      null !== this.idleCallbackId &&
        (cancelIdleCallback(this[e(1)]), (this.idleCallbackId = null)),
      console.log(e(11)));
  }
  [oi(12)]() {
    const e = ni;
    ((this.paused = !1),
      this[e(0)].size > 0 && this[e(5)](),
      console[e(13)]("[AssetCacheQueue] 队列已恢复"));
  }
  [oi(5)]() {
    const e = ni;
    this.processing ||
      0 === this.queue.size ||
      this[e(10)] ||
      ("undefined" != typeof requestIdleCallback
        ? (this.idleCallbackId = requestIdleCallback(
            () => this.processQueue(),
            { timeout: this.config.itemTimeout },
          ))
        : setTimeout(() => this.processQueue(), 0));
  }
  async processQueue() {
    const e = ni;
    if (this[e(14)] || 0 === this.queue[e(15)]) return;
    this.processing = !0;
    const t = Date.now();
    try {
      const o = Array.from(this.queue.values())
        .sort((e, t) => t.priority - e.priority)
        .slice(0, this.config.batchSize);
      for (const i of o) {
        if (Date[e(3)]() - t > this[e(16)][e(17)]) {
          console.log("[AssetCacheQueue] 处理时间超限，暂停处理");
          break;
        }
        (await this.processItem(i), this[e(0)].delete(i.id));
      }
    } catch (o) {
      console[e(18)]("[AssetCacheQueue] 处理队列出错:", o);
    } finally {
      ((this[e(14)] = !1),
        (this.idleCallbackId = null),
        this.queue.size > 0 && this.scheduleProcessing());
    }
  }
  async [oi(19)](e) {
    const t = ni;
    try {
      const o = await Be.getAssetRecord(e.id);
      if (o && o[t(20)] === e.url) return void this.stats[t(21)]++;
      (await Be.saveAsset(e.id, e.url))
        ? (this.stats.processed++,
          console.log("[AssetCacheQueue] ✅ 缓存完成: " + e.id))
        : e.retries < this.config.maxRetries
          ? (e.retries++,
            this[t(0)].set(e.id, e),
            console.debug(
              "[AssetCacheQueue] 缓存失败，重试 " +
                e.retries +
                "/" +
                this.config.maxRetries +
                ": " +
                e.id,
            ))
          : (this[t(4)].failed++,
            console[t(18)](
              "[AssetCacheQueue] ❌ 缓存失败（已达最大重试）: " + e.id,
            ));
    } catch (o) {
      (this.stats.failed++, console[t(18)](t(22) + e.id, o));
    }
  }
}
const ri = new ii({
  batchSize: 5,
  maxRetries: 2,
  itemTimeout: 3e4,
  maxProcessTime: 5e3,
});
function ai(taskId, url) {
  return `${taskId}_vidu_${(url.split("/").pop() || url).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 36) || Date.now()}`;
}
async function si(e, taskId) {
  const t = [];
  if (e.url) {
    const type =
        e.type ||
        ((url) => {
          const e = url.toLowerCase();
          return e.includes(".mp4") ||
            e.includes(".webm") ||
            e.includes(".mov") ||
            e.includes("video") ||
            e.includes("/v/")
            ? "video"
            : e.includes(".mp3") ||
                e.includes(".wav") ||
                e.includes(".ogg") ||
                e.includes(".m4a") ||
                e.includes(".aac") ||
                e.includes(".flac") ||
                e.includes("audio")
              ? "audio"
              : "image";
        })(e.url),
      o =
        "video" === type &&
        (function (url) {
          const e = url.toLowerCase();
          return (
            e.includes("prod-ss-vidu") ||
            e.includes("prod-sa-vidu") ||
            (e.includes("amazonaws") && e.includes("vidu"))
          );
        })(e.url)
          ? ai(taskId, e.url)
          : taskId;
    t.push({ id: o, url: e.url, type: type, priority: 100 });
  }
  if (
    (e.audioUrl &&
      e.audioUrl !== e.url &&
      t.push({
        id: `${taskId}_audio`,
        url: e.audioUrl,
        type: "audio",
        priority: 80,
      }),
    e.mjImages && Array.isArray(e.mjImages))
  ) {
    const o = "video" === e.type ? "video" : "image";
    e.mjImages.forEach((e, i) => {
      e &&
        "string" == typeof e &&
        t.push({ id: `${taskId}_mj_${i}`, url: e, type: o, priority: 60 });
    });
  }
  if (
    (e.mjOriginalUrl &&
      t.push({
        id: `${taskId}_mj_original`,
        url: e.mjOriginalUrl,
        type: "image",
        priority: 60,
      }),
    e.thumbnailUrl &&
      t.push({
        id: `${taskId}_thumbnail`,
        url: e.thumbnailUrl,
        type: "image",
        priority: 30,
      }),
    t.length > 0)
  ) {
    (ri.enqueueBatch(t),
      console.log(
        `[AssetDownloader] 📥 任务 ${taskId}: ${t.length} 个资源已加入缓存队列`,
      ));
    const e = new CustomEvent("allAssetsDownloadComplete", {
      detail: { taskId: taskId, queued: t.length },
    });
    window.dispatchEvent(e);
  }
}
const li = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        ensureHistoryItemAssetsDownloaded: si,
        getViduVideoAssetId: ai,
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  ci = new Map(),
  di = new Map(),
  ui = (data) => {
    var e, t, o, i;
    console.log("[KlingCallbackService] 收到 callback 数据:", {
      task_id: data.task_id,
      task_status: data.task_status,
      has_videos: !!(null ==
      (t = null == (e = data.task_result) ? void 0 : e.videos)
        ? void 0
        : t.length),
      has_images: !!(null ==
      (i = null == (o = data.task_result) ? void 0 : o.images)
        ? void 0
        : i.length),
    });
    const r = ci.get(data.task_id);
    r
      ? (console.log("[KlingCallbackService] 调用已注册的处理函数"), r(data))
      : (console.log(
          "[KlingCallbackService] 没有找到处理函数，存储为待处理数据",
        ),
        di.set(data.task_id, data));
  };
function gi(e, t, name) {
  if (name.includes(".")) {
    const e = name.slice(name.lastIndexOf("."));
    if (e.length >= 2 && e.length <= 5) return e;
  }
  const o = e.toLowerCase();
  return "audio" === t || o.startsWith("audio/")
    ? o.includes("mpeg") || o.includes("mp3")
      ? ".mp3"
      : o.includes("wav")
        ? ".wav"
        : o.includes("ogg")
          ? ".ogg"
          : o.includes("m4a") || (o.includes("mp4") && o.includes("audio"))
            ? ".m4a"
            : o.includes("aac")
              ? ".aac"
              : o.includes("flac")
                ? ".flac"
                : ".mp3"
    : "video" === t || o.startsWith("video/")
      ? o.includes("mp4")
        ? ".mp4"
        : o.includes("quicktime") || o.includes("mov")
          ? ".mov"
          : o.includes("webm")
            ? ".webm"
            : ".mp4"
      : "image" === t || o.startsWith("image/")
        ? o.includes("png")
          ? ".png"
          : o.includes("jpeg") || o.includes("jpg")
            ? ".jpg"
            : o.includes("webp")
              ? ".webp"
              : o.includes("gif")
                ? ".gif"
                : o.includes("bmp")
                  ? ".bmp"
                  : ".jpg"
        : "";
}
const mi = (e) => {
    if (!e.isActive) return "";
    const parts = [];
    if ("custom" === e.direction && e.customPosition) {
      const { x: t, y: o, z: i } = e.customPosition,
        r = ((e, t, o) => {
          const parts = [],
            i = Math.abs(e),
            r = Math.abs(t),
            a = Math.abs(o);
          if (
            (o < -50
              ? (parts.push("(rim lighting:1.3)"),
                parts.push("(backlighting:1.3)"),
                parts.push("(silhouette lighting:1.2)"))
              : o > 50 &&
                (parts.push("(front lighting:1.2)"),
                parts.push("(flat lighting:1.1)")),
            t < -30)
          )
            if (i > 30) {
              const t = e > 0 ? "right" : "left";
              (parts.push(`(cinematic lighting from top ${t}:1.3)`),
                parts.push("(dramatic overhead lighting:1.2)"));
            } else
              (parts.push("(top lighting:1.2)"),
                parts.push("(overhead lighting:1.2)"));
          else
            t > 30 &&
              (parts.push("(uplighting:1.2)"),
              parts.push("(lighting from below:1.2)"),
              t > 50 && parts.push("(spooky lighting:1.1)"));
          if (i > 30 && r <= 30 && a <= 50) {
            const t = e > 0 ? "right" : "left";
            (parts.push(`(side lighting from ${t}:1.2)`),
              parts.push(`(${t} rim light:1.1)`));
          }
          if (i > 20 && r > 20 && a <= 50) {
            const o = e > 0 ? "right" : "left",
              i = t > 0 ? "bottom" : "top";
            parts.push(`(lighting from ${i} ${o}:1.2)`);
          }
          if (0 === parts.length) {
            const s = Math.max(i, r, a);
            if (s === i) {
              const t = e > 0 ? "right" : "left";
              parts.push(`(side lighting from ${t}:1.2)`);
            } else if (s === r) {
              const e = t > 0 ? "bottom" : "top";
              parts.push(`(${e} lighting:1.2)`);
            } else {
              const e = o > 0 ? "front" : "back";
              parts.push(`(${e} lighting:1.2)`);
            }
          }
          return parts;
        })(t, o, i);
      (parts.push(...r),
        console.log("[getLightingPrompt] 自由模式 3D 坐标:", {
          x: t,
          y: o,
          z: i,
        }),
        console.log("[getLightingPrompt] 生成的方向提示词:", r));
    } else {
      const t = {
        top: "(top lighting:1.2), (overhead lighting:1.2)",
        front: "(front lighting:1.2), (flat lighting:1.1)",
        left: "(side lighting from left:1.2), (left rim light:1.1)",
        right: "(side lighting from right:1.2), (right rim light:1.1)",
        back: "(rim lighting:1.3), (backlighting:1.3), (silhouette lighting:1.2)",
        bottom: "(uplighting:1.2), (lighting from below:1.2)",
      }[e.direction];
      parts.push(t);
    }
    "hard" === e.hardness
      ? (parts.push("(hard shadows:1.2)"),
        parts.push("(high contrast:1.1)"),
        parts.push("(sharp lighting:1.1)"))
      : (parts.push("(soft lighting:1.1)"),
        parts.push("(diffused light:1.1)"),
        parts.push("(volumetric fog:0.8)"));
    const t = e.brightness;
    if (t > 70) {
      const e = 1.1 + (t - 70) / 100;
      (parts.push(`(brightly lit:${e.toFixed(1)})`),
        parts.push("(high key:1.1)"));
    } else if (t < 30) {
      const e = 1.1 + (30 - t) / 100;
      (parts.push(`(dim lighting:${e.toFixed(1)})`),
        parts.push("(low key:1.2)"),
        parts.push("(moody lighting:1.1)"));
    }
    const o = e.color.toLowerCase();
    if ("#ffffff" !== o && "#000000" !== o && "#fff" !== o && "#000" !== o) {
      const t = ((e) => {
        const t = {
            "#ff0000": "red",
            "#00ff00": "green",
            "#0000ff": "blue",
            "#ffff00": "yellow",
            "#ff00ff": "magenta",
            "#00ffff": "cyan",
            "#ffa500": "orange",
            "#800080": "purple",
            "#ffc0cb": "pink",
          },
          o = e.toLowerCase();
        if (t[o]) return t[o];
        const i = parseInt(o.slice(1, 3), 16),
          r = parseInt(o.slice(3, 5), 16),
          a = parseInt(o.slice(5, 7), 16);
        return i > 200 && r < 100 && a < 100
          ? "red"
          : r > 200 && i < 100 && a < 100
            ? "green"
            : a > 200 && i < 100 && r < 100
              ? "blue"
              : i > 200 && r > 200 && a < 100
                ? "yellow"
                : i > 200 && a > 200 && r < 100
                  ? "magenta"
                  : r > 200 && a > 200 && i < 100
                    ? "cyan"
                    : i > 200 && r > 150 && a < 100
                      ? "orange"
                      : i > 150 && r < 100 && a > 150
                        ? "purple"
                        : null;
      })(e.color);
      t
        ? (parts.push(`(${t} lighting:1.2)`),
          parts.push(`(${t} color light:1.2)`),
          parts.push(`(${t} tint:1.1)`))
        : (parts.push("(colored lighting:1.2)"),
          parts.push(`(light color ${e.color}:1.1)`));
    }
    const i = parts.join(", ");
    return (console.log("[getLightingPrompt] 最终提示词:", i), i);
  },
  hi = ({
    apiConfigs: e,
    globalApiKey: t,
    connections: o,
    nodes: i,
    nodesMap: r,
    updateNode: a,
    setHistory: s,
    getConnectedInputImages: l,
    getConnectedImageForInput: c,
    generateId: d,
  }) => {
    const u = g.useCallback(
        async (o) => {
          var i, r, l, c, u, g, m, h, p;
          const mode =
              (null == (i = o.settings) ? void 0 : i.mode) || "inspiration",
            prompt = o.prompt || "",
            f = (null == (r = o.settings) ? void 0 : r.lyrics) || "",
            tags = (null == (l = o.settings) ? void 0 : l.tags) || "",
            title = (null == (c = o.settings) ? void 0 : c.title) || "",
            model = (null == (u = o.settings) ? void 0 : u.model) || "suno-v4",
            w =
              (null == (g = o.settings) ? void 0 : g.continueClipId) ||
              (null == (m = o.settings) ? void 0 : m.clipId) ||
              "",
            y = (null == (h = o.settings) ? void 0 : h.continueAt) || 0;
          if ("inspiration" === mode && !prompt.trim())
            return void alert("请输入音乐描述");
          if (("custom" === mode || "extend" === mode) && !f.trim())
            return void alert("请输入歌词");
          const v = e.find((e) => e.id === model || e.id.includes("suno")),
            apiKey = (null == v ? void 0 : v.key) || t,
            baseUrl = (
              (null == v ? void 0 : v.url) || "https://ai.comfly.chat"
            ).replace(/\/+$/, "");
          if (apiKey) {
            (a(o.id, {
              isGenerating: !0,
              errorMsg: void 0,
              settings: {
                ...o.settings,
                isGenerating: !0,
                progress: 0,
                error: null,
              },
            }),
              en.updateConfig(baseUrl, apiKey, e));
            try {
              const e = {
                  mode: mode,
                  prompt: "inspiration" === mode ? prompt : f,
                  tags: tags || "",
                  title: title || "",
                  mv: model.includes("v3.0")
                    ? "chirp-v3-0"
                    : model.includes("v3.5")
                      ? "chirp-v3-5"
                      : model.includes("v4.5")
                        ? "chirp-v4-5"
                        : model.includes("v5")
                          ? "chirp-v5"
                          : "chirp-v4",
                  continue_at: "extend" === mode ? y : 0,
                  continue_clip_id: "extend" === mode ? w : "",
                  ...("extend" === mode ? { task: "extend" } : {}),
                  make_instrumental:
                    (null == (p = o.settings) ? void 0 : p.isInstrumental) ||
                    !1,
                  model: model,
                },
                t = await en.generateMusic(e);
              if (!t.success)
                throw (
                  console.error("[Music Generation] API Error:", t.error),
                  new Error(t.error || "生成失败")
                );
              if (!t.data)
                throw (
                  console.error("[Music Generation] No data in response:", t),
                  new Error("API 响应中没有数据")
                );
              let taskId, i, r;
              if (
                (console.log("[Music Generation] Response data:", t.data),
                t.data.task_id)
              )
                ((taskId = t.data.task_id),
                  console.log("[Music Generation] Got task_id:", taskId));
              else {
                if (
                  !(
                    t.data.clip_ids &&
                    Array.isArray(t.data.clip_ids) &&
                    t.data.clip_ids.length > 0
                  )
                )
                  throw (
                    console.error(
                      "[Music Generation] Invalid response format:",
                      t.data,
                    ),
                    new Error(
                      `无法获取任务 ID 或 clip IDs。响应数据: ${JSON.stringify(t.data)}`,
                    )
                  );
                ((i = t.data.clip_ids),
                  (r = t.data.clips),
                  console.log(
                    "[Music Generation] Got clip_ids:",
                    i,
                    "with clips data:",
                    !!r,
                  ));
              }
              const l = {
                id: d(),
                type: "audio",
                url: "",
                prompt: "inspiration" === mode ? prompt : f,
                time: qt(),
                status: "generating",
                progress: 0,
                modelName: model,
                sourceNodeId: o.id,
                remoteTaskId:
                  taskId || (null == i ? void 0 : i.join(",")) || "",
              };
              s((e) => [l, ...e]);
              const c = async (e = 0) => {
                var t, r, u, g, m, h, p, w;
                const y = (e) => (e < 30 ? 1e3 : e < 60 ? 2e3 : 3e3);
                if (e >= 120)
                  return (
                    a(o.id, { isGenerating: !1, errorMsg: "生成超时" }),
                    void s((e) =>
                      e.map((e) =>
                        e.id === l.id
                          ? { ...e, status: "failed", errorMsg: "生成超时" }
                          : e,
                      ),
                    )
                  );
                try {
                  e > 0 && (await new Promise((t) => setTimeout(t, y(e - 1))));
                  const v =
                    (null == (t = o.settings) ? void 0 : t.clipIds) || i;
                  if (v && v.length > 0) {
                    const t = await en.getMusicByClipIds(v, model);
                    if (t.success && t.data) {
                      const i = t.data;
                      let m = [];
                      if (
                        (Array.isArray(i)
                          ? (m = i)
                          : i.data && Array.isArray(i.data) && (m = i.data),
                        m.length > 0)
                      ) {
                        const t =
                          null == (r = o.settings) ? void 0 : r.splitTaskId;
                        if (
                          t ||
                          m.some((e) => {
                            var t, o, i, r, a, s;
                            return (
                              "stem" ===
                                (null == (t = e.metadata) ? void 0 : t.type) ||
                              (null == (o = e.metadata)
                                ? void 0
                                : o.stem_from_id) ||
                              (null == (i = e.title)
                                ? void 0
                                : i.includes("Vocals")) ||
                              (null == (r = e.title)
                                ? void 0
                                : r.includes("Instrumental")) ||
                              (null == (a = e.title)
                                ? void 0
                                : a.includes("人声")) ||
                              (null == (s = e.title)
                                ? void 0
                                : s.includes("伴奏"))
                            );
                          })
                        ) {
                          const t = m.find((e) => {
                              var t, o, i;
                              return (
                                (null == (t = e.title)
                                  ? void 0
                                  : t.includes("Vocals")) ||
                                (null == (o = e.title)
                                  ? void 0
                                  : o.includes("人声")) ||
                                (null == (i = e.title)
                                  ? void 0
                                  : i.toLowerCase().includes("vocal"))
                              );
                            }),
                            i = m.find((e) => {
                              var t, o, i;
                              return (
                                (null == (t = e.title)
                                  ? void 0
                                  : t.includes("Instrumental")) ||
                                (null == (o = e.title)
                                  ? void 0
                                  : o.includes("伴奏")) ||
                                (null == (i = e.title)
                                  ? void 0
                                  : i.toLowerCase().includes("instrumental"))
                              );
                            }),
                            r = t || m[0],
                            d = i || m[1] || m[0],
                            u =
                              "complete" === (null == r ? void 0 : r.status) &&
                              ((null == r ? void 0 : r.audio_url) ||
                                (null == r ? void 0 : r.video_url)),
                            g =
                              "complete" === (null == d ? void 0 : d.status) &&
                              ((null == d ? void 0 : d.audio_url) ||
                                (null == d ? void 0 : d.video_url));
                          if (u && g) {
                            const e = r.audio_url || r.video_url || "",
                              t = d.audio_url || d.video_url || "";
                            return (
                              console.log("[useGeneration] 声曲分离完成:", {
                                vocalsUrl: e,
                                instrumentalUrl: t,
                                vocalsTitle: r.title,
                                instrumentalTitle: d.title,
                              }),
                              a(o.id, {
                                isGenerating: !1,
                                settings: {
                                  ...o.settings,
                                  stemVocalsUrl: e,
                                  stemInstrumentalUrl: t,
                                  stemVocalsTitle: r.title || "人声",
                                  stemInstrumentalTitle: d.title || "伴奏",
                                  splitTaskId: void 0,
                                },
                              }),
                              void s((e) =>
                                e.map((e) => {
                                  if (e.id === l.id) {
                                    const t = e.startTime
                                      ? Date.now() - e.startTime
                                      : void 0;
                                    return {
                                      ...e,
                                      status: "completed",
                                      progress: 100,
                                      durationMs: t,
                                    };
                                  }
                                  return e;
                                }),
                              )
                            );
                          }
                          return (
                            console.log("[useGeneration] 声曲分离进行中:", {
                              vocalsStatus: null == r ? void 0 : r.status,
                              instrumentalStatus: null == d ? void 0 : d.status,
                              vocalsComplete: u,
                              instrumentalComplete: g,
                            }),
                            void setTimeout(() => c(e + 1), y(e))
                          );
                        }
                        const i = m.filter(
                          (e) =>
                            (e.audio_url || e.audioUrl) &&
                            "complete" === e.status,
                        );
                        if (i.length > 0) {
                          const e = i[0],
                            t = e.id || e.clip_id || e.clipId,
                            r = e.audio_url || e.audioUrl,
                            c = e.title || title,
                            m =
                              e.duration ||
                              (null == (u = e.metadata) ? void 0 : u.duration),
                            h =
                              (null == (g = e.metadata) ? void 0 : g.prompt) ||
                              e.lyrics ||
                              f;
                          return (
                            a(o.id, {
                              isGenerating: !1,
                              content: r,
                              settings: {
                                ...o.settings,
                                clipId: t,
                                audioUrl: r,
                                generatedLyrics: h,
                                musicTitle: c,
                                duration: m,
                              },
                            }),
                            void i.forEach((e, t) => {
                              var i, r;
                              const a = e.id || e.clip_id || e.clipId,
                                c = e.audio_url || e.audioUrl,
                                u = e.title || title,
                                g =
                                  e.duration ||
                                  (null == (i = e.metadata)
                                    ? void 0
                                    : i.duration),
                                m =
                                  (null == (r = e.metadata)
                                    ? void 0
                                    : r.prompt) ||
                                  e.lyrics ||
                                  f,
                                h = a || `${taskId}_${t}`;
                              if (c) {
                                to(c, h).catch((e) => {
                                  console.error(
                                    `[Music] 下载音频${t + 1}失败:`,
                                    e,
                                  );
                                });
                              }
                              const p = {
                                id: 0 === t ? l.id : d(),
                                type: "audio",
                                url: c,
                                prompt: "inspiration" === mode ? prompt : f,
                                time: qt(),
                                status: "completed",
                                progress: 100,
                                modelName: model,
                                sourceNodeId: o.id,
                                audioUrl: c,
                                duration: g,
                                lyrics: m,
                                musicTitle: u,
                                clipId: a,
                                _assetId: h,
                              };
                              s(
                                0 === t
                                  ? (e) => e.map((e) => (e.id === l.id ? p : e))
                                  : (e) => [p, ...e],
                              );
                            })
                          );
                        }
                      }
                    }
                    return void setTimeout(() => c(e + 1), y(e));
                  }
                  if (!taskId) return void setTimeout(() => c(e + 1), y(e));
                  const b = null == (m = o.settings) ? void 0 : m.splitTaskId,
                    _ = b && b === taskId;
                  let I, S, j, A, P, x;
                  if (
                    ((I = _
                      ? await en.getBackendTaskStatus(taskId, model)
                      : await en.getMusicTaskStatus(taskId, model)),
                    !I.success || !I.data)
                  )
                    return void setTimeout(() => c(e + 1), y(e));
                  if (_) {
                    ((S = I.data),
                      S.data && Array.isArray(S.data)
                        ? ((j = S), (x = S.data))
                        : ((j = S), (x = S.data || [])),
                      (A = (j.status || "").toUpperCase()));
                    const e = j.progress || "0";
                    P =
                      "string" == typeof e
                        ? parseInt(e.replace("%", ""), 10)
                        : e;
                  } else
                    ((S = I.data),
                      (j = S.data),
                      (A = (j.status || "").toLowerCase()),
                      (P = parseInt((j.progress || "0").replace("%", ""), 10)),
                      (x = j.data || []));
                  (s((e) =>
                    e.map((e) => (e.id === l.id ? { ...e, progress: P } : e)),
                  ),
                    a(o.id, {
                      settings: { ...o.settings, generationProgress: P },
                    }));
                  if (
                    (_
                      ? "SUCCESS" === A || "COMPLETED" === A
                      : "complete" === A) &&
                    x &&
                    Array.isArray(x) &&
                    x.length > 0
                  ) {
                    const e = x.filter((e) => {
                      if (_)
                        return (
                          e.audio_url &&
                          ("complete" === e.status || "succeeded" === e.state)
                        );
                      {
                        const t = (e.status || "").toLowerCase(),
                          o = e.audio_url || e.audioUrl || e.video_url;
                        return "complete" === t && o;
                      }
                    });
                    if (e.length > 0) {
                      const t =
                          null == (h = o.settings) ? void 0 : h.splitTaskId,
                        i =
                          t ||
                          e.some((e) => {
                            var t, o, i, r, a, s;
                            return (
                              "stem" ===
                                (null == (t = e.metadata) ? void 0 : t.type) ||
                              (null == (o = e.metadata)
                                ? void 0
                                : o.stem_from_id) ||
                              (null == (i = e.title)
                                ? void 0
                                : i.includes("Vocals")) ||
                              (null == (r = e.title)
                                ? void 0
                                : r.includes("Instrumental")) ||
                              (null == (a = e.title)
                                ? void 0
                                : a.includes("人声")) ||
                              (null == (s = e.title)
                                ? void 0
                                : s.includes("伴奏"))
                            );
                          }) ||
                          (2 === e.length && t);
                      if (
                        (console.log("[useGeneration] 检查声曲分离结果:", {
                          splitTaskId: t,
                          songsCount: e.length,
                          isStemResult: i,
                          songs: e.map((e) => ({
                            title: e.title,
                            metadata: e.metadata,
                          })),
                        }),
                        i)
                      ) {
                        const t = e.find((e) => {
                            var t, o, i, r;
                            return (
                              "Vocals" ===
                                (null == (t = e.metadata)
                                  ? void 0
                                  : t.stem_type_group_name) ||
                              (null == (o = e.title)
                                ? void 0
                                : o.includes("Vocals")) ||
                              (null == (i = e.title)
                                ? void 0
                                : i.includes("人声")) ||
                              (null == (r = e.title)
                                ? void 0
                                : r.toLowerCase().includes("vocal"))
                            );
                          }),
                          i = e.find((e) => {
                            var t, o, i, r;
                            return (
                              "Instrumental" ===
                                (null == (t = e.metadata)
                                  ? void 0
                                  : t.stem_type_group_name) ||
                              (null == (o = e.title)
                                ? void 0
                                : o.includes("Instrumental")) ||
                              (null == (i = e.title)
                                ? void 0
                                : i.includes("伴奏")) ||
                              (null == (r = e.title)
                                ? void 0
                                : r.toLowerCase().includes("instrumental"))
                            );
                          });
                        let r = t,
                          c = i;
                        if (!r || !c)
                          if (1 === e.length) {
                            const t = e[0],
                              o = t.metadata;
                            "vocals" === (null == o ? void 0 : o.stem_type) ||
                            "vocal" === (null == o ? void 0 : o.stem_type)
                              ? (r = t)
                              : "instrumental" ===
                                  (null == o ? void 0 : o.stem_type)
                                ? (c = t)
                                : (r = t);
                          } else ((r = r || e[0]), (c = c || e[1] || e[0]));
                        (r && c) ||
                          (console.error(
                            "[useGeneration] 无法确定人声和伴奏，使用默认分配",
                          ),
                          (r = r || e[0]),
                          (c = c || e[1] || e[0]));
                        const d =
                            (null == r ? void 0 : r.audio_url) ||
                            (null == r ? void 0 : r.video_url) ||
                            "",
                          u =
                            (null == c ? void 0 : c.audio_url) ||
                            (null == c ? void 0 : c.video_url) ||
                            "";
                        (console.log("[useGeneration] 声曲分离结果:", {
                          vocalsUrl: d,
                          instrumentalUrl: u,
                          vocalsTitle: null == r ? void 0 : r.title,
                          instrumentalTitle: null == c ? void 0 : c.title,
                          songsCount: e.length,
                        }),
                          a(o.id, {
                            isGenerating: !1,
                            settings: {
                              ...o.settings,
                              stemVocalsUrl: d,
                              stemInstrumentalUrl: u,
                              stemVocalsTitle:
                                (null == r ? void 0 : r.title) || "人声",
                              stemInstrumentalTitle:
                                (null == c ? void 0 : c.title) || "伴奏",
                              splitTaskId: void 0,
                            },
                          }),
                          s((e) =>
                            e.map((e) => {
                              if (e.id === l.id) {
                                const t = e.startTime
                                  ? Date.now() - e.startTime
                                  : void 0;
                                return {
                                  ...e,
                                  status: "completed",
                                  progress: 100,
                                  durationMs: t,
                                };
                              }
                              return e;
                            }),
                          ));
                      } else {
                        const t = e[0],
                          i = t.id || t.clip_id || t.clipId,
                          r = t.audio_url || t.audioUrl || t.video_url,
                          s = t.title || title,
                          l =
                            t.duration ||
                            (null == (p = t.metadata) ? void 0 : p.duration),
                          c =
                            (null == (w = t.metadata) ? void 0 : w.prompt) ||
                            t.lyrics ||
                            f;
                        a(o.id, {
                          isGenerating: !1,
                          content: r,
                          settings: {
                            ...o.settings,
                            clipId: i,
                            audioUrl: r,
                            generatedLyrics: c,
                            musicTitle: s,
                            duration: l,
                          },
                        });
                      }
                      return void e.forEach((e, t) => {
                        var i, r;
                        const a = e.id || e.clip_id || e.clipId,
                          c = e.audio_url || e.audioUrl,
                          u = e.title || title,
                          g =
                            e.duration ||
                            (null == (i = e.metadata) ? void 0 : i.duration),
                          m =
                            (null == (r = e.metadata) ? void 0 : r.prompt) ||
                            e.lyrics ||
                            f,
                          h = a || `${taskId}_${t}`;
                        c &&
                          to(c, h).catch((e) => {
                            console.error(`[Music] 下载音频${t + 1}失败:`, e);
                          });
                        const p = {
                          id: 0 === t ? l.id : d(),
                          type: "audio",
                          url: c,
                          prompt: "inspiration" === mode ? prompt : f,
                          time: qt(),
                          status: "completed",
                          progress: 100,
                          modelName: model,
                          sourceNodeId: o.id,
                          audioUrl: c,
                          duration: g,
                          lyrics: m,
                          musicTitle: u,
                          _assetId: h,
                        };
                        s(
                          0 === t
                            ? (e) => e.map((e) => (e.id === l.id ? p : e))
                            : (e) => [p, ...e],
                        );
                      });
                    }
                  }
                  if ("error" === A || "failed" === A) {
                    const e = j.fail_reason || S.message || "生成失败";
                    return (
                      a(o.id, { isGenerating: !1, errorMsg: e }),
                      void s((t) =>
                        t.map((t) =>
                          t.id === l.id
                            ? { ...t, status: "failed", errorMsg: e }
                            : t,
                        ),
                      )
                    );
                  }
                  setTimeout(() => c(e + 1), y(e));
                } catch (error) {
                  (console.error("[Music Generation] Poll error:", error),
                    setTimeout(() => c(e + 1), y(e)));
                }
              };
              c();
            } catch (error) {
              (console.error("[Music Generation] Error:", error),
                a(o.id, {
                  isGenerating: !1,
                  errorMsg: error.message || "生成失败",
                }));
            }
          } else alert("请先配置 API Key");
        },
        [e, t, a, s, d],
      ),
      m = g.useCallback(
        async (g) => {
          var m, h, p, f, w, y, v, b, _, I, S, j, A, P, k, T, $, M, C, U, O, E;
          if (
            (console.log("[useGeneration] generate 函数被调用", {
              nodeId: g.id,
              nodeType: g.type,
              nodeX: g.x,
              nodeY: g.y,
              prompt: null == (m = g.prompt) ? void 0 : m.substring(0, 50),
              timestamp: new Date().toISOString(),
            }),
            console.log(
              "[useGeneration] 使用传入的 node 数据，settings:",
              g.settings,
            ),
            console.log("[useGeneration] 当前状态:", {
              totalNodes: i.length,
              totalConnections: o.length,
              connectionsFromThisNode: o.filter((e) => e.from === g.id).length,
            }),
            "gen-music" === g.type)
          )
            return (console.log("[useGeneration] 调用 generateMusic"), u(g));
          let L = g.prompt || "";
          const R = o.filter(
              (e) =>
                e.to === g.id && (!e.inputType || "default" === e.inputType),
            ),
            N = [],
            D = [];
          for (const e of R) {
            const t = r.get(e.from);
            if (t)
              if ("custom-agent" === t.type) {
                const e =
                  (null == (h = t.settings) ? void 0 : h.outputContent) || "";
                e.trim() &&
                  (N.push(e.trim()),
                  console.log("[useGeneration] 检测到上游 Agent 节点输出:", {
                    nodeId: t.id,
                    contentLength: e.length,
                  }));
              } else if ("text-node" === t.type || "novel-input" === t.type) {
                const e = (
                  (null == (p = t.settings) ? void 0 : p.text) ||
                  t.prompt ||
                  t.content ||
                  ""
                ).trim();
                e && D.push(e);
              } else if ("storyboard-node" === t.type) {
                const e =
                  (null == (f = t.settings) ? void 0 : f.jsonData) || "";
                e.trim() && D.push(e.trim());
              }
          }
          const F = [
            "gen-video",
            "gen-image",
            "generate-character-video",
            "generate-scene-video",
          ].includes(g.type);
          if (F && !L.trim()) {
            const e = [...D, ...N].filter(Boolean).join("\n\n").trim();
            e
              ? ((L = e),
                console.log(
                  "[useGeneration] 打组执行：node.prompt 为空，使用上游合并提示词，长度:",
                  L.length,
                ))
              : ((L = "视频生成"),
                console.log(
                  "[useGeneration] 打组执行：无上游内容，使用默认提示词避免 API 400",
                ));
          }
          const W = o.find(
              (e) =>
                e.to === g.id && (!e.inputType || "default" === e.inputType),
            ),
            z = W ? r.get(W.from) : null;
          let B = null;
          if (z && "storyboard-node" === z.type) {
            const e = null == (w = z.settings) ? void 0 : w.jsonData;
            if (e)
              try {
                B = JSON.parse(e);
              } catch (error) {
                console.error("[useGeneration] 解析分镜JSON数据失败:", error);
              }
          }
          const G = o.filter(
              (e) =>
                e.to === g.id && (!e.inputType || "default" === e.inputType),
            ),
            J = [],
            V = [];
          let K = "",
            H = null,
            Z = !1;
          G.forEach((e) => {
            var t, o, i, a;
            const s = r.get(e.from);
            if (s)
              if ("camera-movement" === s.type) {
                const e = null == (t = s.settings) ? void 0 : t.movementConfig;
                e && Wo(e);
              } else if ("professional-camera" === s.type) {
                const e = null == (o = s.settings) ? void 0 : o.cinemaConfig;
                if (e) {
                  const t = Co(e);
                  t && J.push(t);
                }
              } else if ("input-image" === s.type) {
                const e = null == (i = s.settings) ? void 0 : i.multiAngle;
                if (e && e.isActive) {
                  Z = !0;
                  const t = e.sceneMode || "character";
                  let o;
                  ("architecture" === t
                    ? ((o = ((e) => {
                        const t = sn;
                        if (!e || !e.isActive)
                          return {
                            augmentedPrompt: "",
                            angleMetadata: null,
                            needsControlNetReduction: !1,
                          };
                        const { rotation: o, tilt: i, scale: r } = e,
                          a = [],
                          s = (360 - (((o % 360) + 360) % 360)) % 360,
                          l = Math.abs(o) > 15 || Math.abs(o - 360) > 15;
                        return (
                          s >= 30 && s <= 150
                            ? a[t(0)](
                                "(Two-point perspective:1.4), dramatically shifting the vanishing point to the far diagonal corner, re-modeling the interior structure from a corner view, architectural wide-angle lens",
                              )
                            : s > 150 && s < 210
                              ? a.push(
                                  "(Complete 180-degree spatial flip:1.4), rotating the architectural perspective to reveal the opposite wall, dramatic rear view reconstruction",
                                )
                              : s >= 210 && s <= 330
                                ? a.push(t(1))
                                : s > 15 && s < 30
                                  ? a.push(
                                      "(Slightly angled perspective:1.2), subtle shift in vanishing point, revealing more depth",
                                    )
                                  : s > 330 && s < 345
                                    ? a.push(
                                        "(Slightly angled perspective:1.2), subtle shift in vanishing point from opposite side, revealing more depth",
                                      )
                                    : a[t(0)](t(2)),
                          i > 20
                            ? a.push(
                                "(Aerial architectural drone view:1.4), looking down at the spatial layout and furniture arrangement, high-angle interior visualization",
                              )
                            : i < -20
                              ? a[t(0)](
                                  "(Dramatic low-angle architectural shot:1.3), looking up at the ceiling and vertical lines to emphasize height, heroic structural perspective",
                                )
                              : i > 5
                                ? a[t(0)](t(3))
                                : i < -5 &&
                                  a[t(0)](
                                    "slightly lowered camera position, gentle upward angle emphasizing ceiling height",
                                  ),
                          r > 1.3
                            ? a.push(
                                "(Architectural detail close-up:1.2), zooming in on textures and material finishes",
                              )
                            : r < 0.7
                              ? a.push(t(4))
                              : r > 1.1
                                ? a.push(
                                    "medium architectural framing, focusing on key spatial elements",
                                  )
                                : r < 0.9 && a.push(t(5)),
                          {
                            augmentedPrompt:
                              "(Complete spatial reconstruction:1.3), " +
                              a[t(6)](", ") +
                              ", maintaining the aesthetic and materials of the reference image, professional architectural photography, 8k resolution",
                            angleMetadata: { rotation: o, tilt: i, scale: r },
                            needsControlNetReduction: l,
                          }
                        );
                      })(e)),
                      console.log("[Generation] 🏗️ 使用建筑模式提示词"),
                      console.log(
                        "[Generation] ControlNet 降权:",
                        o.needsControlNetReduction ? "是（0.35-0.45）" : "否",
                      ))
                    : ((o = bn(e)),
                      console.log("[Generation] 👤 使用人物模式提示词")),
                    (K = o.augmentedPrompt),
                    (H = o.angleMetadata
                      ? {
                          ...o.angleMetadata,
                          sceneMode: e.sceneMode,
                          needsControlNetReduction:
                            o.needsControlNetReduction || !1,
                        }
                      : null),
                    console.log("[Generation] 角度提示词已启用:", {
                      sceneMode: t,
                      angleAugmentedPrompt: K,
                      angleMetadata: H,
                      sourceNodeId: s.id,
                      multiAngle: e,
                    }));
                } else
                  e &&
                    !e.isActive &&
                    console.log("[Generation] 角度配置存在但未启用:", {
                      sourceNodeId: s.id,
                      multiAngle: e,
                    });
                const t = null == (a = s.settings) ? void 0 : a.lighting;
                if (t && t.isActive) {
                  const e = mi(t);
                  e &&
                    (V.push(e),
                    console.log("[Generation] 💡 重打光提示词已添加:", {
                      lightingPrompt: e,
                      sourceNodeId: s.id,
                      lighting: t,
                    }));
                }
              }
          });
          const Q = null == (y = g.settings) ? void 0 : y.cinemaConfig,
            X = Q ? Co(Q) : "";
          X && J.push(X);
          const Y = Bo(L);
          let ee = "";
          if (Z) {
            const e = "视频生成" === Y.trim() ? "" : Y.trim();
            ((ee = e ? (K ? `${K}, ${e}` : e) : K || ""),
              console.log(
                "[useGeneration] 📸 导演相机模式已启动，最终提示词:",
                ee,
              ));
          } else ee = Y;
          if (N.length > 0 && !F) {
            const e = N.join("\n\n");
            ((ee = ee.trim() ? `${ee}\n\n${e}` : e),
              console.log(
                "[useGeneration] 🤖 已添加 Agent 输出到提示词，总长度:",
                ee.length,
              ));
          }
          const te = [],
            oe = [],
            ne = [];
          for (const e of G) {
            const t = r.get(e.from);
            if (t && "input-image" === t.type) {
              if (t.markers && t.markers.length > 0) {
                const e = t.markers.filter(
                  (e) => e.label && e.label.trim() && !e.isAnalyzing,
                );
                if (e.length > 0)
                  try {
                    const { generateMarkerMask: o, buildMarkerPrompt: i } =
                      await x(
                        async () => {
                          const {
                            generateMarkerMask: e,
                            buildMarkerPrompt: t,
                          } = await import("./markerMask-TdRVtYG7.js");
                          return {
                            generateMarkerMask: e,
                            buildMarkerPrompt: t,
                          };
                        },
                        [],
                        import.meta.url,
                      );
                    let r = 1024,
                      a = 1024;
                    if (t.content)
                      try {
                        const e = new Image();
                        await new Promise((o, i) => {
                          ((e.onload = () => {
                            ((r = e.naturalWidth || e.width),
                              (a = e.naturalHeight || e.height),
                              console.log("[Generation] 获取到实际图片尺寸:", {
                                width: r,
                                height: a,
                              }),
                              o());
                          }),
                            (e.onerror = () => {
                              (console.warn(
                                "[Generation] 无法加载图片，使用默认尺寸",
                              ),
                                o());
                            }),
                            (e.src = t.content || ""));
                        });
                      } catch (Se) {
                        console.warn(
                          "[Generation] 获取图片尺寸失败，使用默认尺寸:",
                          Se,
                        );
                      }
                    const s = e.map((e) => ({
                        ...e,
                        x: e.x / 100,
                        y: e.y / 100,
                      })),
                      l = o(r, a, s);
                    oe.push({
                      nodeId: t.id,
                      mask: l,
                      width: r,
                      height: a,
                      markerCount: e.length,
                    });
                    const c = i(e, r, a);
                    (te.push(c),
                      console.log("[Generation] 已生成标记蒙版:", {
                        nodeId: t.id,
                        markerCount: e.length,
                        imageSize: `${r}×${a}`,
                        maskSize: l.length,
                      }));
                  } catch (error) {
                    console.error("[Generation] 生成标记蒙版失败:", error);
                    const t = 1024,
                      o = 1024,
                      i = e
                        .map(
                          (e, i) =>
                            `${i + 1}. [位置: (${Math.round((e.x / 100) * t)}, ${Math.round((e.y / 100) * o)})像素 / (${Math.round(e.x)}%, ${Math.round(e.y)}%)从左上角] ${e.label}`,
                        )
                        .join("\n");
                    te.push(i);
                  }
              }
              if (null == (v = t.settings) ? void 0 : v.textEditData)
                try {
                  const e = JSON.parse(t.settings.textEditData);
                  if (e.modifications && Array.isArray(e.modifications)) {
                    const t = e.modifications
                      .map(
                        (e, t) =>
                          `${t + 1}. 将"${e.originalText}"修改为"${e.newText}"`,
                      )
                      .join("\n");
                    (ne.push(t),
                      console.log("[Generation] 检测到文字编辑数据:", t));
                  }
                } catch (Se) {
                  console.error("[Generation] 解析文字编辑数据失败:", Se);
                }
            }
          }
          const ie = te.length > 0,
            re = ne.length > 0,
            se = V.length > 0,
            le = N.length > 0;
          if (!(ee.trim() || Z || ie || re || se || le))
            return (
              console.warn(
                "[useGeneration] 提示词为空、角度未启用、且没有标记说明、文字编辑、灯光设置或 Agent 输出",
              ),
              void alert(
                "请输入提示词、启用角度调整功能、添加图片标记说明、使用文字编辑、设置灯光或连接 Agent 节点",
              )
            );
          if (!ee.trim() && Z && !ie && !re && !se)
            return (
              console.error(
                "[useGeneration] 角度已启用但提示词仍为空，这是一个异常情况",
              ),
              console.error("[useGeneration] angleAugmentedPrompt:", K),
              console.error("[useGeneration] angleMetadata:", H),
              void alert("角度配置异常，请检查角度设置或输入提示词")
            );
          const ce =
              J.length > 0 || ee !== L
                ? ", highly cinematic, professional cinematography"
                : "",
            ue = [];
          (ee.trim() && ue.push(ee),
            J.length > 0 && ue.push(J.join(", ")),
            V.length > 0 && ue.push(V.join(", ")));
          let prompt = ue.join(", ");
          if ("gen-image" === g.type || "gen-video" === g.type) {
            const e = (l(g.id) || []).length;
            e > 0 &&
              prompt &&
              (prompt = prompt.replace(/@(\d+)/g, (t, o) => {
                const i = parseInt(o, 10);
                return !i || i > e ? t : `图片${i}`;
              }));
          }
          if ((ce && (prompt = `${prompt}${ce}`), ie)) {
            const e = te.join("\n\n");
            ((prompt = `${prompt}\n\n${e}`),
              console.log(
                "[Generation] 已添加图片标记说明到提示词（含蒙版）:",
                e,
              ));
          }
          if (re) {
            const e = ne.join("\n\n");
            ((prompt = `${prompt}\n\n文字编辑要求：\n${e}`),
              console.log("[Generation] 已添加文字编辑数据到提示词:", e));
          }
          const ge =
              (null == (b = g.settings) ? void 0 : b.model) ||
              ("gen-image" === g.type ? "nano-banana" : "sora-2"),
            pe = ge.includes("mj") || ge.toLowerCase().includes("midjourney"),
            we = ge.includes("jimeng"),
            ye =
              ge.includes("nano-banana-2") ||
              ge.includes("gemini-3.1-flash-image-preview"),
            ve =
              "gen-video" === g.type ||
              "generate-character-video" === g.type ||
              "generate-scene-video" === g.type,
            be = e.find((e) => e.id === ge),
            apiKey = (null == be ? void 0 : be.key) || t;
          if (!apiKey) return void alert("请先配置API Key");
          let taskId;
          a(g.id, { isGenerating: !0, errorMsg: void 0 });
          let _e = "",
            Ie = null;
          try {
            const e = (null == (_ = g.settings) ? void 0 : _.ratio) || "Auto",
              t = (null == (I = g.settings) ? void 0 : I.resolution) || "Auto";
            let baseUrl = (
              (null == be ? void 0 : be.url) || "https://ai.comfly.chat"
            )
              .replace(/\/+$/, "")
              .trim();
            ((baseUrl && /^https?:\/\//i.test(baseUrl)) ||
              (baseUrl = "https://ai.comfly.chat"),
              (taskId = d()));
            let r = l(g.id);
            r = r.filter((url) => {
              if (!url) return !1;
              const e = url.trim();
              return (
                !(!e || 0 === e.length) && "undefined" !== e && "null" !== e
              );
            });
            const u = r.length > 0;
            if (
              (console.log("[Generation] 获取参考图片:", {
                refImagesCount: r.length,
                refImages: r.map((url) => url.substring(0, 50)),
              }),
              u)
            )
              try {
                const { contentStore: e } = await x(
                  async () => {
                    const { contentStore: e } = await Promise.resolve().then(
                      () => Gt,
                    );
                    return { contentStore: e };
                  },
                  void 0,
                  import.meta.url,
                );
                (await e.init(),
                  (r = await Promise.all(
                    r.map(async (url, t) => {
                      if (url.startsWith("content_ref:")) {
                        const t = e.extractId(url),
                          o = await e.get(t);
                        return (
                          o ||
                          (console.warn(
                            `[Generation] ⚠️ Content not found in store: ${t}`,
                          ),
                          url)
                        );
                      }
                      return url;
                    }),
                  )));
              } catch (error) {
                console.error(
                  "[Generation] ❌ Failed to resolve content_ref:",
                  error,
                );
              }
            const m = {
              id: taskId,
              url: "",
              type: ve ? "video" : "image",
              prompt:
                prompt || (u ? "Img2" + (ve ? "Vid" : "Img") : "Untitled"),
              time: new Date().toLocaleTimeString(),
              status: "generating",
              progress: 0,
              modelName: (null == be ? void 0 : be.provider) || ge,
              sourceNodeId: g.id,
              targetPreviewId:
                null == (S = g.settings) ? void 0 : S._autoCreatedPreviewId,
              startTime: Date.now(),
              apiConfig: { modelId: ge, baseUrl: baseUrl, apiKey: apiKey },
            };
            s((e) => [m, ...e]);
            const h = (null == (j = g.settings) ? void 0 : j.batchSize) || 1;
            if (!ve && h > 1) {
              const l = new Array(h).fill(""),
                m = Array.from({ length: h }, (e, t) =>
                  0 === t
                    ? (taskId ?? `batch-${Date.now()}-0`)
                    : (d() ?? `batch-${Date.now()}-${t}`),
                ),
                p = new Set();
              m.forEach((e, t) => {
                let o = e;
                if (
                  (p.has(o) &&
                    ((o = d() ?? `batch-${Date.now()}-${t}`), (m[t] = o)),
                  p.add(o),
                  0 === t)
                )
                  return;
                const i = {
                  id: o,
                  url: "",
                  type: "image",
                  prompt: `${prompt || "Untitled"} (${t + 1}/${h})`,
                  time: new Date().toLocaleTimeString(),
                  status: "generating",
                  progress: 0,
                  modelName:
                    (null == be ? void 0 : be.provider) || ge || "unknown",
                  sourceNodeId: g.id,
                  apiConfig: { modelId: ge, baseUrl: baseUrl, apiKey: apiKey },
                };
                s((e) =>
                  e.some((e) => e.id === o)
                    ? (console.warn(
                        `[Generation] History item with ID ${o} already exists, skipping`,
                      ),
                      e)
                    : [i, ...e],
                );
              });
              const f = await pi({
                node: g,
                currentModel: ge,
                config: be,
                baseUrl: baseUrl,
                prompt: prompt,
                ratio: e,
                resolution: t,
                refImages: r,
                hasReferenceImage: u,
                isVideoGeneration: ve,
                isMidjourney: pe,
                isJimeng: we,
                isNanoBanana2: ye,
                taskId: taskId,
                apiKey: apiKey,
                getConnectedImageForInput: c,
                setHistory: s,
                updateNode: a,
                angleMetadata: H,
                storyboardJsonData: B,
                nodes: i,
                connections: o,
                markerMasks: oe,
              });
              if (!f) return;
              const { endpoint: w, payload: y, useMultipart: v } = f,
                b = v
                  ? { Authorization: `Bearer ${apiKey}` }
                  : {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${apiKey}`,
                    },
                _ = ge.includes("z-image") ? 4e3 : 50;
              console.log(`[Batch] 批量生成模型: ${ge}, 请求间隔: ${_}ms`);
              const I = m.map(async (e, t) => {
                  if (t > 0) {
                    const e = t * _;
                    (console.log(`[Batch] 请求 ${t + 1} 延迟 ${e}ms`),
                      await new Promise((t) => setTimeout(t, e)));
                  }
                  try {
                    let o;
                    if (v && y instanceof FormData) {
                      o = new FormData();
                      for (const [key, value] of y.entries())
                        "n" === key ? o.append("n", "1") : o.append(key, value);
                    } else o = { ...y, n: 1 };
                    const i = await an(w, {
                      method: "POST",
                      headers: b,
                      body: v ? o : JSON.stringify(o),
                    });
                    if (!i.ok) throw new Error(`请求${t + 1}失败: ${i.status}`);
                    return {
                      taskId: e,
                      result: await i.json(),
                      error: null,
                      index: t,
                    };
                  } catch (error) {
                    return (
                      console.error(
                        `[Generation] 批量请求 ${t + 1} 失败:`,
                        error,
                      ),
                      { taskId: e, result: null, error: error, index: t }
                    );
                  }
                }),
                S = await Promise.all(I),
                j = (() => {
                  var e, t;
                  const r = fi(g.id, o, i);
                  if (0 === r.length)
                    return void console.warn(
                      "[Batch] 节点没有连接的预览窗口:",
                      g.id,
                    );
                  const a =
                      null == (e = g.settings) ? void 0 : e.selectedPreviewId,
                    s =
                      null == (t = g.settings)
                        ? void 0
                        : t._autoCreatedPreviewId,
                    l = a && r.includes(a) ? a : s && r.includes(s) ? s : r[0];
                  return (
                    console.log(
                      "[Batch] 节点",
                      g.id,
                      "使用预览窗口:",
                      l,
                      "(selectedPreviewId:",
                      a,
                      ", 共",
                      r.length,
                      "个预览)",
                    ),
                    l
                  );
                })();
              let A = 0,
                P = 0;
              for (const { taskId: e, result: t, error: error, index: r } of S)
                if (!error && t) {
                  r > 0 && (await new Promise((e) => setTimeout(e, 150)));
                  try {
                    (await yi({
                      result: t,
                      taskId: e,
                      node: g,
                      baseUrl: baseUrl,
                      apiKey: apiKey,
                      currentModel: ge,
                      isMidjourney: pe,
                      isVideoGeneration: ve,
                      connections: o,
                      nodes: i,
                      updateNode: a,
                      setHistory: s,
                      connectedPreviewId: j,
                      batchAccumulator: l,
                      batchIndex: r,
                    }),
                      A++);
                  } catch (je) {
                    (P++,
                      console.error(
                        `[Generation] ❌ 批量任务 ${r + 1} 处理失败:`,
                        je,
                      ),
                      s((t) =>
                        t.map((t) =>
                          t.id === e
                            ? { ...t, status: "failed", progress: 0 }
                            : t,
                        ),
                      ));
                  }
                } else
                  (P++,
                    s((t) =>
                      t.map((t) =>
                        t.id === e
                          ? { ...t, status: "failed", progress: 0 }
                          : t,
                      ),
                    ),
                    console.error(
                      `[Generation] ❌ 批量任务 ${r + 1} 失败:`,
                      error,
                    ));
              const x = async () => {
                const e = Date.now();
                for (; Date.now() - e < 3e5; ) {
                  const e = await new Promise((e) => {
                    s((t) => (e(t), t));
                  });
                  if (
                    m.every((t) => {
                      const o = e.find((e) => e.id === t);
                      return (
                        o && ("completed" === o.status || "failed" === o.status)
                      );
                    })
                  )
                    break;
                  await new Promise((e) => setTimeout(e, 1e3));
                  m.filter((t) => {
                    const o = e.find((e) => e.id === t);
                    return (
                      o && ("completed" === o.status || "failed" === o.status)
                    );
                  }).length;
                }
              };
              await x();
              const k = l.filter((url) => url && url.length > 0);
              return void (
                k.length < h &&
                (console.warn(
                  `[Batch] ⚠️ 警告：预期 ${h} 张图片，实际只收集到 ${k.length} 张`,
                ),
                console.warn(
                  "[Batch] 缺失的索引:",
                  l.map((url, e) => (url ? null : e)).filter((e) => null !== e),
                ))
              );
            }
            let payload,
              endpoint = "",
              p = !1;
            const f = await pi({
              node: g,
              currentModel: ge,
              config: be,
              baseUrl: baseUrl,
              prompt: prompt,
              ratio: e,
              resolution: t,
              refImages: r,
              hasReferenceImage: u,
              isVideoGeneration: ve,
              isMidjourney: pe,
              isJimeng: we,
              isNanoBanana2: ye,
              taskId: taskId,
              apiKey: apiKey,
              getConnectedImageForInput: c,
              setHistory: s,
              updateNode: a,
              angleMetadata: H,
              nodes: i,
              connections: o,
              markerMasks: oe,
            });
            if (!f) return;
            ((endpoint = f.endpoint),
              (_e = f.endpoint),
              (payload = f.payload),
              (p = f.useMultipart));
            const w = de(ge) ? "Token" : "Bearer",
              headers = p
                ? { Authorization: `${w} ${apiKey}` }
                : {
                    "Content-Type": "application/json",
                    Authorization: `${w} ${apiKey}`,
                  };
            if (
              (fe(ge) &&
                ((headers["Content-Type"] = "application/json"),
                (headers["x-goog-api-key"] = apiKey),
                delete headers.Authorization,
                console.log(
                  "[Gemini Image Official] 使用官方 API 请求头: x-goog-api-key",
                )),
              me(ge) &&
                ((headers["X-DashScope-Async"] = "enable"),
                console.log(
                  "[Wan 2.6 Official] 添加异步请求头: X-DashScope-Async=enable",
                )),
              he(ge))
            ) {
              const e =
                  (null == (A = g.settings) ? void 0 : A.enableInterleave) ??
                  !1,
                t =
                  e &&
                  ((null == (P = g.settings) ? void 0 : P.useStream) ?? !1),
                o = (null == (k = g.settings) ? void 0 : k.useAsyncMode) ?? !0;
              e && t
                ? ((headers["X-DashScope-Sse"] = "enable"),
                  console.log(
                    "[Wan 2.6 Image Official] 添加流式请求头: X-DashScope-Sse=enable",
                  ))
                : (!o && e) ||
                  ((headers["X-DashScope-Async"] = "enable"),
                  console.log(
                    "[Wan 2.6 Image Official] 添加异步请求头: X-DashScope-Async=enable",
                  ));
            }
            if (
              (console.log("[Generation] Sending request:", {
                endpoint: endpoint,
                useMultipart: p,
                payload: p ? "FormData" : payload,
                model: ge,
              }),
              q(ge))
            ) {
              console.log("[Veo] 📤 发送请求详情:", {
                endpoint: endpoint,
                model: ge,
                payload: payload,
                payloadModel: payload.model,
                hasImages: !!payload.images,
                imagesCount:
                  (null == (T = payload.images) ? void 0 : T.length) || 0,
                imagesPreview:
                  null == ($ = payload.images)
                    ? void 0
                    : $.map((e, t) => ({
                        index: t,
                        type: e.startsWith("data:")
                          ? "base64"
                          : e.startsWith("http")
                            ? "http"
                            : "unknown",
                        length: e.length,
                        mimeType: e.startsWith("data:")
                          ? e.substring(5, e.indexOf(";"))
                          : "N/A",
                      })),
              });
              const e = { ...payload };
              (e.images &&
                (e.images = `[${e.images.length} images, ${e.images.map((e) => e.length).join(", ")} bytes]`),
                console.log(
                  "[Veo] 📤 完整 Payload（不含图片）:",
                  JSON.stringify(e, null, 2),
                ));
            }
            if (
              (ae(ge) &&
                (console.log(
                  "[Kling O1] ========== 发送请求前最终检查 ==========",
                ),
                console.log("[Kling O1] Endpoint:", endpoint),
                console.log("[Kling O1] Payload 对象:", payload),
                console.log(
                  "[Kling O1] Payload JSON:",
                  JSON.stringify(payload, null, 2),
                ),
                console.log("[Kling O1] 字段检查:"),
                console.log(
                  "  - model_name:",
                  payload.model_name,
                  "(类型:",
                  typeof payload.model_name,
                  ")",
                ),
                console.log("  - model:", payload.model, "(应该是 undefined)"),
                console.log(
                  "  - duration:",
                  payload.duration,
                  "(类型:",
                  typeof payload.duration,
                  ")",
                ),
                console.log("  - mode:", payload.mode),
                console.log("  - aspect_ratio:", payload.aspect_ratio),
                console.log("  - element_list:", payload.element_list),
                console.log(
                  "[Kling O1] ==========================================",
                )),
              fe(ge) && taskId)
            ) {
              const e = [10, 25, 40, 55, 70, 85];
              let t = 0;
              Ie = setInterval(() => {
                if (t >= e.length) return;
                const o = e[t++];
                (s((e) =>
                  e.map((e) => (e.id === taskId ? { ...e, progress: o } : e)),
                ),
                  a(g.id, { settings: { ...g.settings, progress: o } }));
              }, 1800);
            }
            const y = await an(endpoint, {
              method: "POST",
              headers: headers,
              body: p ? payload : JSON.stringify(payload),
            });
            if (!y.ok) {
              const e = await y.text();
              (console.error("[Generation] API Error:", {
                status: y.status,
                errorText: e,
                endpoint: endpoint,
              }),
                q(ge) &&
                  console.error("[Veo] ❌ API 请求失败:", {
                    status: y.status,
                    statusText: y.statusText,
                    errorText: e,
                    endpoint: endpoint,
                    model: ge,
                  }));
              let t = e;
              try {
                const o = JSON.parse(e);
                (null == o ? void 0 : o.error) &&
                  "string" == typeof o.error &&
                  (t = o.error);
              } catch {}
              throw new Error(t || `API请求失败: ${y.status}`);
            }
            const v = await y.text();
            let result;
            try {
              result = JSON.parse(v);
            } catch (Ae) {
              if (
                (console.error("[Generation] ❌ 响应不是有效的 JSON:", {
                  responsePreview: v.substring(0, 200),
                  endpoint: endpoint,
                  model: ge,
                }),
                v.trim().toLowerCase().startsWith("<!doctype") ||
                  v.trim().toLowerCase().startsWith("<html"))
              )
                throw new Error(
                  "API 返回了 HTML 错误页面，而不是 JSON 数据。请检查 API 地址和密钥是否正确。若为打包版，请到设置中确认该模型的 API 地址与 Key 已保存。",
                );
              throw new Error(
                `API 返回了无效的响应格式: ${v.substring(0, 100)}`,
              );
            }
            const b = fi(g.id, o, i),
              E = null == (M = g.settings) ? void 0 : M.selectedPreviewId,
              L =
                E && b.includes(E)
                  ? E
                  : (null == (C = g.settings)
                      ? void 0
                      : C._autoCreatedPreviewId) ||
                    (b.length > 0 ? b[0] : void 0);
            if (ae(ge)) {
              (console.log("[Kling O1] ========== 使用独立响应处理 =========="),
                console.log(
                  "[Kling O1] 响应数据:",
                  JSON.stringify(result, null, 2),
                ));
              const e =
                (null == (U = result.data) ? void 0 : U.task_id) ||
                result.task_id ||
                ((null == (O = result.data) ? void 0 : O.data) &&
                "object" == typeof result.data.data
                  ? result.data.data.task_id
                  : null);
              if ((console.log("[Kling O1] 提取的 task_id:", e), e))
                (s((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? {
                          ...t,
                          status: "generating",
                          progress: 0,
                          remoteTaskId: String(e),
                        }
                      : t,
                  ),
                ),
                  ((taskId, e) => {
                    (console.log(
                      "[KlingCallbackService] 注册 callback 处理函数:",
                      taskId,
                    ),
                      ci.set(taskId, e));
                    const t = di.get(taskId);
                    t &&
                      (console.log(
                        "[KlingCallbackService] 处理待处理的 callback 数据:",
                        taskId,
                      ),
                      e(t),
                      di.delete(taskId));
                  })(String(e), (t) => {
                    var i;
                    if (
                      (console.log("[Kling O1] 收到 callback 数据:", t),
                      "succeed" === t.task_status ||
                        "success" === t.task_status)
                    ) {
                      const r = null == (i = t.task_result) ? void 0 : i.videos;
                      if (r && r.length > 0 && r[0].url) {
                        const t = r[0].url;
                        (console.log("[Kling O1] 从 callback 获取视频 URL:", t),
                          s((e) =>
                            e.map((e) =>
                              e.id === taskId
                                ? {
                                    ...e,
                                    status: "completed",
                                    url: t,
                                    progress: 100,
                                  }
                                : e,
                            ),
                          ),
                          a(g.id, { isGenerating: !1 }));
                        const i = o
                          .filter((e) => e.from === g.id)
                          .map((e) => e.to);
                        if (i.length > 0) {
                          console.log("[Kling O1] 需要更新预览节点:", i);
                          const o = new CustomEvent("klingO1VideoComplete", {
                            detail: {
                              taskId: String(e),
                              videoUrl: t,
                              sourceNodeId: g.id,
                              previewNodeIds: i,
                              previewSourceModel: ge,
                            },
                          });
                          window.dispatchEvent(o);
                        }
                      } else
                        console.error("[Kling O1] callback 中没有视频 URL");
                    } else if (
                      "failed" === t.task_status ||
                      "failure" === t.task_status
                    ) {
                      const e = t.task_status_msg || "生成失败";
                      (console.error("[Kling O1] 任务失败:", e),
                        s((t) =>
                          t.map((t) =>
                            t.id === taskId
                              ? {
                                  ...t,
                                  status: "failed",
                                  errorMsg: e,
                                  progress: 0,
                                }
                              : t,
                          ),
                        ),
                        a(g.id, { isGenerating: !1, errorMsg: e }));
                    }
                  }));
              else {
                console.error("[Kling O1] 未找到 task_id，响应:", result);
                const e =
                  result.message ||
                  result.error ||
                  "创建任务失败：未返回 task_id";
                (a(g.id, { isGenerating: !1, errorMsg: e }),
                  s((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ));
              }
              return;
            }
            await yi({
              result: result,
              taskId: taskId,
              node: g,
              baseUrl: baseUrl,
              apiKey: apiKey,
              currentModel: ge,
              isMidjourney: pe,
              isVideoGeneration: ve,
              connections: o,
              nodes: i,
              updateNode: a,
              setHistory: s,
              connectedPreviewId: L,
            });
          } catch (error) {
            console.error("生成失败:", error);
            const e = error.message;
            let t = e;
            ((e.includes("Failed to fetch") || e.includes("fetch")) &&
              ((t = `网络请求失败: ${e}\n`),
              (t += `模型: ${ge}\n`),
              (t += `URL: ${(null == be ? void 0 : be.url) || "unknown"}\n`),
              (t += `Endpoint: ${_e || "unknown"}\n`),
              (t += `Protocol: ${window.location.protocol}\n`),
              (t += `Hostname: ${window.location.hostname}`)),
              a(g.id, { isGenerating: !1, errorMsg: t }),
              taskId &&
                s((e) =>
                  e.map((e) =>
                    e.id === taskId
                      ? { ...e, status: "failed", progress: 0, errorMsg: t }
                      : e,
                  ),
                ));
            const o =
              null == (E = g.settings) ? void 0 : E._autoCreatedPreviewId;
            if (o)
              try {
                window.dispatchEvent(
                  new CustomEvent("previewGenerateFailed", {
                    detail: { previewNodeId: o },
                  }),
                );
              } catch (Pe) {}
          } finally {
            null != Ie && clearInterval(Ie);
          }
        },
        [e, t, o, i, r, a, s, l, c, d, u],
      ),
      h = g.useCallback(
        async (e, o, prompt, i, r = 1.5, a, l, c, d) => {
          const u = i.modelName || i.id;
          u.includes("gpt-image") ||
            u.includes("gpt-4o-image") ||
            u.includes("nano-banana-2") ||
            u.includes("gemini-3.1-flash-image-preview") ||
            console.warn("[Expand] 当前模型可能不支持蒙版扩图，仍尝试请求:", u);
          const baseUrl = (i.url || "").replace(/\/$/, ""),
            apiKey = i.key || t || "";
          if (!baseUrl || !apiKey)
            return (console.error("[Expand] 缺少 baseUrl 或 apiKey"), null);
          let g = null;
          try {
            const {
              compositeBlob: t,
              maskBase64: m,
              width: width,
              height: height,
            } = await (function (e, t, o = 1.5, i, r, a) {
              return new Promise((s, l) => {
                const c = xo,
                  d = new Image();
                ((d.crossOrigin = "anonymous"),
                  (d[c(6)] = () => {
                    const e = xo,
                      c = d.naturalWidth,
                      u = d.naturalHeight;
                    if (c <= 0 || u <= 0) return void l(new Error(e(7)));
                    let g, m;
                    const h = !t || "原比例" === t || "Auto" === t;
                    if (h)
                      if (null != i && null != r) {
                        const t = Math[e(5)](1, Math.min(5, i)),
                          o = Math.max(1, Math.min(5, r));
                        ((g = Math.round(c * t)), (m = Math.round(u * o)));
                      } else {
                        const e = Math.max(1.1, Math.min(5, o));
                        ((g = Math.round(c * e)), (m = Math.round(u * e)));
                      }
                    else {
                      const i = So(t);
                      ((m = Math[e(5)](u, Math.ceil(c / i))),
                        (g = Math[e(3)](m * i)),
                        g < c &&
                          ((g = c), (m = Math[e(5)](u, Math[e(8)](c / i)))));
                      const r = Math.max(1, Math[e(9)](5, o));
                      ((g = Math[e(3)](g * r)), (m = Math[e(3)](m * r)));
                    }
                    const { offsetX: p, offsetY: f } = jo(
                        g,
                        m,
                        c,
                        u,
                        h ? void 0 : a || "center",
                      ),
                      w = document[e(10)](e(11));
                    ((w[e(12)] = g), (w.height = m));
                    const y = w.getContext("2d");
                    if (!y) return void l(new Error("无法创建 Canvas 上下文"));
                    ((y.fillStyle = "#000000"),
                      y.fillRect(0, 0, g, m),
                      y.drawImage(d, p, f, c, u));
                    const v = document.createElement(e(11));
                    ((v.width = g), (v.height = m));
                    const b = v.getContext("2d");
                    if (!b) return void l(new Error(e(13)));
                    ((b.fillStyle = "#ffffff"),
                      b.fillRect(0, 0, g, m),
                      (b[e(14)] = "#000000"),
                      b[e(15)](p, f, c, u));
                    const _ = v.toDataURL("image/png").split(",")[1];
                    w.toBlob((e) => {
                      e
                        ? s({
                            compositeBlob: e,
                            maskBase64: _,
                            width: g,
                            height: m,
                          })
                        : l(new Error("合成图 toBlob 失败"));
                    }, "image/png");
                  }),
                  (d.onerror = () => l(new Error("图片加载失败"))),
                  (d.src = e));
              });
            })(e, o, r, a, l, d);
            g = URL.createObjectURL(t);
            const h = o && "原比例" !== o && "Auto" !== o ? o : "Auto",
              p = `expand-${Date.now()}`,
              f = {
                id: p,
                type: "gen-image",
                x: 0,
                y: 0,
                width: 200,
                height: 200,
                prompt: "",
                settings: {
                  selectedModel: i.id,
                  ratio: h,
                  resolution: c || "",
                  useAsyncMode: !0,
                  gptImageQuality: "standard",
                },
              },
              w = await pi({
                node: f,
                currentModel: u,
                config: i,
                baseUrl: baseUrl,
                prompt: prompt.trim() || "基于原图自然扩展画面，保持风格一致",
                ratio: h,
                resolution: c || "",
                refImages: [g],
                hasReferenceImage: !0,
                isVideoGeneration: !1,
                isMidjourney: !1,
                isJimeng: u.includes("jimeng") && !u.includes("jimeng-video"),
                isNanoBanana2:
                  u.includes("nano-banana-2") ||
                  u.includes("gemini-3.1-flash-image-preview"),
                taskId: p,
                apiKey: apiKey,
                getConnectedImageForInput: () => null,
                setHistory: s,
                updateNode: () => {},
                nodes: [],
                connections: [],
                markerMasks: [
                  { nodeId: p, mask: m, width: width, height: height },
                ],
                expandMode: !0,
              });
            if (!w) return null;
            const { endpoint: endpoint, payload: payload, useMultipart: y } = w,
              headers = y
                ? { Authorization: `Bearer ${apiKey}` }
                : {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                  },
              v = await an(endpoint, {
                method: "POST",
                headers: headers,
                body: y ? payload : JSON.stringify(payload),
              });
            if (!v.ok) {
              const e = await v.text();
              throw new Error(`扩图请求失败: ${v.status} ${e}`);
            }
            const result = await v.json(),
              data = result.data,
              b =
                (null == data ? void 0 : data.id) ??
                result.task_id ??
                (null == data ? void 0 : data.task_id) ??
                result.id;
            if (b) {
              const e = (e) => (e < 20 ? 800 : e < 50 ? 1500 : 3e3);
              for (let t = 0; t < 200; t++) {
                t > 0 && (await new Promise((o) => setTimeout(o, e(t - 1))));
                const o = `${baseUrl}/v1/images/tasks/${b}`,
                  i = await an(o, {
                    headers: { Authorization: `Bearer ${apiKey}` },
                  }),
                  r = await i.json(),
                  a = qo(r);
                if (
                  "COMPLETED" === a ||
                  "SUCCESS" === a ||
                  "SUCCEEDED" === a ||
                  "FINISHED" === a ||
                  "DONE" === a
                ) {
                  const e = Ho(r, !1, !1);
                  if (e.length > 0) return e;
                }
                if ("FAILED" === a || "ERROR" === a) {
                  const e = Qo(r, String(a));
                  throw new Error(e || "扩图任务失败");
                }
              }
              throw new Error("扩图轮询超时");
            }
            const _ = Ho(result, !1, !1);
            return _.length > 0 ? _ : null;
          } catch (m) {
            throw (console.error("[Expand] 扩图失败:", m), m);
          } finally {
            g && URL.revokeObjectURL(g);
          }
        },
        [t, s],
      ),
      p = g.useCallback(
        async (o) => {
          const {
              nodeId: i,
              cells: r,
              model: model,
              ratio: a,
              resolution: l,
              refImages: c,
              connections: d,
              nodes: u,
              updateNode: g,
              setNodes: m,
              setConnections: h,
              generateId: p,
              gridRows: f,
              gridCols: w,
              targetPreviewId: y,
            } = o,
            v = e.find((e) => e.id === model),
            apiKey = (null == v ? void 0 : v.key) || t,
            baseUrl = (
              (null == v ? void 0 : v.url) || "https://ai.comfly.chat"
            ).replace(/\/+$/, "");
          if (!v || !baseUrl || !apiKey) throw new Error("请先配置 API Key");
          const b = (modelId = model).includes("jimeng")
            ? "jimeng"
            : modelId.includes("gpt-image") || modelId.includes("gpt-4o-image")
              ? "gpt-image"
              : modelId.includes("flux-kontext")
                ? "flux-kontext"
                : modelId.includes("nano-banana-2") ||
                    modelId.includes("gemini-3.1-flash-image-preview")
                  ? "nano-banana-2"
                  : modelId.includes("nano-banana")
                    ? "nano-banana"
                    : modelId.includes("mj") ||
                        modelId.toLowerCase().includes("midjourney")
                      ? "midjourney"
                      : "generic";
          var modelId;
          if (
            ![
              "jimeng",
              "gpt-image",
              "flux-kontext",
              "nano-banana",
              "nano-banana-2",
              "generic",
            ].includes(b)
          )
            throw new Error(
              `当前模型 ${model} 暂不支持分镜图表批量生成，请使用 Nano Banana、即梦、GPT Image 等`,
            );
          let _ = (c || []).filter((url) => {
            if (!url || "string" != typeof url) return !1;
            const e = url.trim();
            return e.length > 0 && "undefined" !== e && "null" !== e;
          });
          if (_.length > 0)
            try {
              const { contentStore: e } = await x(
                async () => {
                  const { contentStore: e } = await Promise.resolve().then(
                    () => Gt,
                  );
                  return { contentStore: e };
                },
                void 0,
                import.meta.url,
              );
              (await e.init(),
                (_ = await Promise.all(
                  _.map(async (url) => {
                    if (url.startsWith("content_ref:")) {
                      const t = e.extractId(url);
                      return (await e.get(t)) || url;
                    }
                    return url;
                  }),
                )));
            } catch (L) {
              console.warn(
                "[generateChartBatch] content_ref 解析失败，使用原始 refImages:",
                L,
              );
            }
          const I = r.filter((e) => (e.prompt || "").trim());
          if (0 === I.length) throw new Error("请至少填写一个分镜描述");
          const S = fi(i, d, u);
          let j = y && S.includes(y) ? y : S[0];
          if (!j && m && h && p) {
            const { createNode: e } = await x(
                async () => {
                  const { createNode: e } = await Promise.resolve().then(
                    () => Yi,
                  );
                  return { createNode: e };
                },
                void 0,
                import.meta.url,
              ),
              t = u.find((n) => n.id === i),
              o = t ? t.x + (t.width || 540) + 80 : 100,
              r = t ? t.y : 100,
              a = e(p(), "preview", o, r, void 0, void 0, u);
            (m((e) => [...e, a]),
              h((e) => [...e, { id: p(), from: i, to: a.id }]),
              (j = a.id));
          }
          if (!j) throw new Error("请连接一个预览节点或将分镜图表连接到预览");
          const A = u.find((n) => n.id === i);
          if (!A) throw new Error("分镜图表节点不存在");
          const P =
              (null == v ? void 0 : v.provider) ||
              (null == v ? void 0 : v.modelName) ||
              model,
            k = "jimeng" === b,
            T = "nano-banana-2" === b,
            $ = I.map(() =>
              p
                ? p()
                : `chart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            ),
            M = new Array(I.length).fill(""),
            C = Date.now(),
            U = $.map((e, t) => ({
              id: e,
              type: "image",
              url: "",
              prompt: I[t].prompt,
              time: qt(),
              status: "generating",
              progress: 0,
              modelName: P,
              sourceNodeId: i,
              targetPreviewId: j,
              startTime: C,
            }));
          (s((e) => [...U, ...e]),
            g(i, { isGenerating: !0, errorMsg: void 0 }));
          let O = null;
          for (let e = 0; e < I.length; e++) {
            e > 0 && (await new Promise((t) => setTimeout(t, 50 * e)));
            let prompt = (I[e].prompt || "").trim();
            const t = [],
              o = prompt.match(/@(\d+)/g);
            o && _.length > 0
              ? (o.forEach((e) => {
                  const o = parseInt(e.slice(1), 10);
                  o >= 1 && o <= _.length && t.push(_[o - 1]);
                }),
                (prompt =
                  prompt.replace(/@\d+/g, "").replace(/\s+/g, " ").trim() ||
                  "自然风格图像"))
              : _.length > 0 && t.push(..._.slice(0, 14));
            try {
              const o = await pi({
                node: A,
                currentModel: model,
                config: v,
                baseUrl: baseUrl,
                prompt: prompt,
                ratio: "Auto" === a ? "1:1" : a,
                resolution: l || "2K",
                refImages: t,
                hasReferenceImage: t.length > 0,
                isVideoGeneration: !1,
                isMidjourney: !1,
                isJimeng: k,
                isNanoBanana2: T,
                taskId: $[e],
                apiKey: apiKey,
                getConnectedImageForInput: () => null,
                setHistory: s,
                updateNode: g,
                nodes: u,
                connections: d,
              });
              if (!o) {
                (s((t) =>
                  t.map((t) =>
                    t.id === $[e] ? { ...t, status: "failed", progress: 0 } : t,
                  ),
                ),
                  (O = new Error(`宫格 ${e + 1} 构建请求失败`)));
                continue;
              }
              const {
                  endpoint: endpoint,
                  payload: payload,
                  useMultipart: i,
                } = o,
                r = "Bearer",
                headers = i
                  ? { Authorization: `${r} ${apiKey}` }
                  : {
                      "Content-Type": "application/json",
                      Authorization: `${r} ${apiKey}`,
                    },
                c = await an(endpoint, {
                  method: "POST",
                  headers: headers,
                  body: i ? payload : JSON.stringify(payload),
                });
              if (!c.ok) {
                const t = await c.text();
                (s((o) =>
                  o.map((o) =>
                    o.id === $[e]
                      ? { ...o, status: "failed", progress: 0, errorMsg: t }
                      : o,
                  ),
                ),
                  (O = new Error(`宫格 ${e + 1} 请求失败: ${c.status}`)));
                continue;
              }
              const m = await c.text();
              let result;
              try {
                result = JSON.parse(m);
              } catch {
                (s((t) =>
                  t.map((t) =>
                    t.id === $[e] ? { ...t, status: "failed", progress: 0 } : t,
                  ),
                ),
                  (O = new Error(`宫格 ${e + 1} 响应非 JSON`)));
                continue;
              }
              await yi({
                result: result,
                taskId: $[e],
                node: A,
                baseUrl: baseUrl,
                apiKey: apiKey,
                currentModel: model,
                isMidjourney: !1,
                isVideoGeneration: !1,
                connections: d,
                nodes: u,
                updateNode: g,
                setHistory: s,
                connectedPreviewId: j,
                batchAccumulator: M,
                batchIndex: e,
              });
            } catch (R) {
              const t = R instanceof Error ? R.message : String(R);
              (s((o) =>
                o.map((o) =>
                  o.id === $[e]
                    ? { ...o, status: "failed", progress: 0, errorMsg: t }
                    : o,
                ),
              ),
                (O = R instanceof Error ? R : new Error(t)));
            }
          }
          await (async () => {
            const e = Date.now() + 3e5;
            for (; Date.now() < e; ) {
              const e = await new Promise((e) => {
                s((t) => (e(t), t));
              });
              if (
                $.every((t) => {
                  const o = e.find((e) => e.id === t);
                  return (
                    o && ("completed" === o.status || "failed" === o.status)
                  );
                })
              )
                return;
              await new Promise((e) => setTimeout(e, 1e3));
            }
          })();
          const E = M.filter((e) => !!e && e.length > 0);
          if (
            (g(i, { isGenerating: !1, errorMsg: void 0 }), E.length > 0 && j)
          ) {
            const e = (null == A ? void 0 : A.nodeName) || "分镜图表";
            await wi(
              j,
              E[0],
              "image",
              g,
              {
                previewMjImages: E,
                selectedPreviewImage: E[0],
                sourceNodeName: e,
                previewSourceModel: model,
                previewSourceNodeId: i,
                previewSourceNodeType: "storyboard-chart-node",
                ...(null != f && null != w
                  ? { previewGridRows: f, previewGridCols: w }
                  : {}),
              },
              u,
            );
          }
          if (O && 0 === E.length) throw O;
        },
        [e, t, s],
      );
    return {
      generate: m,
      generateMusic: u,
      runExpandImage: h,
      generateChartBatch: p,
    };
  };
async function pi(e) {
  var t,
    o,
    i,
    r,
    a,
    s,
    l,
    c,
    d,
    u,
    g,
    m,
    h,
    p,
    f,
    w,
    y,
    v,
    b,
    _,
    I,
    S,
    j,
    A,
    P,
    k,
    T,
    $,
    M,
    C,
    U,
    O,
    E,
    L,
    R,
    N,
    D,
    F,
    W,
    z,
    B,
    G,
    K,
    we,
    ye,
    ve,
    be,
    _e,
    Ie,
    Se,
    je,
    Ae,
    Pe,
    xe,
    ke;
  const {
      node: Te,
      currentModel: $e,
      config: Me,
      baseUrl: baseUrl,
      prompt: prompt,
      ratio: Ce,
      resolution: Ue,
      refImages: Oe,
      hasReferenceImage: Ee,
      isVideoGeneration: Le,
      isMidjourney: Re,
      isJimeng: Ne,
      isNanoBanana2: De,
      taskId: taskId,
      apiKey: apiKey,
      getConnectedImageForInput: Fe,
      setHistory: We,
      updateNode: ze,
      angleMetadata: Be,
      storyboardJsonData: Ge,
      nodes: Je,
      connections: Ve,
      markerMasks: Ke,
      expandMode: He,
    } = e,
    qe = async (e) => {
      var t, o;
      if (!Je || !Ve) return await Jo(e);
      if (e.startsWith("canvas-node:")) {
        const o = e.replace("canvas-node:", ""),
          i = Je.find((n) => n.id === o && "canvas-node" === n.type);
        if (
          null == (t = null == i ? void 0 : i.settings) ? void 0 : t.canvasData
        )
          try {
            const { drawCanvasToImage: e, getBlobFromDataURL: t } = await x(
                async () => {
                  const { drawCanvasToImage: e, getBlobFromDataURL: t } =
                    await import("./index-CgWMCHZL.js").then((n) => n.a);
                  return { drawCanvasToImage: e, getBlobFromDataURL: t };
                },
                __vite__mapDeps([3, 4, 2, 1, 5, 6]),
                import.meta.url,
              ),
              o = i.settings.canvasData,
              base64 = await e(o, i.width, i.height);
            return await t(base64);
          } catch (error) {
            throw (console.error("[Generation] 导出画板失败:", error), error);
          }
      }
      const i = Je.find((n) => n.content === e && "input-image" === n.type);
      if (!i) return await Jo(e);
      const r = Ve.find(
        (e) =>
          e.from === i.id &&
          Je.find((n) => n.id === e.to && "canvas-node" === n.type),
      );
      if (r) {
        const t = Je.find((n) => n.id === r.to);
        if (
          null == (o = null == t ? void 0 : t.settings) ? void 0 : o.canvasData
        )
          try {
            const { drawCanvasToImage: e, getBlobFromDataURL: o } = await x(
                async () => {
                  const { drawCanvasToImage: e, getBlobFromDataURL: t } =
                    await import("./index-CgWMCHZL.js").then((n) => n.a);
                  return { drawCanvasToImage: e, getBlobFromDataURL: t };
                },
                __vite__mapDeps([3, 4, 2, 1, 5, 6]),
                import.meta.url,
              ),
              i = t.settings.canvasData,
              base64 = await e(i, t.width, t.height);
            return await o(base64);
          } catch (error) {
            return (
              console.error("[Generation] 导出画板失败，使用原始图片:", error),
              await Jo(e)
            );
          }
      }
      return await Jo(e);
    },
    Ze = async (e) => {
      if (e.startsWith("data:")) return e;
      if (e.startsWith("http://") || e.startsWith("https://")) return e;
      const blob = await qe(e);
      return await Vo(blob);
    },
    Qe = (e) => {
      const t = e.trim();
      if (t.includes(",")) {
        const e = t.split(",")[1];
        return e ? e.trim() : t;
      }
      return t;
    },
    Xe = async (e) => {
      const t = await Ze(e);
      return se($e) || le($e) || ce($e)
        ? await (async function (e) {
            const t = qn,
              o = await Gn(e),
              { w: i, h: r } = o;
            if (i < 300 || r < 300)
              return (
                console.warn(
                  t(51) + i + "x" + r + " 低于可灵要求 300px，不压缩",
                ),
                e
              );
            const a = (e.startsWith("data:") && e[t(6)](",")[1]) || "",
              s = a ? Math.ceil((3 * a.length) / 4) : 0;
            if (s > 0 && s <= 4718592)
              return (
                console.log(
                  "[compressImageForKling] 图片未超过4.5MB (" +
                    (s / 1024).toFixed(0) +
                    "KB)，按原尺寸 " +
                    i +
                    "x" +
                    r +
                    " 发送",
                ),
                e
              );
            const l = await Hn(e, 6291456, Zn, 1920, 300),
              c = l[t(6)](",")[1] || "",
              d = Math[t(44)]((3 * c.length) / 4);
            return (
              d > Zn &&
                console.warn(
                  "[compressImageForKling] 压缩后仍约 " +
                    (d / 1024 / 1024)[t(40)](1) +
                    "MB，已尽量缩小",
                ),
              l
            );
          })(t)
        : t;
    },
    Ye = async (e) => {
      const t = await Ze(e);
      return await (async function (e) {
        var t;
        const o = qn,
          i = await new Promise((t, o) => {
            const i = qn,
              r = new Image();
            ((r.crossOrigin = "anonymous"),
              (r.onload = () => t(r)),
              (r[i(23)] = () => o(new Error(i(52)))),
              (r.src = e));
          });
        let r = i[o(53)],
          a = i.naturalHeight;
        const s = r / a;
        let l = 0,
          c = 0,
          d = r,
          u = a;
        s > 4
          ? ((d = Math.round(4 * a)), (l = Math.round((r - d) / 2)))
          : s < Xn && ((u = Math.round(r / Xn)), (c = Math.round((a - u) / 2)));
        const g = document.createElement("canvas");
        ((g.width = d), (g.height = u));
        const m = g.getContext("2d");
        if (!m) return e;
        m[o(54)](i, l, c, d, u, 0, 0, d, u);
        let h = g[o(4)]("image/jpeg", 0.9),
          p = h[o(6)](",")[1] || "";
        if (Math.ceil((3 * p[o(32)]) / 4) <= Qn)
          return (
            (s > 4 || s < Xn) &&
              console.log(
                "[Vidu] 比例裁剪完成: " + r + "x" + a + o(55) + d + "x" + u,
              ),
            h
          );
        const f = await Hn(h, 8388608, Qn, Math.max(d, u));
        return (
          console[o(46)](
            "[Vidu] 压缩完成: " +
              (
                Math.ceil(
                  (3 *
                    ((null == (t = f.split(",")[1]) ? void 0 : t[o(32)]) ||
                      0)) /
                    4,
                ) /
                1024 /
                1024
              ).toFixed(2) +
              " MB",
          ),
          f
        );
      })(t);
    };
  let endpoint = "",
    payload = {},
    et = !1;
  if (Le) {
    const duration = (null == (t = Te.settings) ? void 0 : t.duration) || H($e),
      e = parseInt(duration.replace("s", ""), 10) || 8;
    if (Z($e)) {
      endpoint = `${baseUrl}/v2/videos/generations`;
      const t = parseInt(String(e), 10),
        o = Ce && "Auto" !== Ce ? Ce : "3:2",
        i = "1080P",
        r = {
          model: (null == Me ? void 0 : Me.modelName) || "grok-video-3",
          prompt: prompt,
          ratio: o,
          resolution: i,
        };
      if ((Number.isFinite(t) && t > 0 && (r.duration = t), Ee))
        try {
          const e = await Promise.all(
            Oe.slice(0, 1).map(async (e) => await Ze(e)),
          );
          ((r.images = e), console.log("[Grok] 图生视频，已添加图片数据"));
        } catch (tt) {
          return (
            console.error("Grok Image Conversion Failed:", tt),
            alert("图片处理失败，请检查图片链接或跨域设置"),
            ze(Te.id, { isGenerating: !1 }),
            null
          );
        }
      payload = r;
    } else if (J($e)) {
      endpoint = `${baseUrl}/v1/videos/generations`;
      const t = null == (o = Te.settings) ? void 0 : o.seedanceMaterials;
      if (V($e) && t && t.length > 0) {
        et = !0;
        const formData = new FormData();
        (formData.append("model", (null == Me ? void 0 : Me.modelName) || $e),
          formData.append("prompt", prompt.trim()),
          formData.append("duration", String(e)),
          Ce && "Auto" !== Ce && formData.append("ratio", Ce),
          Ue &&
            "Auto" !== Ue &&
            formData.append("resolution", Ue.toLowerCase()));
        for (const e of t) {
          const blob = e.url.startsWith("data:")
              ? await (await fetch(e.url)).blob()
              : await Jo(e.url),
            t = gi(blob.type, e.type, e.name),
            o = e.name.includes(".") ? e.name : `${e.name}${t}`;
          formData.append("files", blob, o);
        }
        ((payload = formData),
          console.log("[Jimeng Seedance] 多素材 FormData, 素材数:", t.length));
      } else {
        const t = Ee && Oe.length > 0,
          o = !!(null == (i = Te.settings) ? void 0 : i.veoFramesMode),
          r = o ? Fe(Te.id, "veo_start") : null,
          a = o ? Fe(Te.id, "veo_end") : null,
          s = !(!r && !a),
          l = {
            model: (null == Me ? void 0 : Me.modelName) || $e,
            prompt: prompt.trim(),
            duration: e,
          };
        (Ue && "Auto" !== Ue && (l.resolution = Ue.toLowerCase()),
          Ce && "Auto" !== Ce && (l.ratio = Ce));
        const c = [];
        if (s) {
          if (r)
            try {
              if (r.startsWith("http://") || r.startsWith("https://"))
                c.push(r);
              else {
                const e = r.startsWith("data:") ? r : await Vo(await Jo(r));
                c.push(e);
              }
            } catch (tt) {
              return (
                console.error("[Jimeng Video] 首帧处理失败:", tt),
                alert("首帧图片处理失败，请检查图片链接"),
                ze(Te.id, { isGenerating: !1 }),
                null
              );
            }
          if (a)
            try {
              if (a.startsWith("http://") || a.startsWith("https://"))
                c.push(a);
              else {
                const e = a.startsWith("data:") ? a : await Vo(await Jo(a));
                c.push(e);
              }
            } catch (tt) {
              return (
                console.error("[Jimeng Video] 尾帧处理失败:", tt),
                alert("尾帧图片处理失败，请检查图片链接"),
                ze(Te.id, { isGenerating: !1 }),
                null
              );
            }
        } else if (t)
          try {
            for (const e of Oe)
              if (e.startsWith("http://") || e.startsWith("https://"))
                c.push(e);
              else {
                const t = e.startsWith("data:") ? e : await Vo(await Jo(e));
                c.push(t);
              }
          } catch (tt) {
            return (
              console.error("[Jimeng Video] 参考图片处理失败:", tt),
              alert("参考图片处理失败，请检查图片链接"),
              ze(Te.id, { isGenerating: !1 }),
              null
            );
          }
        (c.length > 0 && (l.file_paths = c), (payload = l));
      }
    } else if (Q($e) && !J($e)) {
      const t = X($e),
        o = parseInt(String(e), 10),
        i = Ce && "Auto" !== Ce ? Ce : "adaptive",
        c =
          { "480P": "480p", "720P": "720p", "1080P": "1080p" }[
            (null == (r = Te.settings) ? void 0 : r.resolution) || "720P"
          ] || "720p",
        d = $e.replace(/-api$/, ""),
        u = "seedance-1-0-lite-t2v" === d,
        g = Y($e),
        m = !!(null == (a = Te.settings) ? void 0 : a.veoFramesMode),
        h = Fe(Te.id, "veo_start"),
        p = Fe(Te.id, "veo_end");
      if (t) {
        endpoint = `${baseUrl}/v2/videos/generations`;
        const e = {
          model:
            (null == Me ? void 0 : Me.modelName) ||
            "doubao-seedance-1-0-pro-250528",
          prompt: prompt,
          duration: Math.min(10, Math.max(5, o)),
          resolution: c,
          ratio: i,
          watermark: !1,
        };
        if (!u && Ee)
          try {
            const t = m && h ? h : Oe[0],
              o = await Ze(t);
            e.images = [o];
          } catch (tt) {
            return (
              console.error("Seedance API 图片处理失败:", tt),
              alert("图片处理失败，请检查图片链接或跨域设置"),
              ze(Te.id, { isGenerating: !1 }),
              null
            );
          }
        (ee($e) &&
          (e.generate_audio =
            !1 !==
            (null == (s = Te.settings) ? void 0 : s.seedanceGenerateAudio)),
          (payload = e),
          console.log("[Seedance API] 第三方 API Payload:", {
            ...payload,
            images: payload.images ? "(已设置)" : void 0,
          }));
      } else {
        endpoint = `${baseUrl}/api/v3/contents/generations/tasks`;
        const e = [{ type: "text", text: prompt }];
        if (!u)
          if (g && m && h && p)
            try {
              const t = await Ze(h),
                o = await Ze(p);
              (e.push({
                type: "image_url",
                image_url: { url: t },
                role: "first_frame",
              }),
                e.push({
                  type: "image_url",
                  image_url: { url: o },
                  role: "last_frame",
                }));
            } catch (tt) {
              return (
                console.error("Seedance 首尾帧图片处理失败:", tt),
                alert("首尾帧图片处理失败，请检查图片链接或跨域设置"),
                ze(Te.id, { isGenerating: !1 }),
                null
              );
            }
          else if ((m && h) || Ee) {
            const t = m && h ? h : Oe[0];
            try {
              const o = await Ze(t);
              e.push({ type: "image_url", image_url: { url: o } });
            } catch (tt) {
              return (
                console.error("Seedance 图片处理失败:", tt),
                alert("图片处理失败，请检查图片链接或跨域设置"),
                ze(Te.id, { isGenerating: !1 }),
                null
              );
            }
          }
        const t = "seedance-1.5-pro" === d ? 4 : 2,
          r = {
            model:
              (null == Me ? void 0 : Me.modelName) ||
              "doubao-seedance-1-5-pro-251215",
            content: e,
            ratio: i,
            duration: Math.min(12, Math.max(t, o)),
            resolution: c,
            watermark: !1,
          };
        (ee($e) &&
          (r.generate_audio =
            !1 !==
            (null == (l = Te.settings) ? void 0 : l.seedanceGenerateAudio)),
          (payload = r));
      }
    } else if (ae($e)) {
      ((endpoint = `${baseUrl}/kling/v1/videos/omni-video`),
        console.log("[Kling O1] 节点设置:", Te.settings));
      const t = null == (c = Te.settings) ? void 0 : c.klingVideoUrl,
        o =
          (null == (d = Te.settings) ? void 0 : d.klingVideoReferType) ||
          "base",
        i =
          (null == (u = Te.settings) ? void 0 : u.klingVideoKeepSound) || "yes",
        r = null == (g = Te.settings) ? void 0 : g.klingVideoSegment;
      (console.log("[Kling O1] 视频URL:", t),
        console.log("[Kling O1] 视频类型:", o),
        console.log("[Kling O1] 保留原声:", i),
        console.log("[Kling O1] 视频片段:", r));
      let a = e;
      if (t && "base" === o && r) {
        const e = r.endTime - r.startTime;
        ((a = Math.round(e)),
          console.log("[Kling O1] 使用视频片段时长:", e, "秒，四舍五入为:", a));
      }
      const s = { model_name: "kling-video-o1", prompt: prompt },
        l = null == (m = Te.settings) ? void 0 : m.klingImages;
      if (l && l.length > 0)
        ((s.image_list = l.map((e) => ({ image_url: e.url }))),
          console.log(
            "[Kling O1] 添加上传图片:",
            l.length,
            "张",
            s.image_list,
          ));
      else if (Ee)
        try {
          const e = await Promise.all(
            Oe.map(async (e) => ({ image_url: await Ze(e) })),
          );
          ((s.image_list = e),
            console.log("[Kling O1] 添加连接图片参考:", e.length, "张"));
        } catch (tt) {
          return (
            console.error("[Kling O1] 图片处理失败:", tt),
            alert("图片处理失败，请检查图片链接"),
            ze(Te.id, { isGenerating: !1 }),
            null
          );
        }
      const p = null == (h = Te.settings) ? void 0 : h.klingSubjects;
      (console.log("[Kling O1] 原始 klingSubjects:", p),
        console.log(
          "[Kling O1] klingSubjects 类型:",
          null == p ? void 0 : p.map((e) => typeof e),
        ),
        p &&
          p.length > 0 &&
          ((s.element_list = p.map((e) => {
            const t = String(e);
            return (
              console.log("[Kling O1] 处理 element_id:", {
                原始值: e,
                原始类型: typeof e,
                转换后: t,
                转换后类型: typeof t,
              }),
              { element_id: t }
            );
          })),
          console.log("[Kling O1] 添加主体:", p.length, "个"),
          console.log(
            "[Kling O1] element_list:",
            JSON.stringify(s.element_list, null, 2),
          )),
        t
          ? ((s.video_list = [
              { video_url: t, refer_type: o, keep_original_sound: i },
            ]),
            console.log("[Kling O1] 添加视频参考:", s.video_list))
          : console.log("[Kling O1] 没有视频URL，跳过video_list"),
        (s.mode = "pro"),
        Ce && "Auto" !== Ce
          ? ((s.aspect_ratio = Ce), console.log("[Kling O1] 添加比例:", Ce))
          : ((s.aspect_ratio = "16:9"),
            console.log("[Kling O1] 使用默认比例: 16:9")),
        (s.duration = String(a)));
      const f = `${"http://localhost:3001"}/api/kling-callback`;
      ((s.callback_url = f),
        console.log("[Kling O1] 添加 callback_url:", f),
        (payload = s),
        console.log("[Kling O1] 请求参数:", JSON.stringify(s, null, 2)));
    } else if (se($e)) {
      endpoint = `${baseUrl}/kling/v1/videos/text2video`;
      const e = !!Fe(Te.id, "veo_start"),
        t = !!Fe(Te.id, "veo_end"),
        o = Oe && Oe.length > 0,
        i = e || t;
      (i || o) && (endpoint = `${baseUrl}/kling/v1/videos/image2video`);
      const r = { model_name: "kling-v2-5-turbo", prompt: prompt },
        a = parseInt(duration.replace("s", ""));
      ((r.duration = a), console.log("[Kling v2.5 Turbo] 时长:", a));
      const s =
        (null == (p = Te.settings) ? void 0 : p.klingV25Resolution) || "std";
      if (i || o) {
        ((r.mode = s),
          console.log(
            `[Kling v2.5 Turbo] 检测到${i ? "首尾帧" : "参考图片"}，使用用户选择的模式: ${s}`,
          ));
        try {
          if (i) {
            const e = Fe(Te.id, "veo_start"),
              t = Fe(Te.id, "veo_end");
            if (e) {
              let t = await Xe(e);
              if (t.startsWith("http://") || t.startsWith("https://")) {
                console.log(
                  "[Kling v2.5 Turbo] 首帧图片是 HTTP URL，转换为 base64",
                );
                const e = await fetch(t),
                  blob = await e.blob();
                t = await Vo(blob);
              }
              if (!t.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(t.trim()))
                throw (
                  console.error("[Kling v2.5 Turbo] 首帧图片格式错误"),
                  new Error("首帧图片格式错误")
                );
              const o = Qe(t);
              if (!o)
                throw (
                  console.error("[Kling v2.5 Turbo] 无法提取首帧 base64 数据"),
                  new Error("首帧 base64 格式错误")
                );
              ((r.image = o),
                console.log("[Kling v2.5 Turbo] 添加首帧 (image)"),
                console.log(
                  "[Kling v2.5 Turbo] - base64 前30字符:",
                  o.substring(0, 30),
                ),
                console.log("[Kling v2.5 Turbo] - base64 长度:", o.length));
            } else if (t) {
              console.warn("[Kling v2.5 Turbo] 未检测到首帧，使用尾帧作为首帧");
              let e = await Xe(t);
              if (e.startsWith("http://") || e.startsWith("https://")) {
                console.log(
                  "[Kling v2.5 Turbo] 尾帧图片是 HTTP URL，转换为 base64",
                );
                const t = await fetch(e),
                  blob = await t.blob();
                e = await Vo(blob);
              }
              const o = Qe(e);
              o &&
                ((r.image = o),
                console.log("[Kling v2.5 Turbo] 使用尾帧作为首帧 (image)"));
            }
            if (t) {
              let e = await Xe(t);
              if (e.startsWith("http://") || e.startsWith("https://")) {
                console.log(
                  "[Kling v2.5 Turbo] 尾帧图片是 HTTP URL，转换为 base64",
                );
                const t = await fetch(e),
                  blob = await t.blob();
                e = await Vo(blob);
              }
              if (!e.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(e.trim()))
                throw (
                  console.error("[Kling v2.5 Turbo] 尾帧图片格式错误"),
                  new Error("尾帧图片格式错误")
                );
              const o = Qe(e);
              if (!o)
                throw (
                  console.error("[Kling v2.5 Turbo] 无法提取尾帧 base64 数据"),
                  new Error("尾帧 base64 格式错误")
                );
              ((r.image_tail = o),
                console.log("[Kling v2.5 Turbo] 添加尾帧 (image_tail)"),
                console.log(
                  "[Kling v2.5 Turbo] - 尾帧 base64 前30字符:",
                  o.substring(0, 30),
                ),
                console.log(
                  "[Kling v2.5 Turbo] - 尾帧 base64 长度:",
                  o.length,
                ));
            }
          } else if (o && Oe[0]) {
            let e = await Xe(Oe[0]);
            if (e.startsWith("http://") || e.startsWith("https://")) {
              console.log(
                "[Kling v2.5 Turbo] 参考图片是 HTTP URL，转换为 base64",
              );
              const t = await fetch(e),
                blob = await t.blob();
              e = await Vo(blob);
            }
            if (!e.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(e.trim()))
              throw (
                console.error("[Kling v2.5 Turbo] 图片格式错误"),
                new Error("图片格式错误")
              );
            const t = Qe(e);
            if (!t)
              throw (
                console.error("[Kling v2.5 Turbo] 无法提取 base64 数据"),
                new Error("base64 格式错误")
              );
            ((r.image = t),
              console.log("[Kling v2.5 Turbo] 添加参考图片 (image)"),
              console.log(
                "[Kling v2.5 Turbo] - base64 前30字符:",
                t.substring(0, 30),
              ),
              console.log("[Kling v2.5 Turbo] - base64 长度:", t.length));
          }
        } catch (tt) {
          return (
            console.error("[Kling v2.5 Turbo] 图片处理失败:", tt),
            alert("图片处理失败，请检查图片链接"),
            ze(Te.id, { isGenerating: !1 }),
            null
          );
        }
      } else
        "std" === s || "pro" === s
          ? ((r.mode = s), console.log("[Kling v2.5 Turbo] 文生视频模式:", s))
          : (r.mode = "std");
      (Ce && "Auto" !== Ce
        ? ((r.aspect_ratio = Ce), console.log("[Kling v2.5 Turbo] 比例:", Ce))
        : (r.aspect_ratio = "16:9"),
        (payload = r),
        console.log(
          "[Kling v2.5 Turbo] 请求参数:",
          JSON.stringify(r, null, 2),
        ));
    } else if (le($e)) {
      endpoint = `${baseUrl}/kling/v1/videos/text2video`;
      const e = !!Fe(Te.id, "veo_start"),
        t = !!Fe(Te.id, "veo_end"),
        o = e || t,
        i = Oe && Oe.length > 0;
      (console.log("[Kling v2.6] 输入检测:", {
        hasStartFrame: e,
        hasEndFrame: t,
        hasReferenceImage: i,
        refImagesCount: (null == Oe ? void 0 : Oe.length) || 0,
        refImagesPreview:
          null == Oe
            ? void 0
            : Oe.map(
                (url) => `"${null == url ? void 0 : url.substring(0, 50)}"`,
              ),
      }),
        (o || i) && (endpoint = `${baseUrl}/kling/v1/videos/image2video`));
      const r = { model_name: "kling-v2-6", prompt: prompt },
        a = duration.replace("s", "");
      ((r.duration = a), console.log("[Kling v2.6] 时长:", a));
      const s =
          (null == (f = Te.settings) ? void 0 : f.klingV26Resolution) || "std",
        l = (null == (w = Te.settings) ? void 0 : w.klingV26Sound) || "off";
      if (
        (console.log("[Kling v2.6] 用户选择的模式:", s, "声音:", l), o || i)
      ) {
        const e = o ? "pro" : s;
        ((r.mode = e),
          console.log(
            `[Kling v2.6] 检测到${o ? "首尾帧" : "参考图片"}，${o ? "强制 pro 模式（API 要求）" : "使用用户选择的模式"}: ${e}`,
          ));
        try {
          if (o) {
            const e = Fe(Te.id, "veo_start"),
              t = Fe(Te.id, "veo_end");
            if (e) {
              let t = await Xe(e);
              if (t.startsWith("http://") || t.startsWith("https://")) {
                const e = await fetch(t),
                  blob = await e.blob();
                t = await Vo(blob);
              }
              if (!t.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(t.trim()))
                throw new Error("首帧图片格式错误");
              const o = Qe(t);
              if (!o) throw new Error("首帧 base64 格式错误");
              r.image = o;
            } else if (t) {
              let e = await Xe(t);
              if (e.startsWith("http://") || e.startsWith("https://")) {
                const t = await fetch(e),
                  blob = await t.blob();
                e = await Vo(blob);
              }
              const o = Qe(e);
              o && (r.image = o);
            }
            if (t) {
              let e = await Xe(t);
              if (e.startsWith("http://") || e.startsWith("https://")) {
                const t = await fetch(e),
                  blob = await t.blob();
                e = await Vo(blob);
              }
              if (!e.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(e.trim()))
                throw new Error("尾帧图片格式错误");
              const o = Qe(e);
              if (!o) throw new Error("尾帧 base64 格式错误");
              r.image_tail = o;
            }
          } else if (i && Oe[0]) {
            let e = await Xe(Oe[0]);
            if (e.startsWith("http://") || e.startsWith("https://")) {
              const t = await fetch(e),
                blob = await t.blob();
              e = await Vo(blob);
            }
            if (!e.startsWith("data:") && !/^[A-Za-z0-9+/=]+$/.test(e.trim()))
              throw new Error("图片格式错误");
            const t = Qe(e);
            if (!t) throw new Error("base64 格式错误");
            r.image = t;
          }
        } catch (tt) {
          return (
            console.error("[Kling v2.6] 图片处理失败:", tt),
            alert("图片处理失败，请检查图片链接"),
            ze(Te.id, { isGenerating: !1 }),
            null
          );
        }
        "pro" === e
          ? ((r.sound = "on" === l ? "on" : "off"),
            console.log("[Kling v2.6] pro 模式，使用用户设置的声音:", r.sound))
          : ((r.sound = "off"),
            console.log("[Kling v2.6] std 模式，强制 sound: off（API限制）"));
      } else
        ((r.mode = "std" === s || "pro" === s ? s : "std"),
          console.log("[Kling v2.6] 使用用户设置的模式:", r.mode),
          "std" === r.mode
            ? ((r.sound = "off"),
              console.log("[Kling v2.6] std 模式不支持声音，已强制 sound: off"))
            : ((r.sound = "on" === l ? "on" : "off"),
              console.log(
                "[Kling v2.6] pro 模式，使用用户设置的声音:",
                r.sound,
              )));
      ((r.aspect_ratio = Ce && "Auto" !== Ce ? Ce : "16:9"),
        (payload = r),
        console.log("[Kling v2.6] 请求参数:", JSON.stringify(r, null, 2)));
    } else if (ce($e)) {
      endpoint = `${baseUrl}/kling/v1/videos/text2video`;
      const e = !!Fe(Te.id, "veo_start"),
        t = !!Fe(Te.id, "veo_end"),
        o = e || t,
        i = Oe && Oe.length > 0;
      (o || i) && (endpoint = `${baseUrl}/kling/v1/videos/image2video`);
      const r = !!(null == (y = Te.settings) ? void 0 : y.klingV3MultiShot),
        a = { model_name: "kling-v3", prompt: r ? "" : prompt || "" },
        s = duration.replace("s", "");
      a.duration = s;
      const l = (null == (v = Te.settings) ? void 0 : v.klingV3Sound) || "on";
      a.sound = "on" === l ? "on" : "off";
      const c = (null == (b = Te.settings) ? void 0 : b.resolution) || "720P",
        d = "1080P" === c ? "1080p" : "720p";
      if (
        ((a.resolution = d),
        (a.mode = "1080P" === c ? "pro" : "std"),
        (a.multi_shot = r),
        r)
      ) {
        const e =
          (null == (_ = Te.settings) ? void 0 : _.klingV3ShotType) ||
          "intelligence";
        a.shot_type = e;
        const t = null == (I = Te.settings) ? void 0 : I.klingV3MultiPrompt;
        t &&
          t.length > 0 &&
          (a.multi_prompt = t.map((e) => ({
            index: e.index,
            prompt: e.prompt,
            duration: String(e.duration || "2"),
          })));
      }
      const u = null == (S = Te.settings) ? void 0 : S.klingSubjects;
      if (
        (u &&
          u.length > 0 &&
          (a.element_list = u.map((e) => ({ element_id: String(e) }))),
        (a.aspect_ratio = Ce && "Auto" !== Ce ? Ce : "16:9"),
        o || i)
      )
        try {
          if (o) {
            const e = Fe(Te.id, "veo_start"),
              t = Fe(Te.id, "veo_end");
            if (e) {
              let t = await Xe(e);
              if (t.startsWith("http://") || t.startsWith("https://")) {
                const e = await fetch(t),
                  blob = await e.blob();
                t = await Vo(blob);
              }
              const o = Qe(t);
              o && (a.image = o);
            } else if (t) {
              let e = await Xe(t);
              if (e.startsWith("http://") || e.startsWith("https://")) {
                const t = await fetch(e),
                  blob = await t.blob();
                e = await Vo(blob);
              }
              const o = Qe(e);
              o && (a.image = o);
            }
            if (t) {
              let e = await Xe(t);
              if (e.startsWith("http://") || e.startsWith("https://")) {
                const t = await fetch(e),
                  blob = await t.blob();
                e = await Vo(blob);
              }
              const o = Qe(e);
              o && (a.image_tail = o);
            }
          } else if (i && Oe[0]) {
            let e = await Xe(Oe[0]);
            if (e.startsWith("http://") || e.startsWith("https://")) {
              const t = await fetch(e),
                blob = await t.blob();
              e = await Vo(blob);
            }
            const t = Qe(e);
            t && (a.image = t);
          }
        } catch (tt) {
          return (
            console.error("[Kling v3] 图片处理失败:", tt),
            alert("图片处理失败，请检查图片链接"),
            ze(Te.id, { isGenerating: !1 }),
            null
          );
        }
      ((payload = a),
        console.log("[Kling v3] 请求参数:", JSON.stringify(a, null, 2)));
    } else if (q($e)) {
      let e;
      if (
        ((endpoint = `${baseUrl}/v2/videos/generations`), Ce && "Auto" !== Ce)
      )
        if ("16:9" === Ce || "9:16" === Ce) e = Ce;
        else {
          const [t, o] = Ce.split(":").map(Number);
          e = t / o > 1 ? "16:9" : "9:16";
        }
      const t = !!(null == (j = Te.settings) ? void 0 : j.veoFramesMode),
        o = [
          t ? Fe(Te.id, "veo_start") : null,
          t ? Fe(Te.id, "veo_end") : null,
        ].filter(Boolean),
        i = async (e) => {
          if (e.startsWith("content_ref:"))
            try {
              const { contentStore: t } = await x(
                async () => {
                  const { contentStore: e } = await Promise.resolve().then(
                    () => Gt,
                  );
                  return { contentStore: e };
                },
                void 0,
                import.meta.url,
              );
              await t.init();
              const o = t.extractId(e);
              console.log("[Veo] 解析 content_ref:", o);
              const i = await t.get(o);
              if (i) return (console.log("[Veo] ✅ content_ref 已解析"), i);
              throw (
                console.error("[Veo] ❌ content_ref 解析失败，内容不存在:", o),
                new Error(`content_ref 不存在: ${o}`)
              );
            } catch (error) {
              throw (
                console.error("[Veo] ❌ content_ref 解析失败:", error),
                error
              );
            }
          return e;
        },
        r = async (e, t = 5242880) => {
          const o = e.length;
          if (o <= t)
            return (
              console.log(
                "[Veo] 图片大小符合要求:",
                (o / 1024 / 1024).toFixed(2),
                "MB",
              ),
              e
            );
          console.log(
            "[Veo] 图片过大，开始压缩:",
            (o / 1024 / 1024).toFixed(2),
            "MB → 目标: < 5MB",
          );
          try {
            const o = new Image();
            await new Promise((t, i) => {
              ((o.onload = t), (o.onerror = i), (o.src = e));
            });
            const i = document.createElement("canvas"),
              r = i.getContext("2d");
            if (!r) throw new Error("无法创建 Canvas 上下文");
            let a = 0.9,
              s = e,
              l = 0;
            const c = 10;
            for (; s.length > t && l < c; )
              if (
                ((i.width = o.width),
                (i.height = o.height),
                r.clearRect(0, 0, i.width, i.height),
                r.drawImage(o, 0, 0),
                (s = i.toDataURL("image/jpeg", a)),
                console.log(
                  `[Veo] 压缩尝试 ${l + 1}/${c}, 质量: ${a.toFixed(2)}, 大小: ${(s.length / 1024 / 1024).toFixed(2)} MB`,
                ),
                (a -= 0.1),
                l++,
                a < 0.3 && s.length > t)
              ) {
                const e = 0.8;
                ((i.width = Math.floor(o.width * e)),
                  (i.height = Math.floor(o.height * e)),
                  r.clearRect(0, 0, i.width, i.height),
                  r.drawImage(o, 0, 0, i.width, i.height),
                  (s = i.toDataURL("image/jpeg", 0.8)),
                  console.log(
                    `[Veo] 缩小尺寸至 ${i.width}x${i.height}, 大小: ${(s.length / 1024 / 1024).toFixed(2)} MB`,
                  ));
                break;
              }
            if (
              (s.length > t
                ? console.warn("[Veo] ⚠️ 压缩后仍然超过限制，但已尽力压缩")
                : console.log(
                    "[Veo] ✅ 压缩成功:",
                    (s.length / 1024 / 1024).toFixed(2),
                    "MB",
                  ),
              !s.startsWith("data:image/"))
            )
              throw (
                console.error(
                  "[Veo] ❌ 压缩后的图片格式不正确:",
                  s.substring(0, 50),
                ),
                new Error("压缩后的图片格式不正确")
              );
            return s;
          } catch (error) {
            return (console.error("[Veo] 压缩失败，使用原图:", error), e);
          }
        };
      let a = [];
      const s = ne($e),
        l = async (e) => {
          var t;
          if (!s) return e;
          if (
            (e.startsWith("http://") || e.startsWith("https://")) &&
            (e.includes(".jpg") ||
              e.includes(".jpeg") ||
              e.includes(".png") ||
              e.includes(".webp") ||
              e.includes(".gif"))
          )
            return (console.log("[Veo Fast] 使用标准URL:", e), e);
          try {
            if (Je && Ve) {
              const o = Ve.filter((e) => e.to === Te.id);
              for (const i of o) {
                const o = Je.find((n) => n.id === i.from);
                if (o && o.content === e) {
                  const e = null == (t = o.settings) ? void 0 : t.originalUrl;
                  if (
                    e &&
                    "string" == typeof e &&
                    (e.startsWith("http://") || e.startsWith("https://")) &&
                    (e.includes(".jpg") ||
                      e.includes(".jpeg") ||
                      e.includes(".png") ||
                      e.includes(".webp") ||
                      e.includes(".gif"))
                  )
                    return (console.log("[Veo Fast] 找到原始标准URL:", e), e);
                }
              }
            }
          } catch (error) {
            console.warn("[Veo Fast] 获取原始URL失败:", error);
          }
          return (console.log("[Veo Fast] 未找到标准URL，转换为base64"), e);
        };
      o.length > 0
        ? (console.log(
            "[Veo] 处理首尾帧图片，数量:",
            o.length,
            s ? "(Fast模式-URL)" : "(标准模式-Base64)",
          ),
          (a = await Promise.all(
            o.map(async (e, t) => {
              console.log(
                `[Veo] 处理图片 ${t + 1}/${o.length}:`,
                e.substring(0, 100),
              );
              try {
                if (((e = await i(e)), s)) {
                  const o = await l(e);
                  if (
                    (o.startsWith("http://") || o.startsWith("https://")) &&
                    (o.includes(".jpg") ||
                      o.includes(".jpeg") ||
                      o.includes(".png") ||
                      o.includes(".webp") ||
                      o.includes(".gif"))
                  )
                    return (
                      console.log(
                        `[Veo Fast] 图片 ${t + 1} 使用标准 HTTP URL:`,
                        o,
                      ),
                      o
                    );
                  {
                    let e;
                    if (
                      (console.log(
                        `[Veo Fast] 图片 ${t + 1} 不是标准URL，转换为 base64`,
                      ),
                      o.startsWith("data:"))
                    )
                      e = o;
                    else {
                      if (
                        !(
                          o.startsWith("http://") ||
                          o.startsWith("https://") ||
                          o.startsWith("blob:")
                        )
                      )
                        throw new Error(
                          `不支持的图片格式: ${o.substring(0, 50)}`,
                        );
                      {
                        const blob = await Jo(o);
                        e = await Vo(blob);
                      }
                    }
                    return ((e = await r(e)), e);
                  }
                }
                {
                  let o;
                  if (e.startsWith("data:"))
                    (console.log(`[Veo] 图片 ${t + 1} 已是 base64 格式`),
                      (o = e));
                  else if (
                    e.startsWith("http://") ||
                    e.startsWith("https://")
                  ) {
                    console.log(
                      `[Veo] 图片 ${t + 1} 是 HTTP URL，开始下载转换...`,
                    );
                    const blob = await Jo(e);
                    ((o = await Vo(blob)),
                      console.log(
                        `[Veo] 图片 ${t + 1} 转换成功，大小:`,
                        (o.length / 1024 / 1024).toFixed(2),
                        "MB",
                      ));
                  } else {
                    if (!e.startsWith("blob:"))
                      throw (
                        console.error(
                          `[Veo] 图片 ${t + 1} 格式不支持:`,
                          e.substring(0, 100),
                        ),
                        new Error(`不支持的图片格式: ${e.substring(0, 50)}`)
                      );
                    {
                      console.log(
                        `[Veo] 图片 ${t + 1} 是 Blob URL，开始转换...`,
                      );
                      const blob = await Jo(e);
                      ((o = await Vo(blob)),
                        console.log(
                          `[Veo] 图片 ${t + 1} 转换成功，大小:`,
                          (o.length / 1024 / 1024).toFixed(2),
                          "MB",
                        ));
                    }
                  }
                  return ((o = await r(o)), o);
                }
              } catch (error) {
                throw (
                  console.error(`[Veo] 图片 ${t + 1} 处理失败:`, error),
                  error
                );
              }
            }),
          )),
          console.log("[Veo] 所有首尾帧图片处理完成"))
        : Ee &&
          (console.log(
            "[Veo] 处理参考图片，数量:",
            Oe.length,
            "（最多使用3张）",
            s ? "(Fast模式-URL)" : "(标准模式-Base64)",
          ),
          (a = await Promise.all(
            Oe.slice(0, 3).map(async (e, t) => {
              console.log(
                `[Veo] 处理参考图 ${t + 1}/${Math.min(Oe.length, 3)}:`,
                e.substring(0, 100),
              );
              try {
                if (((e = await i(e)), s)) {
                  const o = await l(e);
                  if (
                    (o.startsWith("http://") || o.startsWith("https://")) &&
                    (o.includes(".jpg") ||
                      o.includes(".jpeg") ||
                      o.includes(".png") ||
                      o.includes(".webp") ||
                      o.includes(".gif"))
                  )
                    return (
                      console.log(
                        `[Veo Fast] 参考图 ${t + 1} 使用标准 HTTP URL:`,
                        o,
                      ),
                      o
                    );
                  {
                    let e;
                    if (
                      (console.log(
                        `[Veo Fast] 参考图 ${t + 1} 不是标准URL，转换为 base64`,
                      ),
                      o.startsWith("data:"))
                    )
                      e = o;
                    else {
                      if (
                        !(
                          o.startsWith("http://") ||
                          o.startsWith("https://") ||
                          o.startsWith("blob:")
                        )
                      )
                        throw new Error(
                          `不支持的图片格式: ${o.substring(0, 50)}`,
                        );
                      {
                        const blob = await Jo(o);
                        e = await Vo(blob);
                      }
                    }
                    return ((e = await r(e)), e);
                  }
                }
                {
                  let o;
                  if (e.startsWith("data:"))
                    (console.log(`[Veo] 参考图 ${t + 1} 已是 base64 格式`),
                      (o = e));
                  else if (
                    e.startsWith("http://") ||
                    e.startsWith("https://")
                  ) {
                    console.log(
                      `[Veo] 参考图 ${t + 1} 是 HTTP URL，开始下载转换...`,
                    );
                    const blob = await Jo(e);
                    ((o = await Vo(blob)),
                      console.log(
                        `[Veo] 参考图 ${t + 1} 转换成功，大小:`,
                        (o.length / 1024 / 1024).toFixed(2),
                        "MB",
                      ));
                  } else {
                    if (!e.startsWith("blob:"))
                      throw (
                        console.error(
                          `[Veo] 参考图 ${t + 1} 格式不支持:`,
                          e.substring(0, 100),
                        ),
                        new Error(`不支持的图片格式: ${e.substring(0, 50)}`)
                      );
                    {
                      console.log(
                        `[Veo] 参考图 ${t + 1} 是 Blob URL，开始转换...`,
                      );
                      const blob = await Jo(e);
                      ((o = await Vo(blob)),
                        console.log(
                          `[Veo] 参考图 ${t + 1} 转换成功，大小:`,
                          (o.length / 1024 / 1024).toFixed(2),
                          "MB",
                        ));
                    }
                  }
                  return ((o = await r(o)), o);
                }
              } catch (error) {
                throw (
                  console.error(`[Veo] 参考图 ${t + 1} 处理失败:`, error),
                  error
                );
              }
            }),
          )),
          console.log("[Veo] 所有参考图片处理完成"));
      const c = {
        model: (null == Me ? void 0 : Me.modelName) || "veo3.1-components",
        prompt: prompt,
        enhance_prompt: !1,
      };
      if (a.length > 0)
        if (
          ((c.images = a),
          console.log(
            "[Veo] 图生视频模式（通过images参数），图片数量:",
            a.length,
          ),
          console.log(
            "[Veo] 图片格式检查:",
            a.map((e, t) => ({
              index: t,
              type: e.startsWith("data:")
                ? "base64"
                : e.startsWith("http")
                  ? "http"
                  : "unknown",
              length: e.length,
              sizeMB: (e.length / 1024 / 1024).toFixed(2),
              mimeType: e.startsWith("data:")
                ? e.substring(5, e.indexOf(";"))
                : "N/A",
              preview: e.substring(0, 50),
            })),
          ),
          s)
        )
          console.log("[Veo Fast] 使用 URL 格式，跳过 base64 验证");
        else {
          const e = a.filter((e) => !e.startsWith("data:image/"));
          if (e.length > 0)
            throw (
              console.error("[Veo] ❌ 发现非base64格式的图片:", e.length),
              new Error(`图片格式错误：${e.length} 张图片不是base64格式`)
            );
          const t = a.filter((e) => e.length > 10485760);
          t.length > 0 &&
            console.warn("[Veo] ⚠️ 发现超大图片:", t.length, "张图片超过10MB");
        }
      else console.log("[Veo] 文生视频模式（无images参数）");
      e && (c.aspect_ratio = e);
      const d = Ue && "Auto" !== Ue ? Ue : "720P";
      ("1080P" === d
        ? ((c.enable_upsample = !0),
          console.log(
            "[Veo] 用户选择1080P，发送 enable_upsample: true（返回1080P视频）",
          ))
        : "4K" === d
          ? ((c.resolution = "4K"),
            console.log("[Veo] 用户选择4K，发送 resolution: 4K"))
          : console.log(
              `[Veo] 用户选择${d}，使用默认720P（不发送resolution参数）`,
            ),
        a.length > 0 &&
          console.log(
            "[Veo] 图生视频模式，分辨率由参考图自动决定" +
              ("1080P" === d ? "，enable_upsample提升到1080P" : ""),
          ));
      let u = (null == Me ? void 0 : Me.modelName) || "veo3.1-components";
      const g = t && o.length >= 1 && o.length <= 2,
        m = oe($e),
        h = "4K" === Ue || "4K" === c.resolution;
      ("1080P" === Ue || c.resolution,
        s
          ? ((u = "veo3.1-fast"),
            g
              ? console.log(
                  `[Veo] Fast首尾帧模式（${o.length}张图）+ ${Ue || "默认"}，使用 MODEL ID: ${u}`,
                )
              : a.length > 0
                ? console.log(
                    `[Veo] Fast图生视频模式（${a.length}张图），使用 MODEL ID: ${u}`,
                  )
                : console.log(`[Veo] Fast文生视频模式，使用 MODEL ID: ${u}`))
          : g
            ? m
              ? h
                ? ((u = "veo3.1-pro-4k"),
                  console.log(
                    `[Veo] Pro首尾帧模式（${o.length}张图）+ 4K，使用 MODEL ID: ${u}`,
                  ))
                : ((u = "veo3.1-pro"),
                  console.log(
                    `[Veo] Pro首尾帧模式（${o.length}张图）+ ${Ue || "默认"}，使用 MODEL ID: ${u}`,
                  ))
              : h
                ? ((u = "veo3.1-4k"),
                  console.log(
                    `[Veo] 首尾帧模式（${o.length}张图）+ 4K，使用 MODEL ID: ${u}`,
                  ))
                : ((u = "veo3.1"),
                  console.log(
                    `[Veo] 首尾帧模式（${o.length}张图）+ ${Ue || "默认"}，使用 MODEL ID: ${u}`,
                  ))
            : a.length > 0
              ? m && 1 === a.length
                ? ((u = h ? "veo3.1-pro-4k" : "veo3.1-pro"),
                  console.log(
                    `[Veo] Pro单图模式（1张图），分辨率: ${Ue || "Auto"}，使用 MODEL ID: ${u}`,
                  ))
                : ((u = h ? "veo3.1-components-4k" : "veo3.1-components"),
                  console.log(
                    `[Veo] 多图模式（${a.length}张图），分辨率: ${Ue || "Auto"}，使用 MODEL ID: ${u}`,
                  ))
              : h
                ? ((u = m ? "veo3.1-pro-4k" : "veo3.1-components-4k"),
                  console.log(`[Veo] 文生视频 + 4K，使用 MODEL ID: ${u}`))
                : ((u = m ? "veo3.1-pro" : "veo3.1-components"),
                  console.log(`[Veo] 文生视频，使用 MODEL ID: ${u}`)),
        (c.model = u),
        console.log("[Veo] 最终 Payload:", {
          model: c.model,
          prompt: c.prompt,
          resolution: c.resolution || "(图生视频-自动)",
          aspect_ratio: c.aspect_ratio,
          enhance_prompt: c.enhance_prompt,
          enable_upsample: c.enable_upsample,
          imagesCount: a.length,
          hasImages: a.length > 0,
          isFramesMode: g,
          isImageToVideo: a.length > 0,
        }),
        (payload = c));
    } else if (re($e)) {
      let t = baseUrl;
      (baseUrl.includes("t8star") &&
        (console.log(
          "[Generation] Hailuo模型检测到错误URL，自动切换到默认端点",
        ),
        (t = "https://ai.comfly.chat")),
        (endpoint = `${t}/minimax/v1/video_generation`));
      const o = {
        model: (null == Me ? void 0 : Me.modelName) || "MiniMax-Hailuo-2.3",
        prompt: prompt,
      };
      Ce && "Auto" !== Ce && (o.aspect_ratio = Ce);
      const i =
          !!(null == (A = Te.settings) ? void 0 : A.veoFramesMode) && ie($e),
        r = i ? Fe(Te.id, "veo_start") : null,
        a = i ? Fe(Te.id, "veo_end") : null;
      let s = Ue;
      (i &&
        r &&
        a &&
        "768P" !== Ue &&
        "1080P" !== Ue &&
        ((s = "768P"),
        console.log("[Hailuo] 首尾帧模式强制使用768P（原分辨率:", Ue, "）")),
        (o.duration = e),
        (o.resolution = s && "Auto" !== s ? s : "768P"),
        console.log("[Hailuo] 模式检测:", {
          model: o.model,
          currentModel: $e,
          isHailuoFramesMode: i,
          hasStartFrame: !!r,
          hasEndFrame: !!a,
          hasReferenceImage: Ee,
          refImagesCount: Oe.length,
          resolution: o.resolution,
        }));
      const l = async (e) => {
          if (!e) return null;
          if (e.startsWith("data:")) return e;
          if (e.startsWith("http")) return e;
          const blob = await Jo(e);
          return await Vo(blob);
        },
        c = await l(r),
        d = await l(a);
      if (c && d)
        (console.log("[Hailuo] 使用首尾帧模式"),
          (o.first_frame_image = c),
          (o.last_frame_image = d));
      else if (Ee && Oe.length > 0) {
        console.log("[Hailuo] 使用图生视频模式，图片数量:", Oe.length);
        const e = await l(Oe[0]);
        e
          ? (console.log("[Hailuo] 图片已解析，类型:", e.substring(0, 30)),
            (o.first_frame_image = e))
          : console.warn("[Hailuo] 图片解析失败");
      } else console.log("[Hailuo] 使用文生视频模式");
      (console.log("[Hailuo] 最终 payload:", {
        model: o.model,
        prompt: o.prompt,
        duration: o.duration,
        resolution: o.resolution,
        hasFirstFrame: !!o.first_frame_image,
        hasLastFrame: !!o.last_frame_image,
      }),
        (payload = o));
    } else if (ge($e)) {
      const t = me($e),
        o = !!(null == (P = Te.settings) ? void 0 : P.wan26MultiShot);
      ((endpoint = t
        ? `${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`
        : `${baseUrl}/v2/videos/generations`),
        console.log("[Wan 2.6] 选择 endpoint:", {
          isOfficial: t,
          enableMultiShot: o,
          endpoint: endpoint.substring(0, 100),
        }));
      const i = prompt.trim() || "生成视频",
        r = { prompt: i },
        a = null == (k = Te.settings) ? void 0 : k.wan26AudioConfig,
        s = null == (T = Te.settings) ? void 0 : T.wan26AudioFile,
        l = null == ($ = Te.settings) ? void 0 : $.wan26AudioSegment;
      if ("upload" === a && s)
        try {
          console.log("[Wan 2.6] 开始上传音频文件:", {
            name: s.name,
            size: s.size,
            type: s.type,
            segment: l,
          });
          const e = await _n(s, l || void 0, apiKey, baseUrl);
          (console.log("[Wan 2.6] 音频处理成功，URL:", e.substring(0, 100)),
            (r.audio_url = e));
        } catch (error) {
          console.error("[Wan 2.6] 音频上传失败:", error);
          const e = error instanceof Error ? error.message : String(error);
          let t = `音频上传失败: ${e}\n\n`;
          throw (
            (e.includes("CORS") || e.includes("Failed to fetch")) &&
              ((t += "可能的原因：\n"),
              (t += "1. 第三方代理服务不支持文件上传\n"),
              (t += "2. 需要配置 CORS 跨域访问\n\n"),
              (t += "建议解决方案：\n"),
              (t += "• 联系第三方代理服务商询问文件上传接口\n"),
              (t += '• 或使用"自动配音"功能\n'),
              (t += "• 或将音频文件上传到公网（如阿里云 OSS）后提供 URL")),
            new Error(t)
          );
        }
      const c = null == (M = Te.settings) ? void 0 : M.wan26Resolution;
      if (Ee && Oe.length > 0) {
        let e = Oe[0];
        console.log(
          "[Wan 2.6] 开始处理图片，原始 URL 类型:",
          e.substring(0, 50),
        );
        try {
          const t = new Image();
          t.crossOrigin = "anonymous";
          const o = new Promise((o, i) => {
              ((t.onload = () => o(t)), (t.onerror = i), (t.src = e));
            }),
            i = await o,
            r = i.width,
            a = i.height;
          console.log("[Wan 2.6] 原始图片尺寸:", { width: r, height: a });
          const s = 240,
            l = 7680;
          if (r < s || a < s || r > l || a > l) {
            console.log("[Wan 2.6] 图片尺寸超出范围，需要调整");
            let t = r,
              o = a;
            if (t < s || o < s) {
              const e = Math.max(s / t, s / o);
              ((t = Math.round(t * e)), (o = Math.round(o * e)));
            }
            if (t > l || o > l) {
              const e = Math.min(l / t, l / o);
              ((t = Math.round(t * e)), (o = Math.round(o * e)));
            }
            console.log("[Wan 2.6] 调整后图片尺寸:", { width: t, height: o });
            const c = document.createElement("canvas");
            ((c.width = t), (c.height = o));
            const d = c.getContext("2d");
            if (!d) throw new Error("无法创建 canvas context");
            (d.drawImage(i, 0, 0, t, o),
              (e = c.toDataURL("image/png")),
              console.log(
                "[Wan 2.6] 图片已调整并转换为 Base64，长度:",
                e.length,
              ));
          } else if (
            (console.log("[Wan 2.6] 图片尺寸符合要求，无需调整"),
            e.startsWith("blob:"))
          ) {
            const t = document.createElement("canvas");
            ((t.width = r), (t.height = a));
            const o = t.getContext("2d");
            if (!o) throw new Error("无法创建 canvas context");
            (o.drawImage(i, 0, 0),
              (e = t.toDataURL("image/png")),
              console.log("[Wan 2.6] Blob URL 已转换为 Base64"));
          }
        } catch (error) {
          throw (
            console.error("[Wan 2.6] 图片处理失败:", error),
            new Error("图片处理失败：无法加载或调整图片")
          );
        }
        ((r.images = [e]),
          console.log(
            "[Wan 2.6] 图生视频模式，最终图片 URL 类型:",
            e.substring(0, 50),
          ));
      }
      let d;
      const u = t;
      if (
        (console.log("[Wan 2.6] 格式选择:", {
          isOfficial: t,
          enableMultiShot: o,
          useNestedFormat: u,
          formatType: u ? "嵌套格式" : "扁平格式",
        }),
        u)
      ) {
        console.log(
          `[Wan 2.6] 使用嵌套格式 (${t ? "官方 API" : "多镜头模式"})`,
        );
        const s = { prompt: i },
          images = r.images;
        (Array.isArray(images) && images.length > 0 && (s.img_url = images[0]),
          r.audio_url && (s.audio_url = r.audio_url));
        const l = { resolution: c || "720P", prompt_extend: !0, duration: e };
        (o && (l.shot_type = "multi"),
          r.audio_url ||
            ("auto" !== a && a
              ? "none" === a && (l.audio = !1)
              : t || (l.audio = !0)));
        ((d = {
          model: t
            ? (null == Me ? void 0 : Me.modelName) || "wan2.6-i2v-flash"
            : "wan2.6-i2v",
          input: s,
          parameters: l,
        }),
          console.log("[Wan 2.6] Payload (嵌套格式):", {
            apiType: t ? "Official" : "Proxy",
            model: d.model,
            "input.prompt": s.prompt,
            "input.img_url": s.img_url
              ? String(s.img_url).substring(0, 50)
              : "(无)",
            "input.audio_url": s.audio_url
              ? String(s.audio_url).substring(0, 50)
              : "(无)",
            "parameters.resolution": l.resolution,
            "parameters.duration": l.duration,
            "parameters.durationType": typeof l.duration,
            "parameters.shot_type": l.shot_type || "(单镜头)",
          }));
      } else
        (console.log(
          `[Wan 2.6] 使用扁平格式（第三方代理${o ? " - 多镜头" : " - 单镜头"}）`,
        ),
          (d = {
            model: "wan2.6-i2v",
            prompt: i,
            resolution: c || "720P",
            prompt_extend: !0,
            duration: e,
          }),
          o && (d.shot_type = "multi"),
          r.images && (d.images = r.images),
          r.audio_url
            ? (d.audio_url = r.audio_url)
            : "auto" !== a && a
              ? "none" === a && (d.audio = !1)
              : (d.audio = !0),
          console.log("[Wan 2.6] Payload (扁平格式):", {
            model: d.model,
            prompt: d.prompt,
            duration: d.duration,
            durationType: typeof d.duration,
            shot_type: d.shot_type || "(单镜头)",
            images: d.images ? `[${d.images.length} images]` : "(无)",
            audio_url: d.audio_url
              ? String(d.audio_url).substring(0, 50)
              : "(无)",
            audio: d.audio,
            resolution: d.resolution,
          }));
      payload = d;
    } else if (de($e)) {
      const e = (null == (C = Te.settings) ? void 0 : C.duration) || H($e),
        modelName = (null == Me ? void 0 : Me.modelName) || "viduq2";
      let t = 10;
      "viduq3-pro" === modelName || "vidu-q3-pro" === $e
        ? (t = 16)
        : ("vidu2.0" !== modelName && "vidu-2.0" !== $e) || (t = 8);
      const o = Math.min(t, Math.max(1, parseInt(e.replace("s", ""), 10) || 5)),
        i = (null == (U = Te.settings) ? void 0 : U.resolution) || "720p",
        r = Ce && "Auto" !== Ce ? Ce : "16:9",
        a = !!(null == (O = Te.settings) ? void 0 : O.veoFramesMode) && ie($e),
        s = [
          a ? Fe(Te.id, "veo_start") : null,
          a ? Fe(Te.id, "veo_end") : null,
        ].filter(Boolean);
      if (a && 2 === s.length) {
        endpoint = `${baseUrl}/vidu/v2/start-end2video`;
        const [e, t] = await Promise.all(s.map((e) => Ye(e)));
        ((payload = {
          model: modelName,
          images: [e, t],
          duration: o,
          seed: 0,
          resolution: i,
          movement_amplitude: "auto",
          off_peak: !1,
          ...((null == prompt ? void 0 : prompt.trim())
            ? { prompt: prompt.trim() }
            : {}),
        }),
          console.log("[Vidu] 首尾帧模式 start-end2video"));
      } else if (Ee && Oe.length > 0) {
        const e = await Promise.all(Oe.slice(0, 7).map((e) => Ye(e)));
        1 === Oe.length
          ? ((endpoint = `${baseUrl}/vidu/v2/img2video`),
            (payload = {
              model: modelName,
              images: e,
              duration: o,
              seed: 0,
              resolution: i,
              movement_amplitude: "auto",
              off_peak: !1,
              ...((null == prompt ? void 0 : prompt.trim())
                ? { prompt: prompt.trim() }
                : {}),
            }),
            console.log("[Vidu] 图生视频 img2video"))
          : ((endpoint = `${baseUrl}/vidu/v2/reference2video`),
            (payload = {
              model: modelName,
              prompt: (null == prompt ? void 0 : prompt.trim()) || "生成视频",
              images: e,
              duration: o,
              seed: 0,
              aspect_ratio: r,
              resolution: i,
              movement_amplitude: "auto",
              off_peak: !1,
            }),
            console.log("[Vidu] 参考图 reference2video, 图片数:", e.length));
      } else {
        ((endpoint = `${baseUrl}/vidu/v2/text2video`),
          (payload = {
            model: modelName,
            prompt: (null == prompt ? void 0 : prompt.trim()) || "生成视频",
            duration: o,
            seed: 0,
            aspect_ratio: r,
            resolution: i,
            movement_amplitude: "auto",
            off_peak: !1,
          }));
        ([
          "viduq2",
          "vidu2.0",
          "viduq2-pro",
          "viduq2-turbo",
          "viduq2-pro-fast",
          "viduq3-pro",
        ].includes(modelName) || (payload.style = "general"),
          console.log(
            "[Vidu] 文生视频 text2video, duration:",
            o,
            "model:",
            modelName,
          ));
      }
      console.log("[Vidu] 请求参数:", {
        model: modelName,
        duration: o,
        maxDuration: t,
        originalDuration: e,
        resolution: i,
        aspectRatio: r,
      });
    } else if (ue($e)) {
      const e = (null == (E = Te.settings) ? void 0 : E.mjMode) || "fast",
        t = (null == (L = Te.settings) ? void 0 : L.mjMotion) || "low";
      endpoint = `${baseUrl}/${e}/mj/submit/video`;
      const o = { prompt: prompt.trim(), motion: t, image: "" };
      if (Ee && Oe.length > 0) {
        const e = Oe[0],
          t = await Ze(e);
        ((o.image = t), console.log("[MJ Video] 图生视频，已添加首帧图片"));
      }
      ((payload = o),
        console.log("[MJ Video] 请求参数:", {
          endpoint: endpoint,
          mode: e,
          motion: t,
          hasImage: !!o.image,
          promptPreview: prompt.substring(0, 100),
        }));
    } else {
      const t = baseUrl.includes("api.openai.com"),
        o = "Auto" === Ce ? "16:9" : Ce,
        i = "16:9" === o || "9:16" === o ? o : "16:9",
        r =
          "sora-2-pro" === $e &&
          !!(null == (R = Te.settings) ? void 0 : R.isHD);
      if (t) {
        ((endpoint = `${baseUrl}/videos`), (et = !0));
        const t = "9:16" === i,
          o = r ? (t ? "1080x1920" : "1920x1080") : t ? "720x1280" : "1280x720",
          formData = new FormData();
        if (
          (formData.append(
            "model",
            (null == Me ? void 0 : Me.modelName) || "sora-2",
          ),
          formData.append("prompt", prompt),
          formData.append("size", o),
          formData.append("seconds", String(e)),
          r && formData.append("quality", "hd"),
          Ee)
        ) {
          (await Promise.all(Oe.slice(0, 1).map((url) => qe(url)))).forEach(
            (blob) => {
              (formData.append("input_reference", blob, "ref.png"),
                formData.append("image", blob, "ref.png"));
            },
          );
        }
        payload = formData;
      } else {
        ((endpoint = `${baseUrl}/v2/videos/generations`), (et = !1));
        const t = String(e),
          o = {
            model: (null == Me ? void 0 : Me.modelName) || "sora-2",
            prompt: prompt,
            aspect_ratio: i,
            duration: t,
          };
        if (
          (prompt.length > 5e3 &&
            console.warn(
              "[Sora] ⚠️ 提示词过长:",
              prompt.length,
              "字符，可能超出 API 限制",
            ),
          console.log("[Sora] 📝 Payload 详情:", {
            model: o.model,
            promptLength: prompt.length,
            promptPreview: prompt.substring(0, 100) + "...",
            aspect_ratio: i,
            duration: t,
            endpoint: endpoint,
          }),
          r && (o.hd = !0),
          null == (N = Te.settings) ? void 0 : N.characterId)
        ) {
          const e = Te.settings.characterId;
          ((o.character = e),
            console.log("[Sora2] 使用角色客串 (character字段):", e),
            console.log("[Sora2] Payload:", o));
        }
        if (Ee) {
          const e = await Promise.all(
            Oe.slice(0, 1).map(async (e) => await Ze(e)),
          );
          ((o.images = e), console.log("[Sora] 图生视频，已添加图片数据"));
        }
        payload = o;
      }
    }
  } else if (Ne) {
    const e = "Auto" !== Ce && Ce ? Ce : "Auto",
      t = "1K" === Ue ? "1k" : "4K" === Ue ? "4k" : "2k",
      o = ("2k" !== t && "4k" !== t) || "Auto" !== e ? e : "1:1";
    if (Ee) {
      endpoint = `${baseUrl}/v1/images/compositions`;
      const e = await Promise.all(
        Oe.map(async (e) => {
          if (e.startsWith("data:")) return e;
          if (e.startsWith("http://") || e.startsWith("https://")) return e;
          const blob = await Jo(e);
          return await Vo(blob);
        }),
      );
      ((payload = {
        model: (null == Me ? void 0 : Me.modelName) || $e,
        prompt: prompt.trim(),
        images: e,
        ratio: o,
        resolution: t,
        response_format: "url",
      }),
        console.log("[Jimeng] 图生图，已添加", e.length, "张图片"));
    } else
      ((endpoint = `${baseUrl}/v1/images/generations`),
        (payload = {
          model: (null == Me ? void 0 : Me.modelName) || $e,
          prompt: prompt.trim(),
          ratio: o,
          resolution: t,
          response_format: "url",
        }));
  } else if ($e.includes("gpt-image") || $e.includes("gpt-4o-image")) {
    const e = (null == (D = Te.settings) ? void 0 : D.useAsyncMode) ?? !0,
      t = e ? "?async=true" : "";
    console.log(`[GPT Image] 使用${e ? "异步" : "同步"}模式`);
    const o = (e) =>
        ({
          "1:1": "1024x1024",
          "16:9": "1792x1024",
          "21:9": "1792x1024",
          "4:3": "1536x1024",
          "3:2": "1536x1024",
          "9:16": "1024x1792",
          "3:4": "1024x1536",
          "2:3": "1024x1536",
          Auto: "1024x1024",
        })[e] || "1024x1024",
      i =
        (null == (F = Te.settings) ? void 0 : F.gptImageQuality) || "standard";
    if (Ee) {
      ((endpoint = `${baseUrl}/v1/images/edits${t}`), (et = !0));
      const formData = new FormData();
      (formData.append("model", (null == Me ? void 0 : Me.modelName) || $e),
        formData.append("prompt", prompt),
        formData.append("n", "1"),
        formData.append("response_format", "url"));
      const size = o(Ce);
      (formData.append("size", size), formData.append("quality", i));
      const e = await Promise.all(Oe.map((url) => qe(url)));
      if (
        ((He
          ? e
          : await Promise.all(
              e.map(async (blob) => {
                try {
                  const { makeImageSquare: e } = await x(
                    async () => {
                      const { makeImageSquare: e } =
                        await import("./markerMask-TdRVtYG7.js");
                      return { makeImageSquare: e };
                    },
                    [],
                    import.meta.url,
                  );
                  return await e(blob);
                } catch (error) {
                  return (
                    console.warn(
                      "[Generation] 转换正方形失败，使用原图:",
                      error,
                    ),
                    blob
                  );
                }
              }),
            )
        ).forEach((blob, e) =>
          formData.append("image", blob, `input_${e}.png`),
        ),
        Ke && Ke.length > 0)
      )
        try {
          const { base64ToBlob: e } = await x(
              async () => {
                const { base64ToBlob: e } =
                  await import("./markerMask-TdRVtYG7.js");
                return { base64ToBlob: e };
              },
              [],
              import.meta.url,
            ),
            t = Ke[0],
            o = e(t.mask, "image/png");
          (formData.append("mask", o, "mask.png"),
            console.log(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            ),
            console.log("[Generation] ✅ 已添加标记蒙版到 GPT Image 请求"),
            console.log("[Generation] 📊 蒙版信息:", {
              尺寸: `${t.width}×${t.height}`,
              文件大小: `${(o.size / 1024).toFixed(2)} KB`,
              标记数量: t.markerCount || 0,
            }),
            console.log(
              "[Generation] 🖼️ 蒙版预览（复制下面完整链接到浏览器地址栏查看）:",
            ),
            console.log(
              `%cdata:image/png;base64,${t.mask}`,
              "color: #60a5fa; font-weight: bold;",
            ),
            console.log(
              "[Generation] 💡 提示：白色区域 = AI 将修改的位置，黑色区域 = AI 将保持不变",
            ),
            console.log(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            ));
        } catch (error) {
          console.error("[Generation] ❌ 添加蒙版失败:", error);
        }
      payload = formData;
    } else {
      endpoint = `${baseUrl}/v1/images/generations${t}`;
      const size = o(Ce);
      payload = {
        model: (null == Me ? void 0 : Me.modelName) || $e,
        prompt: prompt,
        n: 1,
        size: size,
        quality: i,
        response_format: "url",
      };
    }
  } else if ($e.includes("flux-kontext")) {
    ((endpoint = `${baseUrl}/v1/images/edits`), (et = !0));
    const formData = new FormData();
    if (
      (formData.append(
        "model",
        (null == Me ? void 0 : Me.modelName) || "flux-kontext-pro",
      ),
      formData.append("prompt", prompt),
      "Auto" !== Ce && formData.append("aspect_ratio", Ce),
      Ee)
    ) {
      (await Promise.all(Oe.map((url) => qe(url)))).forEach((blob, e) =>
        formData.append("image", blob, `flux_ref_${e}.png`),
      );
    }
    payload = formData;
  } else if ($e.includes("grok-4.1-image") || $e.includes("grok-4.2-image")) {
    ((endpoint = `${baseUrl}/v1/chat/completions`), (et = !1));
    const e =
        Ce && "Auto" !== Ce
          ? Ee
            ? `\n\n请忽略参考图原始比例，按 ${Ce} 比例输出图片。`
            : `\n\n请生成比例为 ${Ce} 的图片。`
          : "",
      t = Ue && "Auto" !== Ue ? `\n\n请生成 ${Ue} 分辨率的图片。` : "",
      o = (prompt.trim() || (Ee ? "参考上图修改" : "")).concat(e).concat(t);
    let messages;
    if (Ee && Oe.length > 0) {
      const e = [{ type: "text", text: o }],
        t = await Promise.all(
          Oe.slice(0, 4).map(async (e) => {
            if (e.startsWith("http://") || e.startsWith("https://")) return e;
            if (e.startsWith("data:")) return e;
            const blob = await Jo(e);
            return await Vo(blob);
          }),
        );
      (t.forEach((url) =>
        e.push({ type: "image_url", image_url: { url: url } }),
      ),
        (messages = [{ role: "user", content: e }]),
        console.log(
          "[Grok Image] 图生图 Chat(修改图片)，参考图数:",
          t.length,
          "Auto" !== Ce ? "提示词已追加比例" : "",
        ));
    } else messages = [{ role: "user", content: o }];
    ((payload = {
      model: (null == Me ? void 0 : Me.modelName) || $e,
      messages: messages,
      stream: !1,
      ...("Auto" !== Ce ? { aspect_ratio: Ce } : {}),
      ...(Ue && "Auto" !== Ue ? { resolution: Ue.toLowerCase() } : {}),
    }),
      console.log(
        "[Grok Image] Chat Completions，endpoint:",
        endpoint,
        "aspect_ratio:",
        "Auto" !== Ce ? Ce : "(auto)",
        "resolution:",
        Ue && "Auto" !== Ue ? Ue.toLowerCase() : "(auto)",
        "payload.resolution:",
        payload.resolution,
      ));
  } else if ($e.includes("z-image-turbo") || $e.includes("z-image-official")) {
    if (pe($e)) {
      ((endpoint = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`),
        console.log("[Z-Image Official] ========== DEBUG INFO =========="),
        console.log(
          "[Z-Image Official] window.location.hostname:",
          window.location.hostname,
        ),
        console.log(
          "[Z-Image Official] window.location.protocol:",
          window.location.protocol,
        ),
        console.log(
          "[Z-Image Official] window.location.href:",
          window.location.href,
        ),
        console.log("[Z-Image Official] baseUrl:", baseUrl),
        console.log("[Z-Image Official] endpoint:", endpoint),
        console.log(
          "[Z-Image Official] isTauriEnvironment:",
          "undefined" != typeof window && "__TAURI__" in window,
        ),
        console.log(
          "[Z-Image Official] ========================================",
        ));
      let size = "1024*1024";
      ((size =
        "1:1" === Ce
          ? "1024*1024"
          : "16:9" === Ce
            ? "1280*720"
            : "9:16" === Ce
              ? "720*1280"
              : "4:3" === Ce
                ? "1152*864"
                : "3:4" === Ce
                  ? "864*1152"
                  : "3:2" === Ce
                    ? "1248*832"
                    : "2:3" === Ce
                      ? "832*1248"
                      : "21:9" === Ce
                        ? "1344*576"
                        : "9:21" === Ce
                          ? "576*1344"
                          : "7:9" === Ce
                            ? "896*1152"
                            : "9:7" === Ce
                              ? "1152*896"
                              : "1024*1024"),
        ("2K" !== Ue && "4K" !== Ue) ||
          ("1:1" === Ce
            ? (size = "1280*1280")
            : "16:9" === Ce
              ? (size = "1536*864")
              : "9:16" === Ce
                ? (size = "864*1536")
                : "4:3" === Ce
                  ? (size = "1472*1104")
                  : "3:4" === Ce
                    ? (size = "1104*1472")
                    : "3:2" === Ce
                      ? (size = "1536*1024")
                      : "2:3" === Ce
                        ? (size = "1024*1536")
                        : "21:9" === Ce
                          ? (size = "1680*720")
                          : "9:21" === Ce
                            ? (size = "720*1680")
                            : "7:9" === Ce
                              ? (size = "1120*1440")
                              : "9:7" === Ce && (size = "1440*1120")),
        (payload = {
          model: "z-image-turbo",
          input: { messages: [{ role: "user", content: [{ text: prompt }] }] },
          parameters: { prompt_extend: !1, size: size },
        }),
        console.log("[Z-Image Official] 通义官方 API Payload:", payload));
    } else {
      const e = (null == (W = Te.settings) ? void 0 : W.useAsyncMode) ?? !0;
      ((endpoint = `${baseUrl}/v1/images/generations${e ? "?async=true" : ""}`),
        console.log(`[Z-Image Turbo Proxy] 使用${e ? "异步" : "同步"}模式`),
        (payload = {
          model: (null == Me ? void 0 : Me.modelName) || "z-image-turbo",
          prompt: prompt,
          response_format: "url",
          ...("Auto" !== Ce ? { aspect_ratio: Ce } : {}),
        }),
        console.log("[Z-Image Turbo Proxy] 第三方代理 API Payload:", payload));
    }
  } else if (he($e)) {
    let e = (null == (z = Te.settings) ? void 0 : z.enableInterleave) ?? !1;
    e ||
      Ee ||
      ((e = !0),
      console.warn(
        "[Wan 2.6 Image] ⚠️ 图像编辑模式需要参考图片，已自动切换到图文混排模式（纯文生图）",
      ));
    let size = "1280*1280";
    size =
      "1:1" === Ce
        ? "1280*1280"
        : "16:9" === Ce
          ? "1280*720"
          : "9:16" === Ce
            ? "720*1280"
            : "4:3" === Ce
              ? "1280*960"
              : "3:4" === Ce
                ? "960*1280"
                : "3:2" === Ce
                  ? "1200*800"
                  : "2:3" === Ce
                    ? "800*1200"
                    : "21:9" === Ce
                      ? "1344*576"
                      : "1280*1280";
    const content = [{ text: prompt }];
    if (Ee) {
      const t = e ? 1 : 4,
        o = Oe.slice(0, t);
      for (const e of o)
        if (e.startsWith("data:")) content.push({ image: e });
        else if (e.startsWith("http://") || e.startsWith("https://"))
          content.push({ image: e });
        else {
          const blob = await Jo(e),
            base64 = await Vo(blob);
          content.push({ image: base64 });
        }
    }
    const t = { size: size, enable_interleave: e, watermark: !1 };
    e
      ? ((t.n = 1),
        (t.max_images =
          (null == (K = Te.settings) ? void 0 : K.maxImages) ?? 5))
      : ((t.prompt_extend =
          (null == (B = Te.settings) ? void 0 : B.promptExtend) ?? !0),
        (t.n = (null == (G = Te.settings) ? void 0 : G.imageCount) ?? 4));
    const negativePrompt =
      (null == (we = Te.settings) ? void 0 : we.negativePrompt) || "";
    negativePrompt && (t.negative_prompt = negativePrompt);
    const o = null == (ye = Te.settings) ? void 0 : ye.seed;
    null != o && (t.seed = o);
    const i = e && ((null == (ve = Te.settings) ? void 0 : ve.useStream) ?? !1),
      r = (null == (be = Te.settings) ? void 0 : be.useAsyncMode) ?? !0;
    let a = prompt;
    const s = null == (_e = Te.settings) ? void 0 : _e.audioUrl,
      l = null == (Ie = Te.settings) ? void 0 : Ie.audioDescription;
    if (s || l) {
      const e = l || "根据上传的音频风格生成";
      ((a = `${prompt}\n\n【音频参考】${e}`),
        console.log("[Wan 2.6 Image Official] 添加音频参考到提示词:", e));
    }
    const c = [{ text: a }, ...content.slice(1)];
    (e
      ? i
        ? ((endpoint = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`),
          (t.stream = !0))
        : (endpoint = `${baseUrl}/api/v1/services/aigc/image-generation/generation`)
      : (endpoint = r
          ? `${baseUrl}/api/v1/services/aigc/image-generation/generation`
          : `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`),
      (payload = {
        model: "wan2.6-image",
        input: { messages: [{ role: "user", content: c }] },
        parameters: t,
      }),
      console.log("[Wan 2.6 Image Official] 通义官方 API Payload:", payload),
      console.log(
        "[Wan 2.6 Image Official] 模式:",
        e ? "图文混排" : "图像编辑",
        "流式:",
        i,
      ));
  } else if (fe($e)) {
    const modelName =
      (null == Me ? void 0 : Me.modelName) || "gemini-3.1-flash-image-preview";
    endpoint = `${baseUrl.replace(/\/+$/, "")}/v1beta/models/${modelName}:generateContent`;
    const parts = [{ text: prompt }];
    if (Ee && Oe.length > 0) {
      const e = 14,
        t = Oe.slice(0, e),
        o = await Promise.all(
          t.map(async (e) => {
            const blob = await qe(e),
              t = await Vo(blob),
              o = t.indexOf(","),
              i = o >= 0 ? t.slice(o + 1).trim() : t;
            let mimeType = "image/png";
            if (t.startsWith("data:")) {
              const e = t.match(/data:([^;]+)/);
              e && (mimeType = e[1]);
            }
            return { inline_data: { mime_type: mimeType, data: i } };
          }),
        );
      (parts.push(...o),
        console.log(
          "[Gemini Image Official] 图生图，已添加",
          o.length,
          "张参考图",
        ));
    }
    const e = "Auto" === Ce ? "1:1" : Ce,
      t = ((e) =>
        "4K" === e
          ? "4K"
          : "2K" === e
            ? "2K"
            : "1K" === e
              ? "1K"
              : "512px" === e
                ? "512"
                : "2K")(Ue),
      generationConfig = {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig:
          "gemini-2.5-flash-image-official" === $e
            ? { aspectRatio: e }
            : { aspectRatio: e, imageSize: t },
      };
    ((payload = {
      contents: [{ role: "user", parts: parts }],
      generationConfig: generationConfig,
    }),
      console.log(
        "[Gemini Image Official] 官方 API Payload (generationConfig):",
        generationConfig,
        "| resolution:",
        Ue,
        "-> imageSize:",
        t,
      ));
  } else if (te($e)) {
    const e =
      !!(modelId = $e) &&
      modelId.startsWith("seedream-") &&
      modelId.endsWith("-api");
    let t;
    if ("Auto" === Ce || "1:1" === Ce)
      t = "1K" === Ue ? "1K" : "4K" === Ue ? "4K" : "2K";
    else {
      const e = {
        "16:9": [2560, 1440],
        "9:16": [1440, 2560],
        "4:3": [2048, 1536],
        "3:4": [1536, 2048],
        "3:2": [2400, 1600],
        "2:3": [1600, 2400],
        "21:9": [2560, 1097],
        "9:21": [1097, 2560],
      };
      let o = e;
      "4K" === Ue
        ? (o = {
            "16:9": [3840, 2160],
            "9:16": [2160, 3840],
            "4:3": [3072, 2304],
            "3:4": [2304, 3072],
            "3:2": [3600, 2400],
            "2:3": [2400, 3600],
            "21:9": [3840, 1646],
            "9:21": [1646, 3840],
            "1:1": [4096, 4096],
          })
        : "1K" === Ue &&
          (o = {
            "16:9": [1280, 720],
            "9:16": [720, 1280],
            "4:3": [1024, 768],
            "3:4": [768, 1024],
            "3:2": [1200, 800],
            "2:3": [800, 1200],
            "21:9": [1280, 549],
            "9:21": [549, 1280],
            "1:1": [1024, 1024],
          });
      const i = o[Ce] || e[Ce] || [2048, 2048];
      ((t = `${i[0]}x${i[1]}`),
        console.log(`[Seedream] 比例 ${Ce}，分辨率 ${Ue}，计算尺寸: ${t}`));
    }
    endpoint = e
      ? `${baseUrl.replace(/\/+$/, "")}/v1/images/generations`
      : `${baseUrl.replace(/\/+$/, "")}/api/v3/images/generations`;
    const o = {
      model: (null == Me ? void 0 : Me.modelName) || $e.replace(/-api$/, ""),
      prompt: prompt.trim(),
      size: t,
      sequential_image_generation: "disabled",
      response_format: "b64_json",
      watermark: !1,
    };
    if (Ee && Oe.length > 0) {
      const e = 14,
        t = Oe.slice(0, e),
        i = await Promise.all(
          t.map(async (e) => {
            if (e.startsWith("data:")) return e;
            const blob = await Jo(e);
            return await Vo(blob);
          }),
        );
      ((o.image = 1 === i.length ? i[0] : i),
        console.log("[Seedream] 图生图，已添加", i.length, "张参考图"));
    }
    ((payload = o),
      console.log(
        `[Seedream${e ? " API" : ""}] ${e ? "第三方" : "方舟图片"} API Payload:`,
        { ...payload, image: payload.image ? "(已设置)" : void 0 },
      ));
  } else if (De) {
    const e = (null == (Se = Te.settings) ? void 0 : Se.useAsyncMode) ?? !0,
      t = e ? "?async=true" : "";
    console.log(`[Nano Banana 2] 使用${e ? "异步" : "同步"}模式`);
    const o = "gemini-3.1-flash-image-preview" === $e,
      i =
        o && "512px" === Ue
          ? "512px"
          : "1K" === Ue
            ? "1K"
            : "4K" === Ue
              ? "4K"
              : "2K",
      r = o
        ? "512px" === Ue
          ? "gemini-3.1-flash-image-preview-512px"
          : "2K" === Ue
            ? "gemini-3.1-flash-image-preview-2k"
            : "4K" === Ue
              ? "gemini-3.1-flash-image-preview-4k"
              : "gemini-3.1-flash-image-preview"
        : (null == Me ? void 0 : Me.modelName) || "nano-banana-2";
    if (Ee) {
      ((endpoint = `${baseUrl}/v1/images/edits${t}`), (et = !0));
      const formData = new FormData();
      if (
        (formData.append("model", r),
        formData.append("prompt", prompt),
        formData.append("response_format", "url"),
        formData.append("image_size", i),
        "Auto" !== Ce &&
          (formData.append("aspect_ratio", Ce),
          ("8:1" !== Ce && "1:8" !== Ce) ||
            console.log("[Nano Banana 2] 发送 aspect_ratio:", Ce)),
        Be)
      ) {
        const { rotation: e, tilt: t, scale: o } = Be,
          i = Be.sceneMode,
          r = Be.needsControlNetReduction || !1;
        if (0 === e && 0 === t && 1 === o)
          console.log(
            "[Generation] 📸 导演相机模式：角度为默认值，使用默认重绘强度",
          );
        else {
          let a = 0.78;
          if (
            ((a = ln(i, a)),
            formData.append("denoising_strength", String(a)),
            r && "architecture" === i)
          ) {
            const e = cn();
            (console.log(
              "[Generation] 🔧 建筑模式：ControlNet 权重降低至",
              e.toFixed(2),
            ),
              console.log(
                "[Generation] 💡 提示：如果 API 支持 ControlNet 参数，请取消上述注释",
              ));
          }
          (console.log(
            "[Generation] 📸 导演相机模式：角度已变化，重绘强度提升至",
            a,
          ),
            console.log("[Generation] 场景模式:", i || "character"),
            console.log("[Generation] 角度参数:", {
              rotation: e,
              tilt: t,
              scale: o,
            }),
            console.log("[Generation] ⚠️ 重要：重绘强度已提升，允许空间重组"));
        }
      }
      if (
        ((await Promise.all(Oe.map((url) => qe(url)))).forEach((blob, e) =>
          formData.append("image", blob, `input_${e}.png`),
        ),
        Ke && Ke.length > 0)
      )
        try {
          const { base64ToBlob: e } = await x(
              async () => {
                const { base64ToBlob: e } =
                  await import("./markerMask-TdRVtYG7.js");
                return { base64ToBlob: e };
              },
              [],
              import.meta.url,
            ),
            t = Ke[0],
            o = e(t.mask, "image/png");
          (formData.append("mask", o, "mask.png"),
            console.log(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            ),
            console.log("[Generation] ✅ 已添加标记蒙版到 Nano Banana 2 请求"),
            console.log("[Generation] 📊 蒙版信息:", {
              尺寸: `${t.width}×${t.height}`,
              文件大小: `${(o.size / 1024).toFixed(2)} KB`,
              标记数量: t.markerCount || 0,
            }),
            console.log(
              "[Generation] 🖼️ 蒙版预览（复制下面完整链接到浏览器地址栏查看）:",
            ),
            console.log(
              `%cdata:image/png;base64,${t.mask}`,
              "color: #60a5fa; font-weight: bold;",
            ),
            console.log(
              "[Generation] 💡 提示：白色区域 = AI 将修改的位置，黑色区域 = AI 将保持不变",
            ),
            console.log(
              "[Generation] ⚠️ 注意：如果 AI 没有按照蒙版修改，可能是 API 不支持 mask 参数",
            ),
            console.log(
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            ));
        } catch (error) {
          console.error("[Generation] ❌ 添加蒙版失败:", error);
        }
      payload = formData;
    } else
      ((endpoint = `${baseUrl}/v1/images/generations${t}`),
        (payload = {
          model: r,
          prompt: prompt,
          response_format: "url",
          image_size: i,
          ...("Auto" !== Ce ? { aspect_ratio: Ce } : {}),
        }),
        "Auto" === Ce ||
          ("8:1" !== Ce && "1:8" !== Ce) ||
          console.log("[Nano Banana 2] 文生图 发送 aspect_ratio:", Ce),
        Ge &&
          "object" == typeof payload &&
          null !== payload &&
          (Object.assign(payload, Ge),
          console.log(
            "[Generation] Added storyboard JSON data to payload:",
            Ge,
          )));
  } else if (Re) {
    const e = (null == (je = Te.settings) ? void 0 : je.mjMode) || "fast",
      t = (null == (Ae = Te.settings) ? void 0 : Ae.mjVersion) || "--v 7",
      o = Fe(Te.id, "oref"),
      i = Fe(Te.id, "sref"),
      r = [],
      a = new Map();
    let s = o || "",
      l = i || "";
    const c = [];
    (s &&
      !s.startsWith("http") &&
      (r.push(s), a.set("oref", r.length - 1), (s = "")),
      l &&
        !l.startsWith("http") &&
        (r.push(l), a.set("sref", r.length - 1), (l = "")));
    const d = Oe.filter((e) => e !== o && e !== i);
    for (const m of d)
      m.startsWith("http")
        ? c.push(m)
        : (r.push(m), a.set(`default_${c.length}`, r.length - 1), c.push(null));
    if (r.length > 0)
      try {
        We((e) =>
          e.map((e) =>
            e.id === taskId ? { ...e, progress: 2, status: "generating" } : e,
          ),
        );
        const e = `${baseUrl}/mj/submit/upload-discord-images`,
          t = await Promise.all(
            r.map(async (e) => {
              if (e.startsWith("blob:")) {
                const blob = await fetch(e).then((e) => e.blob());
                return await Vo(blob);
              }
              return e;
            }),
          ),
          o = await fetch(e, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ base64Array: t }),
          });
        if (!o.ok) {
          const e = await o.text();
          throw new Error(`图片上传失败: ${o.status} - ${e}`);
        }
        const i = await o.json();
        if (1 !== i.code || !i.result || !Array.isArray(i.result))
          throw new Error(i.description || "上传返回格式错误");
        {
          const e = i.result;
          (a.has("oref") && (s = e[a.get("oref")]),
            a.has("sref") && (l = e[a.get("sref")]));
          for (let t = 0; t < c.length; t++)
            null === c[t] &&
              a.has(`default_${t}`) &&
              (c[t] = e[a.get(`default_${t}`)]);
        }
      } catch (ot) {
        return (
          We((e) =>
            e.map((e) =>
              e.id === taskId
                ? {
                    ...e,
                    status: "failed",
                    progress: 0,
                    errorMsg: `图片上传失败: ${ot.message}`,
                  }
                : e,
            ),
          ),
          ze(Te.id, {
            isGenerating: !1,
            errorMsg: `图片上传失败: ${ot.message}`,
            settings: {
              ...Te.settings,
              isGenerating: !1,
              progress: 0,
              error: `图片上传失败: ${ot.message}`,
            },
          }),
          null
        );
      }
    const u = c.filter((url) => null !== url);
    let g = u.length > 0 ? u.join(" ") + " " : "";
    if (
      ((g += prompt.trim()),
      g.includes("--v ") || g.includes("--niji ") || (g = `${g} ${t}`.trim()),
      "Auto" === Ce || g.includes("--ar ") || (g = `${g} --ar ${Ce}`.trim()),
      s && !g.includes("--oref "))
    ) {
      g = `${g} --oref ${s}`.trim();
      const e = null == (Pe = Te.settings) ? void 0 : Pe.mjOw;
      e && e > 0 && (g = `${g} --ow ${Math.min(1e3, Math.max(1, e))}`.trim());
    }
    if (l && !g.includes("--sref ")) {
      g = `${g} --sref ${l}`.trim();
      const e = null == (xe = Te.settings) ? void 0 : xe.mjSw;
      e && e > 0 && (g = `${g} --sw ${Math.min(1e3, Math.max(1, e))}`.trim());
    }
    ((endpoint = `${baseUrl}/${e}/mj/submit/imagine`),
      (payload = { prompt: g.trim(), base64Array: [] }));
  } else {
    const e =
        ($e.includes("banana") || $e.includes("edit") || $e.includes("qwen")) &&
        !$e.includes("nano-banana-2") &&
        !$e.includes("gemini-3.1-flash-image-preview"),
      t = (null == (ke = Te.settings) ? void 0 : ke.useAsyncMode) ?? !0,
      o = t ? "?async=true" : "";
    if (
      (console.log(`[Nano Banana] 使用${t ? "异步" : "同步"}模式`), Ee && e)
    ) {
      ((endpoint = `${baseUrl}/v1/images/edits${o}`), (et = !0));
      const formData = new FormData();
      if (
        (formData.append(
          "model",
          (null == Me ? void 0 : Me.modelName) || "nano-banana",
        ),
        formData.append("prompt", prompt || "enhance"),
        formData.append("n", "1"),
        formData.append("response_format", "url"),
        "Auto" !== Ce && formData.append("aspect_ratio", Ce),
        Be)
      ) {
        const { rotation: e, tilt: t, scale: o } = Be,
          i = Be.sceneMode,
          r = Be.needsControlNetReduction || !1;
        if (!(0 === e && 0 === t && 1 === o)) {
          let a = 0.78;
          if (
            ((a = ln(i, a)),
            formData.append("denoising_strength", String(a)),
            r && "architecture" === i)
          ) {
            const e = cn();
            console.log(
              "[Generation] 🔧 建筑模式：ControlNet 权重降低至",
              e.toFixed(2),
            );
          }
          (console.log(
            "[Generation] 📸 导演相机模式：角度已变化，重绘强度提升至",
            a,
          ),
            console.log("[Generation] 场景模式:", i || "character"),
            console.log("[Generation] 角度参数:", {
              rotation: e,
              tilt: t,
              scale: o,
            }),
            console.log("[Generation] ⚠️ 重要：重绘强度已提升，允许空间重组"));
        }
      }
      ((await Promise.all(Oe.map((url) => qe(url)))).forEach((blob, e) =>
        formData.append("image", blob, `input_${e}.png`),
      ),
        (payload = formData));
    } else
      ((endpoint = `${baseUrl}/v1/images/generations${o}`),
        (payload = {
          model: (null == Me ? void 0 : Me.modelName) || $e,
          prompt: prompt,
          response_format: "url",
          ...("Auto" !== Ce ? { aspect_ratio: Ce } : {}),
        }),
        Ge &&
          "object" == typeof payload &&
          null !== payload &&
          (Object.assign(payload, Ge),
          console.log(
            "[Generation] Added storyboard JSON data to payload:",
            Ge,
          )));
  }
  var modelId;
  return (
    Be &&
      (et && payload instanceof FormData
        ? payload.append("angle_parameters", JSON.stringify(Be))
        : "object" == typeof payload &&
          null !== payload &&
          (payload.angle_parameters = Be),
      console.log("[Generation] Added angle_parameters to payload:", Be)),
    { endpoint: endpoint, payload: payload, useMultipart: et }
  );
}
function fi(e, t, o) {
  return t
    .filter((t) => t.from === e)
    .map((e) => o.find((n) => n.id === e.to))
    .filter((n) => "preview" === (null == n ? void 0 : n.type))
    .map((n) => n.id);
}
async function wi(e, content, t, o, i, r) {
  if (e) {
    console.log("[updateConnectedPreview] 开始更新预览节点:", {
      previewId: e,
      content: null == content ? void 0 : content.substring(0, 100),
      previewType: t,
      extraProps: i,
    });
    try {
      let a,
        s = content;
      if (
        content &&
        (content.startsWith("http://") || content.startsWith("https://"))
      ) {
        const t = `preview_${e}_${Date.now()}`;
        ((s = await po(content, t, 0, { usePreviewQuality: !0 })), (a = t));
      } else
        content &&
          (content.startsWith("blob:") || content.startsWith("data:")) &&
          (null == i ? void 0 : i.contentAssetId) &&
          (a = i.contentAssetId);
      let l,
        c = null == i ? void 0 : i.previewMjImages;
      if (
        (console.log(
          "[updateConnectedPreview] 多图数量:",
          (null == c ? void 0 : c.length) || 0,
        ),
        (null == i ? void 0 : i.previewMjAssetIds) &&
          i.previewMjAssetIds.length > 0 &&
          c &&
          c.length === i.previewMjAssetIds.length)
      )
        l = i.previewMjAssetIds;
      else if (c && c.length > 0) {
        console.log("[updateConnectedPreview] 开始下载多图/多视频:", c);
        const t = c.map(async (url, t) => {
            if (
              url &&
              (url.startsWith("http://") || url.startsWith("https://"))
            ) {
              await new Promise((e) => setTimeout(e, 50 * t));
              const o = `preview_${e}_img${t}_${Date.now()}`;
              return {
                url: await po(url, o, 0, { usePreviewQuality: !0 }),
                assetId: o,
              };
            }
            return { url: url, assetId: void 0 };
          }),
          o = await Promise.all(t);
        ((c = o.map((e) => e.url).filter((e) => null != e)),
          (l = o.map((e) => e.assetId).filter((e) => null != e)),
          console.log("[updateConnectedPreview] 多图/多视频下载完成:", c));
      }
      let d = null == i ? void 0 : i.previewMjVideos;
      if (
        (console.log(
          "[updateConnectedPreview] 多视频数量:",
          (null == d ? void 0 : d.length) || 0,
        ),
        d && d.length > 0)
      ) {
        console.log("[updateConnectedPreview] 开始下载多视频:", d);
        const t = d.map(async (url, t) => {
          if (
            url &&
            (url.startsWith("http://") || url.startsWith("https://"))
          ) {
            await new Promise((e) => setTimeout(e, 100 * t));
            const o = `preview_${e}_video${t}_${Date.now()}`;
            return await po(url, o);
          }
          return url;
        });
        ((d = await Promise.all(t)),
          console.log("[updateConnectedPreview] 多视频下载完成:", d));
      }
      let u,
        g = null == i ? void 0 : i.selectedPreviewImage;
      if (g && (g.startsWith("http://") || g.startsWith("https://"))) {
        const t = `preview_${e}_selected_${Date.now()}`;
        ((g = await po(g, t, 0, { usePreviewQuality: !0 })), (u = t));
      }
      let m = null == i ? void 0 : i.selectedPreviewVideo;
      if (m && (m.startsWith("http://") || m.startsWith("https://"))) {
        const t = `preview_${e}_selected_video_${Date.now()}`;
        m = await po(m, t);
      }
      const h = {
        content: s,
        previewType: t,
        _contentAssetId: a,
        previewMjImages: c && c.length > 0 ? c : void 0,
        _previewMjAssetIds: l,
        selectedPreviewImage: g || void 0,
        _selectedImageAssetId: u,
        previewMjVideos: d && d.length > 0 ? d : void 0,
        selectedPreviewVideo: m || void 0,
      };
      if (
        ((null == i ? void 0 : i.sourceNodeName) &&
          (h.nodeName = i.sourceNodeName),
        null != (null == i ? void 0 : i.previewSourceModel) && r)
      ) {
        const t = r.find((n) => n.id === e);
        h.settings = {
          ...((null == t ? void 0 : t.settings) || {}),
          previewSourceModel: i.previewSourceModel,
        };
      }
      if (null != (null == i ? void 0 : i.previewActualSize) && r) {
        const t = r.find((n) => n.id === e);
        h.settings = {
          ...(h.settings || {}),
          ...((null == t ? void 0 : t.settings) || {}),
          previewActualSize: i.previewActualSize,
        };
      }
      if (
        (null != (null == i ? void 0 : i.previewGridRows) &&
          null != (null == i ? void 0 : i.previewGridCols)) ||
        null != (null == i ? void 0 : i.previewSourceNodeId) ||
        null != (null == i ? void 0 : i.previewSourceNodeType)
      ) {
        const t = null == r ? void 0 : r.find((n) => n.id === e);
        h.settings = {
          ...(h.settings || {}),
          ...((null == t ? void 0 : t.settings) || {}),
          ...(null != (null == i ? void 0 : i.previewGridRows) &&
          null != (null == i ? void 0 : i.previewGridCols)
            ? {
                previewGridRows: i.previewGridRows,
                previewGridCols: i.previewGridCols,
              }
            : {}),
          ...(null != (null == i ? void 0 : i.previewSourceNodeId)
            ? { previewSourceNodeId: i.previewSourceNodeId }
            : {}),
          ...(null != (null == i ? void 0 : i.previewSourceNodeType)
            ? { previewSourceNodeType: i.previewSourceNodeType }
            : {}),
        };
      }
      (console.log("[updateConnectedPreview] 更新预览节点数据:", h),
        o(e, h),
        console.log("[updateConnectedPreview] ✅ 预览节点更新完成"));
    } catch (error) {
      (console.error("[updateConnectedPreview] ❌ 更新预览节点失败:", error),
        o(e, {
          content: content,
          previewType: t,
          previewMjImages:
            (null == i ? void 0 : i.previewMjImages) &&
            i.previewMjImages.length > 0
              ? i.previewMjImages
              : void 0,
          selectedPreviewImage:
            (null == i ? void 0 : i.selectedPreviewImage) || void 0,
          previewMjVideos:
            (null == i ? void 0 : i.previewMjVideos) &&
            i.previewMjVideos.length > 0
              ? i.previewMjVideos
              : void 0,
          selectedPreviewVideo:
            (null == i ? void 0 : i.selectedPreviewVideo) || void 0,
        }));
    }
  } else console.log("[updateConnectedPreview] 没有预览节点ID，跳过");
}
async function yi(e) {
  var t, o, i, r, a, s, l, c, d, u, g, m, h, p, f, w;
  const {
      result: result,
      taskId: taskId,
      node: y,
      baseUrl: baseUrl,
      apiKey: apiKey,
      currentModel: v,
      isMidjourney: b,
      isVideoGeneration: _,
      connections: I,
      nodes: S,
      updateNode: j,
      setHistory: A,
      connectedPreviewId: P,
      batchAccumulator: k,
      batchIndex: T,
    } = e,
    $ = fi(y.id, I, S),
    M = null == (t = y.settings) ? void 0 : t.selectedPreviewId,
    C =
      M && $.includes(M)
        ? M
        : P || (null == (o = y.settings) ? void 0 : o._autoCreatedPreviewId),
    U = C ? [C] : $.length > 0 ? [$[0]] : [],
    O = U[0],
    E = async (content, e, t) => {
      for (const o of U) await wi(o, content, e, j, t, S);
    },
    L = y.nodeName;
  let R = result.data && "object" == typeof result.data ? result.data.id : null;
  if (!R && result.base_resp && "object" == typeof result.base_resp) {
    const e = result.base_resp;
    if (
      (console.log("[Hailuo] 检查 base_resp:", e),
      0 === e.status_code && result.task_id)
    )
      ((R = result.task_id),
        console.log("[Hailuo] 从 base_resp 提取 task_id:", R));
    else if (0 !== e.status_code) {
      const t = e.status_msg || "请求失败";
      return (
        console.error("[Hailuo] 请求失败:", t, e),
        j(y.id, { isGenerating: !1, errorMsg: String(t) }),
        void A((e) =>
          e.map((e) =>
            e.id === taskId
              ? { ...e, status: "failed", progress: 0, errorMsg: String(t) }
              : e,
          ),
        )
      );
    }
  }
  if (!R && ge(v)) {
    if (
      (console.log(
        "[Wan 2.6] 提取任务ID，响应数据:",
        JSON.stringify(result).substring(0, 500),
      ),
      console.log("[Wan 2.6] 响应数据键:", Object.keys(result)),
      result.task_id)
    )
      ((R = result.task_id),
        console.log("[Wan 2.6] ✓ 从根级别提取 task_id:", R));
    else if (result.output && "object" == typeof result.output) {
      const e = result.output;
      if (
        (console.log("[Wan 2.6] 检查 output:", e),
        e.task_id &&
          ((R = e.task_id),
          console.log("[Wan 2.6] ✓ 从 output 提取 task_id:", R)),
        "FAILED" === e.task_status)
      ) {
        const t = e.code || "Unknown",
          o = e.message || "创建任务失败";
        return (
          console.error("[Wan 2.6] ✗ 创建任务失败:", t, o),
          j(y.id, { isGenerating: !1, errorMsg: `${t}: ${o}` }),
          void A((e) =>
            e.map((e) =>
              e.id === taskId
                ? {
                    ...e,
                    status: "failed",
                    progress: 0,
                    errorMsg: `${t}: ${o}`,
                  }
                : e,
            ),
          )
        );
      }
    }
    if ("FAILED" === result.status || "ERROR" === result.status) {
      const e = String(result.fail_reason || "创建任务失败");
      return (
        console.error("[Wan 2.6] ✗ 创建任务失败:", e),
        j(y.id, { isGenerating: !1, errorMsg: e }),
        void A((t) =>
          t.map((t) =>
            t.id === taskId
              ? { ...t, status: "failed", progress: 0, errorMsg: e }
              : t,
          ),
        )
      );
    }
    R || console.error("[Wan 2.6] ✗ 未能提取任务ID，响应:", result);
  }
  const N =
    (v.includes("grok-4.1-image") || v.includes("grok-4.2-image")) &&
    result.choices &&
    Array.isArray(result.choices) &&
    result.choices.length > 0;
  if (
    ((R =
      R ||
      (N ? null : result.id) ||
      result.task_id ||
      (result.data && "object" == typeof result.data
        ? result.data.task_id
        : null) ||
      ("string" == typeof result.data && result.data.length > 10
        ? result.data
        : null) ||
      (!b || (1 !== result.code && 22 !== result.code) ? null : result.result)),
    R)
  ) {
    A((e) =>
      e.map((e) =>
        e.id === taskId
          ? { ...e, status: "generating", progress: 0, remoteTaskId: R }
          : e,
      ),
    );
    const e = (null == (i = y.settings) ? void 0 : i.mjMode) || "fast",
      t = Math.ceil(2e3),
      o = (e) =>
        _ || b
          ? e < 15
            ? 2e3
            : e < 45
              ? 3e3
              : 5e3
          : e < 20
            ? 800
            : e < 50
              ? 1500
              : 3e3,
      r = async (i = 0, a = -1) => {
        var s, l, c, d, u, g, m, h, p;
        const f = !1;
        if (i > t)
          return (
            A((e) =>
              e.map((e) =>
                e.id === taskId
                  ? {
                      ...e,
                      status: "failed",
                      progress: 0,
                      errorMsg: "生成超时（1600秒）",
                    }
                  : e,
              ),
            ),
            void j(y.id, { isGenerating: !1, errorMsg: "生成超时（1600秒）" })
          );
        try {
          let t;
          if ((i > 0 && (await new Promise((e) => setTimeout(e, o(i - 1)))), b))
            t = `${baseUrl}/${e}/mj/task/${R}/fetch`;
          else if (_)
            if (ae(v))
              t = `${baseUrl}/kling/v1/videos/omni-video/${encodeURIComponent(R)}`;
            else if (se(v))
              t = `${baseUrl}/kling/v1/videos/text2video/${encodeURIComponent(R)}`;
            else if (le(v))
              t = `${baseUrl}/kling/v1/videos/text2video/${encodeURIComponent(R)}`;
            else if (ce(v))
              t = `${baseUrl}/kling/v1/videos/text2video/${encodeURIComponent(R)}`;
            else if (q(v) || Z(v))
              t = `${baseUrl}/v2/videos/generations/${encodeURIComponent(R)}`;
            else if (Q(v))
              t = X(v)
                ? `${baseUrl}/v2/videos/generations/${encodeURIComponent(R)}`
                : `${baseUrl}/api/v3/contents/generations/tasks/${encodeURIComponent(R)}`;
            else if (ge(v))
              t = me(v)
                ? `${baseUrl}/api/v1/tasks/${encodeURIComponent(R)}`
                : `${baseUrl}/v2/videos/generations/${encodeURIComponent(R)}`;
            else if (re(v))
              t = `${baseUrl}/minimax/v1/query/video_generation?task_id=${encodeURIComponent(R)}`;
            else if (de(v))
              t = `${baseUrl}/vidu/v2/tasks/${encodeURIComponent(R)}/creations`;
            else if (ue(v)) {
              const e =
                (null == (s = y.settings) ? void 0 : s.mjMode) || "fast";
              t = `${baseUrl}/${e}/mj/task/${encodeURIComponent(R)}/fetch`;
            } else if (J(v)) t = `${baseUrl}/v1/tasks/${encodeURIComponent(R)}`;
            else if (v.startsWith("sora")) {
              t = baseUrl.includes("api.openai.com")
                ? `${baseUrl}/videos/${encodeURIComponent(R)}`
                : `${baseUrl}/v2/videos/generations/${encodeURIComponent(R)}`;
            } else t = `${baseUrl}/v1/videos/${encodeURIComponent(R)}`;
          else
            t =
              v.includes("grok-4.1-image") || v.includes("grok-4.2-image")
                ? `${baseUrl}/v1/tasks/${encodeURIComponent(R)}`
                : he(v)
                  ? `${baseUrl}/api/v1/tasks/${encodeURIComponent(R)}`
                  : `${baseUrl}/v1/images/tasks/${R}`;
          const I = "Bearer",
            S = await an(t, { headers: { Authorization: `${I} ${apiKey}` } }),
            P = await S.json();
          if (!S.ok && de(v) && _) {
            console.warn(
              "[Vidu] 轮询请求超时或临时错误，继续轮询:",
              (null == P ? void 0 : P.error) || S.status,
            );
            const e = Math.min(10 + 2 * i, 90);
            return (
              A((t) =>
                t.map((t) => (t.id === taskId ? { ...t, progress: e } : t)),
              ),
              j(y.id, { settings: { ...y.settings, progress: e } }),
              void setTimeout(() => r(i + 1, e), o(i))
            );
          }
          if ((se(v) || le(v) || ce(v)) && _) {
            let e;
            if (P.task_status) e = P;
            else if (P.data && "object" == typeof P.data) {
              const t = P.data;
              t.task_status
                ? (e = t)
                : t.data && "object" == typeof t.data && (e = t.data);
            }
            if (!e) {
              f;
              const e = Math.min(10 + 2 * i, 90);
              return (
                A((t) =>
                  t.map((t) => (t.id === taskId ? { ...t, progress: e } : t)),
                ),
                j(y.id, { settings: { ...y.settings, progress: e } }),
                void setTimeout(() => r(i + 1, a), o(i))
              );
            }
            const t = String(e.task_status || "").toLowerCase(),
              s = e.task_result,
              l = null == s ? void 0 : s.videos;
            if (
              (console.log("[Kling] 解析结果:", {
                taskStatus: t,
                hasVideos: !!l,
                videosCount: (null == l ? void 0 : l.length) || 0,
              }),
              "succeed" === t || "success" === t)
            ) {
              if (l && l.length > 0 && l[0].url) {
                const e = l[0].url,
                  t = le(v),
                  o = ce(v);
                console.log(
                  o ? "[Kling v3]" : t ? "[Kling v2.6]" : "[Kling v2.5 Turbo]",
                  "视频生成完成:",
                  e,
                );
                return (
                  to(e, taskId).catch((e) => {
                    console.error(
                      o
                        ? "[Kling v3]"
                        : t
                          ? "[Kling v2.6]"
                          : "[Kling v2.5 Turbo]",
                      "下载视频失败:",
                      e,
                    );
                  }),
                  A((t) =>
                    t.map((t) => {
                      if (t.id === taskId) {
                        const o = t.startTime
                          ? Date.now() - t.startTime
                          : void 0;
                        return {
                          ...t,
                          status: "completed",
                          progress: 100,
                          url: e,
                          durationMs: o,
                        };
                      }
                      return t;
                    }),
                  ),
                  j(y.id, {
                    isGenerating: !1,
                    content: e,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                    },
                  }),
                  void (await E(e, "video", {
                    sourceNodeName: L,
                    previewSourceModel: v,
                  }))
                );
              }
              {
                const e = "未返回视频 URL";
                return (
                  console.error("[Kling v2.5 Turbo] 错误:", e),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
            }
            if ("failed" === t || "failure" === t || "error" === t) {
              const t = String(e.task_status_msg || "任务失败");
              return (
                console.error("[Kling v2.5 Turbo] 任务失败:", t),
                A((e) =>
                  e.map((e) =>
                    e.id === taskId
                      ? { ...e, status: "failed", progress: 0, errorMsg: t }
                      : e,
                  ),
                ),
                void j(y.id, { isGenerating: !1, errorMsg: t })
              );
            }
            if ("processing" === t || "submitted" === t) {
              const e = Math.min(10 + 2 * i, 90);
              return (
                A((t) =>
                  t.map((t) => (t.id === taskId ? { ...t, progress: e } : t)),
                ),
                j(y.id, { settings: { ...y.settings, progress: e } }),
                void setTimeout(() => r(i + 1, e), o(i))
              );
            }
            {
              const e = Math.min(10 + 2 * i, 90);
              return (
                A((t) =>
                  t.map((t) => (t.id === taskId ? { ...t, progress: e } : t)),
                ),
                j(y.id, { settings: { ...y.settings, progress: e } }),
                void setTimeout(() => r(i + 1, e), o(i))
              );
            }
          }
          if (J(v) && _) {
            f;
            const e = (
                P.status ||
                P.state ||
                P.task_status ||
                ""
              ).toLowerCase(),
              t = Zo(P, i);
            if (
              "completed" === e ||
              "success" === e ||
              "finished" === e ||
              "done" === e
            ) {
              let e = P.video_url || P.url || P.output;
              if (
                (!e &&
                  P.data &&
                  (e = P.data.url || P.data.video_url || P.data.output),
                !e &&
                  P.result &&
                  (e = P.result.url || P.result.video_url || P.result.output),
                Array.isArray(e) && (e = e[0]),
                e)
              )
                return (
                  to(e, taskId).catch((e) => {
                    console.error("[Jimeng Video] 下载视频失败:", e);
                  }),
                  A((t) =>
                    t.map((t) => {
                      if (t.id === taskId) {
                        const o = t.startTime
                          ? Date.now() - t.startTime
                          : void 0;
                        return {
                          ...t,
                          status: "completed",
                          progress: 100,
                          url: e,
                          durationMs: o,
                        };
                      }
                      return t;
                    }),
                  ),
                  j(y.id, {
                    isGenerating: !1,
                    content: e,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                    },
                  }),
                  void (await E(e, "video", {
                    sourceNodeName: L,
                    previewSourceModel: v,
                  }))
                );
              {
                const e = "未返回视频 URL";
                return (
                  console.error("[Jimeng Video] 错误:", e, P),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
            }
            if ("failed" === e || "error" === e || "failure" === e) {
              const e = P.error || P.message || P.error_message || "生成失败";
              return (
                console.error("[Jimeng Video] 生成失败:", e, P),
                A((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? { ...t, status: "failed", progress: 0, errorMsg: e }
                      : t,
                  ),
                ),
                void j(y.id, {
                  isGenerating: !1,
                  errorMsg: e,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 0,
                    error: e,
                  },
                })
              );
            }
            console.log("[Jimeng Video] 任务进行中, 状态:", e, "进度:", t);
            return (
              (Math.abs(t - a) >= 10 || 0 === t || 100 === t) &&
                (A((e) =>
                  e.map((e) =>
                    e.id === taskId
                      ? { ...e, status: "generating", progress: t }
                      : e,
                  ),
                ),
                j(y.id, { settings: { ...y.settings, progress: t } })),
              void setTimeout(() => r(i + 1, t), o(i))
            );
          }
          if (ge(v) && _) {
            const e = me(v);
            let t;
            f;
            let a = null,
              s = null,
              c = 0;
            if (e) {
              const e = P.output || {};
              ((t = (e.task_status || "").toUpperCase()),
                (a = e.video_url || null),
                (s = e.message || e.code || null),
                console.log(
                  "[Wan 2.6 Official] 状态:",
                  t,
                  "videoUrl:",
                  null == a ? void 0 : a.substring(0, 50),
                ));
            } else {
              if (
                ((t = (P.status || "").toUpperCase()),
                (a = (null == (l = P.data) ? void 0 : l.output) || null),
                (s = P.fail_reason || null),
                P.progress)
              ) {
                const e = String(P.progress).replace("%", "");
                c = parseInt(e, 10) || 0;
              }
              console.log(
                "[Wan 2.6 Proxy] 状态:",
                t,
                "进度:",
                c,
                "videoUrl:",
                null == a ? void 0 : a.substring(0, 50),
              );
            }
            if (
              (t ||
                (console.warn("[Wan 2.6] 状态为空，尝试从其他字段获取"),
                (t = (P.task_status || P.state || "").toUpperCase()),
                a || (a = P.video_url || P.url || null),
                console.log(
                  "[Wan 2.6] fallback 状态:",
                  t,
                  "videoUrl:",
                  null == a ? void 0 : a.substring(0, 50),
                )),
              "SUCCESS" === t || "SUCCEEDED" === t)
            ) {
              if (a)
                return (
                  console.log("[Wan 2.6] 视频生成完成:", a),
                  to(a, taskId).catch((e) => {
                    console.error("[Wan 2.6] 下载视频失败:", e);
                  }),
                  A((e) =>
                    e.map((e) => {
                      if (e.id === taskId) {
                        const t = e.startTime
                          ? Date.now() - e.startTime
                          : void 0;
                        return {
                          ...e,
                          status: "completed",
                          progress: 100,
                          url: a,
                          durationMs: t,
                        };
                      }
                      return e;
                    }),
                  ),
                  j(y.id, {
                    isGenerating: !1,
                    content: a,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                    },
                  }),
                  void (await E(a, "video", {
                    sourceNodeName: L,
                    previewSourceModel: v,
                  }))
                );
              {
                const e = "未返回视频 URL";
                return (
                  console.error("[Wan 2.6] 错误:", e, P),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
            }
            if ("FAILED" === t || "FAILURE" === t || "ERROR" === t) {
              const e = s || "生成失败";
              return (
                console.error("[Wan 2.6] 生成失败:", e, P),
                A((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? { ...t, status: "failed", progress: 0, errorMsg: e }
                      : t,
                  ),
                ),
                void j(y.id, {
                  isGenerating: !1,
                  errorMsg: e,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 0,
                    error: e,
                  },
                })
              );
            }
            if ("UNKNOWN" === t) {
              const e = "任务已过期或不存在";
              return (
                console.error("[Wan 2.6] 任务查询失败:", e),
                A((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? { ...t, status: "failed", progress: 0, errorMsg: e }
                      : t,
                  ),
                ),
                void j(y.id, {
                  isGenerating: !1,
                  errorMsg: e,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 0,
                    error: e,
                  },
                })
              );
            }
            {
              const e = c || ("RUNNING" === t ? 50 : 10);
              return (
                console.log("[Wan 2.6] 任务进行中, 状态:", t, "进度:", e),
                A((t) =>
                  t.map((t) => (t.id === taskId ? { ...t, progress: e } : t)),
                ),
                j(y.id, { settings: { ...y.settings, progress: e } }),
                void setTimeout(() => r(i + 1, e), o(i))
              );
            }
          }
          if (de(v) && _) {
            const e = P.data && "object" == typeof P.data ? P.data : P,
              t = String(e.state ?? P.state ?? "").toLowerCase();
            if ("success" === t) {
              const t = e.creations ?? P.creations,
                o = null == t ? void 0 : t[0],
                i = null == o ? void 0 : o.video;
              let r =
                (null == o ? void 0 : o.url) ??
                (null == o ? void 0 : o.download_url) ??
                (null == o ? void 0 : o.video_url) ??
                (null == i ? void 0 : i.url) ??
                (null == i ? void 0 : i.download_url) ??
                (null == o ? void 0 : o.output_url) ??
                (null == o ? void 0 : o.play_url);
              if (!r && o && "object" == typeof o)
                for (const e of Object.values(o))
                  if (
                    "string" == typeof e &&
                    e.startsWith("http") &&
                    (e.includes(".mp4") ||
                      /\/video[\/?]/.test(e) ||
                      e.includes("prod-ss-vidu") ||
                      (e.includes("s3") && e.includes("amazonaws")))
                  ) {
                    r = e;
                    break;
                  }
              if (r) {
                console.log("[Vidu] 视频生成完成:", r);
                const e = ai(taskId, r);
                return (
                  to(r, e).catch((e) => {
                    console.error("[Vidu] 下载视频失败:", e);
                  }),
                  si({ url: r, type: "video" }, taskId),
                  A((t) =>
                    t.map((t) => {
                      if (t.id === taskId) {
                        const o = t.startTime
                          ? Date.now() - t.startTime
                          : void 0;
                        return {
                          ...t,
                          status: "completed",
                          progress: 100,
                          url: r,
                          _assetId: e,
                          durationMs: o,
                        };
                      }
                      return t;
                    }),
                  ),
                  j(y.id, {
                    isGenerating: !1,
                    content: r,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                    },
                  }),
                  void (await E(r, "video", {
                    sourceNodeName: L,
                    previewSourceModel: v,
                  }))
                );
              }
              const a = "未返回视频 URL";
              return (
                A((e) =>
                  e.map((e) =>
                    e.id === taskId
                      ? { ...e, status: "failed", progress: 0, errorMsg: a }
                      : e,
                  ),
                ),
                void j(y.id, { isGenerating: !1, errorMsg: a })
              );
            }
            if ("failed" === t) {
              const t = String(e.err_code ?? P.err_code ?? "任务失败");
              return (
                A((e) =>
                  e.map((e) =>
                    e.id === taskId
                      ? { ...e, status: "failed", progress: 0, errorMsg: t }
                      : e,
                  ),
                ),
                void j(y.id, {
                  isGenerating: !1,
                  errorMsg: t,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 0,
                    error: t,
                  },
                })
              );
            }
            const a = Math.min(10 + 2 * i, 90);
            return (
              A((e) =>
                e.map((e) => (e.id === taskId ? { ...e, progress: a } : e)),
              ),
              j(y.id, { settings: { ...y.settings, progress: a } }),
              void setTimeout(() => r(i + 1, a), o(i))
            );
          }
          if (Q(v) && _) {
            const e = X(v),
              t = String(P.status || "").toLowerCase();
            let a, s;
            if (e) {
              const e = P.data;
              ((a = null == e ? void 0 : e.output), (s = P.fail_reason));
            } else {
              const e = P.content;
              a = null == e ? void 0 : e.video_url;
              const t = P.error;
              s =
                (null == t ? void 0 : t.message) ||
                (null == t ? void 0 : t.code) ||
                P.message;
            }
            if (("succeeded" === t || "success" === t) && a)
              return (
                console.log(
                  `[Seedance${e ? " API" : ""}] 视频生成完成:`,
                  a.substring(0, 100),
                ),
                to(a, taskId).catch((t) => {
                  console.error(
                    `[Seedance${e ? " API" : ""}] 下载视频失败:`,
                    t,
                  );
                }),
                A((e) =>
                  e.map((e) => {
                    if (e.id === taskId) {
                      const t = e.startTime ? Date.now() - e.startTime : void 0;
                      return {
                        ...e,
                        status: "completed",
                        progress: 100,
                        url: a,
                        durationMs: t,
                      };
                    }
                    return e;
                  }),
                ),
                j(y.id, {
                  isGenerating: !1,
                  content: a,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 100,
                    error: null,
                  },
                }),
                void (await E(a, "video", { previewSourceModel: v }))
              );
            if ("failed" === t) {
              const e = String(s || "生成失败");
              return (
                A((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? { ...t, status: "failed", progress: 0, errorMsg: e }
                      : t,
                  ),
                ),
                void j(y.id, {
                  isGenerating: !1,
                  errorMsg: e,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 0,
                    error: e,
                  },
                })
              );
            }
            const l = Math.min(10 + 2 * i, 90);
            return (
              A((e) =>
                e.map((e) => (e.id === taskId ? { ...e, progress: l } : e)),
              ),
              j(y.id, { settings: { ...y.settings, progress: l } }),
              void setTimeout(() => r(i + 1, l), o(i))
            );
          }
          if (re(v) && _) {
            if (0 !== (null == (c = P.base_resp) ? void 0 : c.status_code)) {
              const e =
                (null == (d = P.base_resp) ? void 0 : d.status_msg) ||
                "Hailuo query failed";
              return (
                console.error("[Hailuo] 查询失败:", e, P),
                A((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? { ...t, status: "failed", progress: 0, errorMsg: e }
                      : t,
                  ),
                ),
                void j(y.id, { isGenerating: !1, errorMsg: e })
              );
            }
            const e = (P.status || "").toLowerCase(),
              t = Zo(P, i);
            if (
              (console.log("[Hailuo] 状态:", e, "进度:", t), "success" === e)
            ) {
              const e = P.file_id;
              if (!e) {
                const e = "未返回file_id";
                return (
                  console.error("[Hailuo] 错误:", e, P),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
              console.log("[Hailuo] 获取视频链接, file_id:", e);
              const t = `${baseUrl}/minimax/v1/files/retrieve?file_id=${encodeURIComponent(e)}`,
                o = await fetch(t, {
                  headers: { Authorization: `Bearer ${apiKey}` },
                });
              if (!o.ok) {
                const e = `获取下载链接失败: HTTP ${o.status}`;
                return (
                  console.error("[Hailuo] 错误:", e),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
              const i = await o.json();
              if (
                (console.log("[Hailuo] 下载响应:", i),
                0 !== (null == (u = i.base_resp) ? void 0 : u.status_code))
              ) {
                const e =
                  (null == (g = i.base_resp) ? void 0 : g.status_msg) ||
                  "获取下载链接失败";
                return (
                  console.error("[Hailuo] 错误:", e, i),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
              const r = null == (m = i.file) ? void 0 : m.download_url;
              if (r)
                return (
                  console.log("[Hailuo] 视频生成完成:", r),
                  to(r, taskId).catch((e) => {
                    console.error("[Hailuo] 下载视频失败:", e);
                  }),
                  A((e) =>
                    e.map((e) => {
                      if (e.id === taskId) {
                        const t = e.startTime
                          ? Date.now() - e.startTime
                          : void 0;
                        return {
                          ...e,
                          status: "completed",
                          progress: 100,
                          url: r,
                          durationMs: t,
                        };
                      }
                      return e;
                    }),
                  ),
                  j(y.id, {
                    isGenerating: !1,
                    content: r,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                    },
                  }),
                  void (await E(r, "video", {
                    sourceNodeName: L,
                    previewSourceModel: v,
                  }))
                );
              {
                const e = "未返回download_url";
                return (
                  console.error("[Hailuo] 错误:", e, i),
                  A((t) =>
                    t.map((t) =>
                      t.id === taskId
                        ? { ...t, status: "failed", progress: 0, errorMsg: e }
                        : t,
                    ),
                  ),
                  void j(y.id, { isGenerating: !1, errorMsg: e })
                );
              }
            }
            if ("failed" === e) {
              const e =
                P.error ||
                (null == (h = P.base_resp) ? void 0 : h.status_msg) ||
                "生成失败";
              return (
                console.error("[Hailuo] 生成失败:", e, P),
                A((t) =>
                  t.map((t) =>
                    t.id === taskId
                      ? { ...t, status: "failed", progress: 0, errorMsg: e }
                      : t,
                  ),
                ),
                void j(y.id, {
                  isGenerating: !1,
                  errorMsg: e,
                  settings: {
                    ...y.settings,
                    isGenerating: !1,
                    progress: 0,
                    error: e,
                  },
                })
              );
            }
            console.log("[Hailuo] 任务进行中, 状态:", e, "进度:", t);
            return (
              (Math.abs(t - a) >= 10 || 0 === t || 100 === t) &&
                (A((e) =>
                  e.map((e) =>
                    e.id === taskId
                      ? { ...e, status: "generating", progress: t }
                      : e,
                  ),
                ),
                j(y.id, { settings: { ...y.settings, progress: t } })),
              void setTimeout(() => r(i + 1, t), o(i))
            );
          }
          const $ = qo(P),
            M = Zo(P, i);
          if (
            "COMPLETED" === $ ||
            "SUCCESS" === $ ||
            "SUCCEEDED" === $ ||
            "FINISHED" === $ ||
            "DONE" === $
          ) {
            const e = Ho(P, _, b);
            if (
              (console.log(
                "[Polling] Task completed, resultUrls:",
                e,
                "length:",
                e.length,
                "isMidjourney:",
                b,
                "isVideoGeneration:",
                _,
                "currentModel:",
                v,
              ),
              e.length > 0)
            ) {
              const t = e[0],
                o = J(v) && _,
                i =
                  (!!(modelId = v) &&
                    (modelId.includes("jimeng-5.0") ||
                      modelId.includes("jimeng-4.6") ||
                      modelId.includes("jimeng-4.5") ||
                      modelId.includes("jimeng-4.1") ||
                      modelId.includes("jimeng-4.0") ||
                      modelId.includes("jimeng-3.1")),
                  o && Yt(t)),
                r = (i && eo(t)) || t,
                a = i ? e.map((e) => eo(e) || e) : e;
              if (b && 1 === e.length && !_)
                (console.log("[MJ Polling] 开始处理 MJ 图片，previewId:", O),
                  to(t, taskId).catch((e) => {
                    console.error("[MJ] 下载图片失败:", e);
                  }),
                  si({ url: t, type: "image" }, taskId).catch(() => {}),
                  A((e) =>
                    e.map((e) => {
                      if (e.id === taskId) {
                        const o = e.startTime
                          ? Date.now() - e.startTime
                          : void 0;
                        return {
                          ...e,
                          status: "completed",
                          progress: 100,
                          url: t,
                          mjOriginalUrl: t,
                          mjNeedsSplit: !0,
                          durationMs: o,
                        };
                      }
                      return e;
                    }),
                  ),
                  j(y.id, {
                    isGenerating: !1,
                    content: t,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                    },
                  }),
                  console.log("[MJ Polling] 发送到预览窗口，previewId:", O),
                  O
                    ? await E(t, "image", {
                        sourceNodeName: L,
                        previewSourceModel: v,
                      })
                    : console.warn(
                        "[MJ Polling] ⚠️ 预览节点ID为空，无法发送到预览窗口",
                      ),
                  (async () => {
                    try {
                      let o = t,
                        i = !1;
                      if (
                        "undefined" != typeof window &&
                        ("__TAURI__" in window ||
                          "__TAURI_INTERNALS__" in window) &&
                        (t.startsWith("http://") || t.startsWith("https://"))
                      )
                        try {
                          const { downloadWithFallback: e } = await x(
                              async () => {
                                const { downloadWithFallback: e } =
                                  await import("./tauriDownloader-BG3Xb0u0.js");
                                return { downloadWithFallback: e };
                              },
                              __vite__mapDeps([0, 1, 2]),
                              import.meta.url,
                            ),
                            blob = await e(t, 6e4);
                          ((o = URL.createObjectURL(blob)), (i = !0));
                        } catch (e) {
                          console.warn(
                            "[MJ Polling] Tauri 下载原图失败，使用原 URL 裁切:",
                            e,
                          );
                        }
                      try {
                        const e = (await vo(o)).map((e) => e.url),
                          t = await Promise.all(
                            e.map(async (url, e) => {
                              try {
                                if (!url || !url.startsWith("blob:"))
                                  return (
                                    console.warn(
                                      "[MJ] ⚠️ Invalid blob URL:",
                                      url,
                                    ),
                                    url
                                  );
                                const o = await fetch(url);
                                if (!o.ok)
                                  return (
                                    console.error(
                                      "[MJ] ❌ Fetch failed:",
                                      o.status,
                                    ),
                                    url
                                  );
                                const blob = await o.blob(),
                                  i = `mj_${taskId}_split_${e}`;
                                try {
                                  const { assetStore: e } = await x(
                                    async () => {
                                      const { assetStore: e } =
                                        await Promise.resolve().then(() => Ge);
                                      return { assetStore: e };
                                    },
                                    void 0,
                                    import.meta.url,
                                  );
                                  await e.init();
                                  if (await e.saveBlobAsset(i, blob, url)) {
                                    console.log(
                                      "[MJ] ✅ Blob saved to assetStore:",
                                      i,
                                    );
                                    const t = await e.getAssetUrl(i);
                                    if (t)
                                      return (
                                        console.log(
                                          "[MJ] ✅ Got persistent URL from assetStore:",
                                          t.substring(0, 50),
                                        ),
                                        t
                                      );
                                  } else
                                    console.warn(
                                      "[MJ] ⚠️ Failed to save blob to assetStore, will use blob URL",
                                    );
                                } catch (t) {
                                  console.error(
                                    `[MJ] ❌ assetStore error for split ${e}:`,
                                    t,
                                  );
                                }
                                const r = URL.createObjectURL(blob);
                                return (
                                  console.warn(
                                    "[MJ] ⚠️ Using temporary blob URL (not persistent):",
                                    r.substring(0, 50),
                                  ),
                                  r
                                );
                              } catch (o) {
                                return (
                                  console.error(
                                    "[MJ] ❌ Failed to create history blob:",
                                    o,
                                  ),
                                  url
                                );
                              }
                            }),
                          );
                        (e.forEach((url, e) => {
                          to(url, `${taskId}_split_${e}`).catch((t) => {
                            console.error(
                              `[MJ] ❌ 保存切片 ${e + 1} 到本地文件失败:`,
                              t,
                            );
                          });
                        }),
                          A((e) =>
                            e.map((e) =>
                              e.id === taskId
                                ? {
                                    ...e,
                                    url: t[0],
                                    mjImages: t,
                                    selectedMjImageIndex: 0,
                                    mjNeedsSplit: !1,
                                    _mjAssetIds: t.map(
                                      (e, t) => `mj_${taskId}_split_${t}`,
                                    ),
                                  }
                                : e,
                            ),
                          ),
                          setTimeout(() => {
                            try {
                              A(
                                (e) => (
                                  x(
                                    async () => {
                                      const { STORAGE_KEYS: e } =
                                        await import("./index-CgWMCHZL.js").then(
                                          (n) => n.n,
                                        );
                                      return { STORAGE_KEYS: e };
                                    },
                                    __vite__mapDeps([3, 4, 2, 1, 5, 6]),
                                    import.meta.url,
                                  )
                                    .then(({ STORAGE_KEYS: t }) => {
                                      (localStorage.setItem(
                                        t.HISTORY,
                                        JSON.stringify(e),
                                      ),
                                        console.log(
                                          "[MJ] ✅ History saved to localStorage immediately",
                                        ));
                                    })
                                    .catch(() => {}),
                                  e
                                ),
                              );
                            } catch (e) {
                              console.error(
                                "[MJ] ❌ Failed to save history to localStorage:",
                                e,
                              );
                            }
                          }, 100),
                          j(y.id, {
                            settings: {
                              ...y.settings,
                              mjImages: e,
                              selectedMjImageIndex: 0,
                            },
                          }),
                          await E(e[0], "image", {
                            previewMjImages: e,
                            selectedPreviewImage: e[0],
                            sourceNodeName: L,
                            previewSourceModel: v,
                          }));
                      } finally {
                        i && o.startsWith("blob:") && URL.revokeObjectURL(o);
                      }
                    } catch (o) {
                      (console.error("[MJ] ❌ 裁切失败:", o),
                        console.error(
                          "[MJ] ❌ 错误详情:",
                          o instanceof Error ? o.message : String(o),
                        ),
                        console.error(
                          "[MJ] ❌ 错误堆栈:",
                          o instanceof Error ? o.stack : "No stack",
                        ),
                        console.warn("[MJ] ⚠️ 裁切失败，保持显示原图"),
                        A((e) =>
                          e.map((e) =>
                            e.id === taskId
                              ? { ...e, mjSplitError: o.message }
                              : e,
                          ),
                        ),
                        j(y.id, {
                          settings: { ...y.settings, mjSplitError: o.message },
                        }));
                    }
                  })());
              else {
                (to(t, taskId).catch((e) => {
                  console.error("[Generation] 下载失败:", e);
                }),
                  e.length > 1 &&
                    e.slice(1).forEach((url, e) => {
                      to(url, `${taskId}_${e + 1}`).catch((t) => {
                        console.error(`[Generation] 下载第${e + 2}张失败:`, t);
                      });
                    }));
                let o = a,
                  i = r;
                (!_ && a.length > 0 && ((o = a), (i = r)),
                  A((t) =>
                    t.map((t) => {
                      if (t.id === taskId) {
                        const r = t.startTime
                          ? Date.now() - t.startTime
                          : void 0;
                        ue(v);
                        return {
                          ...t,
                          status: "completed",
                          progress: 100,
                          url: i,
                          mjImages: e.length > 1 ? o : void 0,
                          selectedMjImageIndex: 0,
                          durationMs: r,
                          _assetId: taskId,
                          _mjAssetIds:
                            e.length > 1
                              ? e.map((e, t) =>
                                  0 === t ? taskId : `${taskId}_${t}`,
                                )
                              : void 0,
                        };
                      }
                      return t;
                    }),
                  ));
                const s = o.map((url, e) => ({
                  id: `${taskId}_${e}`,
                  thumbUrl: url,
                  fullUrl: url,
                  createdAt: Date.now(),
                }));
                if (
                  (j(y.id, {
                    isGenerating: !1,
                    content: i,
                    settings: {
                      ...y.settings,
                      isGenerating: !1,
                      progress: 100,
                      error: null,
                      generatedImages: s,
                    },
                  }),
                  void 0 !== k && void 0 !== T)
                ) {
                  k[T] = i;
                  const e = k.filter((url) => url && url.length > 0);
                  (await new Promise((e) => setTimeout(e, 100)),
                    await E(i, "image", {
                      previewMjImages: e.length > 0 ? e : void 0,
                      selectedPreviewImage: i,
                      sourceNodeName: L,
                      previewSourceModel: v,
                    }));
                } else {
                  const t = ue(v),
                    r =
                      e.length > 1
                        ? t && _
                          ? { previewMjVideos: o, selectedPreviewVideo: i }
                          : { previewMjImages: o, selectedPreviewImage: i }
                        : void 0;
                  await E(i, _ ? "video" : "image", {
                    ...r,
                    sourceNodeName: L,
                    previewSourceModel: v,
                  });
                }
              }
            }
          } else if (
            "FAILED" === $ ||
            "ERROR" === $ ||
            "FAILURE" === $ ||
            "CANCELLED" === $
          ) {
            const e = Qo(P, $);
            (console.error("[Generation] ❌ 任务失败:", {
              status: $,
              errorMsg: e,
              model: v,
              isVideoGeneration: _,
              isMidjourney: b,
              pollData: JSON.stringify(P).substring(0, 500),
            }),
              q(v) &&
                console.error("[Veo] ❌ Veo 生成失败，详细信息:", {
                  model: v,
                  status: $,
                  errorMsg: e,
                  data: P.data,
                  message: P.message,
                  error: P.error,
                  failReason: P.failReason || P.fail_reason,
                }),
              A((t) =>
                t.map((t) =>
                  t.id === taskId
                    ? { ...t, status: "failed", progress: 0, errorMsg: e }
                    : t,
                ),
              ),
              j(y.id, {
                isGenerating: !1,
                errorMsg: e,
                settings: {
                  ...y.settings,
                  isGenerating: !1,
                  progress: 0,
                  error: e,
                },
              }));
            const t =
              null == (p = y.settings) ? void 0 : p._autoCreatedPreviewId;
            if (t)
              try {
                window.dispatchEvent(
                  new CustomEvent("previewGenerateFailed", {
                    detail: { previewNodeId: t },
                  }),
                );
              } catch (w) {}
          } else {
            ((Math.abs(M - a) >= 10 || 0 === M || 100 === M) &&
              (A((e) =>
                e.map((e) => (e.id === taskId ? { ...e, progress: M } : e)),
              ),
              j(y.id, { settings: { ...y.settings, progress: M } })),
              setTimeout(() => r(i + 1, M), o(i)));
          }
        } catch {
          setTimeout(() => r(i + 1, a), o(i));
        }
        var modelId;
      };
    r();
  } else if (v.includes("grok-4.1-image") || v.includes("grok-4.2-image")) {
    console.log(
      "[Grok Image] 处理同步响应:",
      JSON.stringify(result).substring(0, 500),
    );
    let e = [];
    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const t = result.data;
      e = t.map((e) => e.url).filter((e) => !!e);
    }
    if (0 === e.length) {
      const t = result.choices;
      if (t && t.length > 0 && t[0].message) {
        const o = t[0].message,
          content = o.content;
        if ("string" == typeof content) {
          const t = content.trim();
          if (
            t.startsWith("http://") ||
            t.startsWith("https://") ||
            t.startsWith("data:")
          )
            e = [t];
          else if (t) {
            const o = t.match(
              /!\[[^\]]*\]\s*\(\s*(https?:\/\/[^)\s]+|data:[^)\s]+)\s*\)/,
            );
            o && (e = [o[1]]);
          }
        } else if (Array.isArray(content))
          for (const t of content)
            t &&
              "object" == typeof t &&
              ("image_url" === t.type &&
              (null == (r = t.image_url) ? void 0 : r.url)
                ? e.push(t.image_url.url)
                : "image" === t.type && t.image && e.push(t.image));
        if (0 === e.length && o.reasoning_content) {
          const t = o.reasoning_content,
            i = [],
            r = /!\[[^\]]*\]\s*\(\s*(https?:\/\/[^)\s]+|data:[^)\s]+)\s*\)/g;
          let a = r.exec(t);
          for (; a; ) (i.push(a[1]), (a = r.exec(t)));
          if (0 === i.length) {
            const e = /\]\s*\(\s*(https?:\/\/[^)\s]+|data:[^)\s]+)\s*\)/g;
            for (a = e.exec(t); a; ) (i.push(a[1]), (a = e.exec(t)));
          }
          if (0 === i.length) {
            const e = /(https?:\/\/[^\s\]\)"']+|data:[^\s\]\)"']+)/g;
            for (a = e.exec(t); a; ) (i.push(a[1]), (a = e.exec(t)));
          }
          i.length > 0 &&
            ((e = i),
            console.log(
              "[Grok Image] 从 reasoning_content 提取到图片 URL 数:",
              e.length,
            ));
        }
      }
    }
    if (0 === e.length) {
      let t = function (e) {
        if (e) {
          if ("string" == typeof e) {
            const t = e.trim();
            if (
              (t.startsWith("http://") ||
                t.startsWith("https://") ||
                t.startsWith("data:image")) &&
              t.length > 50
            )
              return void (i.has(t) || (i.add(t), o.push(t)));
            const r = e,
              a = r.match(
                /!\[[^\]]*\]\s*\(\s*(https?:\/\/[^)\s]+|data:[^)\s]+)\s*\)/g,
              );
            a &&
              a.forEach((e) => {
                const t = e.replace(/!\[[^\]]*\]\s*\(\s*|\s*\)$/g, "");
                t && !i.has(t) && (i.add(t), o.push(t));
              });
            const s = r.match(/\]\s*\(\s*(https?:\/\/[^)\s]+)\s*\)/g);
            s &&
              s.forEach((e) => {
                const t = e.replace(/\]\s*\(\s*|\s*\)$/g, "");
                t && !i.has(t) && (i.add(t), o.push(t));
              });
            const l = r.match(/(https?:\/\/[^\s\]\)"'\n]+)/g);
            return void (
              l &&
              l.forEach((e) => {
                (!/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(e) &&
                  !/file_download|\/image\//.test(e)) ||
                  i.has(e) ||
                  (i.add(e), o.push(e));
              })
            );
          }
          Array.isArray(e)
            ? e.forEach(t)
            : "object" == typeof e && Object.values(e).forEach(t);
        }
      };
      const o = [],
        i = new Set();
      (t(result),
        o.length > 0 &&
          ((e = o),
          console.log(
            "[Grok Image] 从响应深度扫描提取到图片 URL 数:",
            e.length,
          )));
    }
    if (e.length > 0) {
      const t = e[0];
      if (
        (void 0 !== k && void 0 !== T && (k[T] = t),
        e.forEach((url, e) => {
          to(url, `${taskId}_${e}`).catch(() => {});
        }),
        A((o) =>
          o.map((o) =>
            o.id === taskId
              ? {
                  ...o,
                  status: "completed",
                  progress: 100,
                  url: t,
                  mjImages: e.length > 1 ? e : void 0,
                  selectedMjImageIndex: 0,
                  durationMs: o.startTime ? Date.now() - o.startTime : void 0,
                }
              : o,
          ),
        ),
        j(y.id, {
          isGenerating: !1,
          content: t,
          settings: {
            ...y.settings,
            isGenerating: !1,
            progress: 100,
            error: null,
            generatedImages: e.map((url, e) => ({
              id: `${taskId}_${e}`,
              thumbUrl: url,
              fullUrl: url,
              createdAt: Date.now(),
            })),
          },
        }),
        void 0 !== k && void 0 !== T)
      ) {
        const e = k.filter((e) => e && e.length > 0);
        (await new Promise((e) => setTimeout(e, 100)),
          await E(t, "image", {
            previewMjImages: e.length > 0 ? e : void 0,
            selectedPreviewImage: t,
            sourceNodeName: L,
            previewSourceModel: v,
          }));
      } else
        await E(
          t,
          "image",
          e.length > 1
            ? {
                previewMjImages: e,
                selectedPreviewImage: t,
                sourceNodeName: L,
                previewSourceModel: v,
              }
            : { sourceNodeName: L, previewSourceModel: v },
        );
      console.log("[Grok Image] ✅ 图片处理完成");
    } else {
      const e = String(
        (null == (a = result.error) ? void 0 : a.message) ??
          result.message ??
          "未返回图片",
      );
      (A((t) =>
        t.map((t) =>
          t.id === taskId
            ? { ...t, status: "failed", progress: 0, errorMsg: e }
            : t,
        ),
      ),
        j(y.id, {
          isGenerating: !1,
          errorMsg: e,
          settings: { ...y.settings, isGenerating: !1, progress: 0, error: e },
        }),
        console.warn(
          "[Grok Image] 未从响应中解析到图片 URL。完整 message 键:",
          (
            null == (l = null == (s = result.choices) ? void 0 : s[0])
              ? void 0
              : l.message
          )
            ? Object.keys(result.choices[0].message)
            : "无 choices",
        ));
    }
  } else if (v.includes("z-image-turbo") || v.includes("z-image-official")) {
    const e = pe(v);
    console.log(
      `[Z-Image ${e ? "Official" : "Proxy"}] 处理同步响应:`,
      JSON.stringify(result).substring(0, 500),
    );
    let t = [];
    if (e) {
      const e = result.output;
      if (
        (null == e ? void 0 : e.choices) &&
        Array.isArray(e.choices) &&
        e.choices.length > 0
      ) {
        const o = e.choices[0],
          content =
            null == (c = null == o ? void 0 : o.message) ? void 0 : c.content;
        if (content && Array.isArray(content)) {
          const e = content.filter(
            (e) => e && "object" == typeof e && "image" in e,
          );
          t = e.map((e) => e.image).filter((e) => "string" == typeof e);
        }
      }
      console.log("[Z-Image Official] 提取的图片 URLs:", t);
    } else
      (console.log(
        "[Z-Image Turbo Proxy] 完整响应数据:",
        JSON.stringify(result).substring(0, 500),
      ),
        console.log("[Z-Image Turbo Proxy] 响应数据键:", Object.keys(result)),
        result.data && Array.isArray(result.data) && result.data.length > 0
          ? (console.log(
              "[Z-Image Turbo Proxy] data 数组长度:",
              result.data.length,
            ),
            console.log(
              "[Z-Image Turbo Proxy] 第一个 data 项:",
              JSON.stringify(result.data[0]),
            ),
            (t = result.data.map((e) => e.url).filter(Boolean)))
          : (console.warn(
              "[Z-Image Turbo Proxy] ⚠️ 响应中没有 data 数组或为空",
            ),
            result.images && Array.isArray(result.images)
              ? (console.log("[Z-Image Turbo Proxy] 尝试从 images 字段提取"),
                (t = result.images
                  .map((e) => ("string" == typeof e ? e : e.url))
                  .filter(Boolean)))
              : result.url &&
                (console.log("[Z-Image Turbo Proxy] 尝试从 url 字段提取"),
                (t = "string" == typeof result.url ? [result.url] : []))),
        console.log("[Z-Image Proxy] 提取的图片 URLs:", t));
    if (t.length > 0) {
      const o = t[0];
      if (
        (void 0 !== k &&
          void 0 !== T &&
          ((k[T] = o),
          console.log(
            `[Z-Image ${e ? "Official" : "Proxy"}] 批量任务 ${T + 1}，写入累加器:`,
            o,
          ),
          console.log(
            `[Z-Image ${e ? "Official" : "Proxy"}] 当前累加器状态:`,
            k,
          )),
        t.forEach((url, t) => {
          to(url, `${taskId}_${t}`).catch((o) => {
            console.error(
              `[Z-Image ${e ? "Official" : "Proxy"}] 下载图片 ${t} 失败:`,
              o,
            );
          });
        }),
        A((e) =>
          e.map((e) => {
            if (e.id === taskId) {
              const i = e.startTime ? Date.now() - e.startTime : void 0;
              return {
                ...e,
                status: "completed",
                progress: 100,
                url: o,
                mjImages: t.length > 1 ? t : void 0,
                selectedMjImageIndex: 0,
                durationMs: i,
              };
            }
            return e;
          }),
        ),
        j(y.id, {
          isGenerating: !1,
          content: o,
          settings: {
            ...y.settings,
            isGenerating: !1,
            progress: 100,
            error: null,
            generatedImages: t.map((url, e) => ({
              id: `${taskId}_${e}`,
              thumbUrl: url,
              fullUrl: url,
              createdAt: Date.now(),
            })),
          },
        }),
        void 0 !== k && void 0 !== T)
      ) {
        const t = k.filter((url) => url && url.length > 0);
        (console.log(
          `[Z-Image ${e ? "Official" : "Proxy"}] 批量生成，当前已完成 ${t.length} 张`,
        ),
          console.log(
            `[Z-Image ${e ? "Official" : "Proxy"}] connectedPreviewId:`,
            O,
          ),
          await new Promise((e) => setTimeout(e, 100)),
          await E(o, "image", {
            previewMjImages: t.length > 0 ? t : void 0,
            selectedPreviewImage: o,
            sourceNodeName: L,
            previewSourceModel: v,
          }));
      } else
        (console.log(
          `[Z-Image ${e ? "Official" : "Proxy"}] 单张生成，更新预览节点`,
        ),
          console.log(
            `[Z-Image ${e ? "Official" : "Proxy"}] connectedPreviewId:`,
            O,
          ),
          await E(
            o,
            "image",
            t.length > 1
              ? {
                  previewMjImages: t,
                  selectedPreviewImage: o,
                  sourceNodeName: L,
                  previewSourceModel: v,
                }
              : { sourceNodeName: L, previewSourceModel: v },
          ));
      console.log(
        `[Z-Image ${e ? "Official" : "Proxy"}] ✅ 图片处理完成，共 ${t.length} 张`,
      );
    } else {
      const t = String(
        result.message ?? result.error ?? result.code ?? "未返回图片 URL",
      );
      (console.error(
        `[Z-Image ${e ? "Official" : "Proxy"}] 生成失败:`,
        t,
        result,
      ),
        A((e) =>
          e.map((e) =>
            e.id === taskId
              ? { ...e, status: "failed", progress: 0, errorMsg: t }
              : e,
          ),
        ),
        j(y.id, {
          isGenerating: !1,
          errorMsg: t,
          settings: { ...y.settings, isGenerating: !1, progress: 0, error: t },
        }));
    }
  } else if (he(v)) {
    console.log(
      "[Wan 2.6 Image Official] 处理响应:",
      JSON.stringify(result).substring(0, 500),
    );
    let e = [],
      t = [];
    const o = (null == (d = y.settings) ? void 0 : d.enableInterleave) ?? !1,
      i = result.output;
    if (
      (null == i ? void 0 : i.choices) &&
      Array.isArray(i.choices) &&
      i.choices.length > 0
    ) {
      const o = i.choices[0],
        content =
          null == (u = null == o ? void 0 : o.message) ? void 0 : u.content;
      if (content && Array.isArray(content))
        for (const i of content)
          "image" === i.type && i.image
            ? e.push(i.image)
            : "text" === i.type && i.text && t.push(i.text);
    }
    if (
      (console.log("[Wan 2.6 Image Official] 提取的图片 URLs:", e),
      console.log("[Wan 2.6 Image Official] 提取的文本内容:", t),
      e.length > 0)
    ) {
      const i = e[0];
      if (
        (void 0 !== k &&
          void 0 !== T &&
          ((k[T] = i),
          console.log(
            `[Wan 2.6 Image Official] 批量任务 ${T + 1}，写入累加器:`,
            i,
          ),
          console.log("[Wan 2.6 Image Official] 当前累加器状态:", k)),
        e.forEach((url, e) => {
          to(url, `${taskId}_${e}`).catch((t) => {
            console.error(`[Wan 2.6 Image Official] 下载图片 ${e} 失败:`, t);
          });
        }),
        A((r) =>
          r.map((r) => {
            if (r.id === taskId) {
              const a = r.startTime ? Date.now() - r.startTime : void 0;
              return {
                ...r,
                status: "completed",
                progress: 100,
                url: i,
                mjImages: e.length > 1 ? e : void 0,
                selectedMjImageIndex: 0,
                durationMs: a,
                ...(o && t.length > 0 ? { generatedText: t.join("\n") } : {}),
              };
            }
            return r;
          }),
        ),
        j(y.id, {
          isGenerating: !1,
          content: i,
          settings: {
            ...y.settings,
            isGenerating: !1,
            progress: 100,
            error: null,
            generatedImages: e.map((url, e) => ({
              id: `${taskId}_${e}`,
              thumbUrl: url,
              fullUrl: url,
              createdAt: Date.now(),
            })),
            ...(o && t.length > 0 ? { generatedText: t.join("\n") } : {}),
          },
        }),
        void 0 !== k && void 0 !== T)
      ) {
        const e = k.filter((url) => url && url.length > 0);
        (console.log(
          `[Wan 2.6 Image Official] 批量生成，当前已完成 ${e.length} 张`,
        ),
          await new Promise((e) => setTimeout(e, 100)),
          await E(i, "image", {
            previewMjImages: e.length > 0 ? e : void 0,
            selectedPreviewImage: i,
            sourceNodeName: L,
            previewSourceModel: v,
          }));
      } else
        (console.log("[Wan 2.6 Image Official] 单张生成，更新预览节点"),
          await E(
            i,
            "image",
            e.length > 1
              ? {
                  previewMjImages: e,
                  selectedPreviewImage: i,
                  sourceNodeName: L,
                  previewSourceModel: v,
                }
              : { sourceNodeName: L, previewSourceModel: v },
          ));
      console.log(
        `[Wan 2.6 Image Official] ✅ 图片处理完成，共 ${e.length} 张${o ? `，文本 ${t.length} 段` : ""}`,
      );
    } else {
      const e = String(
        result.message ?? result.error ?? result.code ?? "未返回图片 URL",
      );
      (console.error("[Wan 2.6 Image Official] 生成失败:", e, result),
        A((t) =>
          t.map((t) =>
            t.id === taskId
              ? { ...t, status: "failed", progress: 0, errorMsg: e }
              : t,
          ),
        ),
        j(y.id, {
          isGenerating: !1,
          errorMsg: e,
          settings: { ...y.settings, isGenerating: !1, progress: 0, error: e },
        }));
    }
  } else if (fe(v)) {
    console.log("[Gemini Image Official] 处理响应", result);
    const candidates = result.candidates;
    let e = [];
    if (candidates && candidates.length > 0) {
      const content = candidates[0].content,
        t = null == content ? void 0 : content.parts;
      if (t && Array.isArray(t) && t.length > 0) {
        const o = [];
        for (const e of t) {
          const t = e.inline_data ?? e.inlineData;
          if (t && t.data) {
            const e = t.mime_type ?? t.mimeType ?? "image/png";
            o.push({ data: t.data, mime: e });
          }
        }
        o.length > 0 && (e = o.map((e) => `data:${e.mime};base64,${e.data}`));
      }
      if (0 === e.length) {
        const e =
            null == (g = null == content ? void 0 : content.parts)
              ? void 0
              : g[0],
          o = e ? Object.keys(e) : [];
        console.warn(
          "[Gemini Image Official] 响应中未找到图片 part。candidates[0].content.parts 长度:",
          (null == t ? void 0 : t.length) ?? 0,
          "首个 part 的 keys:",
          o,
          "content:",
          content,
        );
      }
    }
    if (e.length > 0) {
      const t = e.length > 1 ? e[e.length - 1] : e[0],
        o = e.length > 1 ? e.length - 1 : 0,
        i = `${taskId}_${o}`,
        r = e.map((e, t) => `${taskId}_${t}`);
      (void 0 !== k && void 0 !== T && (k[T] = t),
        await Promise.all(
          e.map(async (url, e) => {
            const t = `${taskId}_${e}`;
            await to(url, t);
            try {
              await kt.storeWithThumbnails(t, url);
            } catch (o) {
              console.warn("[Gemini Image Official] 缩略图生成跳过:", t, o);
            }
          }),
        ));
      let a = e;
      try {
        const e = await Promise.all(r.map((e) => kt.getPreview(e)));
        e.every((e) => null != e) && (a = e);
      } catch (D) {}
      const s = a[o] || t;
      if (
        (lo(s, i),
        e.length > 1 &&
          a.forEach((e, t) => {
            e && r[t] && lo(e, r[t]);
          }),
        A((t) =>
          t.map((t) => {
            if (t.id === taskId) {
              const o = t.startTime ? Date.now() - t.startTime : void 0;
              return {
                ...t,
                status: "completed",
                progress: 100,
                url: s,
                mjImages: e.length > 1 ? a : void 0,
                selectedMjImageIndex: 0,
                durationMs: o,
                _assetId: i,
                ...(e.length > 1 ? { _mjAssetIds: r } : {}),
              };
            }
            return t;
          }),
        ),
        j(y.id, {
          isGenerating: !1,
          content: s,
          settings: {
            ...y.settings,
            isGenerating: !1,
            progress: 100,
            error: null,
            generatedImages: e.map((url, e) => ({
              id: `${taskId}_${e}`,
              thumbUrl: a[e] || url,
              fullUrl: url,
              createdAt: Date.now(),
              assetId: `${taskId}_${e}`,
            })),
          },
        }),
        void 0 !== k && void 0 !== T)
      ) {
        const e = k.filter((e) => e && e.length > 0);
        await E(s, "image", {
          previewMjImages: e.length > 0 ? e : void 0,
          selectedPreviewImage: s,
          sourceNodeName: L,
          previewSourceModel: v,
        });
      } else {
        let o;
        try {
          const blob = await fetch(t).then((e) => e.blob()),
            e = await ao(blob);
          e.width > 0 && e.height > 0 && (o = `${e.width}×${e.height}`);
        } catch (D) {}
        await E(
          s,
          "image",
          e.length > 1
            ? {
                previewMjImages: a,
                selectedPreviewImage: s,
                sourceNodeName: L,
                previewSourceModel: v,
                previewActualSize: o,
                contentAssetId: i,
                previewMjAssetIds: r,
              }
            : {
                sourceNodeName: L,
                previewSourceModel: v,
                previewActualSize: o,
                contentAssetId: i,
              },
        );
      }
      console.log(
        "[Gemini Image Official] ✅ 图片处理完成，共",
        e.length,
        "张",
      );
    } else {
      const e =
          (null == (m = result.error) ? void 0 : m.message) ??
          result.message ??
          result.error,
        t =
          (null ==
          (f =
            null ==
            (p =
              null == (h = null == candidates ? void 0 : candidates[0])
                ? void 0
                : h.content)
              ? void 0
              : p.parts)
            ? void 0
            : f
                .map((e) => e.text ?? e.text)
                .filter(Boolean)
                .join(" ")) || "",
        o = t ? t.trim() : "",
        i = String(
          e ??
            (o
              ? `未返回图片。模型回复：${o.length > 120 ? o.slice(0, 120) + "…" : o}`
              : "未返回图片（响应中无图片数据，可能被安全过滤或模型未生成）"),
        );
      (console.error(
        "[Gemini Image Official] 生成失败:",
        i,
        "response:",
        result,
      ),
        A((e) =>
          e.map((e) =>
            e.id === taskId
              ? { ...e, status: "failed", progress: 0, errorMsg: i }
              : e,
          ),
        ),
        j(y.id, {
          isGenerating: !1,
          errorMsg: i,
          settings: { ...y.settings, isGenerating: !1, progress: 0, error: i },
        }));
    }
  } else {
    if (!(result.data && Array.isArray(result.data) && result.data.length > 0))
      throw (
        console.error("[Response] Invalid response format:", result),
        new Error("未返回图片数据")
      );
    {
      console.log(
        "[Sync Mode] Processing synchronous response, isMidjourney:",
        b,
        "isVideoGeneration:",
        _,
        "currentModel:",
        v,
      );
      const e = result.data
          .map((e) => {
            if (e.url) return e.url;
            if (e.b64_json) {
              let mimeType = "image/png";
              return (
                e.b64_json.startsWith("/9j/")
                  ? (mimeType = "image/jpeg")
                  : e.b64_json.startsWith("R0lGOD")
                    ? (mimeType = "image/gif")
                    : e.b64_json.startsWith("UklGR") &&
                      (mimeType = "image/webp"),
                console.log(
                  "[Sync Mode] ✓ 检测到 base64 图片数据，转换为 data URL",
                ),
                `data:${mimeType};base64,${e.b64_json}`
              );
            }
            return null;
          })
          .filter(Boolean),
        t = e[0];
      if (
        (console.log(
          "[Sync Mode] Result URLs:",
          e.length,
          "张",
          (null == (w = e[0]) ? void 0 : w.substring(0, 50)) + "...",
        ),
        J(v) && _ && t)
      ) {
        console.log("[Jimeng Video Sync] 检测到 Jimeng 视频同步响应:", t);
        const e = eo(t) || t;
        (to(t, taskId).catch((e) => {
          console.error("[Jimeng Video Sync] 下载视频失败:", e);
        }),
          A((t) =>
            t.map((t) => {
              if (t.id === taskId) {
                const o = t.startTime ? Date.now() - t.startTime : void 0;
                return {
                  ...t,
                  status: "completed",
                  progress: 100,
                  url: e,
                  durationMs: o,
                };
              }
              return t;
            }),
          ),
          j(y.id, {
            isGenerating: !1,
            content: e,
            settings: {
              ...y.settings,
              isGenerating: !1,
              progress: 100,
              error: null,
            },
          }));
        const o = e;
        return (
          console.log("[Jimeng Video Sync] 更新预览节点, previewId:", O),
          await E(o, "video", { sourceNodeName: L, previewSourceModel: v }),
          void console.log("[Jimeng Video Sync] ✅ 视频处理完成")
        );
      }
      if (b && 1 === e.length && !_)
        (console.log("[MJ Sync] Detected MJ single image:", t),
          to(t, taskId).catch((e) => {
            console.error("[MJ Sync] 下载图片失败:", e);
          }),
          A((e) =>
            e.map((e) => {
              if (e.id === taskId) {
                const o = e.startTime ? Date.now() - e.startTime : void 0;
                return {
                  ...e,
                  status: "completed",
                  progress: 100,
                  url: t,
                  mjOriginalUrl: t,
                  mjNeedsSplit: !0,
                  durationMs: o,
                };
              }
              return e;
            }),
          ),
          j(y.id, {
            isGenerating: !1,
            content: t,
            settings: {
              ...y.settings,
              isGenerating: !1,
              progress: 100,
              error: null,
            },
          }),
          console.log(
            "[MJ Sync] Updating preview with original image, previewId:",
            O,
          ),
          O
            ? await E(t, "image", { sourceNodeName: L, previewSourceModel: v })
            : console.warn("[MJ Sync] ⚠️ 预览节点ID为空，无法发送到预览窗口"),
          console.log("[MJ Sync] ========== 准备开始裁切 =========="),
          (async () => {
            try {
              (console.log("[MJ Sync] 🔪 Starting to split image immediately"),
                console.log(
                  "[MJ Sync] 🔪 Image URL to split:",
                  t.substring(0, 100),
                ));
              let o = t,
                i = !1;
              if (
                "undefined" != typeof window &&
                ("__TAURI__" in window || "__TAURI_INTERNALS__" in window) &&
                (t.startsWith("http://") || t.startsWith("https://"))
              )
                try {
                  const { downloadWithFallback: e } = await x(
                      async () => {
                        const { downloadWithFallback: e } =
                          await import("./tauriDownloader-BG3Xb0u0.js");
                        return { downloadWithFallback: e };
                      },
                      __vite__mapDeps([0, 1, 2]),
                      import.meta.url,
                    ),
                    blob = await e(t, 6e4);
                  ((o = URL.createObjectURL(blob)), (i = !0));
                } catch (e) {
                  console.warn(
                    "[MJ Sync] Tauri 下载原图失败，使用原 URL 裁切:",
                    e,
                  );
                }
              try {
                const e = await vo(o);
                (console.log("[MJ Sync] ✅ Split completed successfully!"),
                  console.log(
                    "[MJ Sync] ✅ Number of split images:",
                    e.length,
                  ));
                const t = e.map((e) => e.url);
                (console.log(
                  "[MJ Sync] ✅ Split URLs:",
                  t.map((e) => e.substring(0, 50)),
                ),
                  console.log(
                    "[MJ Sync] 📋 Creating independent Blob URLs for history...",
                  ));
                const i = await Promise.all(
                  t.map(async (url) => {
                    try {
                      const e = await fetch(url),
                        blob = await e.blob(),
                        t = URL.createObjectURL(blob);
                      return (
                        console.log(
                          "[MJ Sync] ✅ Created history blob:",
                          t.substring(0, 50),
                        ),
                        t
                      );
                    } catch (e) {
                      return (
                        console.error(
                          "[MJ Sync] ❌ Failed to create history blob:",
                          e,
                        ),
                        url
                      );
                    }
                  }),
                );
                (console.log("[MJ Sync] ✅ History Blob URLs created"),
                  console.log("[MJ Sync] 💾 开始保存切片到本地..."),
                  t.forEach((url, e) => {
                    to(url, `${taskId}_split_${e}`).catch((t) => {
                      console.error(`[MJ Sync] ❌ 保存切片 ${e + 1} 失败:`, t);
                    });
                  }),
                  console.log("[MJ Sync] ✅ 切片保存任务已启动"),
                  A((e) =>
                    e.map((e) =>
                      e.id === taskId
                        ? {
                            ...e,
                            url: i[0],
                            mjImages: i,
                            selectedMjImageIndex: 0,
                            mjNeedsSplit: !1,
                          }
                        : e,
                    ),
                  ),
                  console.log("[MJ Sync] ✅ History updated with split images"),
                  j(y.id, {
                    settings: {
                      ...y.settings,
                      mjImages: t,
                      selectedMjImageIndex: 0,
                    },
                  }),
                  console.log("[MJ Sync] ✅ Node settings updated"),
                  console.log(
                    "[MJ Sync] ✅ Updating preview with split images, previewId:",
                    O,
                  ),
                  await E(t[0], "image", {
                    previewMjImages: t,
                    selectedPreviewImage: t[0],
                    sourceNodeName: L,
                    previewSourceModel: v,
                  }),
                  console.log(
                    "[MJ Sync] ========== MJ 四宫格处理完成 ==========",
                  ));
              } finally {
                i && o.startsWith("blob:") && URL.revokeObjectURL(o);
              }
            } catch (o) {
              (console.error("[MJ Sync] ❌ 裁切失败:", o),
                console.error(
                  "[MJ Sync] ❌ 错误详情:",
                  o instanceof Error ? o.message : String(o),
                ),
                console.error(
                  "[MJ Sync] ❌ 错误堆栈:",
                  o instanceof Error ? o.stack : "No stack",
                ),
                console.warn("[MJ Sync] ⚠️ 裁切失败，保持显示原图"),
                A((e) =>
                  e.map((e) =>
                    e.id === taskId ? { ...e, mjSplitError: o.message } : e,
                  ),
                ),
                j(y.id, {
                  settings: { ...y.settings, mjSplitError: o.message },
                }));
            }
          })());
      else {
        (to(t, taskId).catch((e) => {
          console.error("[Sync] 下载失败:", e);
        }),
          e.length > 1 &&
            e.slice(1).forEach((url, e) => {
              to(url, `${taskId}_${e + 1}`).catch((t) => {
                console.error(`[Sync] 下载第${e + 2}张失败:`, t);
              });
            }),
          A((o) =>
            o.map((o) => {
              if (o.id === taskId) {
                const i = o.startTime ? Date.now() - o.startTime : void 0;
                return {
                  ...o,
                  status: "completed",
                  progress: 100,
                  url: t,
                  mjImages: e.length > 1 ? e : void 0,
                  selectedMjImageIndex: 0,
                  durationMs: i,
                };
              }
              return o;
            }),
          ));
        const o = e.map((url, e) => ({
          id: `${taskId}_${e}`,
          thumbUrl: url,
          fullUrl: url,
          createdAt: Date.now(),
        }));
        (j(y.id, {
          isGenerating: !1,
          content: t,
          settings: {
            ...y.settings,
            isGenerating: !1,
            progress: 100,
            error: null,
            generatedImages: o,
          },
        }),
          console.log("[Sync] Updating preview, previewIds:", U),
          await E(
            t,
            "image",
            e.length > 1
              ? { previewMjImages: e, sourceNodeName: L, previewSourceModel: v }
              : { sourceNodeName: L, previewSourceModel: v },
          ));
      }
    }
  }
}
function vi() {
  const e = [
    "pool",
    "maxSize",
    "length",
    "pop",
    "release",
    "clear",
    "get",
    "accessOrder",
    "indexOf",
    "splice",
    "set",
    "cache",
    "size",
    "push",
    "nodeIdMap",
    "nextIndex",
    "capacity",
    "expand",
    "positions",
    "delete",
    " nodes",
    "objectPools",
  ];
  return (vi = function () {
    return e;
  })();
}
const bi = Ii;
o = bi(0);
class _i {
  constructor() {
    (u(this, "pool", []), u(this, i, 500));
  }
  acquire(e, t, o, i) {
    const r = Ii,
      a = this.pool[r(3)]();
    return a
      ? ((a.x = e), (a.y = t), (a.width = o), (a.height = i), a)
      : { x: e, y: t, width: o, height: i };
  }
  [((i = bi(1)), bi(4))](e) {
    const t = Ii;
    this.pool[t(2)] < this.maxSize && this.pool.push(e);
  }
  [bi(5)]() {
    this[Ii(0)] = [];
  }
  getStats() {
    const e = Ii;
    return { poolSize: this.pool[e(2)], maxSize: this.maxSize };
  }
}
function Ii(e, t) {
  e -= 0;
  return vi()[e];
}
class Si {
  constructor() {
    (u(this, "cache", new Map()),
      u(this, "accessOrder", []),
      u(this, "maxSize", 1e3));
  }
  [bi(6)](e) {
    const t = Ii,
      o = this.cache.get(e);
    if (void 0 !== o) {
      const o = this[t(7)][t(8)](e);
      (o > -1 && this.accessOrder[t(9)](o, 1), this[t(7)].push(e));
    }
    return o;
  }
  [bi(10)](e, t) {
    const o = Ii;
    if (this[o(11)].has(e)) {
      const i = this[o(7)][o(8)](e);
      return (
        i > -1 && this.accessOrder.splice(i, 1),
        this.accessOrder.push(e),
        void this.cache.set(e, t)
      );
    }
    if (this.cache[o(12)] >= this.maxSize) {
      const e = this.accessOrder.shift();
      e && this.cache.delete(e);
    }
    (this[o(11)][o(10)](e, t), this.accessOrder[o(13)](e));
  }
  [bi(5)]() {
    const e = Ii;
    (this.cache[e(5)](), (this.accessOrder = []));
  }
  getStats() {
    const e = Ii;
    return { cacheSize: this.cache[e(12)], maxSize: this[e(1)] };
  }
}
class ji {
  constructor(e = 1e3) {
    (u(this, "positions"),
      u(this, a, new Map()),
      u(this, r, 0),
      u(this, "capacity"),
      (this.capacity = e),
      (this.positions = new Float32Array(4 * e)));
  }
  setPosition(e, t, o, i, r) {
    const a = Ii;
    let s = this.nodeIdMap.get(e);
    void 0 === s &&
      (this[a(15)] >= this[a(16)] && this[a(17)](),
      (s = this.nextIndex++),
      this[a(14)].set(e, s));
    const l = 4 * s;
    ((this.positions[l] = t),
      (this[a(18)][l + 1] = o),
      (this[a(18)][l + 2] = i),
      (this.positions[l + 3] = r));
  }
  getPosition(e) {
    const t = Ii,
      o = this[t(14)][t(6)](e);
    if (void 0 === o) return null;
    const i = 4 * o;
    return {
      x: this[t(18)][i],
      y: this.positions[i + 1],
      width: this.positions[i + 2],
      height: this[t(18)][i + 3],
    };
  }
  removeNode(e) {
    const t = Ii;
    this[t(14)][t(19)](e);
  }
  [((a = bi(14)), (r = bi(15)), bi(17))]() {
    const e = Ii,
      t = 2 * this.capacity,
      o = new Float32Array(4 * t);
    (o[e(10)](this.positions),
      (this[e(18)] = o),
      (this.capacity = t),
      console.log("[NodePositionArray] Expanded to " + t + e(20)));
  }
  clear() {
    const e = Ii;
    (this.nodeIdMap.clear(), (this.nextIndex = 0), this[e(18)].fill(0));
  }
  getStats() {
    const e = Ii;
    return {
      nodeCount: this[e(14)][e(12)],
      capacity: this.capacity,
      memoryUsage: this.positions.byteLength,
    };
  }
}
const Ai = new (class {
    constructor() {
      (u(this, o, []), u(this, "maxSize", 1e3));
    }
    acquire(e, t) {
      const o = this.pool.pop();
      return o ? ((o.x = e), (o.y = t), o) : { x: e, y: t };
    }
    release(e) {
      const t = Ii;
      this.pool.length < this[t(1)] && this.pool.push(e);
    }
    releaseMany(e) {
      e.forEach((e) => this.release(e));
    }
    clear() {
      this[Ii(0)] = [];
    }
    getStats() {
      const e = Ii;
      return { poolSize: this.pool[e(2)], maxSize: this.maxSize };
    }
  })(),
  Pi = new _i(),
  xi = new Si(),
  ki = new ji();
"undefined" != typeof window &&
  (window[bi(21)] = {
    position: Ai,
    boundingBox: Pi,
    pathString: xi,
    nodePosition: ki,
  });
const Ti = new Map(),
  $i = new Map(),
  Mi = new Map();
let Ci = null;
"undefined" != typeof window && (window.debugNodeCache = $i);
const Ui = (e) => {
    try {
      const t = new DOMMatrix(e.style.transform || "matrix(1, 0, 0, 1, 0, 0)");
      return { x: t.e, y: t.f };
    } catch {
      const t = e.style.transform,
        o = null == t ? void 0 : t.match(/translate3d\(([^,]+)px,\s*([^,]+)px/);
      return { x: o ? parseFloat(o[1]) : 0, y: o ? parseFloat(o[2]) : 0 };
    }
  },
  Oi = (e, t, o = 1) => {
    if (t) {
      Ti.set(e, t);
      const i = t.getBoundingClientRect(),
        r = Ui(t),
        a = o > 0 ? o : 1;
      let s = i.width / a,
        l = i.height / a;
      if (s < 10 || l < 10) {
        const e = t.style.width,
          o = t.style.height;
        (e && "auto" !== e && (s = parseFloat(e) || 260),
          o && "auto" !== o && (l = parseFloat(o) || 260),
          s < 10 && (s = t.offsetWidth / a || 260),
          l < 10 && (l = t.offsetHeight / a || 260));
      }
      $i.set(e, { x: r.x, y: r.y, width: s, height: l });
    } else (Ti.delete(e), $i.delete(e));
  },
  Ei = (e) => {
    (Ti.delete(e), $i.delete(e));
  },
  Li = (e, width, height) => {
    const t = $i.get(e);
    t && ((t.width = width), (t.height = height));
  },
  Ri = (e, t, o) => {
    const i = $i.get(e);
    i
      ? ((i.x = t), (i.y = o))
      : $i.set(e, { x: t, y: o, width: 260, height: 260 });
  },
  Ni = (e) => $i.get(e) || null,
  Di = (e, t, o, i) => {
    const r = `${Math.round(e)},${Math.round(t)},${Math.round(o)},${Math.round(i)}`,
      a = xi.get(r);
    if (a) return a;
    const s = Math.max(0.5 * Math.abs(o - e), 50),
      l = `M ${e} ${t} C ${e + s} ${t}, ${o - s} ${i}, ${o} ${i}`;
    return (xi.set(r, l), l);
  },
  Fi = (e, t, o, i, r, a, s) => {
    var l;
    if (!o || 0 === e.length) return;
    const c = void 0 !== i ? i : t.zoom;
    (null !== Ci && Math.abs(Ci - c) > 1e-6 && $i.clear(), (Ci = c));
    for (const d of e) {
      const e = null == s ? void 0 : s.get(d.from);
      let i = $i.get(d.from);
      if (e)
        i = { x: e.output.x - 1, y: e.output.y - 0.5, width: 1, height: 1 };
      else if (r === d.from && a) {
        const e = $i.get(d.from);
        ((i = {
          x: a.x,
          y: a.y,
          width: (null == e ? void 0 : e.width) || 260,
          height: (null == e ? void 0 : e.height) || 260,
        }),
          $i.set(d.from, i));
      } else if (!i) {
        const e =
          Ti.get(d.from) ||
          document.querySelector(`[data-node-id="${d.from}"]`);
        if (e) {
          const t = Ui(e),
            o = e.getBoundingClientRect(),
            r = c > 0 ? c : 1;
          ((i = { x: t.x, y: t.y, width: o.width / r, height: o.height / r }),
            $i.set(d.from, i));
        }
      }
      const u = null == s ? void 0 : s.get(d.to);
      let g = $i.get(d.to);
      if (u) g = { x: u.input.x, y: u.input.y - 0.5, width: 1, height: 1 };
      else if (r === d.to && a) {
        const e = $i.get(d.to);
        ((g = {
          x: a.x,
          y: a.y,
          width: (null == e ? void 0 : e.width) || 260,
          height: (null == e ? void 0 : e.height) || 260,
        }),
          $i.set(d.to, g));
      } else if (!g) {
        const e =
          Ti.get(d.to) || document.querySelector(`[data-node-id="${d.to}"]`);
        if (e) {
          const t = Ui(e),
            o = e.getBoundingClientRect(),
            i = c > 0 ? c : 1;
          ((g = { x: t.x, y: t.y, width: o.width / i, height: o.height / i }),
            $i.set(d.to, g));
        }
      }
      if (!i || !g) continue;
      const m = 0,
        h = 0,
        p = (i.x + i.width) * c + t.x;
      let f = (i.y + i.height / 2) * c + t.y + h;
      const w = g.x * c + t.x;
      let y = (g.y + g.height / 2) * c + t.y + m;
      const v = Di(p, f, w, y),
        b = o.querySelector(`[data-connection-id="${d.id}"]`);
      if (b) {
        b.querySelectorAll("path").forEach((e) => {
          e.setAttribute("d", v);
        });
        const e = b.querySelector(".edge-delete-btn");
        if (e) {
          const t = (p + w) / 2,
            o = (f + y) / 2;
          e.setAttribute("transform", `translate(${t}, ${o})`);
        }
      } else {
        let e = Mi.get(d.id);
        if (
          (e ||
            ((e = o.querySelector(
              `[data-connection-id="${d.id}"] path.edge-main`,
            )),
            e && Mi.set(d.id, e)),
          e)
        ) {
          e.setAttribute("d", v);
          const t =
            null == (l = e.parentElement)
              ? void 0
              : l.querySelector(".edge-hit-path");
          t && t.setAttribute("d", v);
        }
      }
    }
  },
  Wi = "qiaodoumayi_model_settings_memory";
function zi() {
  const e = Vi;
  try {
    const t = localStorage[e(0)](Wi);
    return t ? JSON[e(1)](t) : {};
  } catch (t) {
    return (console.error("读取模型设置记忆失败:", t), {});
  }
}
function Bi(e) {
  return zi()[e] || null;
}
function Gi(e, t) {
  const o = Vi;
  try {
    const o = zi();
    ((o[e] = { ...o[e], ...t }), localStorage.setItem(Wi, JSON.stringify(o)));
  } catch (i) {
    console.error(o(2), i);
  }
}
const Ji = Vi(5);
function Vi(e, t) {
  e -= 0;
  return Hi()[e];
}
function Ki(e, t) {
  try {
    const o = localStorage.getItem(Ji),
      i = o ? JSON.parse(o) : {};
    ((i[e] = t), localStorage.setItem(Ji, JSON.stringify(i)));
  } catch (o) {
    console.error("保存最近使用模型失败:", o);
  }
}
function Hi() {
  const e = [
    "getItem",
    "parse",
    "保存模型设置记忆失败:",
    "error",
    "清除模型设置记忆失败:",
    "qiaodoumayi_last_used_model",
  ];
  return (Hi = function () {
    return e;
  })();
}
function qi(e) {
  try {
    const t = localStorage.getItem(Ji);
    if (!t) return null;
    return JSON.parse(t)[e] || null;
  } catch (t) {
    return (console.error("读取最近使用模型失败:", t), null);
  }
}
function Zi(type) {
  return (
    {
      "input-image": "图片输入",
      "text-node": "文本节点",
      "novel-input": "小说输入",
      "video-input": "视频输入",
      "video-analyze": "视频分析",
      "storyboard-node": "分镜节点",
      "gen-image": "生成图片",
      "gen-video": "生成视频",
      "gen-music": "生成音乐",
      "image-compare": "图片对比",
      preview: "预览节点",
      "local-save": "本地保存",
      "extract-characters-scenes": "提取角色场景",
      "character-description": "角色描述",
      "scene-description": "场景描述",
      "create-character": "创建角色",
      "create-scene": "创建场景",
      "generate-character-video": "生成角色视频",
      "generate-scene-video": "生成场景视频",
      "generate-character-image": "生成角色图片",
      "generate-scene-image": "生成场景图片",
      "camera-movement": "镜头运动",
      "professional-camera": "专业镜头",
      "custom-agent": "自定义代理",
      "canvas-node": "画板节点",
      "rh-app": "RH 应用",
      "rh-comfy": "RH Comfy",
      "jimeng-super-resolution": "智能超清",
      "table-editor-node": "表格编辑器",
      "storyboard-chart-node": "分镜图表",
      "doodle-canvas": "涂鸦画板",
      "inpaint-crop": "裁剪局部重绘",
      "inpaint-stitch": "无缝拼回",
    }[type] || "节点"
  );
}
function Qi(type) {
  switch (type) {
    case "gen-video":
    case "gen-image":
      return { w: 360, h: 340 };
    case "video-input":
      return { w: 360, h: 420 };
    case "video-analyze":
    case "novel-input":
    case "extract-characters-scenes":
      return { w: 400, h: 500 };
    case "storyboard-node":
    case "canvas-node":
      return { w: 600, h: 500 };
    case "image-compare":
      return { w: 400, h: 300 };
    case "preview":
      return { w: 440, h: 310 };
    case "text-node":
      return { w: 360, h: 280 };
    case "character-description":
    case "scene-description":
      return { w: 400, h: 400 };
    case "create-character":
    case "create-scene":
      return { w: 350, h: 300 };
    case "generate-character-video":
    case "generate-scene-video":
    case "generate-character-image":
    case "generate-scene-image":
      return { w: 400, h: 450 };
    case "local-save":
      return { w: 320, h: 380 };
    case "camera-movement":
      return { w: 340, h: 480 };
    case "professional-camera":
      return { w: 320, h: 420 };
    case "gen-music":
      return { w: 350, h: 700 };
    case "custom-agent":
      return { w: 500, h: 800 };
    case "rh-app":
    case "rh-comfy":
      return { w: 340, h: 420 };
    case "jimeng-super-resolution":
      return { w: 320, h: 280 };
    case "table-editor-node":
      return { w: 520, h: 420 };
    case "storyboard-chart-node":
      return { w: 540, h: 480 };
    case "doodle-canvas":
      return { w: 500, h: 300 };
    case "inpaint-crop":
    case "inpaint-stitch":
      return { w: 340, h: 380 };
    default:
      return { w: 260, h: 260 };
  }
}
function Xi(e, type, t = 100, o = 100, i, r, a) {
  const s = Qi(type),
    l = Zi(type);
  let c = i || l;
  if (!i && a) {
    const e = a.filter((e) => e.type === type);
    if (e.length > 0) {
      const t = e
          .map((e) => {
            const name = e.nodeName || "",
              t = l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              o = name.match(new RegExp(`^${t}_(\\d+)$`));
            return o ? parseInt(o[1], 10) : name === l ? 0 : -1;
          })
          .filter((e) => e >= 0),
        o = (t.length > 0 ? Math.max(...t) : -1) + 1;
      o > 0 && (c = `${l}_${o}`);
    }
  }
  const d = {};
  if (
    (r && Object.assign(d, r),
    type.includes("image") || "storyboard-chart-node" === type)
  ) {
    const e = qi(type) || "nano-banana";
    d.model || (d.model = e);
    const t = Bi(d.model);
    t
      ? (!d.ratio && t.aspectRatio && (d.ratio = t.aspectRatio),
        !d.resolution && t.resolution && (d.resolution = t.resolution),
        !d.batchCount && t.imageCount && (d.batchCount = t.imageCount))
      : (d.ratio || (d.ratio = "1:1"),
        d.resolution || (d.resolution = "1K"),
        d.batchCount || (d.batchCount = 1));
  }
  if (type.includes("video")) {
    const e = qi(type) || "sora-2";
    d.model || (d.model = e);
    const t = Bi(d.model);
    t
      ? (!d.ratio && t.aspectRatio && (d.ratio = t.aspectRatio),
        !d.resolution &&
          t.videoResolution &&
          (d.resolution = t.videoResolution),
        !d.duration && t.videoDuration && (d.duration = `${t.videoDuration}s`))
      : (d.ratio || (d.ratio = "16:9"),
        d.resolution || (d.resolution = "1080P"));
  }
  return {
    id: e,
    type: type,
    x: t,
    y: o,
    width: s.w,
    height: s.h,
    content: "",
    prompt: "",
    settings: d,
    nodeName: c,
  };
}
const Yi = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      createNode: Xi,
      getNodeDefaultSize: Qi,
      getNodeTypeName: Zi,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
function er() {
  const e = [
    "data:",
    "warn",
    "blob",
    "saveBlobAsset",
    "getItem",
    "parse",
    "map",
    "filter",
    "has",
    "length",
    "发现 ",
    "error",
    "成功添加 ",
    "import",
    "合并角色库失败:",
  ];
  return (er = function () {
    return e;
  })();
}
const tr = async (e, t) => {
  const o = or;
  if (!e) return e;
  if (e.startsWith("blob:")) return e;
  try {
    if (e.startsWith(o(0))) {
      const o = await fetch(e),
        i = await o.blob(),
        r = "character_" + t;
      return (await Be.saveBlobAsset(r, i, e), URL.createObjectURL(i));
    }
    const i = await fetch(e);
    if (!i.ok) return (console[o(1)]("无法获取角色缩略图:", e), e);
    const r = await i[o(2)](),
      a = "character_" + t;
    return (await Be[o(3)](a, r, e), URL.createObjectURL(r));
  } catch (i) {
    return (console.warn("转换角色缩略图失败:", e, i), e);
  }
};
function or(e, t) {
  e -= 0;
  return er()[e];
}
const nr = async (e, t, o) => {
    const i = or;
    try {
      const a = (() => {
          const e = or;
          try {
            const t = localStorage[e(4)]("qiaodoumayi_characters");
            return t ? JSON[e(5)](t) : [];
          } catch {
            return [];
          }
        })(),
        s = new Set(a[i(6)]((e) => e.id)),
        l = e[i(7)]((e) => !s[i(8)](e.id));
      if (0 === l[i(9)])
        return (
          null == o || o(95, "角色库已是最新，无需更新", "import"),
          void t(a)
        );
      null == o ||
        o(92, i(10) + l.length + " 个新角色，正在保存到本地缓存...", "import");
      const c = [];
      for (let e = 0; e < l[i(9)]; e++) {
        const t = l[e];
        null == o ||
          o(
            92 + (e / l.length) * 3,
            "正在处理角色 " + (e + 1) + "/" + l.length + ": " + t.name,
            "import",
          );
        const i = await tr(t.imageUrl, t.id);
        c.push({ ...t, imageUrl: i, _assetId: "character_" + t.id });
      }
      const d = [...a, ...c];
      try {
        localStorage.setItem("qiaodoumayi_characters", JSON.stringify(d));
      } catch (r) {
        console[i(11)]("保存角色库到 localStorage 失败:", r);
      }
      (t(d),
        null == o || o(95, i(12) + l.length + " 个新角色到本地角色库", i(13)));
    } catch (a) {
      console[i(11)](i(14), a);
      try {
        const o = (() => {
            try {
              const e = localStorage.getItem("qiaodoumayi_characters");
              return e ? JSON.parse(e) : [];
            } catch {
              return [];
            }
          })(),
          r = new Set(o[i(6)]((e) => e.id)),
          a = e[i(7)]((e) => !r.has(e.id));
        if (a.length > 0) {
          const e = [...o, ...a];
          (localStorage.setItem("qiaodoumayi_characters", JSON.stringify(e)),
            t(e));
        } else t(o);
      } catch (s) {
        (console.error("降级处理也失败:", s), t(e));
      }
    }
  },
  ir = ur,
  rr = "undefined" != typeof window && ir(0) in window;
function ar(e, ...t) {
  return [e.replace(/\\/g, "/").replace(/\/+$/, ""), ...t]
    .join("/")
    .replace(/\/+/g, "/");
}
const sr = "qiaodoumayi_cache_dir",
  lr = "handles",
  cr = ir(1);
function dr() {
  const e = [
    "__TAURI__",
    "cacheDirectoryHandle",
    "open",
    "objectStoreNames",
    "contains",
    "createObjectStore",
    "onsuccess",
    "close",
    "error",
    "result",
    "readonly",
    "objectStore",
    "directoryPathTauri",
    "manifest",
    "manifestDirty",
    "setDirectoryHandle",
    "log",
    "_registerAssetListener",
    "_unregisterAssetListener",
    "getDirectoryHandle",
    "prompt",
    "readwrite",
    "requestPermission",
    "[LocalCacheManager] requestPermission result:",
    "[LocalCacheManager] requestPermission failed (likely no user gesture):",
    "keys",
    "warn",
    "directoryHandle",
    "_restorePromise",
    "hasAsset",
    "assets",
    "image/",
    "getSubdirectory",
    "startsWith",
    "png",
    "split",
    "set",
    "buffer",
    "subtle",
    "from",
    "join",
    "string",
    "decode",
    "parse",
    " assets",
    "1.0",
    "toISOString",
    "getFileHandle",
    "manifest.json",
    "text",
    "[LocalCacheManager] Manifest loaded: ",
    "[LocalCacheManager] Created new manifest",
    "manifestWriteTimer",
    "updatedAt",
    "[LocalCacheManager] Failed to write manifest:",
    "processingQueue",
    "remoteUrl",
    "size",
    " -> ",
    "toFixed",
    "getExtension",
    "substring",
    "now",
    "[LocalCacheManager] ✅ Saved (Tauri): ",
    "scheduleManifestWrite",
    "dataUrlToBlob",
    "length",
    "charCodeAt",
    "saveThumbnail",
    "isAvailable",
    "thumbnails",
    "[LocalCacheManager] 缩略图已保存到 thumbnails/: ",
    " KB)",
    "onerror",
    "blob",
    "mimeType",
    "fileName",
    "arrayBuffer",
    "removeAsset",
    "removeAssets",
    "history.json",
    "[LocalCacheManager] History synced (Tauri):",
    "[LocalCacheManager] Failed to sync history (Tauri):",
    "createWritable",
    "[LocalCacheManager] History synced: ",
    "_listenerUnsubscribe",
    "_saveThumbnailsForAsset",
    "readAsDataURL",
    "storeWithThumbnails",
    "has",
    "floor",
    "catch",
    "enabled",
    "directoryPath",
    "ensureRestored",
    "then",
    "[LocalCacheManager] ⏳ Silent restore failed, will retry on first user interaction",
    "removeEventListener",
    "addEventListener",
    "pointerdown",
    "qiaodoumayi_cache_directory_config",
    "setItem",
    "getDirectoryPathTauri",
    "setDirectoryPathTauri",
    "current",
    "[CacheDirectory] ✅ Hook: directory handle synced",
    "[CacheDirectory] ⚠️ Could not restore directory handle. Showing re-auth prompt.",
    "[CacheDirectory] Tauri cache directory selected:",
    "name",
    "AbortError",
    "showDirectoryPicker",
    "已选择文件夹",
    "saveAsset",
    "请先选择缓存目录",
    "getAssetRecord",
  ];
  return (dr = function () {
    return e;
  })();
}
function ur(e, t) {
  e -= 0;
  return dr()[e];
}
class gr {
  constructor() {
    (u(this, "directoryHandle", null),
      u(this, c, null),
      u(this, l, null),
      u(this, s, !1),
      u(this, "manifestWriteTimer", null),
      u(this, "processingQueue", new Set()),
      u(this, "_restorePromise", null),
      u(this, "_listenerUnsubscribe", null));
  }
  async [((c = ir(12)), (l = ir(13)), (s = ir(14)), ir(15))](e) {
    const t = ur;
    if (((this.directoryHandle = e), (this[t(12)] = null), e)) {
      try {
        (await (async function (e) {
          return new Promise((t, o) => {
            const i = ur,
              r = indexedDB[i(2)](sr, 1);
            ((r.onupgradeneeded = () => {
              const e = ur,
                t = r.result;
              !t[e(3)][e(4)](lr) && t[e(5)](lr);
            }),
              (r[i(6)] = () => {
                const i = r.result,
                  a = i.transaction(lr, "readwrite");
                (a.objectStore(lr).put(e, cr),
                  (a.oncomplete = () => {
                    (i.close(), t());
                  }),
                  (a.onerror = () => {
                    const e = ur;
                    (i[e(7)](), o(a[e(8)]));
                  }));
              }),
              (r.onerror = () => o(r[i(8)])));
          });
        })(e),
          console[t(16)](
            "[LocalCacheManager] Directory handle saved to IndexedDB",
          ));
      } catch (o) {
        console.warn("[LocalCacheManager] Failed to persist handle to IDB:", o);
      }
      (await this.loadManifest(), this._registerAssetListener());
    } else ((this.manifest = null), this._unregisterAssetListener());
  }
  async setDirectoryPathTauri(e) {
    const t = ur;
    (e === this[t(12)] && null !== this.manifest) ||
      ((this[t(12)] = e),
      (this.directoryHandle = null),
      e
        ? (await this.loadManifest(),
          this[t(17)](),
          console[t(16)]("[LocalCacheManager] Tauri cache path set:", e))
        : ((this.manifest = null), this[t(18)]()));
  }
  getDirectoryPathTauri() {
    return this.directoryPathTauri;
  }
  [ir(19)]() {
    return this.directoryHandle;
  }
  isAvailable() {
    const e = ur;
    return null !== this.directoryHandle || null !== this[e(12)];
  }
  async restoreFromIDB() {
    var e;
    const t = ur;
    if (this.directoryHandle) return !0;
    try {
      const i = await (async function () {
        return new Promise((e, t) => {
          const o = indexedDB.open(sr, 1);
          ((o.onupgradeneeded = () => {
            const e = ur,
              t = o.result;
            !t[e(3)][e(4)](lr) && t.createObjectStore(lr);
          }),
            (o.onsuccess = () => {
              const i = ur,
                r = o[i(9)],
                a = r.transaction(lr, i(10)).objectStore(lr).get(cr);
              ((a[i(6)] = () => {
                (r.close(), e(a.result || null));
              }),
                (a.onerror = () => {
                  (r.close(), t(a.error));
                }));
            }),
            (o.onerror = () => t(o.error)));
        });
      })();
      if (!i)
        return (
          console.log(
            "[LocalCacheManager] No saved directory handle found in IDB",
          ),
          !1
        );
      let r = t(20);
      try {
        ((r = await i.queryPermission({ mode: t(21) })),
          console.log("[LocalCacheManager] queryPermission result:", r));
      } catch {
        console.warn(
          "[LocalCacheManager] queryPermission not supported, trying requestPermission directly",
        );
      }
      if ("granted" !== r)
        try {
          ((r = await i[t(22)]({ mode: t(21) })), console.log(t(23), r));
        } catch (o) {
          return (console.warn(t(24), o), !1);
        }
      return "granted" === r
        ? ((this.directoryHandle = i),
          await this.loadManifest(),
          this[t(17)](),
          console.log(
            "[LocalCacheManager] ✅ Directory restored from IDB: " +
              i.name +
              ", " +
              Object[t(25)](
                (null == (e = this.manifest) ? void 0 : e.assets) || {},
              ).length +
              " assets in manifest",
          ),
          !0)
        : (console.warn("[LocalCacheManager] Permission not granted:", r), !1);
    } catch (i) {
      return (
        console[t(26)]("[LocalCacheManager] Failed to restore from IDB:", i),
        !1
      );
    }
  }
  ensureRestored() {
    const e = ur;
    return this[e(27)]
      ? Promise.resolve(!0)
      : (!this[e(28)] &&
          (this._restorePromise = this.restoreFromIDB().then(
            (e) => (!e && (this[ur(28)] = null), e),
          )),
        this._restorePromise);
  }
  getManifest() {
    return this.manifest;
  }
  async ensureManifestLoaded() {
    (this.directoryPathTauri || this.directoryHandle) &&
      (await this.loadManifest());
  }
  [ir(29)](e) {
    var t;
    const o = ur;
    return !!(null == (t = this.manifest) ? void 0 : t[o(30)][e]);
  }
  getSubdirectoryName(e) {
    const t = ur;
    return e.startsWith(t(31))
      ? "images"
      : e.startsWith("video/")
        ? "videos"
        : e.startsWith("audio/")
          ? "audio"
          : "other";
  }
  async [ir(32)](e) {
    const t = ur;
    if (!this[t(27)]) return null;
    try {
      return await this.directoryHandle[t(19)](e, { create: !0 });
    } catch (o) {
      return (
        console.error(
          "[LocalCacheManager] Failed to get/create subdirectory '" + e + "':",
          o,
        ),
        null
      );
    }
  }
  getExtension(e) {
    const t = ur;
    if (e[t(33)]("image/")) {
      const o = e.split("/")[1] || t(34);
      return "jpeg" === o ? "jpg" : o;
    }
    return e.startsWith("video/")
      ? e.split("/")[1] || "mp4"
      : e.startsWith("audio/")
        ? e[t(35)]("/")[1] || "mp3"
        : "bin";
  }
  async computeBlobFingerprint(e) {
    const t = ur;
    if ("undefined" == typeof crypto || !crypto.subtle) return "";
    const o = e.size,
      i = 16384;
    let r;
    if (o <= 32768) r = await e.arrayBuffer();
    else {
      const a = await e.slice(0, i).arrayBuffer(),
        s = await e.slice(o - i).arrayBuffer(),
        l = new Uint8Array(8 + a.byteLength + s.byteLength);
      (new DataView(l.buffer).setBigUint64(0, BigInt(o), !0),
        l[t(36)](new Uint8Array(a), 8),
        l.set(new Uint8Array(s), 8 + a.byteLength),
        (r = l[t(37)]));
    }
    const a = await crypto[t(38)].digest("SHA-256", r);
    return Array[t(39)](new Uint8Array(a))
      .map((e) => e.toString(16).padStart(2, "0"))
      [t(40)]("");
  }
  async loadManifest() {
    const e = ur;
    if (this.directoryPathTauri)
      try {
        const t = ar(this.directoryPathTauri, "manifest.json"),
          o = await h(t),
          i = typeof o === e(41) ? o : new TextDecoder()[e(42)](o);
        ((this[e(13)] = JSON[e(43)](i)),
          console.log(
            "[LocalCacheManager] Manifest loaded (Tauri): " +
              Object.keys(this.manifest.assets).length +
              e(44),
          ));
      } catch {
        ((this[e(13)] = {
          version: e(45),
          createdAt: new Date().toISOString(),
          updatedAt: new Date()[e(46)](),
          assets: {},
        }),
          console[e(16)]("[LocalCacheManager] Created new manifest (Tauri)"));
      }
    else if (this.directoryHandle)
      try {
        const t = await this.directoryHandle[e(47)](e(48), { create: !1 }),
          o = await t.getFile(),
          i = await o[e(49)]();
        ((this[e(13)] = JSON.parse(i)),
          console.log(
            e(50) + Object[e(25)](this.manifest.assets).length + " assets",
          ));
      } catch {
        ((this.manifest = {
          version: "1.0",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          assets: {},
        }),
          console.log(e(51)));
      }
  }
  scheduleManifestWrite() {
    const e = ur;
    ((this.manifestDirty = !0),
      this.manifestWriteTimer && clearTimeout(this[e(52)]),
      (this.manifestWriteTimer = setTimeout(() => this.flushManifest(), 1e3)));
  }
  async flushManifest() {
    const e = ur;
    if (this.directoryPathTauri && this.manifest && this.manifestDirty)
      try {
        this[e(13)].updatedAt = new Date().toISOString();
        const t = ar(this.directoryPathTauri, "manifest.json");
        (await p(this.directoryPathTauri, { recursive: !0 }),
          await writeTextFile(t, JSON.stringify(this.manifest, null, 2)),
          (this.manifestDirty = !1),
          console.log("[LocalCacheManager] Manifest flushed (Tauri)"));
      } catch (t) {
        console.error(
          "[LocalCacheManager] Failed to write manifest (Tauri):",
          t,
        );
      }
    else if (this.directoryHandle && this[e(13)] && this[e(14)])
      try {
        this[e(13)][e(53)] = new Date().toISOString();
        const t = await this[e(27)][e(47)](e(48), { create: !0 }),
          o = await t.createWritable();
        (await o.write(JSON.stringify(this.manifest, null, 2)),
          await o[e(7)](),
          (this.manifestDirty = !1),
          console[e(16)]("[LocalCacheManager] Manifest flushed to disk"));
      } catch (o) {
        console.error(e(54), o);
      }
  }
  async saveAsset(e, t, o, i, r) {
    const a = ur;
    if (!this[a(13)]) return !1;
    if (!this[a(27)] && !this[a(12)]) return !1;
    if (this[a(55)].has(e)) return !1;
    if (this.manifest.assets[e]) return !0;
    if (i) {
      const t = Object.entries(this.manifest[a(30)]).find(
        ([, e]) => e.remoteUrl && e[a(56)] === i,
      );
      if (t) {
        const [, o] = t;
        return (
          (this.manifest.assets[e] = {
            ...o,
            cachedAt: Date.now(),
            remoteUrl: i,
          }),
          this.scheduleManifestWrite(),
          console[a(16)](
            "[LocalCacheManager] ♻️ Reuse (remoteUrl) asset " +
              e +
              " -> " +
              o.fileName,
          ),
          !0
        );
      }
    }
    try {
      const r = await this.computeBlobFingerprint(t),
        s = Object.entries(this.manifest.assets).find(
          ([, e]) =>
            e[a(57)] === t.size && e.contentHash === r && e.mimeType === o,
        );
      if (s) {
        const [, o] = s;
        return (
          (this[a(13)].assets[e] = {
            ...o,
            cachedAt: Date.now(),
            remoteUrl: i || void 0,
            contentHash: r,
          }),
          this.scheduleManifestWrite(),
          console.log(
            "[LocalCacheManager] ♻️ Reuse (content) asset " +
              e +
              a(58) +
              o.fileName +
              " (" +
              (t.size / 1024)[a(59)](1) +
              " KB)",
          ),
          !0
        );
      }
    } catch (s) {
      console.warn(
        "[LocalCacheManager] Fingerprint compute failed, skip content dedup:",
        s,
      );
    }
    this[a(55)].add(e);
    try {
      const s = await this.computeBlobFingerprint(t),
        l = r ?? this.getSubdirectoryName(o),
        c = this[a(60)](o),
        d = Qt().replace(/-/g, ""),
        u =
          e.length > 16
            ? e[a(61)](0, 8) + "_" + e.slice(-8)
            : e.substring(0, 16),
        g = d + "_" + u.replace(/[^a-zA-Z0-9_-]/g, "_") + "." + c,
        m = l + "/" + g;
      if (this.directoryPathTauri) {
        const r = ar(this[a(12)], l),
          c = ar(this.directoryPathTauri, m);
        await p(r, { recursive: !0 });
        const d = await t.arrayBuffer();
        return (
          await f(c, new Uint8Array(d)),
          (this.manifest[a(30)][e] = {
            fileName: m,
            mimeType: o,
            size: t[a(57)],
            cachedAt: Date[a(62)](),
            remoteUrl: i || void 0,
            contentHash: s || void 0,
          }),
          this.scheduleManifestWrite(),
          console[a(16)](
            a(63) + m + " (" + (t[a(57)] / 1024).toFixed(1) + " KB)",
          ),
          !0
        );
      }
      const h = await this.getSubdirectory(l);
      if (!h) return !1;
      const w = await h.getFileHandle(g, { create: !0 }),
        y = await w.createWritable();
      return (
        await y.write(t),
        await y[a(7)](),
        (this.manifest[a(30)][e] = {
          fileName: m,
          mimeType: o,
          size: t[a(57)],
          cachedAt: Date[a(62)](),
          remoteUrl: i || void 0,
          contentHash: s || void 0,
        }),
        this[a(64)](),
        console.log(
          "[LocalCacheManager] ✅ Saved: " +
            m +
            " (" +
            (t.size / 1024)[a(59)](1) +
            " KB)",
        ),
        !0
      );
    } catch (l) {
      return (
        console[a(8)](
          "[LocalCacheManager] ❌ Failed to save asset " + e + ":",
          l,
        ),
        !1
      );
    } finally {
      this.processingQueue.delete(e);
    }
  }
  [ir(65)](e) {
    const t = ur;
    try {
      const [o, i] = e.split(","),
        r = null == o ? void 0 : o.match(/data:([^;]+)/),
        a = (null == r ? void 0 : r[1]) || "image/jpeg",
        s = atob(i || ""),
        l = new Uint8Array(s.length);
      for (let e = 0; e < s[t(66)]; e++) l[e] = s[t(67)](e);
      return new Blob([l], { type: a });
    } catch {
      return null;
    }
  }
  async [ir(68)](e, t, o) {
    const i = ur;
    if (!this[i(69)]() || !this[i(13)]) return !1;
    const r = o + "_" + e;
    if (this.hasAsset(r)) return !0;
    const a = this.dataUrlToBlob(t);
    if (!a) return !1;
    const s = await this.saveAsset(r, a, "image/jpeg", void 0, i(70));
    return (
      s &&
        console[i(16)](i(71) + r + " (" + (a[i(57)] / 1024).toFixed(1) + i(72)),
      s
    );
  }
  hasThumbnail(e, t) {
    return this.hasAsset(t + "_" + e);
  }
  async readThumbnail(e, t) {
    const o = await this.readAsset(t + "_" + e);
    return o
      ? new Promise((e) => {
          const t = ur,
            i = new FileReader();
          ((i.onload = () => e(i.result)),
            (i[t(73)] = () => e(null)),
            i.readAsDataURL(o[t(74)]));
        })
      : null;
  }
  async readAsset(e) {
    const t = ur;
    if (!this[t(13)]) return null;
    const o = this[t(13)].assets[e];
    if (!o) return null;
    if (this.directoryPathTauri)
      try {
        const e = ar(this[t(12)], o.fileName),
          i = await h(e),
          r = i instanceof Uint8Array ? i : new Uint8Array(i);
        return {
          blob: new Blob([r], { type: o[t(75)] }),
          mimeType: o.mimeType,
        };
      } catch (i) {
        return (
          console.warn(
            "[LocalCacheManager] Failed to read asset " +
              e +
              " from cache (Tauri):",
            i,
          ),
          delete this.manifest.assets[e],
          this.scheduleManifestWrite(),
          null
        );
      }
    if (!this.directoryHandle) return null;
    try {
      const e = o[t(76)][t(35)]("/");
      if (2 !== e.length)
        return (
          console.warn(
            "[LocalCacheManager] Invalid fileName in manifest: " + o.fileName,
          ),
          null
        );
      const [i, r] = e,
        a = await this[t(27)].getDirectoryHandle(i, { create: !1 }),
        s = await a.getFileHandle(r, { create: !1 }),
        l = await s.getFile();
      return {
        blob: new Blob([await l[t(77)]()], { type: o.mimeType }),
        mimeType: o.mimeType,
      };
    } catch (r) {
      return (
        console.warn(
          "[LocalCacheManager] Failed to read asset " + e + " from cache:",
          r,
        ),
        delete this.manifest[t(30)][e],
        this.scheduleManifestWrite(),
        null
      );
    }
  }
  async readAssetAsUrl(e) {
    const t = await this.readAsset(e);
    return t ? URL.createObjectURL(t.blob) : null;
  }
  getCachedAssetIds() {
    const e = ur;
    return this.manifest ? Object[e(25)](this[e(13)][e(30)]) : [];
  }
  async [ir(78)](e) {
    var t;
    const o = ur;
    if (!(null == (t = this.manifest) ? void 0 : t.assets[e])) return !0;
    const i = this.manifest[o(30)][e].fileName;
    try {
      if (this.directoryPathTauri) {
        const e = ar(this.directoryPathTauri, i);
        await w(e);
      } else if (this.directoryHandle) {
        const e = i.split("/");
        if (e[o(66)] >= 2) {
          const [t, i] = [e[0], e.slice(1).join("/")],
            r = await this.directoryHandle[o(19)](t, { create: !1 });
          await r.removeEntry(i);
        }
      }
    } catch (r) {
      console.warn("[LocalCacheManager] Failed to remove asset file:", e, r);
    }
    return (delete this[o(13)].assets[e], this.scheduleManifestWrite(), !0);
  }
  async [ir(79)](e) {
    let t = 0;
    for (const o of e) {
      (await this.removeAsset(o)) && t++;
    }
    return t;
  }
  async syncHistory(e) {
    const t = ur;
    if (this[t(12)])
      try {
        await p(this.directoryPathTauri, { recursive: !0 });
        const o = ar(this.directoryPathTauri, t(80));
        (await writeTextFile(o, JSON.stringify(e, null, 2)),
          console.log(t(81), e[t(66)]));
      } catch (o) {
        console[t(8)](t(82), o);
      }
    else if (this.directoryHandle)
      try {
        const o = await this.directoryHandle.getFileHandle("history.json", {
            create: !0,
          }),
          i = await o[t(83)]();
        (await i.write(JSON.stringify(e, null, 2)),
          await i.close(),
          console[t(16)](t(84) + e.length + " items"));
      } catch (i) {
        console[t(8)]("[LocalCacheManager] Failed to sync history:", i);
      }
  }
  async loadHistory() {
    const e = ur;
    if (this.directoryPathTauri)
      try {
        const t = ar(this.directoryPathTauri, e(80)),
          o = await h(t),
          i = "string" == typeof o ? o : new TextDecoder()[e(42)](o);
        return JSON[e(43)](i);
      } catch {
        return null;
      }
    if (!this.directoryHandle) return null;
    try {
      const t = await this[e(27)].getFileHandle(e(80), { create: !1 }),
        o = await t.getFile(),
        i = await o.text();
      return JSON.parse(i);
    } catch {
      return null;
    }
  }
  [ir(17)]() {
    this[ur(85)] ||
      (console.log("[LocalCacheManager] Registering global asset listener"),
      (this._listenerUnsubscribe = Be.addListener(async (e, t) => {
        const o = ur;
        if (!this[o(55)].has(e)) {
          this[o(55)].add(e);
          try {
            (await this.saveAsset(e, t.blob, t.mimeType, t.remoteUrl),
              t[o(75)].startsWith("image/") &&
                t[o(74)].size > 51200 &&
                this[o(86)](e, t[o(74)]).catch(() => {}));
          } catch (i) {
            console.error("[LocalCacheManager] ❌ Auto-save asset failed:", i);
          } finally {
            this.processingQueue.delete(e);
          }
        }
      })));
  }
  async _saveThumbnailsForAsset(e, t) {
    const o = ur,
      i = await new Promise((e, o) => {
        const i = ur,
          r = new FileReader();
        ((r.onload = () => e(r.result)), (r.onerror = o), r[i(87)](t));
      });
    if (!i.startsWith("data:image")) return;
    const { thumbnailStore: r } = await x(
      async () => {
        const { thumbnailStore: e } = await Promise.resolve().then(() => Tt);
        return { thumbnailStore: e };
      },
      void 0,
      import.meta.url,
    );
    await r[o(88)](e, i);
  }
  [ir(18)]() {
    this._listenerUnsubscribe &&
      (console.log("[LocalCacheManager] Unregistering global asset listener"),
      this._listenerUnsubscribe(),
      (this._listenerUnsubscribe = null));
  }
  getStats() {
    const e = ur;
    if (!this.manifest) return { count: 0, totalSize: 0, formattedSize: "0 B" };
    const t = new Map();
    Object.values(this.manifest.assets).forEach((e) => {
      const o = ur;
      !t[o(89)](e.fileName) && t[o(36)](e.fileName, e);
    });
    const o = Array[e(39)](t.values()),
      i = o.reduce((e, t) => e + t.size, 0);
    return {
      count: o[e(66)],
      totalSize: i,
      formattedSize: this.formatBytes(i),
    };
  }
  formatBytes(e) {
    if (0 === e) return "0 B";
    const t = Math[ur(90)](Math.log(e) / Math.log(1024));
    return (
      (e / Math.pow(1024, t)).toFixed(2) + " " + ["B", "KB", "MB", "GB"][t]
    );
  }
  reset() {
    const e = ur;
    (this[e(18)](),
      (this.directoryHandle = null),
      (this.directoryPathTauri = null),
      (this.manifest = null),
      (this.manifestDirty = !1),
      (this._restorePromise = null),
      this.manifestWriteTimer &&
        (clearTimeout(this.manifestWriteTimer),
        (this.manifestWriteTimer = null)),
      (async function () {
        return new Promise((e, t) => {
          const o = indexedDB[ur(2)](sr, 1);
          ((o.onupgradeneeded = () => {
            const e = ur,
              t = o.result;
            !t.objectStoreNames[e(4)](lr) && t[e(5)](lr);
          }),
            (o.onsuccess = () => {
              const i = ur,
                r = o[i(9)],
                a = r.transaction(lr, "readwrite");
              (a[i(11)](lr).delete(cr),
                (a.oncomplete = () => {
                  (r.close(), e());
                }),
                (a.onerror = () => {
                  (r.close(), t(a.error));
                }));
            }),
            (o.onerror = () => t(o.error)));
        });
      })()[e(91)](() => {}));
  }
}
const mr = new gr();
(() => {
  const e = ur;
  try {
    const t = localStorage.getItem("qiaodoumayi_cache_directory_config");
    if (t) {
      const o = JSON.parse(t);
      if (o[e(92)] && o[e(93)]) {
        if (rr) {
          const e = () => {
            const e = ur;
            mr.setDirectoryPathTauri(o[e(93)]).then(() => {
              console[ur(16)](
                "[LocalCacheManager] ✅ Tauri cache path restored from config",
              );
            });
          };
          return void ("undefined" != typeof requestIdleCallback
            ? requestIdleCallback(() => e(), { timeout: 800 })
            : setTimeout(e, 0));
        }
        (console.log(
          "[LocalCacheManager] Auto-restoring directory handle on module load...",
        ),
          mr[e(94)]()[e(95)]((e) => {
            const t = ur;
            if (e)
              console.log(
                "[LocalCacheManager] ✅ Auto-restore successful (silent)",
              );
            else {
              console.log(t(96));
              const e = () => {
                const t = ur;
                (document.removeEventListener("click", e, !0),
                  document[t(97)]("keydown", e, !0),
                  document[t(97)]("pointerdown", e, !0),
                  setTimeout(() => {
                    mr.ensureRestored().then((e) => {
                      e
                        ? console.log(
                            "[LocalCacheManager] ✅ Restored after user interaction",
                          )
                        : console.warn(
                            "[LocalCacheManager] ⚠️ Restore failed even after user interaction",
                          );
                    });
                  }, 50));
              };
              (document[t(98)]("click", e, { once: !0, capture: !0 }),
                document[t(98)]("keydown", e, { once: !0, capture: !0 }),
                document.addEventListener(t(99), e, { once: !0, capture: !0 }));
            }
          }));
      }
    }
  } catch {}
})();
const hr = () => {
    const e = ur,
      [t, o] = g.useState(() => {
        const e = ur;
        try {
          const t = localStorage.getItem(e(100));
          if (t) {
            const e = JSON.parse(t);
            return {
              enabled: e.enabled || !1,
              directoryHandle: null,
              directoryPath: e.directoryPath || "",
            };
          }
        } catch (t) {
          console.error("[CacheDirectory] Failed to load config:", t);
        }
        return { enabled: !1, directoryHandle: null, directoryPath: "" };
      }),
      i = g.useRef(null),
      r = g.useCallback((e) => {
        o((t) => {
          const o = ur,
            r = { ...t, ...e };
          void 0 !== e.directoryHandle && (i.current = e.directoryHandle);
          try {
            localStorage[o(101)](
              o(100),
              JSON.stringify({
                enabled: r[o(92)],
                directoryPath: r.directoryPath,
              }),
            );
          } catch (a) {
            console.error("[CacheDirectory] Failed to save config:", a);
          }
          return r;
        });
      }, []);
    g.useEffect(() => {
      const e = ur;
      if (!t.enabled || !t.directoryPath) return;
      if (rr) {
        if (mr[e(102)]() === t[e(93)]) return;
        return void mr[e(103)](t.directoryPath);
      }
      if (i.current) return;
      let r = !1;
      return (
        (async () => {
          const e = ur;
          console.log(
            "[CacheDirectory] Hook: waiting for directory handle restore...",
          );
          const t = await mr[e(94)]();
          if (!r)
            if (t) {
              const t = mr.getDirectoryHandle();
              ((i[e(104)] = t),
                o((e) => ({ ...e, directoryHandle: t })),
                console[e(16)](e(105)));
            } else console.warn(e(106));
        })(),
        () => {
          r = !0;
        }
      );
    }, []);
    const a = g.useCallback(async () => {
        const e = ur;
        if (rr)
          try {
            const t = await open({
              directory: !0,
              multiple: !1,
              title: "选择资源缓存目录",
            });
            return (
              !(!t || typeof t !== e(41)) &&
              (await mr.setDirectoryPathTauri(t),
              (i.current = null),
              r({ directoryHandle: null, directoryPath: t, enabled: !0 }),
              console.log(e(107), t),
              !0)
            );
          } catch (t) {
            return (
              t[e(108)] === e(109) ||
                (console.error(
                  "[CacheDirectory] Tauri directory selection failed:",
                  t,
                ),
                alert(
                  "选择目录失败：" +
                    (t instanceof Error ? t.message : String(t)),
                )),
              !1
            );
          }
        if (!(e(110) in window))
          return (
            alert(
              "您的浏览器不支持文件夹选择功能。请使用 Chrome、Edge 或 Opera 浏览器。",
            ),
            !1
          );
        try {
          const t = await window.showDirectoryPicker();
          return (
            (i.current = t),
            await mr.setDirectoryHandle(t),
            r({
              directoryHandle: t,
              directoryPath: t.name || e(111),
              enabled: !0,
            }),
            console[e(16)]("[CacheDirectory] Directory selected:", t.name),
            !0
          );
        } catch (o) {
          return (
            "AbortError" === o[e(108)] ||
              (console.error("[CacheDirectory] Directory selection failed:", o),
              alert(
                "选择文件夹失败：" +
                  (o instanceof Error ? o.message : String(o)),
              )),
            !1
          );
        }
      }, [r]),
      s = g.useCallback(
        async (e, o, i) => {
          const r = ur;
          t.enabled && mr.isAvailable() && (await mr[r(112)](e, o, i));
        },
        [t[e(92)]],
      ),
      l = g.useCallback(
        (e) => {
          const o = ur;
          if (e) {
            const e = !!i.current,
              r = rr && t[o(93)];
            if (!e && !r) return void alert(o(113));
            r && mr.setDirectoryPathTauri(t[o(93)]);
          }
          (!e && ((i[o(104)] = null), mr.reset()), r({ enabled: e }));
        },
        [r, t.directoryPath],
      ),
      c = g.useCallback(
        async (e) => {
          const t = ur;
          try {
            const o = await Be[t(114)](e);
            return (
              !(!o || !o.blob) &&
              (await s(e, o.blob, o[t(75)] || o.blob.type), !0)
            );
          } catch (o) {
            return (
              console.error("[CacheDirectory] Manual save failed:", o),
              !1
            );
          }
        },
        [s],
      ),
      d = g.useCallback(
        async (e) => {
          t.enabled && mr.isAvailable() && (await mr.syncHistory(e));
        },
        [t[e(92)]],
      );
    return {
      config: t,
      selectDirectory: a,
      setEnabled: l,
      saveAssetToDirectory: s,
      manualSaveAsset: c,
      syncHistory: d,
      manager: mr,
    };
  },
  pr = Object.freeze(
    Object.defineProperty(
      { __proto__: null, localCacheManager: mr, useCacheDirectory: hr },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
let fr = { current: !1 };
function wr(e) {
  fr.current = e;
}
function yr() {
  return fr[vr(0)];
}
function vr(e, t) {
  e -= 0;
  return br()[e];
}
function br() {
  const e = ["current"];
  return (br = function () {
    return e;
  })();
}
const _r = new Map(),
  Ir = 83886080;
let Sr = 0;
const jr = [];
function Ar(e, content) {
  const t = 2 * content.length;
  if (!(t > 41943040)) {
    if (_r.has(e)) {
      const t = jr.indexOf(e);
      return (t > -1 && jr.splice(t, 1), void jr.push(e));
    }
    for (; (Sr + t > Ir || _r.size >= 384) && jr.length > 0; ) {
      const e = jr.shift();
      if (e && _r.has(e)) {
        const t = _r.get(e);
        (t && (Sr -= 2 * t.length), _r.delete(e));
      }
    }
    (_r.set(e, content), jr.push(e), (Sr += t));
  }
}
async function Pr(e, size) {
  if (mr.isAvailable() && mr.hasThumbnail(e, size)) {
    const t = await mr.readThumbnail(e, size);
    if (t) return t;
  }
  return "thumb" === size ? kt.getThumbnail(e) : kt.getPreview(e);
}
function xr(e, t = {}) {
  const {
      enabled: enabled = !0,
      placeholder: o,
      useThumbnail: i = !1,
      usePreview: r = !1,
      useOriginal: a = !1,
      renderQuality: s = "high",
      distanceToViewportCenter: l = 0,
      shouldLoadContent: c = !0,
      nodeType: d = "unknown",
      totalNodeCount: u = 0,
      preferConstantDisplay: m = !1,
    } = t,
    h = g.useMemo(() => !!e && Bt.isContentRef(e), [e]),
    p = a ? "" : r ? "_preview" : i ? "_thumb" : "_preview",
    f = g.useMemo(() => {
      if (h && e) {
        const t = Bt.extractId(e),
          o = t + p || t;
        return _r.get(o);
      }
    }, [h, e, p]),
    [content, w] = g.useState(() => {
      if (f) return f;
      if (h && e) {
        const t = Bt.extractId(e),
          o = Bt.getFromCacheSync(t);
        if (o) return o;
        if (!a) {
          const e = t + "_thumb",
            o = _r.get(e);
          if (o) return o;
          const i = t + "_preview",
            r = _r.get(i);
          if (r) return r;
        }
      }
      return h ? void 0 : e;
    }),
    [y, v] = g.useState(
      () => !!h && !f && (!e || !Bt.getFromCacheSync(Bt.extractId(e))),
    ),
    [b, _] = g.useState(!1),
    [I, S] = g.useState(
      () => !!f || !!(h && e && Bt.getFromCacheSync(Bt.extractId(e))),
    ),
    j = g.useRef(!1),
    A = g.useRef(e),
    P = g.useRef(!0),
    [x, k] = g.useState(0);
  return (
    g.useEffect(
      () => (
        (P.current = !0),
        () => {
          P.current = !1;
        }
      ),
      [],
    ),
    g.useEffect(() => {
      if (f) return (w(f), v(!1), S(!0), void _(!1));
      if (h && e) {
        const t = Bt.extractId(e),
          o = t + p || t,
          i = _r.get(o) ?? (a ? Bt.getFromCacheSync(t) : void 0);
        if (i) return (w(i), v(!1), S(!0), void _(!1));
        if (!a && !content) {
          const e = t + "_thumb",
            o = _r.get(e);
          if (o) return (w(o), v(!1), S(!0), void _(!1));
          const i = t + "_preview",
            r = _r.get(i);
          if (r) return (w(r), v(!1), S(!0), void _(!1));
        }
      }
      if (e === A.current && content && !y) return;
      if (((A.current = e), !e || !Bt.isContentRef(e)))
        return (w(e), v(!1), _(!1), void S(!1));
      const t = ((e) =>
          "text-node" === e || "preview" === e || "input-image" === e
            ? "high"
            : "video-input" === e || "gen-video" === e
              ? "low"
              : "medium")(d),
        g = (b = u) >= 500 ? 800 : b >= 300 ? 1e3 : b >= 200 ? 1200 : 1500;
      var b;
      if (
        !c ||
        ("low" === t && "low" === s && l > 0.6 * g) ||
        ("medium" === t && "low" === s && l > g) ||
        ("high" !== t && "low" === s && l > 1.5 * g)
      )
        return (w(o), v(!1), S(!0), void _(!1));
      if (!enabled) return (w(o), v(!1), void S(!0));
      if (j.current) return;
      if (h && e) {
        const t = Bt.extractId(e),
          o = t + p || t,
          i = _r.get(o) ?? (a ? Bt.getFromCacheSync(t) : void 0);
        if (i) return (w(i), v(!1), void S(!0));
      }
      if (!m && yr()) {
        const e = setInterval(() => {
          !yr() && P.current && (clearInterval(e), k((e) => e + 1));
        }, 100);
        return () => clearInterval(e);
      }
      (async () => {
        if (((j.current = !0), v(!0), _(!1), !m && yr()))
          return ((j.current = !1), void v(!1));
        try {
          await Bt.init();
          const t = Bt.extractId(e);
          let s;
          if (i || r)
            ((s = await Pr(t, r ? "preview" : "thumb")),
              s ||
                ((s = await Bt.get(t)),
                s &&
                  s.startsWith("data:image") &&
                  kt.storeWithThumbnails(t, s).catch(() => {})));
          else if (a) s = await Bt.get(t);
          else if (
            ((s = await Pr(t, "preview")),
            !s && ((s = await Bt.get(t)), s && s.startsWith("data:image")))
          ) {
            const e = t;
            kt.storeWithThumbnails(e, s).catch(() => {});
            const o = await Pr(e, "preview");
            o && (s = o);
          }
          if (!P.current) return;
          if (s) {
            (Ar(t + p || t, s), w(s), S(!0), _(!1));
          } else {
            for (let e = 0; e < 3 && P.current && !s; e++)
              if (
                (await new Promise((t) => setTimeout(t, 200 + 200 * e)),
                (s = await Bt.get(t)),
                s && (i || r))
              ) {
                const e = await Pr(t, "preview");
                e && (s = e);
              }
            if (s && P.current) {
              (Ar(t + p || t, s), w(s), S(!0), _(!1));
            } else
              (console.warn(
                "[useLazyContent] Content not found in IndexedDB:",
                t,
              ),
                w(o),
                _(!0));
          }
        } catch (error) {
          (console.error("[useLazyContent] Failed to load content:", error),
            P.current && (w(o), _(!0)));
        } finally {
          (P.current && v(!1), (j.current = !1));
        }
      })();
    }, [e, enabled, o, f, i, r, a, p, x, s, l, c, m]),
    { content: content, isLoading: y, hasError: b, isFromStore: I }
  );
}
function kr(e, t = {}) {
  const {
      useThumbnail: o = !1,
      usePreview: i = !1,
      useOriginal: r = !1,
      preferConstantDisplay: a = !1,
    } = t,
    s = g.useMemo(
      () =>
        e
          .map((e) => {
            if (!e) return "empty";
            if ("string" != typeof e)
              try {
                return JSON.stringify(e).substring(0, 100);
              } catch {
                return "object";
              }
            return Bt.isContentRef(e) ? e : e.substring(0, 100);
          })
          .join("|"),
      [e],
    ),
    l = g.useMemo(
      () =>
        e.map((e) => {
          if (!e)
            return { content: e, isLoading: !1, hasError: !1, isFromStore: !1 };
          if ("string" != typeof e)
            return { content: e, isLoading: !1, hasError: !1, isFromStore: !1 };
          if (!Bt.isContentRef(e))
            return { content: e, isLoading: !1, hasError: !1, isFromStore: !1 };
          const t = Bt.extractId(e),
            a = t + (r ? "" : i ? "_preview" : o ? "_thumb" : "_preview"),
            s = _r.get(a) ?? (r ? Bt.getFromCacheSync(t) : void 0);
          return s
            ? { content: s, isLoading: !1, hasError: !1, isFromStore: !0 }
            : { content: void 0, isLoading: !0, hasError: !1, isFromStore: !1 };
        }),
      [s, o, i, r],
    ),
    [c, d] = g.useState(l);
  g.useEffect(() => {
    d(l);
  }, [l]);
  const u = g.useRef(!0);
  g.useEffect(
    () => (
      (u.current = !0),
      () => {
        u.current = !1;
      }
    ),
    [],
  );
  const [m, h] = g.useState(0);
  return (
    g.useEffect(() => {
      if (!a && yr()) {
        const e = setInterval(() => {
          !yr() && u.current && (clearInterval(e), h((e) => e + 1));
        }, 100);
        return () => clearInterval(e);
      }
      e.some((e) => e && Bt.isContentRef(e)) &&
        (async () => {
          if ((await Bt.init(), !a && yr())) return;
          const s = await Promise.all(
            e.map(async (e) => {
              if (!e || "string" != typeof e || !Bt.isContentRef(e))
                return {
                  content: e,
                  isLoading: !1,
                  hasError: !1,
                  isFromStore: !1,
                };
              if (!1 === t.enabled)
                return {
                  content: t.placeholder,
                  isLoading: !1,
                  hasError: !1,
                  isFromStore: !0,
                };
              const a = Bt.extractId(e),
                s = a + (r ? "" : i ? "_preview" : o ? "_thumb" : "_preview"),
                l = _r.get(s) ?? (r ? Bt.getFromCacheSync(a) : void 0);
              if (l)
                return {
                  content: l,
                  isLoading: !1,
                  hasError: !1,
                  isFromStore: !0,
                };
              try {
                let e;
                if (r) e = await Bt.get(a);
                else if (o || i)
                  ((e = await Pr(a, i ? "preview" : "thumb")),
                    e ||
                      ((e = await Bt.get(a)),
                      e &&
                        e.startsWith("data:image") &&
                        kt.storeWithThumbnails(a, e).catch(() => {})));
                else if (
                  ((e = await Pr(a, "preview")),
                  !e &&
                    ((e = await Bt.get(a)), e && e.startsWith("data:image")))
                ) {
                  kt.storeWithThumbnails(a, e).catch(() => {});
                  const t = await Pr(a, "preview");
                  t && (e = t);
                }
                return (
                  e ||
                    (await new Promise((e) => setTimeout(e, 200)),
                    (e = r
                      ? await Bt.get(a)
                      : (await Pr(a, "preview")) || (await Bt.get(a)))),
                  e
                    ? (Ar(s, e),
                      {
                        content: e,
                        isLoading: !1,
                        hasError: !1,
                        isFromStore: !0,
                      })
                    : (console.warn("[useLazyContents] Content not found:", a),
                      {
                        content: t.placeholder,
                        isLoading: !1,
                        hasError: !0,
                        isFromStore: !0,
                      })
                );
              } catch (error) {
                return (
                  console.error(
                    "[useLazyContents] Failed to load content:",
                    error,
                  ),
                  {
                    content: t.placeholder,
                    isLoading: !1,
                    hasError: !0,
                    isFromStore: !0,
                  }
                );
              }
            }),
          );
          u.current && d(s);
        })();
    }, [s, t.enabled, t.placeholder, o, i, r, m, a]),
    c
  );
}
function Tr() {
  (_r.clear(),
    (jr.length = 0),
    (Sr = 0),
    console.log("[useLazyContent] Global content cache cleared"));
}
const $r = Object.freeze(
    Object.defineProperty(
      {
        __proto__: null,
        clearContentCache: Tr,
        useLazyContent: xr,
        useLazyContents: kr,
        warmContentCacheForPaste: function (e, content) {
          Ar(e, content);
        },
      },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  Mr = 52428800;
function Cr(e) {
  return e.replace(/\.[^/.]+$/, "") || "未命名文件";
}
const Ur = ({
  mousePosRef: e,
  canvasRef: t,
  view: o,
  setNodes: i,
  generateId: r,
}) => ({
  handleFileDrop: g.useCallback(
    async (a, s) => {
      var l, c;
      if (a.length > 15) {
        if (
          !confirm(
            `您正在尝试导入 ${a.length} 个文件，这可能会导致性能问题。\n\n建议一次导入不超过 15 个文件。\n\n是否继续？（只会处理前 15 个文件）`,
          )
        )
          return;
        a = Array.from(a).slice(0, 15);
      }
      const d = a.filter((e) => e.size > Mr);
      if (
        (d.length > 0 &&
          (alert(
            "以下文件超过 50MB 限制，将被跳过：\n\n" +
              d
                .map(
                  (e) => `${e.name} (${(e.size / 1024 / 1024).toFixed(2)}MB)`,
                )
                .join("\n"),
          ),
          (a = a.filter((e) => e.size <= Mr))),
        0 === a.length)
      )
        return;
      let u, g;
      if (s && t.current) {
        const e = t.current.getBoundingClientRect();
        ((u = (s.clientX - e.left - o.x) / o.zoom),
          (g = (s.clientY - e.top - o.y) / o.zoom));
      } else
        ((u = (null == (l = e.current) ? void 0 : l.x) || 100),
          (g = (null == (c = e.current) ? void 0 : c.y) || 100));
      for (let e = 0; e < a.length; e += 3) {
        const t = a.slice(e, e + 3);
        for (let o = 0; o < t.length; o++)
          try {
            await Or(t[o], e + o, u, g, i, r);
          } catch (error) {
            console.error(
              `[FileDropHandler] Failed to process file ${t[o].name}:`,
              error,
            );
          }
        if (e + 3 < a.length) {
          const e = 1 === a.length ? 0 : 100;
          await new Promise((t) => setTimeout(t, e));
        }
      }
    },
    [e, t, o, i, r],
  ),
});
async function Or(file, e, t, o, i, r) {
  var a;
  const s = file.name,
    l = file.type,
    c = file.size,
    d = (null == (a = s.split(".").pop()) ? void 0 : a.toLowerCase()) || "",
    u = (e % 5) * 20,
    g = 20 * Math.floor(e / 5),
    m =
      l.startsWith("image/") ||
      ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(d),
    h =
      l.startsWith("video/") ||
      ["mp4", "mov", "avi", "mkv", "webm"].includes(d);
  m
    ? await (async function (file, e, t, o, i, r, a) {
        const s = a(),
          l = Cr(e),
          c = t > Er,
          d = URL.createObjectURL(file);
        let u,
          content = d,
          g = 300,
          m = 200;
        try {
          const e = await ((url = d),
          new Promise((e) => {
            const t = new Image(),
              o = setTimeout(() => {
                ((t.onload = t.onerror = () => {}), (t.src = ""), e(null));
              }, 5e3);
            ((t.onload = () => {
              clearTimeout(o);
              const i = t.naturalWidth,
                r = t.naturalHeight;
              e({ imageSize: `${i}×${r}`, width: i, height: r });
            }),
              (t.onerror = () => {
                (clearTimeout(o), e(null));
              }),
              (t.src = url));
          }));
          if (e) {
            u = e.imageSize;
            const size = (function (e, t) {
              const o = e / t,
                i = o >= 0.85 && o <= 1 / 0.85 ? 260 : 440,
                r = 800,
                a = 150;
              let s, l;
              o >= 1
                ? ((s = i), (l = Math.round(i / o)))
                : ((l = i), (s = Math.round(i * o)));
              const c = Math.max(s, l),
                d = Math.min(s, l);
              if (c > r) {
                const e = r / c;
                ((s = Math.round(s * e)), (l = Math.round(l * e)));
              } else if (d < a) {
                const e = a / d;
                ((s = Math.round(s * e)), (l = Math.round(l * e)));
              }
              return { width: s, height: l };
            })(e.width, e.height);
            ((g = size.width), (m = size.height));
          }
        } catch {}
        var url;
        const h = {
          id: s,
          type: "input-image",
          x: o,
          y: i,
          width: g,
          height: m,
          content: content,
          prompt: e,
          nodeName: l,
          settings: {
            mediaType: "image",
            ...(u ? { imageSize: u } : {}),
            _originalSize: t,
            _isLargeFile: c,
            _blobUrl: content,
          },
        };
        if ((r((e) => [...e, h]), Rr && t <= Lr))
          return void (async () => {
            try {
              const e = await (function (file) {
                  return new Promise((e, t) => {
                    const o = new FileReader();
                    ((o.onload = () => e(o.result)),
                      (o.onerror = t),
                      o.readAsDataURL(file));
                  });
                })(file),
                t = await Bt.store(e),
                o = Bt.createRef(t);
              r((e) =>
                e.map((n) =>
                  n.id === s
                    ? {
                        ...n,
                        content: o,
                        settings: { ...n.settings, _blobUrl: void 0 },
                      }
                    : n,
                ),
              );
            } catch (e) {
              console.warn(
                "[FileDropHandler] Background store for aget/裁切 failed:",
                e,
              );
            }
          })();
        c &&
          t <= Lr &&
          (async () => {
            try {
              const e = await En();
              if (e.shouldUseRust) {
                const e = `data:image/jpeg;base64,${await Tn("process_image", file, { maxDimension: 1536, quality: 0.78 })}`,
                  t = await Bt.store(e),
                  o = Bt.createRef(t);
                r((e) =>
                  e.map((n) =>
                    n.id === s
                      ? {
                          ...n,
                          content: o,
                          settings: { ...n.settings, _blobUrl: void 0 },
                        }
                      : n,
                  ),
                );
              }
            } catch (e) {
              console.warn(
                "[FileDropHandler] Background Rust+store failed:",
                e,
              );
            }
          })();
      })(file, s, c, t + u, o + g, i, r)
    : h &&
      (await (async function (file, e, t, o, i, r, a) {
        const s = Cr(e),
          l = a(),
          c = URL.createObjectURL(file),
          d = {
            id: l,
            type: "input-image",
            x: o,
            y: i,
            width: 320,
            height: 200,
            content: c,
            prompt: e,
            nodeName: s,
            settings: {
              mediaType: "video",
              _originalSize: t,
              videoFileName: e,
              _blobUrl: c,
            },
          };
        r((e) => [...e, d]);
      })(file, s, c, t + u, o + g, i, r));
}
const Er = 409600,
  Lr = 15728640,
  Rr = "undefined" != typeof window && "__TAURI__" in window && !0;
const Nr = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      extractNodeNameFromFileName: Cr,
      useFileDropHandler: Ur,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
function Dr(e, t) {
  e -= 0;
  return zr()[e];
}
const Fr =
    "data:image/svg+xml;base64," +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#374151" width="100" height="100"/><text x="50" y="55" font-size="12" fill="#9ca3af" text-anchor="middle" font-family="sans-serif">N/A</text></svg>',
    ),
  Wr = (e, t = 2048, o = 0.85) =>
    new Promise((i) => {
      const r = Dr;
      if (e.startsWith("data:image/jpeg")) {
        if ((3 * (e[r(0)] - e.indexOf(",") - 1)) / 4 / 1024 / 1024 < 0.5)
          return void i(e);
      }
      const a = new Image();
      ((a.onload = () => {
        const r = Dr;
        try {
          const s = document.createElement("canvas"),
            l = s.getContext("2d", { willReadFrequently: !1, alpha: !1 });
          if (!l) return void i(e);
          let c = a[r(1)],
            d = a.height;
          if (c > t || d > t) {
            const e = t / Math.max(c, d);
            ((c = Math.floor(c * e)), (d = Math.floor(d * e)));
          }
          ((s[r(1)] = c), (s.height = d), l.drawImage(a, 0, 0, c, d));
          const u = s.toDataURL("image/jpeg", o);
          ((s.width = 0), (s.height = 0), i(u));
        } catch (s) {
          (console[r(2)]("[compressImage] 压缩失败:", s), i(e));
        }
      }),
        (a.onerror = () => i(e)),
        (a.src = e));
    });
function zr() {
  const e = [
    "length",
    "width",
    "warn",
    "keep",
    "preserveOriginalFields",
    "some",
    "log",
    "[urlToDataURL] 保留原图不压缩，字段: ",
    "data:",
    "data:image/jpeg",
    "onloadend",
    "result",
    "FileReader 失败",
    "substring",
    "trim",
    "http://",
    "https://",
    "startsWith",
    "blob:",
    "match",
    "file:///",
    "file://",
    "count",
    "_currentFieldName",
    "slice",
    "object",
    "entries",
    "forEach",
    "reduce",
  ];
  return (zr = function () {
    return e;
  })();
}
const Br = async (e, t = 0, o, i = { count: 0, current: 0 }, r, a) => {
    const s = Dr;
    if (t > 10) return e;
    if (null == e) return e;
    if ("string" == typeof e) {
      const t = e[s(14)]();
      if (
        (t.startsWith(s(15)) ||
          t.startsWith(s(16)) ||
          t[s(17)](s(18)) ||
          t[s(19)](/^[a-zA-Z]:[\\\/]/) ||
          t[s(17)](s(20)) ||
          t[s(17)](s(21)) ||
          (t.startsWith("/") &&
            t.match(
              /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mp3|wav|ogg|m4a|aac)$/i,
            ))) &&
        !t[s(17)]("data:")
      ) {
        (i.current++,
          o &&
            i.count > 0 &&
            o(
              (i.current / i[s(22)]) * 100,
              "正在转换 " + i.current + "/" + i[s(22)],
              "export",
            ));
        return await (async (e, t = !0, o, i) => {
          const r = Dr,
            a = (null == i ? void 0 : i.onFailedBehavior) ?? r(3),
            s = (null == i ? void 0 : i.silentFail) ?? !1,
            l = (null == i ? void 0 : i[r(4)]) ?? [],
            c = (null == i ? void 0 : i._currentFieldName) ?? "",
            d = (null == i ? void 0 : i.timeoutMs) ?? 2500,
            u = l[r(5)](
              (e) =>
                c === e || c.endsWith("_" + e) || c.includes("[" + e + "]"),
            ),
            g = t && !u;
          if ((u && c && console[r(6)](r(7) + c), !e || e.startsWith(r(8)))) {
            if (g && e.startsWith("data:image/") && !e.startsWith(r(9)))
              try {
                return await Wr(e);
              } catch {
                return e;
              }
            return e;
          }
          try {
            const t = new Promise((e, t) => {
                setTimeout(() => t(new Error("转换超时")), d);
              }),
              o = fetch(e)
                .then((e) => {
                  if (!e.ok) throw new Error("HTTP " + e.status);
                  return e.blob();
                })
                .then(
                  (e) =>
                    new Promise((t, o) => {
                      const i = Dr,
                        r = new FileReader();
                      ((r[i(10)] = () => {
                        const e = r[Dr(11)];
                        g && e.startsWith("data:image/")
                          ? Wr(e)
                              .then((e) => {
                                t(e);
                              })
                              .catch(() => t(e))
                          : t(e);
                      }),
                        (r.onerror = () => o(new Error(i(12)))),
                        r.readAsDataURL(e));
                    }),
                );
            return await Promise.race([o, t]);
          } catch (m) {
            return (
              !s &&
                console.warn(
                  "[urlToDataURL] 转换失败:",
                  e[r(13)](0, 60) + "...",
                  m,
                ),
              o && o.push(e),
              "placeholder" === a ? Fr : e
            );
          }
        })(t, !0, r, a);
      }
      return e;
    }
    if (Array.isArray(e)) {
      const l = [],
        c = 5,
        d = (null == a ? void 0 : a[s(23)]) ?? "";
      for (let u = 0; u < e.length; u += c) {
        const g = e[s(24)](u, u + c),
          m = await Promise.all(
            g.map((e, s) => {
              const l = { ...a, _currentFieldName: d };
              return Br(e, t + 1, o, i, r, l);
            }),
          );
        (l.push(...m),
          u % (2 * c) == 0 &&
            u > 0 &&
            (await new Promise((e) => setTimeout(e, 5))));
      }
      return l;
    }
    if (typeof e === s(25)) {
      const l = {},
        c = Object[s(26)](e),
        d = 10;
      for (let e = 0; e < c[s(0)]; e += d) {
        const u = c.slice(e, e + d);
        ((
          await Promise.all(
            u.map(async ([e, s]) => {
              const l = { ...a, _currentFieldName: e };
              return [e, await Br(s, t + 1, o, i, r, l)];
            }),
          )
        )[s(27)](([e, t]) => {
          l[e] = t;
        }),
          e % (2 * d) == 0 &&
            e > 0 &&
            (await new Promise((e) => setTimeout(e, 5))));
      }
      return l;
    }
    return e;
  },
  Gr = (e, t = 0) => {
    const o = Dr;
    if (t > 10) return 0;
    if (null == e) return 0;
    if ("string" == typeof e) {
      const t = e[o(14)]();
      return (t.startsWith("http://") ||
        t.startsWith(o(16)) ||
        t[o(17)]("blob:") ||
        t[o(19)](/^[a-zA-Z]:[\\\/]/) ||
        t.startsWith(o(20)) ||
        t.startsWith("file://") ||
        (t[o(17)]("/") &&
          t[o(19)](
            /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov|avi|mp3|wav|ogg|m4a|aac)$/i,
          ))) &&
        !t.startsWith("data:")
        ? 1
        : 0;
    }
    return Array.isArray(e)
      ? e[o(28)]((e, o) => e + Gr(o, t + 1), 0)
      : "object" == typeof e
        ? Object.values(e).reduce((e, o) => e + Gr(o, t + 1), 0)
        : 0;
  },
  Jr = Object.freeze(
    Object.defineProperty(
      { __proto__: null, convertUrlsToDataURLs: Br, countUrls: Gr },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  );
const Vr = async (e, t = 0) => {
    var o;
    const i = e.settings ? { ...e.settings } : {};
    "_executeTrigger" in i && delete i._executeTrigger;
    const r = { ...e, settings: i, _nodeUpdateTime: Date.now() };
    ("custom-agent" === r.type &&
      ("isGenerating" in r && delete r.isGenerating,
      "generationProgress" in r && delete r.generationProgress),
      (r.nodeName && "" !== r.nodeName.trim()) ||
        ((r.nodeName = (function (e, t) {
          if (e.videoFileName) return Cr(e.videoFileName);
          if (e.prompt && "string" == typeof e.prompt) {
            const t = e.prompt.trim();
            if (
              t.match(
                /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|mkv|webm|mp3|wav|ogg|m4a|aac|flac)$/i,
              )
            )
              return Cr(t);
            if (t.length < 100 && !t.includes(" ") && !t.includes("\n"))
              return Cr(t);
          }
          return `${Zi(e.type)}${t + 1}`;
        })(r, t)),
        console.log(
          `[useProjectIO] 为旧版本节点 ${r.id} (${r.type}) 自动生成名称: ${r.nodeName}`,
        )));
    const a = null == (o = e.settings) ? void 0 : o._assetId;
    if (a)
      try {
        const { assetStore: e } = await x(
            async () => {
              const { assetStore: e } = await Promise.resolve().then(() => Ge);
              return { assetStore: e };
            },
            void 0,
            import.meta.url,
          ),
          t = await e.getAssetUrl(a);
        if (t) return ((r.content = t), r);
      } catch (error) {
        console.error(
          "[useProjectIO] ❌ Failed to restore from assetStore:",
          error,
        );
      }
    const s = e._contentAssetId,
      l = e._previewMjAssetIds,
      c = e._selectedImageAssetId;
    if (s || (null == l ? void 0 : l.length) || c)
      try {
        const { assetStore: e } = await x(
          async () => {
            const { assetStore: e } = await Promise.resolve().then(() => Ge);
            return { assetStore: e };
          },
          void 0,
          import.meta.url,
        );
        if (s && (!r.content || "" === r.content)) {
          const url = await e.getAssetUrl(s);
          url && (r.content = url);
        }
        if (l && r.previewMjImages) {
          const t = [...r.previewMjImages];
          for (let o = 0; o < l.length; o++)
            if (l[o] && (!t[o] || "" === t[o])) {
              const url = await e.getAssetUrl(l[o]);
              url && (t[o] = url);
            }
          r.previewMjImages = t;
        }
        if (c && (!r.selectedPreviewImage || "" === r.selectedPreviewImage)) {
          const url = await e.getAssetUrl(c);
          url && (r.selectedPreviewImage = url);
        }
      } catch (u) {
        console.warn("[useProjectIO] 预览节点资源恢复失败:", u);
      }
    const d = await (async (e) => {
      const t = e._localFilePath;
      if (!t || "string" != typeof t) return null;
      try {
        console.warn(`[useProjectIO] ⚠️ 不支持从本地文件系统恢复: ${t}`);
      } catch (error) {
        console.warn(`[useProjectIO] ⚠️ 恢复本地文件失败: ${t}`, error);
      }
      return null;
    })(e);
    return d ? ((r.content = d), (r._localFilePath = e._localFilePath), r) : r;
  },
  Kr = ({
    projectName: e,
    nodes: t,
    connections: o,
    view: i,
    history: r,
    chatSessions: a,
    characterLibrary: s,
    klingSubjectLibrary: l,
    selectedNodeId: c,
    selectedNodeIds: d,
    groups: u,
    setNodes: m,
    setConnections: h,
    setView: p,
    setHistory: f,
    setChatSessions: w,
    setCharacterLibrary: v,
    setKlingSubjectLibrary: b,
    setProjectName: _,
    setGroups: I,
    setSelectionContextMenu: S,
    onProgress: j,
    viewportSize: A,
  }) => {
    const P = "undefined" != typeof window && "__TAURI__" in window;
    g.useEffect(() => {
      if (!P || !j) return;
      let e;
      return (
        y("project-progress", (e) => {
          const payload = e.payload,
            t = "number" == typeof payload.percent ? payload.percent : 0,
            message = payload.message || "";
          j(t, message, "export");
        }).then((t) => {
          e = t;
        }),
        () => {
          null == e || e();
        }
      );
    }, [P, j]);
    const k = g.useCallback(
        async (e) => {
          if (!P) return null;
          try {
            const { open: t } = await x(
                async () => {
                  const { open: e } = await import("./vendor-DXn3GjvW.js").then(
                    (n) => n.n,
                  );
                  return { open: e };
                },
                __vite__mapDeps([1, 2]),
                import.meta.url,
              ),
              o = await t({
                directory: !0,
                multiple: !1,
                defaultPath: e.replace(/\.json$/i, ""),
              });
            return o
              ? Array.isArray(o)
                ? o[0]
                  ? `${o[0]}/${e.replace(/\.json$/i, "")}`
                  : null
                : `${o}/${e.replace(/\.json$/i, "")}`
              : null;
          } catch (t) {
            return (
              console.error("[useProjectIO] Tauri 目录选择失败:", t),
              null
            );
          }
        },
        [P],
      ),
      T = g.useCallback(
        async (e, t) => {
          if (!P)
            return (
              console.log("[useProjectIO] 非 Tauri 环境，跳过容器导出"),
              !1
            );
          (console.log("[useProjectIO] 🚀 开始 Tauri 容器导出..."),
            null == j || j(1, "请选择保存目录（容器格式）...", "export"));
          const o = await k(t);
          if (!o)
            return (
              console.log("[useProjectIO] 用户取消选择目录"),
              null == j || j(0, "", "export"),
              !0
            );
          (console.log("[useProjectIO] 📁 选择的容器路径:", o),
            null == j || j(10, "正在写入容器格式...", "export"));
          try {
            const result = await invoke("export_project", {
              path: o,
              payloadJson: e,
              options: { chunk_size: 65536, hash: !0, separate_assets: !0 },
            });
            return (
              console.log("[useProjectIO] ✅ 容器导出成功:", result),
              null == j || j(100, "保存完成！（容器格式）", "export"),
              setTimeout(() => (null == j ? void 0 : j(0, "", "export")), 500),
              !0
            );
          } catch (i) {
            return (
              console.error("[useProjectIO] ❌ Tauri export 失败:", i),
              console.error(
                "[useProjectIO] 错误详情:",
                JSON.stringify(i, null, 2),
              ),
              null == j ||
                j(
                  -1,
                  `容器导出失败: ${i.message || "未知错误"}，将回退到传统格式`,
                  "export",
                ),
              !1
            );
          }
        },
        [P, j, k],
      ),
      $ = g.useCallback(async () => {
        var l, c, d;
        try {
          const { memoryMonitor: c } = await x(
              async () => {
                const { memoryMonitor: e } =
                  await import("./memoryMonitor-CM3ZHV5J.js");
                return { memoryMonitor: e };
              },
              __vite__mapDeps([7, 8, 4, 2, 1, 5]),
              import.meta.url,
            ),
            d = c.canSafeSave();
          if (!d.canSave)
            return (
              console.error("[useProjectIO] 内存不足，无法保存:", d.reason),
              void (
                null == j || j(-1, `${d.reason}。${d.suggestion}`, "export")
              )
            );
          if (
            (d.suggestion &&
              console.warn("[useProjectIO] 内存警告:", d.reason, d.suggestion),
            await c.cleanupBeforeSave(),
            null == j || j(0, "正在准备保存...", "export"),
            !P && mr.isAvailable())
          ) {
            try {
              const l = await (async (e, t, o, i, r, a, s, l, c, d) => {
                var u;
                const g = mr.getManifest();
                if (!g || 0 === Object.keys(g.assets).length)
                  return (
                    console.log(
                      "[useProjectIO] 本地缓存为空，回退到 JSON 导出",
                    ),
                    !1
                  );
                await mr.flushManifest();
                const m = new Set(),
                  h = (e) => {
                    e && "string" == typeof e && m.add(e);
                  };
                for (const x of e) {
                  (h(null == (u = x.settings) ? void 0 : u._assetId),
                    h(x._contentAssetId),
                    h(x._selectedImageAssetId));
                  const e = x._previewMjAssetIds;
                  e && e.forEach((e) => h(e));
                }
                for (const x of t) {
                  for (const key of [
                    "_assetId",
                    "_audioAssetId",
                    "_mjOriginalAssetId",
                    "_thumbnailAssetId",
                  ])
                    h(x[key]);
                  const e = x._mjAssetIds;
                  e && e.forEach((e) => h(e));
                }
                if (
                  ([...m]
                    .filter(
                      (e) =>
                        !e.startsWith("preview_") && !e.startsWith("thumb_"),
                    )
                    .forEach((e) => m.add(`preview_${e}`)),
                  0 === m.size)
                )
                  return (
                    console.log(
                      "[useProjectIO] 没有匹配的缓存资源，回退到 JSON 导出",
                    ),
                    !1
                  );
                null == d || d(2, "请选择保存位置...", "export");
                const p = `${l || "未命名项目"}_${Zt("standard")}.zip`;
                let f = null;
                if ("showSaveFilePicker" in window)
                  try {
                    const e = await window.showSaveFilePicker({
                      suggestedName: p,
                      types: [
                        {
                          description: "ZIP 项目包",
                          accept: { "application/zip": [".zip"] },
                        },
                      ],
                    });
                    f = await e.createWritable();
                  } catch (L) {
                    if ("AbortError" === L.name)
                      return (null == d || d(0, "", "export"), !0);
                    throw L;
                  }
                const w = new (0,
                  (
                    await x(
                      async () => {
                        const { default: e } =
                          await import("./jszip-CXr7zspi.js").then((n) => n.j);
                        return { default: e };
                      },
                      [],
                      import.meta.url,
                    )
                  ).default)(),
                  y = {},
                  v = (e, blob) => {
                    const mimeType = blob.type || "application/octet-stream",
                      t =
                        e.startsWith("preview_") || e.startsWith("thumb_")
                          ? "thumbnails"
                          : mimeType.startsWith("image/")
                            ? "images"
                            : mimeType.startsWith("video/")
                              ? "videos"
                              : mimeType.startsWith("audio/")
                                ? "audio"
                                : "other",
                      o = mimeType.startsWith("image/")
                        ? mimeType.includes("jpeg")
                          ? "jpg"
                          : mimeType.split("/")[1] || "png"
                        : mimeType.startsWith("video/")
                          ? "mp4"
                          : mimeType.startsWith("audio/")
                            ? "mp3"
                            : "bin",
                      i = (
                        e.length > 16 ? `${e.slice(0, 8)}_${e.slice(-8)}` : e
                      ).replace(/[^a-zA-Z0-9_-]/g, "_");
                    return {
                      fileName: `${t}/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${i}.${o}`,
                      mimeType: mimeType,
                      size: blob.size,
                      cachedAt: Date.now(),
                    };
                  };
                null == d || d(5, "正在读取缓存资源...", "export");
                let b = 0;
                const _ = m.size;
                for (const x of m) {
                  let blob = null,
                    e = g.assets[x];
                  const t = await mr.readAsset(x);
                  if (
                    (t && ((blob = t.blob), (e = g.assets[x])),
                    !blob &&
                      !x.startsWith("preview_") &&
                      !x.startsWith("thumb_"))
                  ) {
                    const t = await Be.getAssetBlob(x);
                    t && ((blob = t), (e = v(x, blob)));
                  }
                  (blob && e && (w.file(e.fileName, blob), (y[x] = e)),
                    b++,
                    (b % 5 != 0 && b !== _) ||
                      null == d ||
                      d(
                        5 + (b / _) * 20,
                        `读取缓存资源 ${b}/${_}...`,
                        "export",
                      ));
                }
                (console.log(
                  `[useProjectIO] 📦 ZIP: 已读取 ${Object.keys(y).length}/${_} 个资源（含缩略图），优先本地`,
                ),
                  null == d || d(28, "正在处理项目数据...", "export"));
                const I = e.map((e) => {
                    var t;
                    const o = { ...e },
                      i = null == (t = e.settings) ? void 0 : t._assetId;
                    i &&
                      y[i] &&
                      o.content &&
                      "string" == typeof o.content &&
                      (o.content.startsWith("blob:") ||
                        o.content.startsWith("data:")) &&
                      (o.content = "");
                    const r = e._contentAssetId;
                    r &&
                      y[r] &&
                      o.content &&
                      "string" == typeof o.content &&
                      (o.content.startsWith("blob:") ||
                        o.content.startsWith("data:")) &&
                      (o.content = "");
                    const a = e._selectedImageAssetId;
                    a &&
                      y[a] &&
                      o.selectedPreviewImage &&
                      "string" == typeof o.selectedPreviewImage &&
                      (o.selectedPreviewImage.startsWith("blob:") ||
                        o.selectedPreviewImage.startsWith("data:")) &&
                      (o.selectedPreviewImage = "");
                    const s = e._previewMjAssetIds;
                    return (
                      s &&
                        o.previewMjImages &&
                        (o.previewMjImages = o.previewMjImages.map((url, e) =>
                          s[e] &&
                          y[s[e]] &&
                          url &&
                          (url.startsWith("blob:") || url.startsWith("data:"))
                            ? ""
                            : url,
                        )),
                      o
                    );
                  }),
                  S = t.map((e) => {
                    const t = { ...e },
                      o = e._assetId;
                    o &&
                      y[o] &&
                      t.url &&
                      (t.url.startsWith("blob:") ||
                        t.url.startsWith("data:")) &&
                      (t.url = "");
                    const i = e._mjAssetIds;
                    i &&
                      t.mjImages &&
                      (t.mjImages = t.mjImages.map((url, e) =>
                        i[e] &&
                        y[i[e]] &&
                        url &&
                        (url.startsWith("blob:") || url.startsWith("data:"))
                          ? ""
                          : url,
                      ));
                    for (const [r, a] of [
                      ["_audioAssetId", "audioUrl"],
                      ["_mjOriginalAssetId", "mjOriginalUrl"],
                      ["_thumbnailAssetId", "thumbnailUrl"],
                    ]) {
                      const o = e[r];
                      o && y[o] && t[a] && (t[a] = "");
                    }
                    return t;
                  });
                null == d || d(32, "正在转换未缓存的资源...", "export");
                const j = [],
                  A = { count: Gr(I) + Gr(s) + Gr(a) + Gr(S), current: 0 },
                  P = {
                    preserveOriginalFields: [
                      "content",
                      "previewMjImages",
                      "previewMjVideos",
                      "selectedPreviewImage",
                      "selectedPreviewVideo",
                      "_contentAssetId",
                      "_previewMjAssetIds",
                      "_selectedImageAssetId",
                    ],
                  },
                  k = [];
                for (let x = 0; x < I.length; x += 3) {
                  const e = I.slice(x, x + 3),
                    result = await Br(e, 0, d, A, j, P);
                  (k.push(...result),
                    null == d ||
                      d(
                        32 + (x / I.length) * 12,
                        `处理节点 ${x + 1}/${I.length}...`,
                        "export",
                      ),
                    await new Promise((e) => setTimeout(e, 10)));
                }
                null == d || d(46, "正在处理角色库...", "export");
                const T = await Br(s, 0, d, A, j);
                null == d || d(50, "正在处理聊天会话...", "export");
                const $ = await Br(a, 0, d, A, j, {
                  preserveOriginalFields: [
                    "content",
                    "url",
                    "imageUrl",
                    "files",
                  ],
                });
                null == d || d(55, "正在处理历史记录...", "export");
                const M =
                  "undefined" != typeof navigator &&
                  (navigator.platform.toLowerCase().includes("mac") ||
                    navigator.platform.toLowerCase().includes("win") ||
                    navigator.userAgent.toLowerCase().includes("mac") ||
                    navigator.userAgent.toLowerCase().includes("win"))
                    ? 500
                    : 200;
                let C = S;
                C.length > M && (C = C.slice(-M));
                const U = await Br(C, 0, d, A, j, {
                  preserveOriginalFields: [
                    "mjImages",
                    "originalUrl",
                    "mjOriginalUrl",
                    "url",
                    "videoPosterUrl",
                    "localCacheUrl",
                    "audioUrl",
                  ],
                });
                null == d || d(65, "正在生成项目文件...", "export");
                const O = _o({
                  version: "2.9",
                  format: "zip-container",
                  projectName: l,
                  nodes: k,
                  connections: o,
                  groups: i,
                  view: {
                    ...r,
                    viewportSize: c || {
                      width: window.innerWidth,
                      height: window.innerHeight,
                    },
                  },
                  chatSessions: $,
                  characterLibrary: T,
                  history: U,
                  timestamp: qt(),
                });
                (w.file("project.json", JSON.stringify(O, null, 2)),
                  w.file(
                    "manifest.json",
                    JSON.stringify(
                      {
                        version: "1.0",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        assets: y,
                      },
                      null,
                      2,
                    ),
                  ),
                  null == d || d(68, "正在压缩文件...", "export"));
                const E = await w.generateAsync(
                  {
                    type: "blob",
                    compression: "DEFLATE",
                    compressionOptions: { level: 6 },
                  },
                  (e) => {
                    null == d ||
                      d(
                        68 + (e.percent / 100) * 22,
                        `压缩中... ${e.percent.toFixed(0)}%`,
                        "export",
                      );
                  },
                );
                if ((null == d || d(92, "正在保存文件...", "export"), f))
                  (await f.write(E), await f.close());
                else {
                  const url = URL.createObjectURL(E),
                    e = document.createElement("a");
                  ((e.href = url),
                    (e.download = p),
                    document.body.appendChild(e),
                    e.click(),
                    document.body.removeChild(e),
                    URL.revokeObjectURL(url));
                }
                return (
                  j.length > 0
                    ? (console.warn(
                        `[useProjectIO] ⚠️ ZIP 导出有 ${j.length} 个非缓存资源转换失败`,
                      ),
                      null == d ||
                        d(100, "保存完成（ZIP，部分资源未缓存）", "export"))
                    : null == d || d(100, "保存完成！（ZIP 格式）", "export"),
                  mr.isAvailable() && mr.syncHistory(t).catch(() => {}),
                  setTimeout(() => {
                    (null == d || d(0, "", "export"),
                      console.log(
                        `[useProjectIO] ✅ ZIP 导出成功！包含 ${Object.keys(y).length} 个缓存资源。`,
                      ));
                  }, 500),
                  !0
                );
              })(t, r, o, u, i, a, s, e, A, j);
              if (l) return;
              console.log("[useProjectIO] ZIP 导出未成功，回退到 JSON 格式");
            } catch (g) {
              console.warn("[useProjectIO] ZIP 导出失败，回退到 JSON:", g);
            }
            null == j || j(0, "正在准备保存...", "export");
          }
          const h = Zt("standard"),
            p = `${e || "未命名项目"}_${h}.json`;
          let f = null,
            w = null,
            y = !1;
          if ("showSaveFilePicker" in window)
            try {
              (null == j || j(1, "请选择保存位置...", "export"),
                (f = await window.showSaveFilePicker({
                  suggestedName: p,
                  types: [
                    {
                      description: "JSON File",
                      accept: { "application/json": [".json"] },
                    },
                  ],
                })),
                (w = await f.createWritable()),
                null == j || j(5, "正在准备数据...", "export"));
            } catch (g) {
              if ("AbortError" === g.name)
                return void (null == j || j(0, "", "export"));
              (console.error("File System API 打开失败:", g),
                (f = null),
                (w = null));
            }
          if (!f && "__TAURI__" in window)
            try {
              console.log("[useProjectIO] 尝试使用Tauri dialog API (Mac兼容)");
              const { save: save } = await x(
                  async () => {
                    const { save: e } =
                      await import("./vendor-DXn3GjvW.js").then((n) => n.n);
                    return { save: e };
                  },
                  __vite__mapDeps([1, 2]),
                  import.meta.url,
                ),
                { writeTextFile: e } = await x(
                  async () => {
                    const { writeTextFile: e } =
                      await import("./vendor-DXn3GjvW.js").then((n) => n.f);
                    return { writeTextFile: e };
                  },
                  __vite__mapDeps([1, 2]),
                  import.meta.url,
                );
              null == j || j(1, "请选择保存位置...", "export");
              const t = await save({
                defaultPath: p,
                filters: [{ name: "JSON", extensions: ["json"] }],
              });
              if (!t) return void (null == j || j(0, "", "export"));
              ((y = !0),
                console.log("[useProjectIO] Tauri dialog 选择路径:", t),
                (f = { tauriPath: t }),
                null == j || j(5, "正在准备数据...", "export"));
            } catch (g) {
              console.error("[useProjectIO] Tauri dialog 失败:", g);
            }
          let v = t,
            b = r;
          if (mr.isAvailable()) {
            (null == j || j(7, "正在从本地缓存预加载资源...", "export"),
              await mr.flushManifest());
            const e = [];
            for (const i of t) {
              const t = null == (l = i.settings) ? void 0 : l._assetId;
              if (
                t &&
                i.content &&
                "string" == typeof i.content &&
                i.content.startsWith("blob:")
              )
                try {
                  if (!(await fetch(i.content, { method: "HEAD" })).ok)
                    throw new Error("dead");
                  e.push(i);
                } catch {
                  const o = await mr.readAsset(t);
                  o
                    ? (e.push({ ...i, content: URL.createObjectURL(o.blob) }),
                      console.log(
                        `[useProjectIO] ♻️ Restored dead blob URL from cache: ${t}`,
                      ))
                    : e.push(i);
                }
              else e.push(i);
            }
            v = e;
            const o = [];
            for (const t of r) {
              const e = t._assetId;
              if (e && t.url && t.url.startsWith("blob:"))
                try {
                  if (!(await fetch(t.url, { method: "HEAD" })).ok)
                    throw new Error("dead");
                  o.push(t);
                } catch {
                  const i = await mr.readAsset(e);
                  i
                    ? (o.push({ ...t, url: URL.createObjectURL(i.blob) }),
                      console.log(
                        `[useProjectIO] ♻️ Restored history blob URL from cache: ${e}`,
                      ))
                    : o.push(t);
                }
              else o.push(t);
            }
            b = o;
          }
          if (
            v.some(
              (n) =>
                "string" == typeof n.content &&
                (n.content.startsWith("http") ||
                  n.content.startsWith("blob:") ||
                  n.content.startsWith("data:")),
            ) ||
            b.some(
              (e) =>
                e.url &&
                (e.url.startsWith("http") || e.url.startsWith("blob:")),
            )
          ) {
            (console.log("[useProjectIO] 检测到 URL，开始转换为 Base64..."),
              null == j ||
                j(10, "正在将所有图片转换为本地数据格式...", "export"));
            const t = { count: Gr(v) + Gr(s) + Gr(a) + Gr(b), current: 0 },
              l = [],
              c = 3,
              d = [],
              h = {
                preserveOriginalFields: [
                  "content",
                  "previewMjImages",
                  "previewMjVideos",
                  "selectedPreviewImage",
                  "selectedPreviewVideo",
                  "_contentAssetId",
                  "_previewMjAssetIds",
                  "_selectedImageAssetId",
                ],
              };
            for (let e = 0; e < v.length; e += c) {
              const o = v.slice(e, e + c),
                i = await Br(o, 0, j, t, l, h);
              (d.push(...i),
                null == j ||
                  j(
                    10 + (e / v.length) * 30,
                    `正在处理节点 ${e + 1}/${v.length}...`,
                    "export",
                  ),
                await new Promise((e) => setTimeout(e, 10)),
                e % (3 * c) == 0 &&
                  e > 0 &&
                  (await new Promise((e) => setTimeout(e, 50))));
            }
            null == j || j(40, "正在处理角色库...", "export");
            const _ = await Br(s, 0, j, t, l);
            (await new Promise((e) => setTimeout(e, 0)),
              null == j || j(50, "正在处理聊天会话...", "export"));
            const I = {
                preserveOriginalFields: ["content", "url", "imageUrl", "files"],
              },
              S = await Br(a, 0, j, t, l, I);
            (await new Promise((e) => setTimeout(e, 0)),
              null == j || j(60, "正在处理历史记录...", "export"));
            const P =
              "undefined" != typeof navigator &&
              (navigator.platform.toLowerCase().includes("mac") ||
                navigator.platform.toLowerCase().includes("win") ||
                navigator.userAgent.toLowerCase().includes("mac") ||
                navigator.userAgent.toLowerCase().includes("win"))
                ? 500
                : 200;
            let k = b;
            k.length > P &&
              (console.warn(
                `[useProjectIO] ⚠️ 历史记录过多 (${k.length})，只保存最新 ${P} 条`,
              ),
              (k = k.slice(-P)));
            const $ = {
                preserveOriginalFields: [
                  "mjImages",
                  "originalUrl",
                  "mjOriginalUrl",
                  "url",
                  "videoPosterUrl",
                  "localCacheUrl",
                  "audioUrl",
                ],
              },
              M = await Br(k, 0, j, t, l, $);
            if (
              (await new Promise((e) => setTimeout(e, 0)),
              null == j || j(70, "正在生成项目文件...", "export"),
              y && f && f.tauriPath)
            ) {
              null == j || j(70, "正在生成项目文件...", "export");
              const t = {
                version: "2.9",
                projectName: e,
                nodes: d,
                connections: o,
                groups: u,
                view: {
                  ...i,
                  viewportSize: A || {
                    width: window.innerWidth,
                    height: window.innerHeight,
                  },
                },
                chatSessions: S,
                characterLibrary: _,
                history: M,
                timestamp: qt(),
              };
              (console.log(
                `[useProjectIO] 📦 项目包含 ${u.length} 个分组:`,
                u.map((e) => `${e.name}(${e.nodeIds.length}个节点)`).join(", "),
              ),
                null == j || j(85, "正在生成JSON文件...", "export"));
              const r = _o(t);
              let a;
              try {
                a = JSON.stringify(r, null, 2);
              } catch (g) {
                if (
                  !(
                    g instanceof RangeError &&
                    g.message.includes("Invalid string length")
                  )
                )
                  throw g;
                (console.warn("项目数据过大，使用紧凑格式"),
                  null == j || j(87, "数据较大，使用紧凑格式...", "export"));
                try {
                  a = JSON.stringify(r);
                } catch (m) {
                  throw (
                    console.error("紧凑格式序列化也失败:", m),
                    new Error(
                      "项目数据过大，无法序列化。请尝试减少画布内容或历史记录。",
                    )
                  );
                }
              }
              if (await T(a, p)) return;
              if (y && f && f.tauriPath) {
                null == j || j(95, "正在写入文件...", "export");
                try {
                  const { writeTextFile: e } = await x(
                    async () => {
                      const { writeTextFile: e } =
                        await import("./vendor-DXn3GjvW.js").then((n) => n.f);
                      return { writeTextFile: e };
                    },
                    __vite__mapDeps([1, 2]),
                    import.meta.url,
                  );
                  (await e(f.tauriPath, a),
                    console.log("[useProjectIO] Tauri文件写入成功"));
                } catch (g) {
                  throw (
                    console.error("[useProjectIO] Tauri文件写入失败:", g),
                    new Error("文件写入失败: " + g.message)
                  );
                }
              } else if (w && f)
                (null == j || j(95, "正在写入文件...", "export"),
                  await w.write(a),
                  await w.close());
              else {
                null == j || j(95, "正在创建下载...", "export");
                const blob = new Blob([a], { type: "application/json" }),
                  url = URL.createObjectURL(blob),
                  e = document.createElement("a");
                ((e.href = url),
                  (e.download = p),
                  document.body.appendChild(e),
                  e.click(),
                  document.body.removeChild(e),
                  URL.revokeObjectURL(url));
              }
            } else if (w && f) {
              null == j || j(95, "正在写入文件...", "export");
              const t = _o({
                  version: "2.9",
                  projectName: e,
                  nodes: d,
                  connections: o,
                  groups: u,
                  view: {
                    ...i,
                    viewportSize: A || {
                      width: window.innerWidth,
                      height: window.innerHeight,
                    },
                  },
                  chatSessions: S,
                  characterLibrary: _,
                  history: M,
                  timestamp: qt(),
                }),
                r = JSON.stringify(t, null, 2);
              (await w.write(r), await w.close());
            } else {
              null == j || j(95, "正在创建下载...", "export");
              const t = _o({
                  version: "2.9",
                  projectName: e,
                  nodes: d,
                  connections: o,
                  groups: u,
                  view: {
                    ...i,
                    viewportSize: A || {
                      width: window.innerWidth,
                      height: window.innerHeight,
                    },
                  },
                  chatSessions: S,
                  characterLibrary: _,
                  history: M,
                  timestamp: qt(),
                }),
                r = JSON.stringify(t, null, 2),
                blob = new Blob([r], { type: "application/json" }),
                url = URL.createObjectURL(blob),
                a = document.createElement("a");
              ((a.href = url),
                (a.download = p),
                document.body.appendChild(a),
                a.click(),
                document.body.removeChild(a),
                URL.revokeObjectURL(url));
            }
            return l.length > 0
              ? (console.warn(
                  `[useProjectIO] ⚠️ 有 ${l.length} 个资源转换失败，已保留原URL`,
                ),
                console.warn("[useProjectIO] 失败资源列表:", l.slice(0, 10)),
                null == j ||
                  j(100, "保存完成（含部分离线资源，见下载报告）", "export"),
                void setTimeout(() => {
                  (null == j || j(0, "", "export"),
                    console.log(
                      "[useProjectIO] ⚠️ 项目保存完成，但有部分资源未能下载（已生成报告）。",
                    ));
                }, 500))
              : (null == j || j(100, "保存完成！", "export"),
                mr.isAvailable() && mr.syncHistory(r).catch(() => {}),
                void setTimeout(() => {
                  (null == j || j(0, "", "export"),
                    console.log(
                      "[useProjectIO] ✅ 项目保存成功！所有图片和视频已包含在文件中。",
                    ));
                }, 500));
          }
          (console.log("[useProjectIO] 未检测到 URL，直接保存..."),
            null == j || j(85, "正在生成JSON文件...", "export"));
          const _ = _o({
            version: "2.9",
            projectName: e,
            nodes: t,
            connections: o,
            groups: u,
            view: {
              ...i,
              viewportSize: A || {
                width: window.innerWidth,
                height: window.innerHeight,
              },
            },
            chatSessions: a,
            characterLibrary: s,
            history: r,
            timestamp: qt(),
          });
          let I;
          try {
            I = JSON.stringify(_, null, 2);
          } catch (g) {
            if (
              !(
                g instanceof RangeError &&
                g.message.includes("Invalid string length")
              )
            )
              throw g;
            (console.warn("项目数据过大，使用紧凑格式"),
              null == j || j(87, "数据较大，使用紧凑格式...", "export"));
            try {
              I = JSON.stringify(_);
            } catch (m) {
              throw (
                console.error("紧凑格式序列化也失败:", m),
                new Error(
                  "项目数据过大，无法序列化。请尝试减少画布内容或历史记录。",
                )
              );
            }
          }
          if (await T(I, p)) return;
          if (y && f && f.tauriPath) {
            null == j || j(95, "正在写入文件...", "export");
            try {
              const { writeTextFile: e } = await x(
                async () => {
                  const { writeTextFile: e } =
                    await import("./vendor-DXn3GjvW.js").then((n) => n.f);
                  return { writeTextFile: e };
                },
                __vite__mapDeps([1, 2]),
                import.meta.url,
              );
              (await e(f.tauriPath, I),
                console.log("[useProjectIO] Tauri文件写入成功"));
            } catch (g) {
              throw (
                console.error("[useProjectIO] Tauri文件写入失败:", g),
                new Error("文件写入失败: " + g.message)
              );
            }
          } else if (w && f)
            (null == j || j(95, "正在写入文件...", "export"),
              await w.write(I),
              await w.close());
          else {
            null == j || j(95, "正在创建下载...", "export");
            const blob = new Blob([I], { type: "application/json" }),
              url = URL.createObjectURL(blob),
              e = document.createElement("a");
            ((e.href = url),
              (e.download = p),
              document.body.appendChild(e),
              e.click(),
              document.body.removeChild(e),
              URL.revokeObjectURL(url));
          }
          (null == j || j(100, "保存完成！", "export"),
            mr.isAvailable() && mr.syncHistory(r).catch(() => {}),
            setTimeout(() => {
              (null == j || j(0, "", "export"),
                console.log("[useProjectIO] ✅ 项目保存成功！"));
            }, 500));
        } catch (error) {
          (console.error("保存项目失败:", error),
            null == j || j(0, "", "export"));
          const e = "保存项目失败: " + (error.message || "未知错误");
          ((null == (c = error.message) ? void 0 : c.includes("memory")) ||
          (null == (d = error.message) ? void 0 : d.includes("allocation"))
            ? console.error(
                "[useProjectIO]",
                e +
                  " - 建议：减少节点数量、关闭其他标签页、或使用性能更好的设备",
              )
            : console.error("[useProjectIO]", e),
            null == j || j(-1, e, "export"));
        }
      }, [e, t, o, i, r, a, s, j, A]);
    return {
      handleSaveProject: $,
      handleLoadProject: g.useCallback(() => {
        const e = async (e) => {
          const t = Gr(e);
          if (t > 0) {
            null == j || j(5, `检测到 ${t} 个外部资源，正在转换...`, "import");
            const o = [],
              i = { count: t, current: 0 };
            ((e = await Br(
              e,
              0,
              (e, t) => (null == j ? void 0 : j(5 + 0.08 * e, t, "import")),
              i,
              o,
              { onFailedBehavior: "placeholder", silentFail: !0 },
            )),
              o.length > 0 &&
                console.log(
                  `[useProjectIO] 项目导入: ${o.length} 个资源不可用，已替换为占位符`,
                ));
          }
          if (nt(e)) {
            const t = it(e);
            if (
              (console.log(
                `[useProjectIO] 检测到 Base64 数据，估计大小: ${(t / 1024 / 1024).toFixed(2)}MB`,
              ),
              t > 20971520)
            ) {
              (console.log(
                "[useProjectIO] 大型项目检测，使用流式 Hydration...",
              ),
                null == j ||
                  j(15, "正在优化大型项目（流式处理）...", "import"));
              const { hydrateProjectDataStreaming: t } = await x(
                  async () => {
                    const { hydrateProjectDataStreaming: e } =
                      await Promise.resolve().then(() => rt);
                    return { hydrateProjectDataStreaming: e };
                  },
                  void 0,
                  import.meta.url,
                ),
                { data: o, stats: i } = await t(e, (e, message) => {
                  null == j || j(15 + 0.1 * e, message, "import");
                });
              ((e = o),
                console.log("[useProjectIO] ✅ 流式 Hydration 完成！"),
                console.log(`  - 转换图片: ${i.converted} 张`),
                console.log(
                  `  - 节省内存: ${(i.totalSize / 1024 / 1024).toFixed(2)}MB`,
                ),
                console.log(`  - 跳过项目: ${i.skipped} 个`),
                null == j ||
                  j(
                    25,
                    `已优化 ${i.converted} 张图片，节省 ${(i.totalSize / 1024 / 1024).toFixed(2)}MB 内存`,
                    "import",
                  ));
            } else {
              (console.log(
                "[useProjectIO] 开始 Hydration（Base64 → Blob URL）...",
              ),
                null == j ||
                  j(15, "正在优化内存数据（Base64 → Blob URL）...", "import"));
              const { hydrateProjectData: t } = await x(
                  async () => {
                    const { hydrateProjectData: e } =
                      await Promise.resolve().then(() => rt);
                    return { hydrateProjectData: e };
                  },
                  void 0,
                  import.meta.url,
                ),
                { data: o, stats: i } = await t(e);
              ((e = o),
                console.log("[useProjectIO] ✅ Hydration 完成！"),
                console.log(`  - 转换图片: ${i.converted} 张`),
                console.log(
                  `  - 节省内存: ${(i.totalSize / 1024 / 1024).toFixed(2)}MB`,
                ),
                console.log(`  - 跳过项目: ${i.skipped} 个`),
                null == j ||
                  j(
                    25,
                    `已优化 ${i.converted} 张图片，节省 ${(i.totalSize / 1024 / 1024).toFixed(2)}MB 内存`,
                    "import",
                  ));
            }
          } else
            console.log("[useProjectIO] 未检测到 Base64 数据，跳过 Hydration");
          const o = e.nodes || [],
            i = o.length;
          (console.log(`[useProjectIO] Processing ${i} nodes...`),
            null == j || j(30, `正在处理 ${i} 个节点...`, "import"),
            m([]));
          const r = [];
          for (let a = 0; a < i; a++) {
            const e = o[a],
              t = await Vr(e, a);
            if ((r.push(t), a % 10 == 0 || a === i - 1)) {
              null == j ||
                j(30 + (a / i) * 40, `处理节点 ${a + 1}/${i}`, "import");
            }
            (a + 1) % 20 == 0 && (await new Promise((e) => setTimeout(e, 0)));
          }
          (null == j || j(70, "正在加载节点到画布...", "import"),
            m([]),
            await new Promise((e) => setTimeout(e, 50)));
          for (let a = 0; a < r.length; a += 50) {
            const e = r.slice(0, a + 50);
            if ((m(e), a + 50 < r.length)) {
              const e = 70 + (a / r.length) * 5;
              (null == j ||
                j(
                  e,
                  `加载节点 ${Math.min(a + 50, r.length)}/${r.length}`,
                  "import",
                ),
                await new Promise((e) => setTimeout(e, 10)));
            }
          }
          if (
            (null == j || j(75, "正在加载连接...", "import"),
            e.connections && h(e.connections),
            null == j || j(77, "正在加载分组...", "import"),
            e.groups && Array.isArray(e.groups)
              ? (I(e.groups),
                console.log(
                  `[useProjectIO] ✅ 已加载 ${e.groups.length} 个分组`,
                ))
              : (I([]),
                console.log(
                  "[useProjectIO] ⚠️ 项目文件不包含分组数据（可能是旧版本）",
                )),
            null == j || j(80, "正在加载视图...", "import"),
            e.view && p(e.view),
            null == j || j(85, "正在加载聊天会话...", "import"),
            e.chatSessions)
          ) {
            w(e.chatSessions);
            let t = 0;
            (e.chatSessions.forEach((e) => {
              var o;
              null == (o = e.messages) ||
                o.forEach((e) => {
                  e.files && e.files.length > 0 && (t += e.files.length);
                });
            }),
              console.log(
                `[useProjectIO] ✅ 已加载 ${e.chatSessions.length} 个聊天会话，包含 ${t} 个媒体文件`,
              ));
          }
          if (
            (null == j || j(87, "正在加载历史记录...", "import"), e.history)
          ) {
            const t =
              "undefined" != typeof navigator &&
              (navigator.platform.toLowerCase().includes("mac") ||
                navigator.platform.toLowerCase().includes("win") ||
                navigator.userAgent.toLowerCase().includes("mac") ||
                navigator.userAgent.toLowerCase().includes("win"))
                ? 500
                : 200;
            let o = e.history;
            (o.length > t &&
              (console.warn(
                `[useProjectIO] ⚠️ 历史记录过多 (${o.length})，只加载最新 ${t} 条`,
              ),
              (o = o.slice(-t))),
              f(o),
              console.log(`[useProjectIO] ✅ 已加载 ${o.length} 条历史记录`));
          } else
            console.log(
              "[useProjectIO] ⚠️ 项目文件不包含历史记录（可能是旧版本）",
            );
          (null == j || j(90, "正在加载角色库...", "import"),
            e.characterLibrary && (await nr(e.characterLibrary, v, j)),
            null == j || j(95, "正在应用项目设置...", "import"),
            e.projectName && _(Ht(e.projectName)),
            null == j || j(100, "加载完成！", "import"),
            setTimeout(() => {
              (null == j || j(0, "", "import"),
                console.log("[useProjectIO] ✅ 项目加载成功！"),
                setTimeout(async () => {
                  var t;
                  try {
                    const o = mr.isAvailable();
                    let i = 0;
                    for (const e of r)
                      if (
                        e.content &&
                        "string" == typeof e.content &&
                        e.content.startsWith("blob:")
                      )
                        try {
                          const r = await fetch(e.content);
                          if (!r.ok) continue;
                          const blob = await r.blob(),
                            a =
                              (null == (t = e.settings)
                                ? void 0
                                : t._assetId) || e.id;
                          (await Be.saveBlobAsset(a, blob, e.content),
                            o &&
                              (await mr.saveAsset(
                                a,
                                blob,
                                blob.type || "application/octet-stream",
                              ),
                              i++));
                        } catch {}
                    const a = e.history || [];
                    for (const e of a) {
                      const t = e._assetId;
                      if (t && e.url && e.url.startsWith("blob:"))
                        try {
                          const r = await fetch(e.url);
                          if (!r.ok) continue;
                          const blob = await r.blob();
                          (await Be.saveBlobAsset(t, blob, e.url),
                            o &&
                              (await mr.saveAsset(
                                t,
                                blob,
                                blob.type || "application/octet-stream",
                              ),
                              i++));
                        } catch {}
                    }
                    (o && a.length > 0 && (await mr.syncHistory(a)),
                      i > 0 &&
                        console.log(
                          `[useProjectIO] ✅ 导入后缓存了 ${i} 个资源到本地目录`,
                        ));
                  } catch (o) {
                    console.warn(
                      "[useProjectIO] 导入后资源缓存失败（不影响使用）:",
                      o,
                    );
                  }
                }, 2e3),
                setTimeout(() => {
                  const e = r.filter(
                    (e) =>
                      e.content &&
                      "string" == typeof e.content &&
                      e.content.startsWith("data:image") &&
                      e.content.length > 102400,
                  );
                  if (e.length > 0) {
                    console.log(
                      `[useProjectIO] 🖼️ 开始后台生成 ${e.length} 张图片的缩略图...`,
                    );
                    const t = 5;
                    let o = 0;
                    const i = async (r) => {
                      const a = e.slice(r, r + t);
                      (await Promise.all(
                        a.map(async (e) => {
                          try {
                            e.content &&
                              !kt.hasThumbnail(e.id) &&
                              (await kt.storeWithThumbnails(e.id, e.content),
                              o++);
                          } catch {}
                        }),
                      ),
                        r + t < e.length
                          ? setTimeout(() => i(r + t), 100)
                          : console.log(
                              `[useProjectIO] ✅ 缩略图生成完成: ${o}/${e.length}`,
                            ));
                    };
                    i(0);
                  }
                }, 1e3));
            }, 500));
        };
        if (P)
          return void (async () => {
            try {
              const { open: t } = await x(
                  async () => {
                    const { open: e } =
                      await import("./vendor-DXn3GjvW.js").then((n) => n.n);
                    return { open: e };
                  },
                  __vite__mapDeps([1, 2]),
                  import.meta.url,
                ),
                o = await t({
                  directory: !0,
                  multiple: !1,
                  title: "选择项目文件夹或项目JSON文件",
                });
              if (!o) return;
              let i = Array.isArray(o) ? o[0] : o;
              (console.log("[useProjectIO] 选择的路径:", i),
                console.log("[useProjectIO] 路径类型:", typeof i),
                Tr(),
                null == j || j(2, "正在读取文件...", "import"));
              const result = await invoke("import_project", {
                path: i,
                options: {
                  lazy_assets: !1,
                  batch_size: 200,
                  max_memory_mb: 512,
                },
              });
              console.log("[useProjectIO] 导入结果:", result);
              const r = result.project_json;
              await e(r);
            } catch (error) {
              (console.error("加载项目失败:", error),
                null == j || j(0, "", "import"));
              const e = error.message || "未知错误";
              let t = "加载项目失败: ";
              (e.includes("JSON 格式错误") || e.includes("JSON 解析失败")
                ? (t +=
                    e +
                    " - 可能的原因：文件在保存时被截断、文件编码不正确、或文件不是有效的项目文件")
                : e.includes("内存不足") || e.includes("memory")
                  ? (t += e + " - 建议：关闭其他应用、重启后重试")
                  : e.includes("读取数据文件失败") ||
                      e.includes("project.data.json")
                    ? (t +=
                        e +
                        " - 可能的原因：选择的不是有效的项目文件夹，或文件夹结构不正确。请确保选择的是导出的项目文件夹（包含 project.data.json 文件）或项目 JSON 文件")
                    : e.includes("文件读取失败") || e.includes("文件读取失败")
                      ? (t +=
                          e +
                          " - 可能的原因：文件权限问题、文件正在被其他程序使用、或磁盘读取错误")
                      : (t += e),
                console.error("[useProjectIO]", t),
                null == j || j(-1, t, "import"));
            }
          })();
        const t = document.createElement("input");
        ((t.type = "file"),
          (t.accept = ".json,.zip"),
          (t.onchange = async (t) => {
            var o;
            const file = null == (o = t.target.files) ? void 0 : o[0];
            if (file)
              try {
                (Tr(), null == j || j(2, "正在读取文件...", "import"));
                const t = file.size / 1024 / 1024;
                (console.log(
                  `[useProjectIO] Loading project file: ${t.toFixed(2)} MB`,
                ),
                  t > 100 &&
                    console.warn(
                      `[useProjectIO] ⚠️ 文件大小为 ${t.toFixed(1)} MB，加载可能需要较长时间`,
                    ));
                if (
                  file.name.toLowerCase().endsWith(".zip") ||
                  "application/zip" === file.type ||
                  "application/x-zip-compressed" === file.type
                ) {
                  (console.log("[useProjectIO] 检测到 ZIP 文件，开始解压..."),
                    null == j || j(5, "正在解压 ZIP 文件...", "import"));
                  const t = (
                      await x(
                        async () => {
                          const { default: e } =
                            await import("./jszip-CXr7zspi.js").then(
                              (n) => n.j,
                            );
                          return { default: e };
                        },
                        [],
                        import.meta.url,
                      )
                    ).default,
                    o = await t.loadAsync(file),
                    r = o.file("project.json");
                  if (!r)
                    throw new Error(
                      "ZIP 文件中未找到 project.json，请确认这是有效的项目 ZIP 包",
                    );
                  const a = await r.async("string"),
                    s = JSON.parse(a),
                    l = o.file("manifest.json");
                  if (l) {
                    const e = await l.async("string"),
                      t = JSON.parse(e),
                      r = Object.entries(t.assets || {});
                    null == j ||
                      j(8, `正在恢复 ${r.length} 个资源文件...`, "import");
                    let a = 0;
                    const s = mr.isAvailable();
                    for (const [l, c] of r) {
                      const e = o.file(c.fileName);
                      if (e)
                        try {
                          const t = await e.async("arraybuffer"),
                            blob = new Blob([t], { type: c.mimeType }),
                            o =
                              l.startsWith("preview_") ||
                              l.startsWith("thumb_"),
                            i = o ? "thumbnails" : void 0;
                          (o ||
                            (await Be.saveBlobAsset(
                              l,
                              blob,
                              c.remoteUrl || "",
                            )),
                            s &&
                              (await mr.saveAsset(
                                l,
                                blob,
                                c.mimeType,
                                c.remoteUrl,
                                i,
                              )),
                            a++,
                            (a % 5 != 0 && a !== r.length) ||
                              null == j ||
                              j(
                                8 + (a / r.length) * 14,
                                `恢复资源 ${a}/${r.length}...`,
                                "import",
                              ));
                        } catch (i) {
                          console.warn(
                            `[useProjectIO] ⚠️ ZIP 资源恢复失败: ${l}`,
                            i,
                          );
                        }
                    }
                    console.log(
                      `[useProjectIO] ✅ 从 ZIP 恢复了 ${a}/${r.length} 个资源`,
                    );
                  }
                  if (s.history && Array.isArray(s.history)) {
                    null == j || j(23, "正在恢复历史记录 URL...", "import");
                    for (const e of s.history) {
                      const t = e._assetId;
                      if (t && (!e.url || "" === e.url)) {
                        const url = await Be.getAssetUrl(t);
                        url && (e.url = url);
                      }
                      const o = e._mjAssetIds;
                      if (o && e.mjImages)
                        for (let s = 0; s < o.length; s++)
                          if (
                            o[s] &&
                            (!e.mjImages[s] || "" === e.mjImages[s])
                          ) {
                            const url = await Be.getAssetUrl(o[s]);
                            url && (e.mjImages[s] = url);
                          }
                      const i = e._audioAssetId;
                      if (i && (!e.audioUrl || "" === e.audioUrl)) {
                        const url = await Be.getAssetUrl(i);
                        url && (e.audioUrl = url);
                      }
                      const r = e._mjOriginalAssetId;
                      if (r && (!e.mjOriginalUrl || "" === e.mjOriginalUrl)) {
                        const url = await Be.getAssetUrl(r);
                        url && (e.mjOriginalUrl = url);
                      }
                      const a = e._thumbnailAssetId;
                      if (a && (!e.thumbnailUrl || "" === e.thumbnailUrl)) {
                        const url = await Be.getAssetUrl(a);
                        url && (e.thumbnailUrl = url);
                      }
                    }
                  }
                  (mr.isAvailable() &&
                    s.history &&
                    mr.syncHistory(s.history).catch(() => {}),
                    null == j || j(25, "正在加载项目数据...", "import"),
                    await e(s));
                } else {
                  let text, t;
                  try {
                    text = await file.text();
                  } catch (r) {
                    throw new Error(`文件读取失败: ${r.message}`);
                  }
                  null == j || j(10, "正在解析项目数据...", "import");
                  try {
                    ((t = JSON.parse(text)), (text = ""));
                  } catch (a) {
                    console.error("[useProjectIO] JSON parse error:", a);
                    const e = a.message;
                    throw e.includes("Unexpected token") || e.includes("JSON")
                      ? new Error(
                          "JSON 格式错误，文件可能已损坏或不是有效的项目文件",
                        )
                      : e.includes("memory") || e.includes("allocation")
                        ? new Error(
                            "文件过大，内存不足。请尝试关闭其他标签页后重试",
                          )
                        : new Error(`JSON 解析失败: ${e}`);
                  }
                  await e(t);
                }
              } catch (error) {
                (console.error("加载项目失败:", error),
                  null == j || j(0, "", "import"));
                const e = error.message || "未知错误";
                let t = "加载项目失败: ";
                (e.includes("ZIP") || e.includes("project.json")
                  ? (t +=
                      e +
                      " - 请确认选择的是有效的项目 ZIP 包（需包含 project.json）")
                  : e.includes("JSON 格式错误") || e.includes("JSON 解析失败")
                    ? (t +=
                        e +
                        " - 可能的原因：文件在保存时被截断、文件编码不正确、或文件不是有效的项目文件")
                    : e.includes("内存不足") || e.includes("memory")
                      ? (t +=
                          e +
                          " - 建议：关闭其他浏览器标签页、重启浏览器、或使用性能更好的设备")
                      : e.includes("文件读取失败")
                        ? (t +=
                            e +
                            " - 可能的原因：文件权限问题、文件正在被其他程序使用、或磁盘读取错误")
                        : (t += e),
                  console.error("[useProjectIO]", t),
                  null == j || j(-1, t, "import"));
              }
          }),
          t.click());
      }, [m, h, p, f, w, v, _, I, j, P]),
      handleImportWorkflow: g.useCallback(() => {
        const e = document.createElement("input");
        ((e.type = "file"),
          (e.accept = ".json"),
          (e.onchange = async (e) => {
            var t;
            const file = null == (t = e.target.files) ? void 0 : t[0];
            if (file)
              try {
                const text = await file.text(),
                  e = JSON.parse(text);
                if (e.nodes && Array.isArray(e.nodes)) {
                  const t = new Map(),
                    o = 20,
                    i = 20;
                  let r = e.nodes.map((e) => {
                    const r = Kt();
                    t.set(e.id, r);
                    const a = e.settings ? { ...e.settings } : {};
                    "_executeTrigger" in a && delete a._executeTrigger;
                    const s = {
                      ...e,
                      id: r,
                      x: e.x + o,
                      y: e.y + i,
                      settings: a,
                    };
                    return (
                      "custom-agent" === s.type &&
                        ("isGenerating" in s && delete s.isGenerating,
                        "generationProgress" in s &&
                          delete s.generationProgress),
                      s
                    );
                  });
                  const a = Gr(r);
                  if (a > 0) {
                    null == j ||
                      j(5, `检测到 ${a} 个外部资源，正在转换...`, "import");
                    const e = [],
                      t = { count: a, current: 0 },
                      o = await Br(
                        r,
                        0,
                        (e, t) =>
                          null == j ? void 0 : j(5 + 0.1 * e, t, "import"),
                        t,
                        e,
                        { onFailedBehavior: "placeholder", silentFail: !0 },
                      );
                    (e.length > 0 &&
                      console.log(
                        `[useProjectIO] 工作流导入: ${e.length} 个资源不可用，已替换为占位符`,
                      ),
                      (r = o));
                  }
                  const s = (e.connections || []).map((e) => ({
                    ...e,
                    id: Kt(),
                    from: t.get(e.from) || e.from,
                    to: t.get(e.to) || e.to,
                  }));
                  let l = 0;
                  if (
                    (console.log(
                      "[useProjectIO] 工作流数据中的groups字段:",
                      e.groups,
                    ),
                    console.log(
                      "[useProjectIO] groups是否为数组:",
                      Array.isArray(e.groups),
                    ),
                    e.groups && Array.isArray(e.groups))
                  ) {
                    console.log(
                      `[useProjectIO] 开始处理 ${e.groups.length} 个分组...`,
                    );
                    const o = e.groups.map((e) => {
                      const o = {
                        ...e,
                        id: Kt(),
                        nodeIds: e.nodeIds.map((e) => t.get(e) || e),
                        updatedAt: Date.now(),
                      };
                      return (
                        console.log(`[useProjectIO] 处理分组: ${e.name}`, {
                          原始nodeIds: e.nodeIds,
                          新nodeIds: o.nodeIds,
                        }),
                        o
                      );
                    });
                    (console.log("[useProjectIO] 准备添加分组到state:", o),
                      I((e) => {
                        const t = [...e, ...o];
                        return (
                          console.log(
                            "[useProjectIO] 更新后的groups state:",
                            t,
                          ),
                          t
                        );
                      }),
                      (l = o.length),
                      console.log(
                        `[useProjectIO] 📦 导入了 ${l} 个分组:`,
                        o
                          .map((e) => `${e.name}(${e.nodeIds.length}个节点)`)
                          .join(", "),
                      ));
                  } else
                    console.warn(
                      "[useProjectIO] ⚠️ 工作流文件不包含有效的分组数据",
                    );
                  (m((e) => [...e, ...r]),
                    h((e) => [...e, ...s]),
                    e.characterLibrary &&
                      Array.isArray(e.characterLibrary) &&
                      (await nr(e.characterLibrary, v)),
                    null == j || j(100, "加载完成！", "import"),
                    setTimeout(
                      () => (null == j ? void 0 : j(0, "", "import")),
                      100,
                    ),
                    console.log(
                      `[useProjectIO] ✅ 成功导入 ${r.length} 个节点、${s.length} 条连接和 ${l} 个分组`,
                    ));
                } else
                  (console.error("[useProjectIO] ❌ 无效的工作流文件"),
                    null == j || j(0, "", "import"));
              } catch (error) {
                (console.error("导入工作流失败:", error),
                  console.error(
                    "[useProjectIO] ❌ 导入工作流失败，请检查文件格式",
                  ),
                  null == j || j(0, "", "import"));
              }
          }),
          e.click());
      }, [m, h, v, I, j]),
      handleSaveSelectedWorkflow: g.useCallback(async () => {
        const e = d.size > 0 ? Array.from(d) : c ? [c] : [];
        if (0 === e.length) return;
        const i = t.filter((n) => e.includes(n.id)),
          r = o.filter((t) => e.includes(t.from) && e.includes(t.to));
        (console.log("[useProjectIO] 当前所有分组:", u),
          console.log("[useProjectIO] 选中的节点ID:", e));
        const a = u
          .filter((t) => t.nodeIds.some((t) => e.includes(t)))
          .map((t) => ({
            ...t,
            nodeIds: t.nodeIds.filter((t) => e.includes(t)),
          }))
          .filter((e) => e.nodeIds.length > 0);
        (console.log(
          `[useProjectIO] 📦 准备导出 ${a.length} 个分组:`,
          a.map((e) => `${e.name}(${e.nodeIds.length}个节点)`).join(", "),
        ),
          console.log(
            "[useProjectIO] 分组详细数据:",
            JSON.stringify(a, null, 2),
          ),
          console.log("正在转换工作流中的图片和视频为本地数据..."));
        const s = {
          type: "workflow",
          version: "1.0",
          nodes: await Br(i, 0, void 0, void 0, void 0, {
            preserveOriginalFields: [
              "content",
              "previewMjImages",
              "previewMjVideos",
              "selectedPreviewImage",
              "selectedPreviewVideo",
              "_contentAssetId",
              "_previewMjAssetIds",
              "_selectedImageAssetId",
            ],
          }),
          connections: r,
          groups: a,
          exportedAt: qt(),
        };
        (console.log("[useProjectIO] 📄 工作流数据:", {
          节点数: s.nodes.length,
          连接数: s.connections.length,
          分组数: s.groups.length,
          分组详情: s.groups,
        }),
          null == S || S({ visible: !1, x: 0, y: 0 }));
        const l = new Date(),
          g = `工作流_${`${l.getFullYear()}${String(l.getMonth() + 1).padStart(2, "0")}${String(l.getDate()).padStart(2, "0")}_${String(l.getHours()).padStart(2, "0")}${String(l.getMinutes()).padStart(2, "0")}`}.json`,
          m = _o(s);
        if ("showSaveFilePicker" in window)
          try {
            const e = await window.showSaveFilePicker({
                suggestedName: g,
                types: [
                  {
                    description: "JSON 工作流文件",
                    accept: { "application/json": [".json"] },
                  },
                ],
              }),
              t = await e.createWritable();
            (await t.write(JSON.stringify(m, null, 2)),
              await t.close(),
              console.log(
                "[useProjectIO] ✅ 工作流保存成功！所有图片和视频已包含在文件中。",
              ));
          } catch (error) {
            if ("AbortError" === error.name) return;
            (console.error("保存工作流失败:", error),
              console.error(
                "[useProjectIO] ❌ 保存失败: " + (error.message || "未知错误"),
              ));
          }
        else {
          const blob = new Blob([JSON.stringify(m, null, 2)], {
              type: "application/json",
            }),
            url = URL.createObjectURL(blob),
            e = document.createElement("a");
          ((e.href = url),
            (e.download = g),
            e.click(),
            URL.revokeObjectURL(url),
            console.log(
              "[useProjectIO] ✅ 工作流保存成功！所有图片和视频已包含在文件中。",
            ));
        }
      }, [d, c, t, o, u, S]),
    };
  },
  Hr = "https://www.runninghub.cn",
  qr = "https://www.runninghub.ai";
async function Zr(e) {
  const { apiKey: apiKey, webappId: t, useOverseas: o = !1 } = e,
    url = `${o ? qr : Hr}/api/webapp/apiCallDemo?apiKey=${encodeURIComponent(apiKey)}&webappId=${encodeURIComponent(t)}`,
    i = await fetch(url, {
      method: "GET",
      headers: {
        Host: o ? "www.runninghub.ai" : "www.runninghub.cn",
        Accept: "application/json",
      },
    });
  if (!i.ok) throw new Error(`请求失败: ${i.status} ${i.statusText}`);
  return await i.json();
}
async function Qr(e) {
  var t;
  const { apiKey: apiKey, file: file, useOverseas: o = !1 } = e,
    baseUrl = o ? qr : Hr,
    formData = new FormData();
  formData.append("file", file);
  const i = await fetch(`${baseUrl}/openapi/v2/media/upload/binary`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!i.ok) throw new Error(`上传失败: ${i.status} ${i.statusText}`);
  const result = await i.json();
  if (0 !== result.code) throw new Error(result.msg || "上传失败");
  if (!(null == (t = result.data) ? void 0 : t.fileName))
    throw new Error("上传返回格式异常，缺少 fileName");
  return {
    fileName: result.data.fileName,
    previewUrl: result.data.download_url,
  };
}
async function Xr(e) {
  var t;
  const { apiKey: apiKey, file: file, useOverseas: o = !1 } = e,
    baseUrl = o ? qr : Hr,
    i = o ? "www.runninghub.ai" : "www.runninghub.cn",
    formData = new FormData();
  (formData.append("apiKey", apiKey),
    formData.append("fileType", "input"),
    formData.append("file", file));
  const r = await fetch(`${baseUrl}/task/openapi/upload`, {
    method: "POST",
    headers: { Host: i },
    body: formData,
  });
  if (!r.ok) throw new Error(`上传失败: ${r.status} ${r.statusText}`);
  const result = await r.json();
  if (0 !== result.code) throw new Error(result.msg || "上传失败");
  if (!(null == (t = result.data) ? void 0 : t.fileName))
    throw new Error("上传返回格式异常");
  return {
    fileName: result.data.fileName,
    previewUrl: result.data.download_url,
  };
}
async function Yr(e) {
  try {
    return (await Qr(e)).fileName;
  } catch (t) {
    try {
      return (await Xr(e)).fileName;
    } catch {
      throw t;
    }
  }
}
async function ea(e) {
  try {
    return await Qr(e);
  } catch (t) {
    try {
      return await Xr(e);
    } catch {
      throw t;
    }
  }
}
async function ta(e) {
  var t;
  const {
      apiKey: apiKey,
      webappId: o,
      nodeInfoList: i,
      useOverseas: r = !1,
      instanceType: a,
    } = e,
    baseUrl = r ? qr : Hr,
    s = r ? "www.runninghub.ai" : "www.runninghub.cn",
    l = await fetch(`${baseUrl}/task/openapi/ai-app/run`, {
      method: "POST",
      headers: { Host: s, "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey,
        webappId: o,
        nodeInfoList: i,
        ...(a ? { instanceType: a } : {}),
      }),
    });
  if (!l.ok) throw new Error(`提交任务失败: ${l.status} ${l.statusText}`);
  const result = await l.json();
  if (0 !== result.code) throw new Error(result.msg || "提交任务失败");
  if (!(null == (t = result.data) ? void 0 : t.taskId))
    throw new Error("返回格式异常，缺少 taskId");
  return {
    taskId: String(result.data.taskId),
    promptTips: result.data.promptTips,
  };
}
async function oa(e) {
  const { apiKey: apiKey, taskId: taskId, useOverseas: t = !1 } = e,
    baseUrl = t ? qr : Hr,
    o = t ? "www.runninghub.ai" : "www.runninghub.cn",
    i = await fetch(`${baseUrl}/task/openapi/outputs`, {
      method: "POST",
      headers: { Host: o, "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey, taskId: taskId }),
    });
  if (!i.ok) throw new Error(`查询失败: ${i.status} ${i.statusText}`);
  return i.json();
}
async function na(e) {
  const { apiKey: apiKey, workflowId: t, useOverseas: o = !1 } = e,
    baseUrl = o ? qr : Hr,
    i = o ? "www.runninghub.ai" : "www.runninghub.cn",
    r = await fetch(`${baseUrl}/api/openapi/getJsonApiFormat`, {
      method: "POST",
      headers: { Host: i, "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey, workflowId: t }),
    });
  if (!r.ok) throw new Error(`请求失败: ${r.status} ${r.statusText}`);
  return r.json();
}
async function ia(e) {
  var t;
  const {
      apiKey: apiKey,
      workflowId: o,
      nodeInfoList: i,
      workflow: r,
      addMetadata: a = !0,
      webhookUrl: s,
      instanceType: l,
      usePersonalQueue: c = !1,
      useOverseas: d = !1,
    } = e,
    baseUrl = d ? qr : Hr,
    u = d ? "www.runninghub.ai" : "www.runninghub.cn",
    body = { apiKey: apiKey, workflowId: o, addMetadata: a };
  (i && i.length > 0 && (body.nodeInfoList = i),
    r && (body.workflow = r),
    s && (body.webhookUrl = s),
    l && (body.instanceType = l),
    c && (body.usePersonalQueue = c));
  const g = await fetch(`${baseUrl}/task/openapi/create`, {
    method: "POST",
    headers: { Host: u, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!g.ok) throw new Error(`提交任务失败: ${g.status} ${g.statusText}`);
  const result = await g.json();
  if (0 !== result.code) throw new Error(result.msg || "提交任务失败");
  if (!(null == (t = result.data) ? void 0 : t.taskId))
    throw new Error("返回格式异常，缺少 taskId");
  return {
    taskId: String(result.data.taskId),
    promptTips: result.data.promptTips,
  };
}
async function ra(e) {
  const { apiKey: apiKey, taskId: taskId, useOverseas: t = !1 } = e,
    baseUrl = t ? qr : Hr,
    o = t ? "www.runninghub.ai" : "www.runninghub.cn",
    i = await fetch(`${baseUrl}/task/openapi/cancel`, {
      method: "POST",
      headers: { Host: o, "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey, taskId: taskId }),
    });
  if (!i.ok) throw new Error(`取消任务失败: ${i.status} ${i.statusText}`);
  return i.json();
}
async function aa(e) {
  const {
      apiKey: apiKey,
      taskId: taskId,
      useOverseas: t = !1,
      pollInterval: o = 5e3,
      timeout: i = 27e5,
      onProgress: r,
      signal: a,
    } = e,
    s = Date.now();
  for (;;) {
    if (null == a ? void 0 : a.aborted) return { success: !1, error: "已取消" };
    const result = await oa({ apiKey: apiKey, taskId: taskId, useOverseas: t });
    if (
      0 === result.code &&
      result.data &&
      Array.isArray(result.data) &&
      result.data.length > 0
    ) {
      const e = result.data;
      return {
        success: !0,
        fileUrls: e.map((e) => e.fileUrl).filter(Boolean),
        outputItems: e
          .filter((e) => e.fileUrl)
          .map((e) => ({ fileUrl: e.fileUrl, fileType: e.fileType })),
      };
    }
    if (805 === result.code) {
      const e = result.failedReason;
      return {
        success: !1,
        error:
          (null == e ? void 0 : e.exception_message) ||
          result.msg ||
          "任务失败",
      };
    }
    if (
      (804 === result.code
        ? null == r || r("running")
        : 813 === result.code && (null == r || r("queued")),
      Date.now() - s > i)
    )
      return { success: !1, error: "等待超时" };
    await new Promise((e) => setTimeout(e, o));
  }
}
function sa(e, t) {
  e -= 0;
  return ua()[e];
}
const la = 1152;
function ca(e) {
  const t = sa,
    o = new Int16Array(e.length);
  for (let i = 0; i < e[t(0)]; i++) {
    const r = Math.max(-1, Math[t(1)](1, e[i]));
    o[i] = r < 0 ? 32768 * r : 32767 * r;
  }
  return o;
}
async function da(e, t) {
  const o = sa;
  try {
    const t = await e[o(3)](),
      i = new (window.AudioContext || window.webkitAudioContext)(),
      r = await i.decodeAudioData(t.slice(0)),
      a = r[o(4)],
      s = r[o(5)],
      l = r.getChannelData(0),
      c = a > 1 ? r[o(6)](1) : l,
      d = await x(
        () => import("./vendor-DXn3GjvW.js").then((n) => n.i),
        __vite__mapDeps([1, 2]),
        import.meta.url,
      ),
      u = (d.default ?? d).Mp3Encoder;
    if (!u) throw new Error(o(7));
    const g = new u(a, s, 128),
      m = ca(l),
      h = a > 1 ? ca(c) : m,
      p = [];
    for (let e = 0; e < m.length; e += la) {
      const t = m[o(8)](e, e + la),
        i = h.subarray(e, e + la),
        r = g.encodeBuffer(t, i);
      r[o(0)] > 0 && p.push(r);
    }
    const f = g.flush();
    f.length > 0 && p.push(f);
    const w = p.reduce((e, t) => e + t.length, 0),
      y = new Uint8Array(w);
    let v = 0;
    for (const e of p) (y.set(e, v), (v += e.length));
    return new Blob([y], { type: "audio/mpeg" });
  } catch {
    return null;
  }
}
function ua() {
  const e = [
    "length",
    "min",
    "bitrate",
    "arrayBuffer",
    "numberOfChannels",
    "sampleRate",
    "getChannelData",
    "lamejs.Mp3Encoder not found",
    "subarray",
    "replace",
    "audio",
    "href",
    "createElement",
    "removeChild",
  ];
  return (ua = function () {
    return e;
  })();
}
async function ga(e, t) {
  const o = sa,
    i = (t || "").toLowerCase().endsWith(".mp3")
      ? t
      : (t[o(9)](/\.[^.]+$/, "") || o(10)) + ".mp3",
    r = await (async function (e) {
      try {
        const t = await fetch(e);
        return t.ok ? da(await t.blob()) : null;
      } catch {
        return null;
      }
    })(e);
  if (!r) {
    console.warn("[audioToMp3] 转换失败，尝试直接下载原文件");
    const t = document.createElement("a");
    return ((t[o(11)] = e), (t.download = i), void t.click());
  }
  const a = URL.createObjectURL(r),
    s = document[o(12)]("a");
  ((s.href = a),
    (s.download = i),
    document.body.appendChild(s),
    s.click(),
    document.body[o(13)](s),
    URL.revokeObjectURL(a));
}
async function ma(url) {
  try {
    console.log("[Download] Attempting to use Tauri backend...");
    const { invoke: e } = await x(
      async () => {
        const { invoke: e } = await import("./vendor-DXn3GjvW.js").then(
          (n) => n.k,
        );
        return { invoke: e };
      },
      __vite__mapDeps([1, 2]),
      import.meta.url,
    );
    (console.log("[Download] Tauri API imported successfully"),
      console.log(
        "[Download] Calling Tauri command: download_file_bypass_cors",
      ),
      console.log("[Download] URL:", url));
    const t = await e("download_file_bypass_cors", { url: url });
    console.log("[Download] Received bytes from Tauri:", t.length);
    const o = new Uint8Array(t),
      blob = new Blob([o]);
    return (
      console.log(
        `[Download] ✅ Tauri download successful, size: ${(blob.size / 1024 / 1024).toFixed(2)}MB`,
      ),
      blob
    );
  } catch (error) {
    throw (console.error("[Download] Tauri download failed:", error), error);
  }
}
async function ha(blob, e) {
  try {
    console.log("[SaveFile] Attempting to use Tauri file system API");
    const o = v,
      path = b;
    console.log("[SaveFile] Tauri APIs ready");
    const i = localStorage.getItem("qiaodoumayi_download_directory");
    let r,
      a,
      s = !1;
    i
      ? ((s = i.startsWith("/") || null !== i.match(/^[A-Za-z]:/)),
        (r = i),
        console.log(
          "[SaveFile] Using custom directory:",
          r,
          "(absolute:",
          s,
          ")",
        ))
      : ((r = "Qiaodoumayi_Media"),
        (s = !1),
        console.log("[SaveFile] Using default directory:", r));
    try {
      if (s) {
        (await o.exists(r)) ||
          (console.log("[SaveFile] Creating directory (absolute):", r),
          await o.mkdir(r, { recursive: !0 }));
      } else {
        (await o.exists(r, { baseDir: _.Document })) ||
          (console.log("[SaveFile] Creating directory (relative):", r),
          await o.mkdir(r, { baseDir: _.Document, recursive: !0 }));
      }
      console.log("[SaveFile] Directory ready:", r);
    } catch (t) {
      throw (console.error("[SaveFile] Failed to create directory:", t), t);
    }
    ((a = s ? await path.join(r, e) : `${r}/${e}`),
      console.log("[SaveFile] Target file path:", a));
    const l = await blob.arrayBuffer(),
      c = new Uint8Array(l);
    return (
      console.log("[SaveFile] Blob converted to Uint8Array, size:", c.length),
      s
        ? await o.writeFile(a, c)
        : await o.writeFile(a, c, { baseDir: _.Document }),
      console.log("[SaveFile] ✅ File saved successfully via Tauri:", a),
      r
    );
  } catch (o) {
    console.error("[SaveFile] Tauri failed, using browser download. Error:", o);
    const t = URL.createObjectURL(blob),
      i = document.createElement("a");
    return (
      (i.href = t),
      (i.download = e),
      document.body.appendChild(i),
      i.click(),
      document.body.removeChild(i),
      URL.revokeObjectURL(t),
      console.log("[SaveFile] ✅ Browser download triggered"),
      ""
    );
  }
}
const pa = (name) =>
    name
      .replace(/\.[^/.]+$/, "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "未命名",
  fa = async (e, t, o, i, url) => {
    var r;
    const a = e.nodeName || `节点${t + 1}`,
      s = pa(a);
    if ((console.log("[generateFileName] 节点名称:", a, "| URL:", url), !i))
      if (e.content) {
        const t =
            "audio" === e.previewType ||
            "audio" === (null == (r = e.settings) ? void 0 : r.mediaType) ||
            /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(e.content.split("?")[0]),
          o =
            e.content.includes(".mp4") ||
            e.content.includes("video") ||
            "video" === e.previewType;
        i = t ? "mp3" : o ? "mp4" : "png";
      } else i = "png";
    let l = "";
    if (url) {
      const t = await (async (url, e) => {
        try {
          if (
            (console.log("[extractOriginalFileName] 输入URL:", url),
            e && e.videoFileName)
          ) {
            const t = e.videoFileName.replace(/\.[^/.]+$/, "");
            return (
              console.log(
                "[extractOriginalFileName] 从 videoFileName 获取:",
                t,
              ),
              t
            );
          }
          if (url.startsWith("blob:")) {
            const parts = url.split("/"),
              e = parts[parts.length - 1];
            return e
              ? (console.log("[extractOriginalFileName] 从 blob URL 提取:", e),
                e)
              : null;
          }
          if (url.startsWith("content_ref:"))
            return (
              console.log("[extractOriginalFileName] 跳过 content_ref 格式"),
              null
            );
          if (url.startsWith("data:"))
            return (
              console.log("[extractOriginalFileName] 跳过 data URL"),
              null
            );
          const t = new URL(url).pathname;
          console.log("[extractOriginalFileName] pathname:", t);
          const filename = t.split("/").pop();
          if (
            (console.log("[extractOriginalFileName] filename:", filename),
            filename && filename.includes("."))
          ) {
            const result = filename.replace(/\.[^/.]+$/, "").split("?")[0];
            return (
              console.log("[extractOriginalFileName] 提取结果:", result),
              result
            );
          }
          console.log("[extractOriginalFileName] 文件名不包含扩展名");
        } catch (error) {
          console.error("[extractOriginalFileName] URL解析失败:", error);
        }
        return null;
      })(url, e);
      t
        ? ((l = pa(t)), console.log("[generateFileName] 提取到原始文件名:", l))
        : console.log("[generateFileName] 未能提取原始文件名");
    }
    let c = s;
    return (
      l && (c = `${s}_${l}`),
      console.log("[generateFileName] 最终文件名:", c),
      void 0 !== o && o > 0 ? `${c}_${o + 1}.${i}` : `${c}.${i}`
    );
  };
function wa({
  nodes: e,
  connections: t,
  selectedNodeId: o,
  selectedNodeIds: i,
  setNodes: r,
  setIsDownloading: a,
  setDownloadProgress: s,
  setLightboxItem: l,
  setLightboxOpen: c,
  onDownloadStart: d,
  onDownloadProgress: u,
  onDownloadComplete: m,
  onDownloadError: h,
  getCancellationToken: p,
}) {
  return {
    handleDownloadSelected: g.useCallback(async () => {
      var t;
      const r =
        i.size > 0
          ? e.filter((n) => i.has(n.id))
          : o
            ? e.filter((n) => n.id === o)
            : [];
      if (0 === r.length) return void (null == h || h("请先选中要下载的节点"));
      const l = [],
        c = (url) =>
          /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(
            (url || "").split("?")[0],
          ) || (url || "").startsWith("data:audio");
      if (
        (r.forEach((e, t) => {
          var o, i;
          if ("preview" === e.type) {
            const o = e.previewMjImages || [];
            if (o.length > 0)
              o.forEach((url, o) => {
                if (url) {
                  const i = "audio" === e.previewType || c(url),
                    r =
                      "video" === e.previewType ||
                      url.includes(".mp4") ||
                      url.includes("video");
                  l.push({
                    url: url,
                    node: e,
                    nodeIndex: t,
                    fileIndex: o,
                    extension: i ? "mp3" : r ? "mp4" : "png",
                    type: i ? "audio" : r ? "video" : "image",
                  });
                }
              });
            else if (e.selectedPreviewImage) {
              const url = e.selectedPreviewImage,
                o = "audio" === e.previewType || c(url),
                i =
                  "video" === e.previewType ||
                  url.includes(".mp4") ||
                  url.includes("video");
              l.push({
                url: url,
                node: e,
                nodeIndex: t,
                extension: o ? "mp3" : i ? "mp4" : "png",
                type: o ? "audio" : i ? "video" : "image",
              });
            } else if (e.content) {
              const o = "audio" === e.previewType || c(e.content),
                i =
                  "video" === e.previewType ||
                  e.content.includes(".mp4") ||
                  e.content.includes("video");
              l.push({
                url: e.content,
                node: e,
                nodeIndex: t,
                extension: o ? "mp3" : i ? "mp4" : "png",
                type: o ? "audio" : i ? "video" : "image",
              });
            }
          } else if ("input-image" === e.type && e.content) {
            const i = null == (o = e.settings) ? void 0 : o.mediaType,
              r = "audio" === i || c(e.content),
              a = "video" === i;
            l.push({
              url: e.content,
              node: e,
              nodeIndex: t,
              extension: r ? "mp3" : a ? "mp4" : "png",
              type: r ? "audio" : a ? "video" : "image",
            });
          } else if ("video-input" === e.type && e.content)
            l.push({
              url: e.content,
              node: e,
              nodeIndex: t,
              extension: "mp4",
              type: "video",
            });
          else if (
            ("gen-video" !== e.type &&
              "generate-character-video" !== e.type &&
              "generate-scene-video" !== e.type) ||
            !e.content
          )
            if (
              ("rh-comfy" === e.type || "rh-app" === e.type) &&
              e.content &&
              c(e.content)
            )
              l.push({
                url: e.content,
                node: e,
                nodeIndex: t,
                extension: "mp3",
                type: "audio",
              });
            else if (
              ("generate-scene-image" !== e.type &&
                "generate-character-image" !== e.type) ||
              !(null == (i = e.settings) ? void 0 : i.imageUrls)
            ) {
              if (e.content) {
                const o = c(e.content),
                  i =
                    e.content.includes(".mp4") ||
                    e.content.includes("video") ||
                    e.content.includes(".webm");
                l.push({
                  url: e.content,
                  node: e,
                  nodeIndex: t,
                  extension: o ? "mp3" : i ? "mp4" : "png",
                  type: o ? "audio" : i ? "video" : "image",
                });
              }
            } else {
              e.settings.imageUrls.forEach((url, o) => {
                url &&
                  l.push({
                    url: url,
                    node: e,
                    nodeIndex: t,
                    fileIndex: o,
                    extension: "png",
                    type: "image",
                  });
              });
            }
          else
            l.push({
              url: e.content,
              node: e,
              nodeIndex: t,
              extension: "mp4",
              type: "video",
            });
        }),
        0 === l.length)
      )
        return void (
          null == h || h("选中的节点中没有可下载的图片、视频或音频")
        );
      const g = [];
      for (const e of l) {
        const name = await fa(
          e.node,
          e.nodeIndex,
          e.fileIndex,
          e.extension,
          e.url,
        );
        let o;
        const i = e.node;
        if ("number" == typeof e.fileIndex && e.fileIndex >= 0) {
          const t = i._previewMjAssetIds;
          t && t[e.fileIndex] && (o = t[e.fileIndex]);
        }
        (o ||
          (o =
            (null == (t = e.node.settings) ? void 0 : t._assetId) ??
            i._contentAssetId ??
            void 0),
          g.push({ url: e.url, name: name, type: e.type, assetIdHint: o }));
      }
      (a(!0), s({ current: 0, total: g.length }), null == d || d(g.length));
      let f = 0,
        w = 0;
      const y = async (e, t) => {
        try {
          let blob = null,
            c = e.url;
          if (Bt.isContentRef(e.url)) {
            const t = Bt.extractId(e.url);
            console.log(`[Download] 从 IndexedDB 获取内容: ${t}`);
            const content = await Bt.get(t);
            if (!content)
              throw (
                console.error(`[Download] ❌ 内容未找到: ${t}`),
                new Error(`内容未找到: ${t}`)
              );
            ((c = content),
              console.log(
                `[Download] ✅ 成功获取内容，长度: ${content.length}`,
              ));
          }
          if (e.assetIdHint && mr.isAvailable() && mr.hasAsset(e.assetIdHint))
            try {
              const result = await mr.readAsset(e.assetIdHint);
              result &&
                ((blob = result.blob),
                console.log(`[Download] 从本地缓存目录读取原图: ${e.name}`));
            } catch (o) {
              console.warn("[Download] 读取本地缓存失败，退回其他通道:", o);
            }
          if (!blob && c.startsWith("data:")) {
            const e = await fetch(c);
            blob = await e.blob();
          } else if (!blob && c.startsWith("blob:"))
            if ("image" === e.type) {
              const { getFullBlobForDisplayUrl: t } = await x(
                async () => {
                  const { getFullBlobForDisplayUrl: e } =
                    await Promise.resolve().then(() => Io);
                  return { getFullBlobForDisplayUrl: e };
                },
                void 0,
                import.meta.url,
              );
              blob =
                (await t(c, e.assetIdHint)) ??
                (await fetch(c).then((e) => e.blob()));
            } else blob = await fetch(c).then((e) => e.blob());
          else if (
            blob ||
            (!c.startsWith("http://") && !c.startsWith("https://"))
          ) {
            if (!blob)
              throw (
                console.error(
                  `[Download] ❌ 无效的 URL 格式: ${c.substring(0, 50)}...`,
                ),
                new Error("无效的 URL 格式")
              );
          } else {
            const { assetStore: t } = await x(
              async () => {
                const { assetStore: e } = await Promise.resolve().then(
                  () => Ge,
                );
                return { assetStore: e };
              },
              void 0,
              import.meta.url,
            );
            let o = await t.getAssetBlob(c);
            if (!o) {
              const e = [c, c.split("?")[0], c.replace(/^https?:\/\//, "")];
              for (const i of e) if (((o = await t.getAssetBlob(i)), o)) break;
            }
            if (
              (!o && e.assetIdHint && (o = await t.getAssetBlob(e.assetIdHint)),
              !o &&
                (c.includes("prod-ss-vidu") ||
                  c.includes("prod-sa-vidu") ||
                  (c.includes("amazonaws") && c.includes("vidu"))) &&
                (o = await t.getAssetBlobByRemoteUrl(c)),
              o)
            )
              (console.log(`[Download] 从缓存获取: ${e.name}`), (blob = o));
            else {
              console.log(`[Download] 从网络下载: ${c}`);
              try {
                const t = "video" === e.type || "audio" === e.type,
                  o =
                    c.includes("prod-ss-vidu") ||
                    c.includes("prod-sa-vidu") ||
                    (c.includes("amazonaws") && c.includes("vidu"));
                if (t || o)
                  try {
                    const { downloadWithFallback: t } = await x(
                      async () => {
                        const { downloadWithFallback: e } =
                          await import("./tauriDownloader-BG3Xb0u0.js");
                        return { downloadWithFallback: e };
                      },
                      __vite__mapDeps([0, 1, 2]),
                      import.meta.url,
                    );
                    ((blob = await t(c, 12e4)),
                      blob.type || "video" !== e.type
                        ? blob.type ||
                          "audio" !== e.type ||
                          (blob = new Blob([await blob.arrayBuffer()], {
                            type: "audio/mpeg",
                          }))
                        : (blob = new Blob([await blob.arrayBuffer()], {
                            type: "video/mp4",
                          })),
                      console.log(
                        `[Download] ✅ Tauri后端下载成功: ${e.name}`,
                      ));
                  } catch (i) {
                    throw (
                      console.warn(
                        "[Download] Tauri video/audio download failed, trying fallback:",
                        i,
                      ),
                      i
                    );
                  }
                else
                  try {
                    ((blob = await ma(c)),
                      console.log(
                        `[Download] ✅ Tauri后端下载成功: ${e.name}`,
                      ));
                  } catch (i) {
                    throw (
                      console.warn(
                        "[Download] Tauri backend failed, falling back to fetch:",
                        i,
                      ),
                      i
                    );
                  }
              } catch (i) {
                try {
                  const t = await fetch(c, {
                    mode: "cors",
                    credentials: "omit",
                  });
                  if (!t.ok)
                    throw new Error(`HTTP ${t.status}: ${t.statusText}`);
                  ((blob = await t.blob()),
                    console.log(
                      `[Download] ✅ CORS下载成功: ${e.name}, 大小: ${(blob.size / 1024 / 1024).toFixed(2)}MB`,
                    ));
                } catch (r) {
                  console.warn(
                    "[Download] CORS fetch failed, trying no-cors mode:",
                    r,
                  );
                  try {
                    const t = await fetch(c, { mode: "no-cors" });
                    if (((blob = await t.blob()), 0 === blob.size))
                      throw (
                        console.warn(
                          "[Download] no-cors mode returned empty blob, trying alternative method",
                        ),
                        new Error("no-cors returned empty blob")
                      );
                    console.log(
                      `[Download] ✅ 使用no-cors模式下载成功: ${e.name}`,
                    );
                  } catch (a) {
                    if (
                      (console.error(
                        "[Download] no-cors fetch also failed:",
                        a,
                      ),
                      "video" === e.type || "audio" === e.type)
                    )
                      throw (
                        console.log(
                          `[Download] ${"audio" === e.type ? "Audio" : "Video"} CORS blocked, opening in new tab for manual download`,
                        ),
                        window.open(c, "_blank"),
                        new Error(
                          `${"audio" === e.type ? "音频" : "视频"} "${e.name}" 因服务器限制无法自动下载，已在新标签页打开，请手动保存`,
                        )
                      );
                    console.log(
                      `[Download] Trying image element method for: ${c}`,
                    );
                    try {
                      blob = await (async function (url) {
                        return new Promise((e, t) => {
                          const o = new Image();
                          o.crossOrigin = "anonymous";
                          const i = setTimeout(() => {
                            t(new Error("Image loading timeout"));
                          }, 3e4);
                          ((o.onload = () => {
                            clearTimeout(i);
                            try {
                              const i = document.createElement("canvas");
                              ((i.width = o.width), (i.height = o.height));
                              const r = i.getContext("2d");
                              if (!r)
                                throw new Error("Failed to get canvas context");
                              (r.drawImage(o, 0, 0),
                                i.toBlob((blob) => {
                                  blob
                                    ? e(blob)
                                    : t(
                                        new Error(
                                          "Failed to create blob from canvas",
                                        ),
                                      );
                                }, "image/png"));
                            } catch (error) {
                              t(error);
                            }
                          }),
                            (o.onerror = () => {
                              (clearTimeout(i),
                                t(new Error("Failed to load image")));
                            }),
                            (o.src = url));
                        });
                      })(c);
                    } catch (l) {
                      throw (
                        console.error(
                          "[Download] Image element method failed:",
                          l,
                        ),
                        window.open(c, "_blank"),
                        new Error(
                          `图片 "${e.name}" 因服务器限制无法自动下载，已在新标签页打开，请手动保存`,
                        )
                      );
                    }
                  }
                }
              }
            }
          }
          if (!blob) throw new Error("无法获取文件数据");
          if ("audio" === e.type) {
            const o = await da(blob);
            if (o) {
              blob = o;
              const name = e.name.replace(/\.[^.]+$/, "") + ".mp3",
                i = await ha(blob, name);
              return (
                f++,
                s({ current: t + 1, total: g.length }),
                null == u || u(t + 1, g.length, name),
                t === g.length - 1 && i ? i : void 0
              );
            }
          }
          const d = await ha(blob, e.name);
          if (
            (f++,
            s({ current: t + 1, total: g.length }),
            null == u || u(t + 1, g.length, e.name),
            t === g.length - 1 && d)
          )
            return d;
        } catch (error) {
          (console.error(`下载失败: ${e.name}`, error), w++);
          const o = error instanceof Error ? error.message : String(error);
          (o.includes("CORS") || o.includes("服务器限制")
            ? console.log(`[Download] CORS error for ${e.name}, user notified`)
            : console.error(`[Download] Unexpected error for ${e.name}:`, o),
            s({ current: t + 1, total: g.length }),
            null == u || u(t + 1, g.length, e.name));
        }
        return "";
      };
      let v = "";
      for (let e = 0; e < g.length; e++) {
        const t = null == p ? void 0 : p();
        if (null == t ? void 0 : t.isCancelled) {
          console.log("[Download] 下载已取消");
          break;
        }
        const o = await y(g[e], e);
        (o && (v = o),
          e < g.length - 1 && (await new Promise((e) => setTimeout(e, 300))));
      }
      (a(!1),
        s({ current: 0, total: 0 }),
        v
          ? (null == m || m(f, w),
            console.log("[Download] All files saved to:", v))
          : null == m || m(f, w));
    }, [e, o, i, a, s, d, u, m, h, p]),
    handleDownloadUrlList: g.useCallback(
      async (e) => {
        if (0 === e.length) return void (null == h || h("没有可下载的文件"));
        (a(!0), s({ current: 0, total: e.length }), null == d || d(e.length));
        let t = 0,
          o = 0;
        const i = async (url) => {
          if (url.startsWith("data:")) {
            return (await fetch(url)).blob();
          }
          if (url.startsWith("blob:")) {
            return (await fetch(url)).blob();
          }
          if (url.startsWith("http://") || url.startsWith("https://")) {
            const { assetStore: e } = await x(
              async () => {
                const { assetStore: e } = await Promise.resolve().then(
                  () => Ge,
                );
                return { assetStore: e };
              },
              void 0,
              import.meta.url,
            );
            let t = await e.getAssetBlob(url);
            if (!t) {
              const o = [
                url,
                url.split("?")[0],
                url.replace(/^https?:\/\//, ""),
              ];
              for (const i of o) if (((t = await e.getAssetBlob(i)), t)) break;
            }
            if (t) return t;
            try {
              return await ma(url);
            } catch {
              const e = await fetch(url, { mode: "cors", credentials: "omit" });
              if (!e.ok) throw new Error(`HTTP ${e.status}`);
              return e.blob();
            }
          }
          throw new Error("无效的 URL 格式");
        };
        for (let a = 0; a < e.length; a++) {
          const l = null == p ? void 0 : p();
          if (null == l ? void 0 : l.isCancelled) break;
          const c = e[a];
          try {
            const blob = await i(c.url),
              e =
                blob.type ||
                (!c.name.endsWith(".mp4") && !c.name.endsWith(".webm"))
                  ? blob
                  : new Blob([await blob.arrayBuffer()], { type: "video/mp4" });
            (await ha(e, c.name), t++);
          } catch (r) {
            (console.error("[Download] 分镜视频下载失败:", c.name, r), o++);
          }
          (s({ current: a + 1, total: e.length }),
            null == u || u(a + 1, e.length, c.name),
            a < e.length - 1 && (await new Promise((e) => setTimeout(e, 300))));
        }
        (a(!1), s({ current: 0, total: 0 }), null == m || m(t, o));
      },
      [a, s, d, u, m, h, p],
    ),
    handleNodeDoubleClick: g.useCallback(
      async (t) => {
        const o = async (url, e, t) => {
            if ("image" === e && url.startsWith("blob:")) {
              const { getFullBlobUrlForDisplayUrl: e } = await x(
                  async () => {
                    const { getFullBlobUrlForDisplayUrl: e } =
                      await Promise.resolve().then(() => Io);
                    return { getFullBlobUrlForDisplayUrl: e };
                  },
                  void 0,
                  import.meta.url,
                ),
                o = await e(url, t);
              if (o) return o;
            }
            return url;
          },
          i = (url, e) => {
            const t = { url: url, type: e };
            try {
              (l(t), c(!0));
            } catch (error) {
              console.error("[handleNodeDoubleClick] Error:", error);
            }
          };
        if (t.content) {
          const r = (url, e) => {
              var t, o;
              if (
                "video" ===
                (null == (t = null == e ? void 0 : e.settings)
                  ? void 0
                  : t.mediaType)
              )
                return !0;
              if (!url) return !1;
              if (url.startsWith("data:video")) return !0;
              if (url.includes("force_video_display=true")) return !0;
              const i =
                null == (o = url.split(".").pop())
                  ? void 0
                  : o.split("?")[0].toLowerCase();
              return ["mp4", "webm", "ogg", "mov"].includes(i || "");
            },
            a = (url, e) => {
              var t, o;
              if (
                "audio" ===
                (null == (t = null == e ? void 0 : e.settings)
                  ? void 0
                  : t.mediaType)
              )
                return !0;
              if (!url) return !1;
              if (url.startsWith("data:audio")) return !0;
              const i =
                null == (o = url.split(".").pop())
                  ? void 0
                  : o.split("?")[0].toLowerCase();
              return ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(
                i || "",
              );
            },
            s = e.find((n) => n.id === t.id),
            l = r(t.content, s) ? "video" : a(t.content, s) ? "audio" : "image",
            c = null == s ? void 0 : s._contentAssetId;
          return void i(await o(t.content, l, c), l);
        }
        const r = e.find((n) => n.id === t.id);
        if (r && r.content) {
          const e = (url, n) => {
              var e, t;
              if (
                "audio" ===
                (null == (e = null == n ? void 0 : n.settings)
                  ? void 0
                  : e.mediaType)
              )
                return !0;
              if (!url) return !1;
              if (url.startsWith("data:audio")) return !0;
              const o =
                null == (t = url.split(".").pop())
                  ? void 0
                  : t.split("?")[0].toLowerCase();
              return ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(
                o || "",
              );
            },
            t = ((url, n) => {
              var e, t;
              if (
                "video" ===
                (null == (e = null == n ? void 0 : n.settings)
                  ? void 0
                  : e.mediaType)
              )
                return !0;
              if (!url) return !1;
              if (url.startsWith("data:video")) return !0;
              if (url.includes("force_video_display=true")) return !0;
              const o =
                null == (t = url.split(".").pop())
                  ? void 0
                  : t.split("?")[0].toLowerCase();
              return ["mp4", "webm", "ogg", "mov"].includes(o || "");
            })(r.content, r)
              ? "video"
              : e(r.content, r)
                ? "audio"
                : "image",
            a = r._contentAssetId;
          i(await o(r.content, t, a), t);
        } else
          console.warn(
            "[handleNodeDoubleClick] Node not found or has no content:",
            t.id,
          );
      },
      [e, l, c],
    ),
  };
}
function ya({
  view: e,
  canvasRef: t,
  connectingSource: o,
  connectingTarget: i,
  connectingInputType: r,
  setMousePos: a,
  setConnectingSource: s,
  setConnectingTarget: l,
  setConnectingInputType: c,
  setConnections: d,
  setNodes: u,
  nodes: m,
  generateId: h,
}) {
  const p = g.useRef(i),
    f = g.useRef(r);
  g.useEffect(() => {
    ((p.current = i), (f.current = r));
  }, [i, r]);
  return {
    handleStartConnectFromOutput: g.useCallback(
      (o, i) => {
        var r;
        (o.stopPropagation(), o.preventDefault());
        const l = null == (r = t.current) ? void 0 : r.getBoundingClientRect();
        if (l) {
          const t = (o.clientX - l.left - e.x) / e.zoom,
            i = (o.clientY - l.top - e.y) / e.zoom;
          a({ x: t, y: i });
        }
        s(i);
      },
      [e, t, a, s],
    ),
    handleStartConnectFromInput: g.useCallback(
      (o, i) => {
        var r;
        (o.stopPropagation(), o.preventDefault());
        const s = null == (r = t.current) ? void 0 : r.getBoundingClientRect();
        if (s) {
          const t = (o.clientX - s.left - e.x) / e.zoom,
            i = (o.clientY - s.top - e.y) / e.zoom;
          a({ x: t, y: i });
        }
        l(i);
      },
      [e, t, a, l],
    ),
    handleConnectToInput: g.useCallback(
      (e, t) => {
        if ((e.stopPropagation(), o && o !== t)) {
          const e = { id: h(), from: o, to: t };
          d((t) => [...t, e]);
          const i = m.find((n) => n.id === t);
          ("preview" === (null == i ? void 0 : i.type) &&
            u((e) =>
              e.map((n) =>
                n.id === o
                  ? {
                      ...n,
                      settings: { ...(n.settings || {}), selectedPreviewId: t },
                    }
                  : n,
              ),
            ),
            s(null));
        }
        if (i && i !== t) {
          const e = {
            id: h(),
            from: t,
            to: i,
            ...(r && "default" !== r ? { inputType: r } : {}),
          };
          d((t) => [...t, e]);
          const o = m.find((n) => n.id === i);
          ("preview" === (null == o ? void 0 : o.type) &&
            u((e) =>
              e.map((n) =>
                n.id === t
                  ? {
                      ...n,
                      settings: { ...(n.settings || {}), selectedPreviewId: i },
                    }
                  : n,
              ),
            ),
            l(null),
            c(null));
        }
      },
      [o, i, r, h, d, u, m, s, l, c],
    ),
    handleConnectToOutput: g.useCallback(
      (e, t) => {
        e.stopPropagation();
        const o = p.current,
          i = f.current;
        if (o && o !== t) {
          const e = { id: h(), from: t, to: o, inputType: i || void 0 };
          d(
            i && !("agent_user_input" === i || "agent_meta_prompt" === i)
              ? (t) => [
                  ...t.filter((e) => !(e.to === o && e.inputType === i)),
                  e,
                ]
              : (t) => [...t, e],
          );
          const r = m.find((n) => n.id === o);
          ("preview" === (null == r ? void 0 : r.type) &&
            u((e) =>
              e.map((n) =>
                n.id === t
                  ? {
                      ...n,
                      settings: { ...(n.settings || {}), selectedPreviewId: o },
                    }
                  : n,
              ),
            ),
            l(null),
            c(null));
        }
      },
      [h, d, u, m, l, c],
    ),
  };
}
function va({ connections: e, nodesMap: t, dataVersion: o }) {
  const i = g.useCallback(
      (o) => {
        var i;
        for (const r of e) {
          if (r.to !== o) continue;
          const e = t.get(r.from);
          if (e) {
            if ("video-input" === e.type) return e;
            if ("input-image" === e.type && e.content) {
              if ("video" === (null == (i = e.settings) ? void 0 : i.mediaType))
                return (
                  console.log(
                    "[getConnectedVideoInputNode] 通过 mediaType 识别为视频节点",
                  ),
                  e
                );
              if (Jn(e.content))
                return (
                  console.log(
                    "[getConnectedVideoInputNode] 通过 URL 格式识别为视频节点",
                  ),
                  e
                );
            }
          }
        }
        return null;
      },
      [e, t, o],
    ),
    r = g.useCallback(
      (o) => {
        for (const i of e)
          if (i.to === o) {
            const e = t.get(i.from);
            if ("video-analyze" === (null == e ? void 0 : e.type)) return e;
          }
        return null;
      },
      [e, t, o],
    ),
    a = g.useCallback((e, t) => {
      if (!e || 0 === e.length) return [];
      const o = [...e].sort((e, t) => e.time - t.time),
        i = [];
      let r = [],
        a = o[0].time;
      return (
        o.forEach((e) => {
          e.time - a >= t && r.length > 0
            ? (i.push([...r]), (r = [e]), (a = e.time))
            : r.push(e);
        }),
        r.length > 0 && i.push(r),
        i
      );
    }, []),
    s = g.useCallback(
      (o) => {
        e.filter((e) => e.to === o);
        const i = e.filter(
            (e) => e.to === o && (!e.inputType || "default" === e.inputType),
          ),
          images = [];
        return (
          i.forEach((e) => {
            var o, i, r;
            const a = t.get(e.from);
            if (
              a &&
              "camera-movement" !== a.type &&
              "professional-camera" !== a.type
            )
              if ("preview" === a.type)
                a.selectedPreviewImage
                  ? images.push(a.selectedPreviewImage)
                  : a.previewMjImages && a.previewMjImages.length > 0
                    ? images.push(a.previewMjImages[0])
                    : a.content && images.push(a.content);
              else if ("canvas-node" === a.type)
                a.content
                  ? images.push(a.content)
                  : (null == (o = a.settings) ? void 0 : o.canvasData) &&
                    images.push(`canvas-node:${a.id}`);
              else if ("rh-app" === a.type) {
                const e = null == (i = a.settings) ? void 0 : i.generatedImages;
                e && e.length > 0
                  ? e.forEach((e) => images.push(e.fullUrl))
                  : a.content && images.push(a.content);
              } else if ("gen-music" === a.type) {
                const e = null == (r = a.settings) ? void 0 : r.audioUrl;
                e && images.push(e);
              } else
                ("inpaint-crop" === a.type || a.type,
                  a.content && images.push(a.content));
          }),
          images
        );
      },
      [e, t, o],
    ),
    l = g.useCallback(
      (o) => {
        const i = e.filter(
            (e) => e.to === o && (!e.inputType || "default" === e.inputType),
          ),
          r = [];
        return (
          i.forEach((e) => {
            var o, i, a, s, l, c, d, u, g, m, h;
            const p = t.get(e.from);
            if (
              p &&
              "camera-movement" !== p.type &&
              "professional-camera" !== p.type
            )
              if ("preview" === p.type) {
                let url, e;
                (p.selectedPreviewImage
                  ? ((url = p.selectedPreviewImage),
                    (e = p._selectedImageAssetId))
                  : (null == (o = p.previewMjImages) ? void 0 : o[0])
                    ? ((url = p.previewMjImages[0]),
                      (e = null == (i = p._previewMjAssetIds) ? void 0 : i[0]))
                    : p.content && ((url = p.content), (e = p._contentAssetId)),
                  url &&
                    r.push({
                      url: url,
                      type: "video" === p.previewType ? "video" : "image",
                      assetId: e,
                    }));
              } else if ("canvas-node" === p.type) {
                const url = p.content
                    ? p.content
                    : (null == (a = p.settings) ? void 0 : a.canvasData)
                      ? `canvas-node:${p.id}`
                      : void 0,
                  e = null == (s = p.settings) ? void 0 : s._assetId;
                url && r.push({ url: url, type: "image", assetId: e });
              } else if ("rh-app" === p.type) {
                const e = null == (l = p.settings) ? void 0 : l.generatedImages;
                (null == e ? void 0 : e.length)
                  ? e.forEach((e) =>
                      r.push({
                        url: e.fullUrl,
                        type: "image",
                        assetId: e.assetId,
                      }),
                    )
                  : p.content &&
                    r.push({
                      url: p.content,
                      type: "image",
                      assetId: null == (c = p.settings) ? void 0 : c._assetId,
                    });
              } else if ("gen-music" === p.type) {
                const e = null == (d = p.settings) ? void 0 : d.audioUrl,
                  t = null == (u = p.settings) ? void 0 : u._audioAssetId;
                e && r.push({ url: e, type: "audio", assetId: t });
              } else if ("video-input" === p.type && p.content) {
                const e = null == (g = p.settings) ? void 0 : g._assetId;
                r.push({ url: p.content, type: "video", assetId: e });
              } else if (p.content) {
                const url = p.content,
                  e = null == (m = p.settings) ? void 0 : m._assetId,
                  t = null == (h = p.settings) ? void 0 : h.mediaType;
                let type = "image";
                (t
                  ? (type = t)
                  : ((url) => {
                        if (!url) return !1;
                        if (url.startsWith("data:video/")) return !0;
                        if (
                          url.startsWith("data:image/") ||
                          url.startsWith("data:audio/")
                        )
                          return !1;
                        const e = url.toLowerCase();
                        return (
                          e.includes(".mp4") ||
                          e.includes(".webm") ||
                          e.includes(".mov") ||
                          e.includes("/v1/videos/")
                        );
                      })(url)
                    ? (type = "video")
                    : ((url) => {
                        if (!url) return !1;
                        if (url.startsWith("data:audio/")) return !0;
                        if (
                          url.startsWith("data:video/") ||
                          url.startsWith("data:image/")
                        )
                          return !1;
                        const e = url.toLowerCase();
                        return (
                          e.includes(".mp3") ||
                          e.includes(".wav") ||
                          e.includes(".ogg") ||
                          e.includes(".m4a") ||
                          e.includes(".aac")
                        );
                      })(url) && (type = "audio"),
                  r.push({ url: url, type: type, assetId: e }));
              }
          }),
          r
        );
      },
      [e, t, o],
    ),
    c = g.useCallback(
      (o) => {
        const i = e.filter(
          (e) => e.to === o && (!e.inputType || "default" === e.inputType),
        );
        for (const e of i) {
          const o = t.get(e.from);
          if ("preview" === (null == o ? void 0 : o.type)) {
            const e = o.previewMjImages;
            if (e && e.length > 1 && !o.selectedPreviewImage) return !0;
          }
        }
        return !1;
      },
      [e, t, o],
    ),
    d = g.useCallback(
      (o, i) => {
        var r, a, s;
        const l = e.find((e) => e.to === o && (e.inputType || "default") === i);
        if (!l) return null;
        const c = t.get(l.from);
        if (!c) return null;
        if (
          "text-node" === c.type ||
          "custom-agent" === c.type ||
          "novel-input" === c.type
        ) {
          return (
            (
              (null == (r = c.settings) ? void 0 : r.text) ||
              c.prompt ||
              c.content ||
              (null == (a = c.settings) ? void 0 : a.outputContent) ||
              (null == (s = c.settings) ? void 0 : s.novelContent) ||
              ""
            ).trim() || null
          );
        }
        return null;
      },
      [e, t, o],
    );
  return {
    getConnectedVideoInputNode: i,
    getConnectedVideoAnalyzeNode: r,
    groupKeyframesByTime: a,
    getConnectedInputImages: s,
    getConnectedInputItems: l,
    hasMultiImageSource: c,
    getConnectedImageForInput: g.useCallback(
      (o, i) => {
        const r = e.find((e) => e.to === o && (e.inputType || "default") === i);
        if (!r) return null;
        const a = t.get(r.from);
        if (!a) return null;
        if ("preview" === a.type) {
          if (a.selectedPreviewImage) return a.selectedPreviewImage;
          if (a.previewMjImages && a.previewMjImages.length > 0)
            return a.previewMjImages[0];
        }
        return a.content || null;
      },
      [e, t, o],
    ),
    getConnectedTextForInput: d,
    getConnectedDirectorNodes: g.useCallback(
      (o) => {
        const i = e.filter(
            (e) => e.to === o && (!e.inputType || "default" === e.inputType),
          ),
          r = [];
        return (
          i.forEach((e) => {
            const o = t.get(e.from);
            !o ||
              ("camera-movement" !== o.type &&
                "professional-camera" !== o.type) ||
              r.push(o);
          }),
          r
        );
      },
      [e, t, o],
    ),
    getConnectedTextNodes: g.useCallback(
      (o) => {
        const i = e.filter(
            (e) => e.to === o && (!e.inputType || "default" === e.inputType),
          ),
          r = [];
        return (
          i.forEach((e) => {
            const o = t.get(e.from);
            o && "text-node" === o.type && r.push(o);
          }),
          r
        );
      },
      [e, t, o],
    ),
    getConnectedAgentNodes: g.useCallback(
      (o) => {
        const i = e.filter(
            (e) => e.to === o && (!e.inputType || "default" === e.inputType),
          ),
          r = [];
        return (
          i.forEach((e) => {
            const o = t.get(e.from);
            o && "custom-agent" === o.type && r.push(o);
          }),
          r
        );
      },
      [e, t, o],
    ),
  };
}
function ba(e, t) {
  e -= 0;
  return Ia()[e];
}
function _a(e, t, o, i) {
  const r = ba,
    a = {},
    s = new Set();
  if (i.mode === r(2) && o[r(3)] > 0) {
    o.forEach((o) => {
      const i = ba,
        r = e.filter((e) => o[i(4)][i(5)](e.id)),
        l = t[i(6)](
          (e) => o.nodeIds.includes(e[i(7)]) && o.nodeIds.includes(e.to),
        );
      ((a[o[i(8)]] = { nodes: r, connections: l, nodeIds: o.nodeIds }),
        s.add(o.name));
    });
    const i = new Set(o[r(9)]((e) => e[r(4)])),
      l = e.filter((e) => !i[r(10)](e.id));
    if (l.length > 0) {
      const e = t.filter((e) => !i.has(e.from) && !i.has(e.to));
      ((a[r(11)] = { nodes: l, connections: e, nodeIds: l.map((e) => e.id) }),
        s.add(r(11)));
    }
  } else
    (e.forEach((e) => {
      const t = ba,
        o = (function (e, t) {
          const o = ba;
          switch (t) {
            case "by-type":
              return Zi(e.type);
            case o(0):
              return new Date().toISOString()[o(1)]("T")[0];
            case "by-group":
              return "default";
            default:
              return "all";
          }
        })(e, i[t(12)]);
      (s.add(o),
        !a[o] && (a[o] = { nodes: [], connections: [], nodeIds: [] }),
        a[o].nodes.push(e),
        a[o][t(4)][t(13)](e.id));
    }),
      s.forEach((e) => {
        const o = ba,
          i = new Set(a[e].nodeIds);
        a[e].connections = t.filter((e) => i.has(e[o(7)]) && i[o(10)](e.to));
      }));
  return {
    structure: a,
    metadata: {
      mode: i.mode,
      totalNodes: e.length,
      totalConnections: t[r(3)],
      categories: Array[r(7)](s).sort(),
      timestamp: new Date().toISOString(),
    },
  };
}
function Ia() {
  const e = [
    "by-time",
    "split",
    "by-group",
    "length",
    "nodeIds",
    "includes",
    "filter",
    "from",
    "name",
    "flatMap",
    "has",
    "未分组",
    "mode",
    "push",
    "metadata",
    "生成时间: ",
    "总节点数: ",
    "totalNodes",
    "📁 文件夹结构:",
    "structure",
    "nodes",
    " 个节点, ",
    "connections",
    "categories",
    "forEach",
    "by-type",
  ];
  return (Ia = function () {
    return e;
  })();
}
const Sa = ({
  nodes: e,
  connections: t,
  groups: o,
  history: i = [],
  chatSessions: r = [],
  characterLibrary: a = [],
  view: s = { x: 0, y: 0, zoom: 1 },
  projectName: l = "未命名项目",
  viewportSize: c,
}) => {
  const d = g.useCallback(
      (mode = "by-type") => _a(e, t, o, { mode: mode, includeAssets: !0 }),
      [e, t, o],
    ),
    u = g.useCallback(
      (mode = "by-type") =>
        (function (e) {
          const t = ba,
            o = [];
          return (
            o.push("📦 分类导出结构 (" + e[t(14)].mode + ")"),
            o[t(13)](t(15) + e.metadata.timestamp),
            o.push(t(16) + e.metadata[t(17)]),
            o.push("总连接数: " + e.metadata.totalConnections),
            o[t(13)](""),
            o[t(13)](t(18)),
            e.metadata.categories.forEach((t) => {
              const i = ba,
                r = e[i(19)][t];
              (o.push("├── " + t + "/"),
                o[i(13)]("│   ├── nodes.json (" + r.nodes.length + " 个节点)"),
                o.push(
                  "│   ├── connections.json (" +
                    r.connections[i(3)] +
                    " 个连接)",
                ),
                o.push("│   └── metadata.json"));
            }),
            o[t(13)](""),
            o[t(13)]("📊 分类详情:"),
            e.metadata.categories.forEach((t) => {
              const i = ba,
                r = e[i(19)][t];
              o[i(13)](
                "  • " +
                  t +
                  ": " +
                  r[i(20)].length +
                  i(21) +
                  r[i(22)].length +
                  " 个连接",
              );
            }),
            o.join("\n")
          );
        })(d(mode)),
      [d],
    ),
    m = g.useCallback(
      (mode = "by-type") =>
        (function (e) {
          const t = ba,
            o = {};
          return (
            e.metadata[t(23)].forEach((t) => {
              const i = ba,
                r = e.structure[t];
              o[t] = {
                nodes: r.nodes,
                connections: r[i(22)],
                metadata: {
                  nodeCount: r.nodes.length,
                  connectionCount: r.connections.length,
                  nodeTypes: [...new Set(r[i(20)].map((e) => e.type))],
                },
              };
            }),
            { _metadata: e.metadata, categories: o }
          );
        })(d(mode)),
      [d],
    ),
    h = g.useCallback(
      () =>
        (function (e, t) {
          const o = ba;
          if (t[o(3)] > 0) return "by-group";
          const i = new Map();
          return (
            e[o(24)]((e) => {
              const t = Zi(e.type);
              i.set(t, (i.get(t) || 0) + 1);
            }),
            i.size > 3 ? o(25) : "by-type"
          );
        })(e, o),
      [e, o],
    ),
    p = g.useCallback(
      async (mode = "by-type", filename) => {
        try {
          const { serializeProjectData: d } = await x(
              async () => {
                const { serializeProjectData: e } =
                  await Promise.resolve().then(() => rt);
                return { serializeProjectData: e };
              },
              void 0,
              import.meta.url,
            ),
            { data: u } = await d(e),
            { data: g } = await d(t),
            { data: m } = await d(o),
            { data: h } = await d(i),
            { data: p } = await d(r),
            { data: f } = await d(a),
            w = new Date().toISOString().split("T")[0],
            y = filename || `${l}_${w}.json`,
            v = {
              version: "2.9",
              projectName: l,
              nodes: u,
              connections: g,
              groups: m,
              view: {
                ...s,
                viewportSize: c || {
                  width: window.innerWidth,
                  height: window.innerHeight,
                },
              },
              chatSessions: p,
              characterLibrary: f,
              history: h,
              timestamp: new Date().toISOString(),
            },
            { sanitizeSensitiveData: b } = await x(
              async () => {
                const { sanitizeSensitiveData: e } =
                  await Promise.resolve().then(() => Io);
                return { sanitizeSensitiveData: e };
              },
              void 0,
              import.meta.url,
            ),
            _ = b(v),
            blob = new Blob([JSON.stringify(_, null, 2)], {
              type: "application/json",
            }),
            url = URL.createObjectURL(blob),
            I = document.createElement("a");
          ((I.href = url),
            (I.download = y),
            document.body.appendChild(I),
            I.click(),
            document.body.removeChild(I),
            URL.revokeObjectURL(url),
            console.log("[useCategorizedExport] JSON导出完成:", {
              filename: y,
              nodes: u.length,
              connections: g.length,
              history: h.length,
            }));
        } catch (error) {
          throw (
            console.error("[useCategorizedExport] JSON导出失败:", error),
            error
          );
        }
      },
      [e, t, o, i, r, a, s, l, c],
    ),
    f = g.useCallback(
      (mode = "by-type") => {
        const result = d(mode),
          e = {};
        return (
          result.metadata.categories.forEach((t) => {
            const data = result.structure[t];
            let o;
            try {
              o = JSON.stringify(data.nodes, null, 2);
            } catch (i) {
              if (
                !(
                  i instanceof RangeError &&
                  i.message.includes("Invalid string length")
                )
              )
                throw i;
              (console.warn(`分类 ${t} 数据过大，使用紧凑格式`),
                (o = JSON.stringify(data.nodes)));
            }
            e[t] = {
              "nodes.json": o,
              "connections.json": JSON.stringify(data.connections, null, 2),
              "metadata.json": JSON.stringify(
                {
                  category: t,
                  nodeCount: data.nodes.length,
                  connectionCount: data.connections.length,
                  nodeTypes: [...new Set(data.nodes.map((n) => n.type))],
                  createdAt: new Date().toISOString(),
                },
                null,
                2,
              ),
            };
          }),
          { structure: e, metadata: result.metadata }
        );
      },
      [d],
    );
  return {
    performCategorizedExport: d,
    getCategoryStructure: u,
    getCategoryExportJSON: m,
    getRecommendedMode: h,
    exportCategorizedJSON: p,
    getCategorizedExportStructure: f,
  };
};
let ja = class {
  constructor() {
    u(this, "_cancelled", !1);
  }
  cancel() {
    this._cancelled = !0;
  }
  get isCancelled() {
    return this._cancelled;
  }
  throwIfCancelled() {
    if (this._cancelled) throw new Error("操作已取消");
  }
};
async function Aa(e) {
  try {
    const t = await fetch(e),
      blob = await t.blob();
    return new Promise((e) => {
      const t = new FileReader();
      ((t.onloadend = () => {
        e(t.result);
      }),
        (t.onerror = () => {
          (console.error("Failed to read blob:", t.error), e(null));
        }),
        t.readAsDataURL(blob));
    });
  } catch (error) {
    return (
      console.error("Failed to convert blob URL to base64:", error),
      null
    );
  }
}
async function Pa(url) {
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://")))
    return null;
  const e = () => {
    try {
      const e = new URL(url);
      return (
        "undefined" != typeof window &&
        window.location.origin !== `${e.protocol}//${e.host}`
      );
    } catch {
      return !0;
    }
  };
  for (let o = 0; o < 2; o++)
    try {
      const e = await invoke("fetch_remote_image_base64", { url: url });
      if (e && e.startsWith("data:")) return e;
    } catch (t) {
      if (0 === o) {
        console.warn(
          "[Export] 后端下载远程图片失败，重试一次:",
          url.substring(0, 60),
          t,
        );
        continue;
      }
      if (e())
        return (
          console.warn(
            "[Export] 跨域图片后端下载失败，将保留链接（避免 CORS）:",
            url.substring(0, 80),
          ),
          null
        );
    }
  try {
    const e = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!e.ok) return null;
    const blob = await e.blob();
    return blob.type.startsWith("image/")
      ? new Promise((e) => {
          const t = new FileReader();
          ((t.onloadend = () => e(t.result)),
            (t.onerror = () => e(null)),
            t.readAsDataURL(blob));
        })
      : null;
  } catch (error) {
    return (
      console.warn(
        "[Export] 远程图片下载失败，将保留链接:",
        url.substring(0, 80),
        error,
      ),
      null
    );
  }
}
function xa(url) {
  var e, t;
  if (!url) return !1;
  if (url.startsWith("data:video")) return !0;
  const o =
    (null == (t = null == (e = url.split(".").pop()) ? void 0 : e.split("?")[0])
      ? void 0
      : t.toLowerCase()) || "";
  return ["mp4", "webm", "ogg", "mov", "avi", "mkv"].includes(o);
}
async function ka(e) {
  return new Promise((t) => {
    try {
      const o = indexedDB.open("qiaodoumayi_content_store");
      ((o.onsuccess = () => {
        const i = o.result
          .transaction("contents", "readonly")
          .objectStore("contents")
          .get(e);
        ((i.onsuccess = () => {
          const e = i.result;
          e && e.content ? t(e.content) : t(null);
        }),
          (i.onerror = () => {
            (console.error("Failed to read from IndexedDB:", i.error), t(null));
          }));
      }),
        (o.onerror = () => {
          (console.error("Failed to open IndexedDB:", o.error), t(null));
        }));
    } catch (error) {
      (console.error("Error reading from IndexedDB:", error), t(null));
    }
  });
}
const Ta = ({
  nodes: e,
  connections: t,
  groups: o,
  history: i = [],
  selectedNodeIds: r,
}) => {
  const a = g.useRef(null),
    s = g.useCallback(() => {
      a.current &&
        (a.current.cancel(),
        console.log("[useTauriCategorizedExport] 用户取消导出"));
    }, []);
  return {
    exportToTauriContainer: g.useCallback(
      async (mode, s, l, c) => {
        const d = new ja();
        a.current = d;
        try {
          (d.throwIfCancelled(), null == l || l(10, "准备导出数据..."));
          const a =
              (null == c ? void 0 : c.exportSelectionOnly) && r && r.size > 0
                ? r
                : null,
            u = a ? e.filter((n) => a.has(n.id)) : e,
            g = a ? t.filter((e) => a.has(e.from) && a.has(e.to)) : t,
            m =
              a && o.length > 0
                ? o.filter((e) => e.nodeIds.some((e) => a.has(e)))
                : o;
          if (a && 0 === u.length)
            throw new Error("当前没有选中任何节点，请先框选或点选要导出的节点");
          a
            ? console.log(
                `[Export] 导出范围: 选中 ${u.length} 个节点, ${g.length} 条连线`,
              )
            : console.log(
                `[Export] 导出范围: 全部画布 (${u.length} 个节点, ${g.length} 条连线)`,
              );
          const result = _a(u, g, m, { mode: mode, includeAssets: !0 });
          (d.throwIfCancelled(), null == l || l(30, "正在提取资源文件..."));
          const h = {},
            p = new Map(),
            f = !0 === (null == c ? void 0 : c.canvasOnly),
            w = (null == c ? void 0 : c.assetsFilter) ?? "all",
            y = Object.values(result.structure).reduce(
              (e, t) => e + t.nodes.length,
              0,
            ),
            v = !f && i && Array.isArray(i) ? i.length : 0,
            b = Math.max(1, v + y);
          let _ = 0,
            I = 0;
          const S = () => {
              _ += 1;
              const e = 30 + Math.floor((20 * _) / b);
              null == l || l(e, `正在提取资源文件... (${_}/${b})`);
            },
            j = 10,
            A = () => {
              I += 1;
              const e = 30 + (20 * (_ + I / j)) / b;
              null == l ||
                l(
                  Math.min(49, Math.floor(e)),
                  `正在提取资源文件... (${_ + 1}/${b})`,
                );
            },
            P = [];
          if ("none" !== w) {
            if (!f && i && Array.isArray(i))
              for (const e of i) {
                d.throwIfCancelled();
                const t = { ...e };
                if (e.url && "string" == typeof e.url) {
                  let o = e.url;
                  if (e.url.startsWith("blob:")) {
                    const base64 = await Aa(e.url);
                    base64 && (o = base64);
                  } else if (e.url.startsWith("content_ref:")) {
                    const t = e.url.replace("content_ref:", ""),
                      i = await ka(t);
                    i && (o = i);
                  }
                  if (o.startsWith("data:")) {
                    const i = `history_${e.id}_url`;
                    ((h[i] = {
                      data: o,
                      type: e.type || "image",
                      filename: `history_${e.id}_url`,
                    }),
                      (t.url = `@asset:${i}`));
                  }
                }
                if (e.originalUrl && "string" == typeof e.originalUrl) {
                  let o = e.originalUrl;
                  if (e.originalUrl.startsWith("blob:")) {
                    const base64 = await Aa(e.originalUrl);
                    base64 && (o = base64);
                  } else if (e.originalUrl.startsWith("content_ref:")) {
                    const t = e.originalUrl.replace("content_ref:", ""),
                      i = await ka(t);
                    i && (o = i);
                  }
                  if (o.startsWith("data:")) {
                    const i = `history_${e.id}_original`;
                    ((h[i] = {
                      data: o,
                      type: e.type || "image",
                      filename: `history_${e.id}_original`,
                    }),
                      (t.originalUrl = `@asset:${i}`));
                  }
                }
                if (e.thumbnailUrl && "string" == typeof e.thumbnailUrl) {
                  let o = e.thumbnailUrl;
                  if (e.thumbnailUrl.startsWith("blob:")) {
                    const base64 = await Aa(e.thumbnailUrl);
                    base64 && (o = base64);
                  } else if (e.thumbnailUrl.startsWith("content_ref:")) {
                    const t = e.thumbnailUrl.replace("content_ref:", ""),
                      i = await ka(t);
                    i && (o = i);
                  }
                  if (o.startsWith("data:")) {
                    const i = `history_${e.id}_thumbnail`;
                    ((h[i] = {
                      data: o,
                      type: "thumbnail",
                      filename: `history_${e.id}_thumbnail`,
                    }),
                      (t.thumbnailUrl = `@asset:${i}`));
                  }
                }
                if (e.videoPosterUrl && "string" == typeof e.videoPosterUrl) {
                  let o = e.videoPosterUrl;
                  if (e.videoPosterUrl.startsWith("blob:")) {
                    const base64 = await Aa(e.videoPosterUrl);
                    base64 && (o = base64);
                  } else if (e.videoPosterUrl.startsWith("content_ref:")) {
                    const t = e.videoPosterUrl.replace("content_ref:", ""),
                      i = await ka(t);
                    i && (o = i);
                  }
                  if (o.startsWith("data:")) {
                    const i = `history_${e.id}_poster`;
                    ((h[i] = {
                      data: o,
                      type: "poster",
                      filename: `history_${e.id}_poster`,
                    }),
                      (t.videoPosterUrl = `@asset:${i}`));
                  }
                }
                if (
                  (e.mjImages &&
                    Array.isArray(e.mjImages) &&
                    (t.mjImages = await Promise.all(
                      e.mjImages.map(async (t, o) => {
                        if (!t || "string" != typeof t) return t;
                        let i = t;
                        if (t.startsWith("blob:")) {
                          const base64 = await Aa(t);
                          base64 && (i = base64);
                        } else if (t.startsWith("content_ref:")) {
                          const e = t.replace("content_ref:", ""),
                            o = await ka(e);
                          o && (i = o);
                        }
                        if (i.startsWith("data:")) {
                          const t = `history_${e.id}_mj_${o}`;
                          return (
                            (h[t] = {
                              data: i,
                              type: "image",
                              filename: `history_${e.id}_mj_${o}`,
                            }),
                            `@asset:${t}`
                          );
                        }
                        return t;
                      }),
                    )),
                  e.mjThumbnails &&
                    Array.isArray(e.mjThumbnails) &&
                    (t.mjThumbnails = await Promise.all(
                      e.mjThumbnails.map(async (t, o) => {
                        if (!t || "string" != typeof t) return t;
                        let i = t;
                        if (t.startsWith("blob:")) {
                          const base64 = await Aa(t);
                          base64 && (i = base64);
                        } else if (t.startsWith("content_ref:")) {
                          const e = t.replace("content_ref:", ""),
                            o = await ka(e);
                          o && (i = o);
                        }
                        if (i.startsWith("data:")) {
                          const t = `history_${e.id}_mj_thumb_${o}`;
                          return (
                            (h[t] = {
                              data: i,
                              type: "thumbnail",
                              filename: `history_${e.id}_mj_thumb_${o}`,
                            }),
                            `@asset:${t}`
                          );
                        }
                        return t;
                      }),
                    )),
                  e.audioUrl && "string" == typeof e.audioUrl)
                ) {
                  let o = e.audioUrl;
                  if (e.audioUrl.startsWith("blob:")) {
                    const base64 = await Aa(e.audioUrl);
                    base64 && (o = base64);
                  } else if (e.audioUrl.startsWith("content_ref:")) {
                    const t = e.audioUrl.replace("content_ref:", ""),
                      i = await ka(t);
                    i && (o = i);
                  }
                  if (o.startsWith("data:")) {
                    const i = `history_${e.id}_audio`;
                    ((h[i] = {
                      data: o,
                      type: "audio",
                      filename: `history_${e.id}_audio`,
                    }),
                      (t.audioUrl = `@asset:${i}`));
                  }
                }
                (P.push(t), S());
              }
            console.log(
              `[Export] 历史记录项: ${P.length}, 来自历史的资源: ${Object.keys(h).length}`,
            );
            for (const e of Object.values(result.structure))
              for (const t of e.nodes) {
                if (
                  (d.throwIfCancelled(),
                  (I = 0),
                  p.set(t.id, t),
                  t.content && "string" == typeof t.content)
                ) {
                  let e = t.content,
                    o = xa(t.content);
                  if (t.content.startsWith("blob:")) {
                    const base64 = await Aa(t.content);
                    base64 &&
                      ((e = base64),
                      (o = o || base64.startsWith("data:video")));
                  } else if (t.content.startsWith("content_ref:")) {
                    const i = t.content.replace("content_ref:", ""),
                      r = await ka(i);
                    r && ((e = r), (o = o || r.startsWith("data:video")));
                  } else if (
                    t.content.startsWith("http://") ||
                    t.content.startsWith("https://")
                  ) {
                    d.throwIfCancelled();
                    const base64 = await Pa(t.content);
                    base64 &&
                      ((e = base64),
                      (o = o || base64.startsWith("data:video")));
                  }
                  if (e.startsWith("data:")) {
                    const i = `${t.id}_content`;
                    h[i] = {
                      data: e,
                      type: o ? "video" : t.type,
                      filename: `${t.nodeName || t.id}_content`,
                    };
                  }
                }
                if (
                  (A(), t.thumbnailUrl && "string" == typeof t.thumbnailUrl)
                ) {
                  let e = t.thumbnailUrl;
                  if (t.thumbnailUrl.startsWith("blob:")) {
                    const base64 = await Aa(t.thumbnailUrl);
                    base64 && (e = base64);
                  } else if (t.thumbnailUrl.startsWith("content_ref:")) {
                    const o = t.thumbnailUrl.replace("content_ref:", ""),
                      i = await ka(o);
                    i && (e = i);
                  } else if (
                    t.thumbnailUrl.startsWith("http://") ||
                    t.thumbnailUrl.startsWith("https://")
                  ) {
                    d.throwIfCancelled();
                    const base64 = await Pa(t.thumbnailUrl);
                    base64 && (e = base64);
                  }
                  if (e.startsWith("data:")) {
                    const o = `${t.id}_thumbnail`;
                    h[o] = {
                      data: e,
                      type: "thumbnail",
                      filename: `${t.nodeName || t.id}_thumbnail`,
                    };
                  }
                }
                if (
                  (A(), t.videoPosterUrl && "string" == typeof t.videoPosterUrl)
                ) {
                  let e = t.videoPosterUrl;
                  if (t.videoPosterUrl.startsWith("blob:")) {
                    const base64 = await Aa(t.videoPosterUrl);
                    base64 && (e = base64);
                  } else if (t.videoPosterUrl.startsWith("content_ref:")) {
                    const o = t.videoPosterUrl.replace("content_ref:", ""),
                      i = await ka(o);
                    i && (e = i);
                  }
                  if (e.startsWith("data:")) {
                    const o = `${t.id}_poster`;
                    h[o] = {
                      data: e,
                      type: "poster",
                      filename: `${t.nodeName || t.id}_poster`,
                    };
                  }
                }
                if ((A(), t.frames && Array.isArray(t.frames)))
                  for (let e = 0; e < t.frames.length; e++) {
                    const o = t.frames[e];
                    if (o.url && "string" == typeof o.url) {
                      let i = o.url;
                      if (o.url.startsWith("blob:")) {
                        const base64 = await Aa(o.url);
                        base64 && (i = base64);
                      } else if (o.url.startsWith("content_ref:")) {
                        const e = o.url.replace("content_ref:", ""),
                          t = await ka(e);
                        t && (i = t);
                      }
                      if (i.startsWith("data:")) {
                        const o = `${t.id}_frame_${e}`;
                        h[o] = {
                          data: i,
                          type: "frame",
                          filename: `${t.nodeName || t.id}_frame_${e}`,
                        };
                      }
                    }
                  }
                if (
                  (A(),
                  t.selectedKeyframes && Array.isArray(t.selectedKeyframes))
                )
                  for (let e = 0; e < t.selectedKeyframes.length; e++) {
                    const o = t.selectedKeyframes[e];
                    if (o.url && "string" == typeof o.url) {
                      let i = o.url;
                      if (o.url.startsWith("blob:")) {
                        const base64 = await Aa(o.url);
                        base64 && (i = base64);
                      } else if (o.url.startsWith("content_ref:")) {
                        const e = o.url.replace("content_ref:", ""),
                          t = await ka(e);
                        t && (i = t);
                      }
                      if (i.startsWith("data:")) {
                        const o = `${t.id}_keyframe_${e}`;
                        h[o] = {
                          data: i,
                          type: "keyframe",
                          filename: `${t.nodeName || t.id}_keyframe_${e}`,
                        };
                      }
                    }
                  }
                if (
                  (A(), t.previewMjImages && Array.isArray(t.previewMjImages))
                )
                  for (let e = 0; e < t.previewMjImages.length; e++) {
                    const o = t.previewMjImages[e];
                    if (o && "string" == typeof o) {
                      let i = o;
                      if (o.startsWith("blob:")) {
                        const base64 = await Aa(o);
                        base64 && (i = base64);
                      } else if (o.startsWith("content_ref:")) {
                        const e = o.replace("content_ref:", ""),
                          t = await ka(e);
                        t && (i = t);
                      } else if (
                        o.startsWith("http://") ||
                        o.startsWith("https://")
                      ) {
                        d.throwIfCancelled();
                        const base64 = await Pa(o);
                        base64 && (i = base64);
                      }
                      if (i.startsWith("data:")) {
                        const o = `${t.id}_preview_${e}`;
                        h[o] = {
                          data: i,
                          type: "preview",
                          filename: `${t.nodeName || t.id}_preview_${e}`,
                        };
                      }
                    }
                  }
                if (
                  (A(),
                  "preview" === t.type &&
                    t.selectedPreviewImage &&
                    "string" == typeof t.selectedPreviewImage)
                ) {
                  const e = t.selectedPreviewImage;
                  let o = e;
                  if (e.startsWith("blob:")) {
                    const base64 = await Aa(e);
                    base64 && (o = base64);
                  } else if (e.startsWith("content_ref:")) {
                    const t = await ka(e.replace("content_ref:", ""));
                    t && (o = t);
                  } else if (
                    e.startsWith("http://") ||
                    e.startsWith("https://")
                  ) {
                    d.throwIfCancelled();
                    const base64 = await Pa(e);
                    base64 && (o = base64);
                  }
                  if (o.startsWith("data:")) {
                    const e = `${t.id}_selectedPreview`;
                    h[e] = {
                      data: o,
                      type: "preview",
                      filename: `${t.nodeName || t.id}_selectedPreview`,
                    };
                  }
                }
                if (
                  (A(),
                  "storyboard-node" === t.type &&
                    t.settings &&
                    t.settings.shots &&
                    Array.isArray(t.settings.shots))
                ) {
                  const e = t.settings.shots;
                  for (let o = 0; o < e.length; o++) {
                    const i = e[o];
                    if (i.image_url && "string" == typeof i.image_url) {
                      let e = i.image_url;
                      if (i.image_url.startsWith("blob:")) {
                        const base64 = await Aa(i.image_url);
                        base64 && (e = base64);
                      } else if (i.image_url.startsWith("content_ref:")) {
                        const t = i.image_url.replace("content_ref:", ""),
                          o = await ka(t);
                        o && (e = o);
                      }
                      if (e.startsWith("data:")) {
                        const r = `${t.id}_shot_${o}_image`;
                        ((h[r] = {
                          data: e,
                          type: "image",
                          filename: `${t.nodeName || t.id}_shot_${o}_image`,
                        }),
                          (i.image_url = `@asset:${r}`));
                      }
                    }
                    if (i.image_urls && Array.isArray(i.image_urls)) {
                      const e = await Promise.all(
                        i.image_urls.map(async (url, e) => {
                          if (!url || "string" != typeof url) return url;
                          let i = url;
                          if (url.startsWith("blob:")) {
                            const base64 = await Aa(url);
                            base64 && (i = base64);
                          } else if (url.startsWith("content_ref:")) {
                            const e = url.replace("content_ref:", ""),
                              t = await ka(e);
                            t && (i = t);
                          }
                          if (i.startsWith("data:")) {
                            const r = `${t.id}_shot_${o}_image_${e}`;
                            return (
                              (h[r] = {
                                data: i,
                                type: "image",
                                filename: `${t.nodeName || t.id}_shot_${o}_image_${e}`,
                              }),
                              `@asset:${r}`
                            );
                          }
                          return url;
                        }),
                      );
                      i.image_urls = e;
                    }
                    if (i.startFrame && "string" == typeof i.startFrame) {
                      let e = i.startFrame;
                      if (i.startFrame.startsWith("blob:")) {
                        const base64 = await Aa(i.startFrame);
                        base64 && (e = base64);
                      }
                      if (e.startsWith("data:")) {
                        const r = `${t.id}_shot_${o}_startFrame`;
                        ((h[r] = {
                          data: e,
                          type: "image",
                          filename: `${t.nodeName || t.id}_shot_${o}_startFrame`,
                        }),
                          (i.startFrame = `@asset:${r}`));
                      }
                    }
                    if (i.endFrame && "string" == typeof i.endFrame) {
                      let e = i.endFrame;
                      if (i.endFrame.startsWith("blob:")) {
                        const base64 = await Aa(i.endFrame);
                        base64 && (e = base64);
                      }
                      if (e.startsWith("data:")) {
                        const r = `${t.id}_shot_${o}_endFrame`;
                        ((h[r] = {
                          data: e,
                          type: "image",
                          filename: `${t.nodeName || t.id}_shot_${o}_endFrame`,
                        }),
                          (i.endFrame = `@asset:${r}`));
                      }
                    }
                  }
                  console.log(
                    `[Export] 处理分镜表节点 ${t.id}，提取了 ${e.length} 个镜头的图片`,
                  );
                }
                if (
                  (A(), t._localFilePath && "string" == typeof t._localFilePath)
                )
                  try {
                    const e = await invoke("read_file_as_base64", {
                        filePath: t._localFilePath,
                      }),
                      o = `${t.id}_local`;
                    h[o] = {
                      data: e,
                      type: t.type,
                      filename: `${t.nodeName || t.id}_local`,
                    };
                  } catch (error) {
                    console.warn(
                      `读取本地文件失败 ${t._localFilePath}:`,
                      error,
                    );
                  }
                (A(), S());
              }
          }
          if ("none" === w) for (const key of Object.keys(h)) delete h[key];
          else if ("images-only" === w)
            for (const [e, t] of Object.entries(h))
              ("video" !== t.type && "audio" !== t.type) || delete h[e];
          (console.log(
            `[Export] 本次导出共 ${Object.keys(h).length} 个资源文件 (filter: ${w}), 节点数: ${u.length}`,
          ),
            d.throwIfCancelled(),
            null == l ||
              l(50, `已提取 ${Object.keys(h).length} 个资源文件...`));
          const k = [],
            T = {};
          (Object.entries(result.structure).forEach(([e, t]) => {
            const o = t.nodes.map((e) => {
              const t = { ...e };
              if (e.content && "string" == typeof e.content) {
                const o = `${e.id}_content`;
                h[o] && (t.content = `@asset:${o}`);
              }
              if (e.thumbnailUrl && "string" == typeof e.thumbnailUrl) {
                const o = `${e.id}_thumbnail`;
                h[o] && (t.thumbnailUrl = `@asset:${o}`);
              }
              if (e.videoPosterUrl && "string" == typeof e.videoPosterUrl) {
                const o = `${e.id}_poster`;
                h[o] && (t.videoPosterUrl = `@asset:${o}`);
              }
              if (
                (t.frames &&
                  Array.isArray(t.frames) &&
                  (t.frames = t.frames.map((t, o) => {
                    const i = `${e.id}_frame_${o}`;
                    return h[i] ? { ...t, url: `@asset:${i}` } : t;
                  })),
                t.selectedKeyframes &&
                  Array.isArray(t.selectedKeyframes) &&
                  (t.selectedKeyframes = t.selectedKeyframes.map((t, o) => {
                    const i = `${e.id}_keyframe_${o}`;
                    return h[i] ? { ...t, url: `@asset:${i}` } : t;
                  })),
                t.previewMjImages &&
                  Array.isArray(t.previewMjImages) &&
                  (t.previewMjImages = t.previewMjImages.map((t, o) => {
                    const i = `${e.id}_preview_${o}`;
                    return h[i] ? `@asset:${i}` : t;
                  })),
                "preview" === t.type)
              ) {
                const o = `${e.id}_selectedPreview`;
                h[o] && (t.selectedPreviewImage = `@asset:${o}`);
              }
              if (
                "storyboard-node" === t.type &&
                t.settings &&
                t.settings.shots &&
                Array.isArray(t.settings.shots)
              ) {
                const o = t.settings.shots;
                for (let t = 0; t < o.length; t++) {
                  const i = o[t];
                  if (i.image_url && "string" == typeof i.image_url) {
                    const o = `${e.id}_shot_${t}_image`;
                    h[o] && (i.image_url = `@asset:${o}`);
                  }
                  if (
                    (i.image_urls &&
                      Array.isArray(i.image_urls) &&
                      (i.image_urls = i.image_urls.map((url, o) => {
                        const i = `${e.id}_shot_${t}_image_${o}`;
                        return h[i] ? `@asset:${i}` : url;
                      })),
                    i.startFrame && "string" == typeof i.startFrame)
                  ) {
                    const o = `${e.id}_shot_${t}_startFrame`;
                    h[o] && (i.startFrame = `@asset:${o}`);
                  }
                  if (i.endFrame && "string" == typeof i.endFrame) {
                    const o = `${e.id}_shot_${t}_endFrame`;
                    h[o] && (i.endFrame = `@asset:${o}`);
                  }
                }
              }
              if (e._localFilePath) {
                const o = `${e.id}_local`;
                h[o] && (t.content = `@asset:${o}`);
              }
              return t;
            });
            (k.push(...o),
              (T[e] = {
                nodeCount: t.nodes.length,
                connectionCount: t.connections.length,
              }));
          }),
            "none" === w &&
              (k.forEach((n) => {
                var e;
                ((n.content = ""),
                  (n.thumbnailUrl = ""),
                  (n.videoPosterUrl = ""),
                  n.frames &&
                    Array.isArray(n.frames) &&
                    (n.frames = n.frames.map((e) => ({ ...e, url: "" }))),
                  n.selectedKeyframes &&
                    Array.isArray(n.selectedKeyframes) &&
                    (n.selectedKeyframes = n.selectedKeyframes.map((e) => ({
                      ...e,
                      url: "",
                    }))),
                  Array.isArray(n.previewMjImages) && (n.previewMjImages = []),
                  "storyboard-node" === n.type &&
                    (null == (e = n.settings) ? void 0 : e.shots) &&
                    Array.isArray(n.settings.shots) &&
                    n.settings.shots.forEach((e) => {
                      ("string" == typeof e.image_url && (e.image_url = ""),
                        Array.isArray(e.image_urls) && (e.image_urls = []),
                        "string" == typeof e.startFrame && (e.startFrame = ""),
                        "string" == typeof e.endFrame && (e.endFrame = ""));
                    }));
              }),
              P.forEach((e) => {
                ((e.url = ""),
                  (e.originalUrl = ""),
                  (e.thumbnailUrl = ""),
                  (e.videoPosterUrl = ""),
                  (e.audioUrl = ""),
                  (e.mjImages = []),
                  (e.mjThumbnails = []));
              })));
          const $ = {
            nodes: k,
            connections: t,
            groups: o,
            view: { x: 0, y: 0, zoom: 1 },
            projectName: s,
            history: P,
            version: "3.0-container",
            timestamp: new Date().toISOString(),
            _categorization: {
              mode: mode,
              categories: T,
              totalNodes: k.length,
              totalConnections: t.length,
              totalHistoryItems: P.length,
            },
          };
          (null == l || l(70, "正在处理敏感数据..."), d.throwIfCancelled());
          const { sanitizeSensitiveData: M } = await x(
              async () => {
                const { sanitizeSensitiveData: e } =
                  await Promise.resolve().then(() => Io);
                return { sanitizeSensitiveData: e };
              },
              void 0,
              import.meta.url,
            ),
            C = M($);
          null == l || l(75, "正在序列化数据...");
          let U = null,
            O = null;
          const E = (function (data) {
              const e = [],
                t = (t) => {
                  for (let i = 0; i < t.length; i++) {
                    i > 0 && e.push(",");
                    try {
                      e.push(JSON.stringify(t[i]));
                    } catch (o) {
                      (console.error(`序列化数组元素 ${i} 失败:`, o),
                        e.push("null"));
                    }
                  }
                };
              try {
                (e.push('{"version":'),
                  e.push(JSON.stringify(data.version ?? "3.0-container")),
                  e.push(',"nodes":['),
                  t(Array.isArray(data.nodes) ? data.nodes : []),
                  e.push("]"),
                  e.push(',"connections":'),
                  e.push(JSON.stringify(data.connections ?? [])),
                  e.push(',"groups":'),
                  e.push(JSON.stringify(data.groups ?? [])),
                  e.push(',"view":'),
                  e.push(JSON.stringify(data.view ?? { x: 0, y: 0, zoom: 1 })),
                  e.push(',"projectName":'),
                  e.push(JSON.stringify(data.projectName ?? "")),
                  e.push(',"history":['),
                  t(Array.isArray(data.history) ? data.history : []),
                  e.push("]"),
                  e.push(',"timestamp":'),
                  e.push(
                    JSON.stringify(data.timestamp ?? new Date().toISOString()),
                  ),
                  null != data._categorization &&
                    (e.push(',"_categorization":'),
                    e.push(JSON.stringify(data._categorization))),
                  e.push("}"));
              } catch (o) {
                throw (
                  console.error("分块序列化失败:", o),
                  new Error("数据序列化失败，请尝试减少画布内容或历史记录")
                );
              }
              return e;
            })(C),
            L = await invoke("get_export_temp_file_path");
          (await invoke("write_file_chunked", { path: L, chunks: E }), (O = L));
          const R = Object.entries(h),
            N = R.length > 15;
          let D = [],
            F = [];
          if (N) {
            null == l || l(78, `正在写入资源到临时目录（${R.length} 个）...`);
            const e = await invoke("get_export_temp_dir");
            for (let t = 0; t < R.length; t++) {
              d.throwIfCancelled();
              const [o, i] = R[t],
                r = `${e}/${o.replace(/[^a-zA-Z0-9_-]/g, "_")}.bin`;
              (await invoke("write_base64_to_file", {
                params: { path: r, base64Data: i.data },
              }),
                D.push({
                  id: o,
                  path: r,
                  assetType: i.type,
                  filename: i.filename,
                }),
                ((t + 1) % 10 != 0 && t !== R.length - 1) ||
                  null == l ||
                  l(
                    78 + Math.floor(((t + 1) / R.length) * 15),
                    `已写入 ${t + 1}/${R.length} 个资源...`,
                  ));
            }
          } else
            F = R.map(([e, t]) => ({
              id: e,
              data: t.data,
              assetType: t.type,
              filename: t.filename,
            }));
          await invoke("export_categorized_project", {
            path: s,
            payloadJson: U,
            payloadJsonPath: O,
            assets: F,
            assetFileRefs: N ? D : void 0,
          });
          return (
            null == l || l(100, "导出完成！"),
            {
              success: !0,
              message: "导出成功",
              assetCount: Object.keys(h).length,
              nodeCount: u.length,
              historyCount: P.length,
            }
          );
        } catch (error) {
          if (error instanceof Error && "操作已取消" === error.message)
            return (
              console.log("[useTauriCategorizedExport] 导出已取消"),
              { success: !1, message: "导出已取消", cancelled: !0 }
            );
          throw (
            console.error("[useTauriCategorizedExport] 导出失败:", error),
            error
          );
        } finally {
          a.current = null;
        }
      },
      [e, t, o, i, r],
    ),
    cancelExport: s,
  };
};
class $a {
  constructor() {
    u(this, "_cancelled", !1);
  }
  cancel() {
    this._cancelled = !0;
  }
  get isCancelled() {
    return this._cancelled;
  }
  throwIfCancelled() {
    if (this._cancelled) throw new Error("操作已取消");
  }
}
const Ma = ({
    setNodes: e,
    setConnections: t,
    setHistory: o,
    setGroups: i,
    setProjectName: r,
  }) => {
    const a = g.useRef(null),
      s = g.useCallback(() => {
        a.current &&
          (a.current.cancel(),
          console.log("[useTauriCategorizedImport] 用户取消导入"));
      }, []),
      l = g.useCallback(
        async (s, l) => {
          const c = new $a();
          a.current = c;
          try {
            (c.throwIfCancelled(), null == l || l(10, "正在读取项目文件..."));
            const result = await invoke("import_categorized_project", {
              path: s,
              streamAssets: !0,
            });
            (c.throwIfCancelled(), null == l || l(50, "正在处理资源文件..."));
            let a = result.data || result;
            const d = result.asset_files,
              u = 8,
              m = 4;
            if (d && d.length > 0) {
              const e = {},
                t = s.includes("\\") ? "\\" : "/",
                o = `${s}${t}assets`,
                i = async (e, i) => {
                  const r = `${o}${t}${i}`;
                  try {
                    const t = await invoke("read_file_as_base64", {
                      filePath: r,
                    });
                    if (t) {
                      return { assetId: e, blobUrl: await et(t) };
                    }
                  } catch (a) {
                    console.warn(
                      `[useTauriCategorizedImport] 读取资源失败 ${e}:`,
                      a,
                    );
                  }
                  return null;
                };
              if (d.length <= u) {
                c.throwIfCancelled();
                ((
                  await Promise.all(d.map(({ id: e, fileName: t }) => i(e, t)))
                ).forEach((t) => {
                  t && (e[t.assetId] = t.blobUrl);
                }),
                  null == l || l(75, `已加载资源 ${d.length}/${d.length}...`));
              } else
                for (let a = 0; a < d.length; a += m) {
                  c.throwIfCancelled();
                  const t = d.slice(a, a + m);
                  (
                    await Promise.all(
                      t.map(({ id: e, fileName: t }) => i(e, t)),
                    )
                  ).forEach((t) => {
                    t && (e[t.assetId] = t.blobUrl);
                  });
                  const o = Math.min(a + m, d.length);
                  null == l ||
                    l(
                      50 + Math.floor((o / d.length) * 25),
                      `已加载资源 ${o}/${d.length}...`,
                    );
                }
              const r = (t) => {
                if ("string" == typeof t && t.startsWith("@asset:")) {
                  const o = t.slice(7);
                  return e[o] ?? t;
                }
                if (Array.isArray(t)) return t.map(r);
                if (t && "object" == typeof t) {
                  const e = {};
                  for (const [o, i] of Object.entries(t)) e[o] = r(i);
                  return e;
                }
                return t;
              };
              a = r(a);
            }
            const h = [],
              p = [],
              f = [],
              w = [];
            (a.nodes && Array.isArray(a.nodes) && h.push(...a.nodes),
              a.connections &&
                Array.isArray(a.connections) &&
                p.push(...a.connections),
              a.allConnections &&
                Array.isArray(a.allConnections) &&
                p.push(...a.allConnections),
              a.history && Array.isArray(a.history) && f.push(...a.history),
              a.groups && Array.isArray(a.groups) && w.push(...a.groups),
              r &&
                a.projectName &&
                "string" == typeof a.projectName &&
                r(Ht(a.projectName)),
              a.categories &&
                "object" == typeof a.categories &&
                Object.entries(a.categories).forEach(([e, t]) => {
                  (t.nodes && Array.isArray(t.nodes) && h.push(...t.nodes),
                    t.connections &&
                      Array.isArray(t.connections) &&
                      p.push(...t.connections));
                }),
              null == l || l(80, `已导入 ${h.length} 个节点...`),
              c.throwIfCancelled());
            const y = new Map();
            h.forEach((e) => {
              y.has(e.id) || y.set(e.id, e);
            });
            const v = new Set(),
              b = [];
            p.forEach((e) => {
              const key = `${e.from}-${e.to}-${e.inputType || "default"}`;
              v.has(key) || (v.add(key), b.push(e));
            });
            const _ = {
              nodes: Array.from(y.values()),
              connections: b,
              history: f,
              groups: w,
            };
            if (nt(_)) {
              (null == l || l(85, "正在优化图片数据（Base64 → Blob URL）..."),
                console.log(
                  "[useTauriCategorizedImport] 检测到 Base64 数据，开始 Hydration...",
                ));
              try {
                const { data: r, stats: a } = await ot(_);
                console.log(
                  `[useTauriCategorizedImport] ✅ Hydration 完成！转换了 ${a.converted} 张图片`,
                );
                const s = r.nodes || Array.from(y.values()),
                  d = r.connections || b,
                  u = r.history || f,
                  m = r.groups || w;
                (null == l || l(95, "正在更新项目..."),
                  c.throwIfCancelled(),
                  g.startTransition(() => {
                    (e(s),
                      t(d),
                      o && u.length > 0 && o(u),
                      i && m.length > 0 && i(m));
                  }));
              } catch (error) {
                (console.error(
                  "[useTauriCategorizedImport] Hydration 失败，使用原始数据:",
                  error,
                ),
                  null == l || l(95, "正在更新项目..."),
                  c.throwIfCancelled(),
                  g.startTransition(() => {
                    (e(Array.from(y.values())),
                      t(b),
                      o && f.length > 0 && o(f),
                      i && w.length > 0 && i(w));
                  }));
              }
            } else
              (null == l || l(95, "正在更新项目..."),
                c.throwIfCancelled(),
                g.startTransition(() => {
                  (e(Array.from(y.values())),
                    t(b),
                    o && f.length > 0 && o(f),
                    i && w.length > 0 && i(w));
                }));
            return (
              null == l || l(100, "导入完成！"),
              console.log("[useTauriCategorizedImport] 导入成功:", {
                nodes: y.size,
                connections: b.length,
                history: f.length,
                groups: w.length,
              }),
              {
                success: !0,
                nodeCount: y.size,
                connectionCount: b.length,
                historyCount: f.length,
                groupCount: w.length,
              }
            );
          } catch (error) {
            if (error instanceof Error && "操作已取消" === error.message)
              return (
                console.log("[useTauriCategorizedImport] 导入已取消"),
                { success: !1, message: "导入已取消", cancelled: !0 }
              );
            throw (
              console.error("[useTauriCategorizedImport] 导入失败:", error),
              error
            );
          } finally {
            a.current = null;
          }
        },
        [e, t, o, i, r],
      ),
      c = g.useCallback(
        async (e) => {
          try {
            const { open: t } = await x(
              async () => {
                const { open: e } = await import("./vendor-DXn3GjvW.js").then(
                  (n) => n.n,
                );
                return { open: e };
              },
              __vite__mapDeps([1, 2]),
              import.meta.url,
            );
            null == e || e(5, "打开文件夹选择器...");
            const o = await t({
              directory: !0,
              multiple: !1,
              title: "选择导出的项目文件夹",
            });
            if (!o)
              return (
                console.log("[useTauriCategorizedImport] 用户取消选择"),
                null
              );
            const i = Array.isArray(o) ? o[0] : o;
            return i
              ? (console.log("[useTauriCategorizedImport] 选择的文件夹:", i),
                await l(i, e))
              : (console.log("[useTauriCategorizedImport] 无效的文件夹路径"),
                null);
          } catch (error) {
            throw (
              console.error(
                "[useTauriCategorizedImport] 文件夹选择失败:",
                error,
              ),
              error
            );
          }
        },
        [l],
      );
    return {
      importFromTauriContainer: l,
      importFromTauriFolder: c,
      cancelImport: s,
    };
  },
  Ca = ({
    setNodes: e,
    setConnections: t,
    setHistory: o,
    setChatSessions: i,
    setCharacterLibrary: r,
    setGroups: a,
    setView: s,
    setProjectName: l,
  }) => ({
    importFromJsonFile: g.useCallback(
      async (c) => {
        var d, u, g, m;
        try {
          null == c || c(5, "打开文件选择器...");
          const { open: h } = await x(
              async () => {
                const { open: e } = await import("./vendor-DXn3GjvW.js").then(
                  (n) => n.n,
                );
                return { open: e };
              },
              __vite__mapDeps([1, 2]),
              import.meta.url,
            ),
            p = await h({
              multiple: !1,
              filters: [{ name: "JSON", extensions: ["json"] }],
              title: "选择项目 JSON 文件",
            });
          if (!p)
            return (console.log("[useTauriJsonImport] 用户取消选择"), null);
          const f = Array.isArray(p) ? p[0] : p;
          if (!f)
            return (console.log("[useTauriJsonImport] 无效的文件路径"), null);
          (console.log("[useTauriJsonImport] 选择的文件:", f),
            null == c || c(10, "正在读取文件..."));
          const { readTextFile: readTextFile } = await x(
              async () => {
                const { readTextFile: e } =
                  await import("./vendor-DXn3GjvW.js").then((n) => n.f);
                return { readTextFile: e };
              },
              __vite__mapDeps([1, 2]),
              import.meta.url,
            ),
            w = await readTextFile(f);
          let y;
          null == c || c(20, "正在解析 JSON...");
          try {
            y = JSON.parse(w);
          } catch (error) {
            throw new Error("JSON 文件格式错误: " + error.message);
          }
          if (
            (null == c || c(30, "正在检查数据完整性..."),
            !y.nodes || !Array.isArray(y.nodes))
          )
            throw new Error("项目文件缺少 nodes 字段");
          const { containsBase64Media: v, hydrateProjectData: b } = await x(
            async () => {
              const { containsBase64Media: e, hydrateProjectData: t } =
                await Promise.resolve().then(() => rt);
              return { containsBase64Media: e, hydrateProjectData: t };
            },
            void 0,
            import.meta.url,
          );
          if (v(y)) {
            null == c || c(40, "正在优化内存数据（Base64 → Blob URL）...");
            const { data: e, stats: t } = await b(y);
            ((y = e),
              console.log("[useTauriJsonImport] ✅ Hydration 完成！"),
              console.log(`  - 转换图片: ${t.converted} 张`),
              console.log(
                `  - 节省内存: ${(t.totalSize / 1024 / 1024).toFixed(2)}MB`,
              ),
              null == c ||
                c(
                  50,
                  `已优化 ${t.converted} 张图片，节省 ${(t.totalSize / 1024 / 1024).toFixed(2)}MB 内存`,
                ));
          } else null == c || c(50, "正在加载节点...");
          return (
            null == c || c(60, "正在加载节点..."),
            e(y.nodes || []),
            null == c || c(70, "正在加载连接..."),
            y.connections && t(y.connections),
            null == c || c(75, "正在加载分组..."),
            a && y.groups && Array.isArray(y.groups) && a(y.groups),
            null == c || c(80, "正在加载视图..."),
            s && y.view && s(y.view),
            null == c || c(85, "正在加载聊天会话..."),
            i && y.chatSessions && i(y.chatSessions),
            null == c || c(90, "正在加载历史记录..."),
            o && y.history && o(y.history),
            null == c || c(95, "正在加载角色库..."),
            r && y.characterLibrary && r(y.characterLibrary),
            null == c || c(98, "正在应用项目设置..."),
            l && y.projectName && l(Ht(y.projectName)),
            null == c || c(100, "导入完成！"),
            console.log("[useTauriJsonImport] 导入成功:", {
              nodes: y.nodes.length,
              connections:
                (null == (d = y.connections) ? void 0 : d.length) || 0,
              history: (null == (u = y.history) ? void 0 : u.length) || 0,
            }),
            {
              success: !0,
              nodeCount: y.nodes.length,
              connectionCount:
                (null == (g = y.connections) ? void 0 : g.length) || 0,
              historyCount: (null == (m = y.history) ? void 0 : m.length) || 0,
            }
          );
        } catch (error) {
          throw (console.error("[useTauriJsonImport] 导入失败:", error), error);
        }
      },
      [e, t, o, i, r, a, s, l],
    ),
  });
export {
  xr as $,
  Kt as A,
  Hn as B,
  Ni as C,
  Zi as D,
  Ne as E,
  De as F,
  Ce as G,
  kt as H,
  Yo as I,
  ue as J,
  se as K,
  C as L,
  le as M,
  ce as N,
  de as O,
  an as P,
  ai as Q,
  en as R,
  oa as S,
  fe as T,
  te as U,
  F as V,
  Sa as W,
  Ta as X,
  Ma as Y,
  Ca as Z,
  x as _,
  ve as a,
  Le as a$,
  kr as a0,
  eo as a1,
  ga as a2,
  mr as a3,
  hr as a4,
  ko as a5,
  To as a6,
  $o as a7,
  Mo as a8,
  Co as a9,
  Bi as aA,
  Ki as aB,
  V as aC,
  bn as aD,
  Gi as aE,
  ee as aF,
  Oo as aG,
  Lo as aH,
  Ro as aI,
  No as aJ,
  Do as aK,
  Fo as aL,
  Wo as aM,
  Go as aN,
  ei as aO,
  Yn as aP,
  Zr as aQ,
  ea as aR,
  Yr as aS,
  ta as aT,
  aa as aU,
  na as aV,
  ia as aW,
  ra as aX,
  Vn as aY,
  D as aZ,
  mo as a_,
  Bt as aa,
  go as ab,
  B as ac,
  G as ad,
  Po as ae,
  ho as af,
  vo as ag,
  wo as ah,
  Xi as ai,
  Cr as aj,
  Oi as ak,
  Ei as al,
  ui as am,
  Gr as an,
  Br as ao,
  nt as ap,
  ot as aq,
  Ye as ar,
  En as as,
  Tn as at,
  N as au,
  Jn as av,
  so as aw,
  E as ax,
  K as ay,
  ie as az,
  Vo as b,
  Dn as b0,
  Ln as b1,
  Nn as b2,
  Ie as b3,
  wr as b4,
  Ae as b5,
  va as b6,
  hi as b7,
  wa as b8,
  ya as b9,
  Ur as ba,
  Kr as bb,
  je as bc,
  Oe as bd,
  Ge as be,
  Gt as bf,
  Io as bg,
  Wn as bh,
  li as bi,
  pr as bj,
  $r as bk,
  Nr as bl,
  Jr as bm,
  Be as c,
  H as d,
  Q as e,
  q as f,
  Jo as g,
  oe as h,
  Z as i,
  ne as j,
  re as k,
  ge as l,
  me as m,
  ae as n,
  si as o,
  Ue as p,
  Me as q,
  Re as r,
  yo as s,
  Fe as t,
  _n as u,
  We as v,
  Fi as w,
  Ri as x,
  Li as y,
  Jt as z,
};
