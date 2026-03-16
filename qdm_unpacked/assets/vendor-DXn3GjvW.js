var e,
  t = Object.defineProperty,
  a = (e, key, value) =>
    ((e, key, value) =>
      key in e
        ? t(e, key, {
            enumerable: !0,
            configurable: !0,
            writable: !0,
            value: value,
          })
        : (e[key] = value))(e, "symbol" != typeof key ? key + "" : key, value);
import { g as s } from "./jszip-CXr7zspi.js";
function r(n, e) {
  for (var t = 0; t < e.length; t++) {
    const a = e[t];
    if ("string" != typeof a && !Array.isArray(a))
      for (const e in a)
        if ("default" !== e && !(e in n)) {
          const t = Object.getOwnPropertyDescriptor(a, e);
          t &&
            Object.defineProperty(
              n,
              e,
              t.get ? t : { enumerable: !0, get: () => a[e] },
            );
        }
  }
  return Object.freeze(
    Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }),
  );
}
var i,
  l,
  o,
  _,
  c,
  u,
  f,
  h = { exports: {} },
  p = {};
function b() {
  return (
    l ||
      ((l = 1),
      (h.exports =
        (i ||
          ((i = 1),
          (function (e) {
            function t(e, t) {
              var a = e.length;
              e.push(t);
              e: for (; 0 < a; ) {
                var s = (a - 1) >>> 1,
                  i = e[s];
                if (!(0 < r(i, t))) break e;
                ((e[s] = t), (e[a] = i), (a = s));
              }
            }
            function a(e) {
              return 0 === e.length ? null : e[0];
            }
            function s(e) {
              if (0 === e.length) return null;
              var t = e[0],
                a = e.pop();
              if (a !== t) {
                e[0] = a;
                e: for (var s = 0, i = e.length, l = i >>> 1; s < l; ) {
                  var o = 2 * (s + 1) - 1,
                    _ = e[o],
                    n = o + 1,
                    c = e[n];
                  if (0 > r(_, a))
                    n < i && 0 > r(c, _)
                      ? ((e[s] = c), (e[n] = a), (s = n))
                      : ((e[s] = _), (e[o] = a), (s = o));
                  else {
                    if (!(n < i && 0 > r(c, a))) break e;
                    ((e[s] = c), (e[n] = a), (s = n));
                  }
                }
              }
              return t;
            }
            function r(e, t) {
              var a = e.sortIndex - t.sortIndex;
              return 0 !== a ? a : e.id - t.id;
            }
            if (
              "object" == typeof performance &&
              "function" == typeof performance.now
            ) {
              var i = performance;
              e.unstable_now = function () {
                return i.now();
              };
            } else {
              var l = Date,
                o = l.now();
              e.unstable_now = function () {
                return l.now() - o;
              };
            }
            var _ = [],
              c = [],
              u = 1,
              f = null,
              h = 3,
              p = !1,
              b = !1,
              d = !1,
              m = "function" == typeof setTimeout ? setTimeout : null,
              g = "function" == typeof clearTimeout ? clearTimeout : null,
              v = "undefined" != typeof setImmediate ? setImmediate : null;
            function w(e) {
              for (var r = a(c); null !== r; ) {
                if (null === r.callback) s(c);
                else {
                  if (!(r.startTime <= e)) break;
                  (s(c), (r.sortIndex = r.expirationTime), t(_, r));
                }
                r = a(c);
              }
            }
            function y(e) {
              if (((d = !1), w(e), !b))
                if (null !== a(_)) ((b = !0), I(k));
                else {
                  var t = a(c);
                  null !== t && O(y, t.startTime - e);
                }
            }
            function k(t, r) {
              ((b = !1), d && ((d = !1), g(A), (A = -1)), (p = !0));
              var i = h;
              try {
                for (
                  w(r), f = a(_);
                  null !== f && (!(f.expirationTime > r) || (t && !B()));
                ) {
                  var l = f.callback;
                  if ("function" == typeof l) {
                    ((f.callback = null), (h = f.priorityLevel));
                    var o = l(f.expirationTime <= r);
                    ((r = e.unstable_now()),
                      "function" == typeof o
                        ? (f.callback = o)
                        : f === a(_) && s(_),
                      w(r));
                  } else s(_);
                  f = a(_);
                }
                if (null !== f) var u = !0;
                else {
                  var m = a(c);
                  (null !== m && O(y, m.startTime - r), (u = !1));
                }
                return u;
              } finally {
                ((f = null), (h = i), (p = !1));
              }
            }
            "undefined" != typeof navigator &&
              void 0 !== navigator.scheduling &&
              void 0 !== navigator.scheduling.isInputPending &&
              navigator.scheduling.isInputPending.bind(navigator.scheduling);
            var S,
              R = !1,
              x = null,
              A = -1,
              M = 5,
              T = -1;
            function B() {
              return !(e.unstable_now() - T < M);
            }
            function E() {
              if (null !== x) {
                var t = e.unstable_now();
                T = t;
                var a = !0;
                try {
                  a = x(!0, t);
                } finally {
                  a ? S() : ((R = !1), (x = null));
                }
              } else R = !1;
            }
            if ("function" == typeof v)
              S = function () {
                v(E);
              };
            else if ("undefined" != typeof MessageChannel) {
              var P = new MessageChannel(),
                L = P.port2;
              ((P.port1.onmessage = E),
                (S = function () {
                  L.postMessage(null);
                }));
            } else
              S = function () {
                m(E, 0);
              };
            function I(e) {
              ((x = e), R || ((R = !0), S()));
            }
            function O(t, a) {
              A = m(function () {
                t(e.unstable_now());
              }, a);
            }
            ((e.unstable_IdlePriority = 5),
              (e.unstable_ImmediatePriority = 1),
              (e.unstable_LowPriority = 4),
              (e.unstable_NormalPriority = 3),
              (e.unstable_Profiling = null),
              (e.unstable_UserBlockingPriority = 2),
              (e.unstable_cancelCallback = function (e) {
                e.callback = null;
              }),
              (e.unstable_continueExecution = function () {
                b || p || ((b = !0), I(k));
              }),
              (e.unstable_forceFrameRate = function (e) {
                0 > e || 125 < e
                  ? console.error(
                      "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported",
                    )
                  : (M = 0 < e ? Math.floor(1e3 / e) : 5);
              }),
              (e.unstable_getCurrentPriorityLevel = function () {
                return h;
              }),
              (e.unstable_getFirstCallbackNode = function () {
                return a(_);
              }),
              (e.unstable_next = function (e) {
                switch (h) {
                  case 1:
                  case 2:
                  case 3:
                    var t = 3;
                    break;
                  default:
                    t = h;
                }
                var a = h;
                h = t;
                try {
                  return e();
                } finally {
                  h = a;
                }
              }),
              (e.unstable_pauseExecution = function () {}),
              (e.unstable_requestPaint = function () {}),
              (e.unstable_runWithPriority = function (e, t) {
                switch (e) {
                  case 1:
                  case 2:
                  case 3:
                  case 4:
                  case 5:
                    break;
                  default:
                    e = 3;
                }
                var a = h;
                h = e;
                try {
                  return t();
                } finally {
                  h = a;
                }
              }),
              (e.unstable_scheduleCallback = function (s, r, i) {
                var l = e.unstable_now();
                switch (
                  ((i =
                    "object" == typeof i &&
                    null !== i &&
                    "number" == typeof (i = i.delay) &&
                    0 < i
                      ? l + i
                      : l),
                  s)
                ) {
                  case 1:
                    var o = -1;
                    break;
                  case 2:
                    o = 250;
                    break;
                  case 5:
                    o = 1073741823;
                    break;
                  case 4:
                    o = 1e4;
                    break;
                  default:
                    o = 5e3;
                }
                return (
                  (s = {
                    id: u++,
                    callback: r,
                    priorityLevel: s,
                    startTime: i,
                    expirationTime: (o = i + o),
                    sortIndex: -1,
                  }),
                  i > l
                    ? ((s.sortIndex = i),
                      t(c, s),
                      null === a(_) &&
                        s === a(c) &&
                        (d ? (g(A), (A = -1)) : (d = !0), O(y, i - l)))
                    : ((s.sortIndex = o), t(_, s), b || p || ((b = !0), I(k))),
                  s
                );
              }),
              (e.unstable_shouldYield = B),
              (e.unstable_wrapCallback = function (e) {
                var t = h;
                return function () {
                  var a = h;
                  h = t;
                  try {
                    return e.apply(this, arguments);
                  } finally {
                    h = a;
                  }
                };
              }));
          })(p)),
        p))),
    h.exports
  );
}
function d(e, t, a, s) {
  if ("function" == typeof t ? e !== t || !s : !t.has(e))
    throw new TypeError(
      "Cannot read private member from an object whose class did not declare it",
    );
  return "m" === a ? s : "a" === a ? s.call(e) : s ? s.value : t.get(e);
}
function m(e, t, value, a, s) {
  if ("function" == typeof t || !t.has(e))
    throw new TypeError(
      "Cannot write private member to an object whose class did not declare it",
    );
  return (t.set(e, value), value);
}
"function" == typeof SuppressedError && SuppressedError;
const g = "__TAURI_TO_IPC_KEY__";
function v(e, t = !1) {
  return window.__TAURI_INTERNALS__.transformCallback(e, t);
}
class w {
  constructor(e) {
    (o.set(this, void 0),
      _.set(this, 0),
      c.set(this, []),
      u.set(this, void 0),
      m(this, o, e || (() => {})),
      (this.id = v((e) => {
        const t = e.index;
        if ("end" in e)
          return void (t == d(this, _, "f")
            ? this.cleanupCallback()
            : m(this, u, t));
        const message = e.message;
        if (t == d(this, _, "f")) {
          for (
            d(this, o, "f").call(this, message),
              m(this, _, d(this, _, "f") + 1);
            d(this, _, "f") in d(this, c, "f");
          ) {
            const e = d(this, c, "f")[d(this, _, "f")];
            (d(this, o, "f").call(this, e),
              delete d(this, c, "f")[d(this, _, "f")],
              m(this, _, d(this, _, "f") + 1));
          }
          d(this, _, "f") === d(this, u, "f") && this.cleanupCallback();
        } else d(this, c, "f")[t] = message;
      })));
  }
  cleanupCallback() {
    window.__TAURI_INTERNALS__.unregisterCallback(this.id);
  }
  set onmessage(e) {
    m(this, o, e);
  }
  get onmessage() {
    return d(this, o, "f");
  }
  [((o = new WeakMap()),
  (_ = new WeakMap()),
  (c = new WeakMap()),
  (u = new WeakMap()),
  g)]() {
    return `__CHANNEL__:${this.id}`;
  }
  toJSON() {
    return this[g]();
  }
}
async function invoke(e, args = {}, t) {
  return window.__TAURI_INTERNALS__.invoke(e, args, t);
}
class y {
  get rid() {
    return d(this, f, "f");
  }
  constructor(e) {
    (f.set(this, void 0), m(this, f, e));
  }
  async close() {
    return invoke("plugin:resources|close", { rid: this.rid });
  }
}
f = new WeakMap();
const k = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      Channel: w,
      Resource: y,
      SERIALIZE_TO_IPC_FN: g,
      convertFileSrc: function (e, t = "asset") {
        return window.__TAURI_INTERNALS__.convertFileSrc(e, t);
      },
      invoke: invoke,
      transformCallback: v,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
var S, R;
async function x(e, t) {
  (window.__TAURI_EVENT_PLUGIN_INTERNALS__.unregisterListener(e, t),
    await invoke("plugin:event|unlisten", { event: e, eventId: t }));
}
async function A(e, t, a) {
  var s;
  const r =
    "string" == typeof (null == a ? void 0 : a.target)
      ? { kind: "AnyLabel", label: a.target }
      : null !== (s = null == a ? void 0 : a.target) && void 0 !== s
        ? s
        : { kind: "Any" };
  return invoke("plugin:event|listen", {
    event: e,
    target: r,
    handler: v(t),
  }).then((t) => async () => x(e, t));
}
async function M(e = {}) {
  return (
    "object" == typeof e && Object.freeze(e),
    await invoke("plugin:dialog|open", { options: e })
  );
}
(((R = S || (S = {})).WINDOW_RESIZED = "tauri://resize"),
  (R.WINDOW_MOVED = "tauri://move"),
  (R.WINDOW_CLOSE_REQUESTED = "tauri://close-requested"),
  (R.WINDOW_DESTROYED = "tauri://destroyed"),
  (R.WINDOW_FOCUS = "tauri://focus"),
  (R.WINDOW_BLUR = "tauri://blur"),
  (R.WINDOW_SCALE_FACTOR_CHANGED = "tauri://scale-change"),
  (R.WINDOW_THEME_CHANGED = "tauri://theme-changed"),
  (R.WINDOW_CREATED = "tauri://window-created"),
  (R.WEBVIEW_CREATED = "tauri://webview-created"),
  (R.DRAG_ENTER = "tauri://drag-enter"),
  (R.DRAG_OVER = "tauri://drag-over"),
  (R.DRAG_DROP = "tauri://drag-drop"),
  (R.DRAG_LEAVE = "tauri://drag-leave"));
const T = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      ask: async function (message, e) {
        var t, a, s;
        const r = "string" == typeof e ? { title: e } : e;
        return await invoke("plugin:dialog|ask", {
          message: message.toString(),
          title:
            null == (t = null == r ? void 0 : r.title) ? void 0 : t.toString(),
          kind: null == r ? void 0 : r.kind,
          yesButtonLabel:
            null == (a = null == r ? void 0 : r.okLabel)
              ? void 0
              : a.toString(),
          noButtonLabel:
            null == (s = null == r ? void 0 : r.cancelLabel)
              ? void 0
              : s.toString(),
        });
      },
      open: M,
      save: async function (e = {}) {
        return (
          "object" == typeof e && Object.freeze(e),
          await invoke("plugin:dialog|save", { options: e })
        );
      },
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
var B, E;
async function P(...e) {
  return invoke("plugin:path|join", { paths: e });
}
(((E = B || (B = {}))[(E.Audio = 1)] = "Audio"),
  (E[(E.Cache = 2)] = "Cache"),
  (E[(E.Config = 3)] = "Config"),
  (E[(E.Data = 4)] = "Data"),
  (E[(E.LocalData = 5)] = "LocalData"),
  (E[(E.Document = 6)] = "Document"),
  (E[(E.Download = 7)] = "Download"),
  (E[(E.Picture = 8)] = "Picture"),
  (E[(E.Public = 9)] = "Public"),
  (E[(E.Video = 10)] = "Video"),
  (E[(E.Resource = 11)] = "Resource"),
  (E[(E.Temp = 12)] = "Temp"),
  (E[(E.AppConfig = 13)] = "AppConfig"),
  (E[(E.AppData = 14)] = "AppData"),
  (E[(E.AppLocalData = 15)] = "AppLocalData"),
  (E[(E.AppCache = 16)] = "AppCache"),
  (E[(E.AppLog = 17)] = "AppLog"),
  (E[(E.Desktop = 18)] = "Desktop"),
  (E[(E.Executable = 19)] = "Executable"),
  (E[(E.Font = 20)] = "Font"),
  (E[(E.Home = 21)] = "Home"),
  (E[(E.Runtime = 22)] = "Runtime"),
  (E[(E.Template = 23)] = "Template"));
const L = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      get BaseDirectory() {
        return B;
      },
      appCacheDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.AppCache,
        });
      },
      appConfigDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.AppConfig,
        });
      },
      appDataDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.AppData,
        });
      },
      appLocalDataDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.AppLocalData,
        });
      },
      appLogDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.AppLog });
      },
      audioDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Audio });
      },
      basename: async function (path, e) {
        return invoke("plugin:path|basename", { path: path, ext: e });
      },
      cacheDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Cache });
      },
      configDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Config });
      },
      dataDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Data });
      },
      delimiter: function () {
        return window.__TAURI_INTERNALS__.plugins.path.delimiter;
      },
      desktopDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Desktop,
        });
      },
      dirname: async function (path) {
        return invoke("plugin:path|dirname", { path: path });
      },
      documentDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Document,
        });
      },
      downloadDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Download,
        });
      },
      executableDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Executable,
        });
      },
      extname: async function (path) {
        return invoke("plugin:path|extname", { path: path });
      },
      fontDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Font });
      },
      homeDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Home });
      },
      isAbsolute: async function (path) {
        return invoke("plugin:path|is_absolute", { path: path });
      },
      join: P,
      localDataDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.LocalData,
        });
      },
      normalize: async function (path) {
        return invoke("plugin:path|normalize", { path: path });
      },
      pictureDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Picture,
        });
      },
      publicDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Public });
      },
      resolve: async function (...e) {
        return invoke("plugin:path|resolve", { paths: e });
      },
      resolveResource: async function (e) {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Resource,
          path: e,
        });
      },
      resourceDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Resource,
        });
      },
      runtimeDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Runtime,
        });
      },
      sep: function () {
        return window.__TAURI_INTERNALS__.plugins.path.sep;
      },
      tempDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Temp });
      },
      templateDir: async function () {
        return invoke("plugin:path|resolve_directory", {
          directory: B.Template,
        });
      },
      videoDir: async function () {
        return invoke("plugin:path|resolve_directory", { directory: B.Video });
      },
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
var I, O;
function D(e) {
  return {
    isFile: e.isFile,
    isDirectory: e.isDirectory,
    isSymlink: e.isSymlink,
    size: e.size,
    mtime: null !== e.mtime ? new Date(e.mtime) : null,
    atime: null !== e.atime ? new Date(e.atime) : null,
    birthtime: null !== e.birthtime ? new Date(e.birthtime) : null,
    readonly: e.readonly,
    fileAttributes: e.fileAttributes,
    dev: e.dev,
    ino: e.ino,
    mode: e.mode,
    nlink: e.nlink,
    uid: e.uid,
    gid: e.gid,
    rdev: e.rdev,
    blksize: e.blksize,
    blocks: e.blocks,
  };
}
(((O = I || (I = {}))[(O.Start = 0)] = "Start"),
  (O[(O.Current = 1)] = "Current"),
  (O[(O.End = 2)] = "End"));
class N extends y {
  async read(e) {
    if (0 === e.byteLength) return 0;
    const data = await invoke("plugin:fs|read", {
        rid: this.rid,
        len: e.byteLength,
      }),
      t = (function (e) {
        const t = new Uint8ClampedArray(e),
          a = t.byteLength;
        let s = 0;
        for (let r = 0; r < a; r++) ((s *= 256), (s += t[r]));
        return s;
      })(data.slice(-8)),
      a = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    return (e.set(a.slice(0, a.length - 8)), 0 === t ? null : t);
  }
  async seek(e, t) {
    return await invoke("plugin:fs|seek", {
      rid: this.rid,
      offset: e,
      whence: t,
    });
  }
  async stat() {
    return D(await invoke("plugin:fs|fstat", { rid: this.rid }));
  }
  async truncate(e) {
    await invoke("plugin:fs|ftruncate", { rid: this.rid, len: e });
  }
  async write(data) {
    return await invoke("plugin:fs|write", { rid: this.rid, data: data });
  }
}
async function open(path, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  const t = await invoke("plugin:fs|open", {
    path: path instanceof URL ? path.toString() : path,
    options: e,
  });
  return new N(t);
}
async function V(path, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  await invoke("plugin:fs|mkdir", {
    path: path instanceof URL ? path.toString() : path,
    options: e,
  });
}
async function H(path, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  return await invoke("plugin:fs|read_dir", {
    path: path instanceof URL ? path.toString() : path,
    options: e,
  });
}
async function C(path, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  const t = await invoke("plugin:fs|read_file", {
    path: path instanceof URL ? path.toString() : path,
    options: e,
  });
  return t instanceof ArrayBuffer ? new Uint8Array(t) : Uint8Array.from(t);
}
async function z(path, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  await invoke("plugin:fs|remove", {
    path: path instanceof URL ? path.toString() : path,
    options: e,
  });
}
async function F(path, data, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  if (data instanceof ReadableStream) {
    const file = await open(path, { read: !1, create: !0, write: !0, ...e }),
      t = data.getReader();
    try {
      for (;;) {
        const { done: e, value: value } = await t.read();
        if (e) break;
        await file.write(value);
      }
    } finally {
      (t.releaseLock(), await file.close());
    }
  } else
    await invoke("plugin:fs|write_file", data, {
      headers: {
        path: encodeURIComponent(path instanceof URL ? path.toString() : path),
        options: JSON.stringify(e),
      },
    });
}
async function writeTextFile(path, data, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  const t = new TextEncoder();
  await invoke("plugin:fs|write_text_file", t.encode(data), {
    headers: {
      path: encodeURIComponent(path instanceof URL ? path.toString() : path),
      options: JSON.stringify(e),
    },
  });
}
async function X(path, e) {
  if (path instanceof URL && "file:" !== path.protocol)
    throw new TypeError("Must be a file URL.");
  return await invoke("plugin:fs|exists", {
    path: path instanceof URL ? path.toString() : path,
    options: e,
  });
}
class q extends y {}
async function U(e, t, a) {
  const s = Array.isArray(e) ? e : [e];
  for (const path of s)
    if (path instanceof URL && "file:" !== path.protocol)
      throw new TypeError("Must be a file URL.");
  const r = new w();
  r.onmessage = t;
  const i = await invoke("plugin:fs|watch", {
      paths: s.map((e) => (e instanceof URL ? e.toString() : e)),
      options: a,
      onEvent: r,
    }),
    l = new q(i);
  return () => {
    l.close();
  };
}
const Y = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      get BaseDirectory() {
        return B;
      },
      FileHandle: N,
      get SeekMode() {
        return I;
      },
      copyFile: async function (e, t, a) {
        if (
          (e instanceof URL && "file:" !== e.protocol) ||
          (t instanceof URL && "file:" !== t.protocol)
        )
          throw new TypeError("Must be a file URL.");
        await invoke("plugin:fs|copy_file", {
          fromPath: e instanceof URL ? e.toString() : e,
          toPath: t instanceof URL ? t.toString() : t,
          options: a,
        });
      },
      create: async function (path, e) {
        if (path instanceof URL && "file:" !== path.protocol)
          throw new TypeError("Must be a file URL.");
        const t = await invoke("plugin:fs|create", {
          path: path instanceof URL ? path.toString() : path,
          options: e,
        });
        return new N(t);
      },
      exists: X,
      lstat: async function (path, e) {
        return D(
          await invoke("plugin:fs|lstat", {
            path: path instanceof URL ? path.toString() : path,
            options: e,
          }),
        );
      },
      mkdir: V,
      open: open,
      readDir: H,
      readFile: C,
      readTextFile: async function (path, e) {
        if (path instanceof URL && "file:" !== path.protocol)
          throw new TypeError("Must be a file URL.");
        const t = await invoke("plugin:fs|read_text_file", {
            path: path instanceof URL ? path.toString() : path,
            options: e,
          }),
          a = t instanceof ArrayBuffer ? t : Uint8Array.from(t);
        return new TextDecoder().decode(a);
      },
      readTextFileLines: async function (path, e) {
        if (path instanceof URL && "file:" !== path.protocol)
          throw new TypeError("Must be a file URL.");
        const t = path instanceof URL ? path.toString() : path;
        return await Promise.resolve({
          path: t,
          rid: null,
          async next() {
            null === this.rid &&
              (this.rid = await invoke("plugin:fs|read_text_file_lines", {
                path: t,
                options: e,
              }));
            const a = await invoke("plugin:fs|read_text_file_lines_next", {
                rid: this.rid,
              }),
              s =
                a instanceof ArrayBuffer
                  ? new Uint8Array(a)
                  : Uint8Array.from(a),
              r = 1 === s[s.byteLength - 1];
            if (r) return ((this.rid = null), { value: null, done: r });
            return {
              value: new TextDecoder().decode(s.slice(0, s.byteLength - 1)),
              done: r,
            };
          },
          [Symbol.asyncIterator]() {
            return this;
          },
        });
      },
      remove: z,
      rename: async function (e, t, a) {
        if (
          (e instanceof URL && "file:" !== e.protocol) ||
          (t instanceof URL && "file:" !== t.protocol)
        )
          throw new TypeError("Must be a file URL.");
        await invoke("plugin:fs|rename", {
          oldPath: e instanceof URL ? e.toString() : e,
          newPath: t instanceof URL ? t.toString() : t,
          options: a,
        });
      },
      size: async function (path) {
        if (path instanceof URL && "file:" !== path.protocol)
          throw new TypeError("Must be a file URL.");
        return await invoke("plugin:fs|size", {
          path: path instanceof URL ? path.toString() : path,
        });
      },
      stat: async function (path, e) {
        return D(
          await invoke("plugin:fs|stat", {
            path: path instanceof URL ? path.toString() : path,
            options: e,
          }),
        );
      },
      truncate: async function (path, e, t) {
        if (path instanceof URL && "file:" !== path.protocol)
          throw new TypeError("Must be a file URL.");
        await invoke("plugin:fs|truncate", {
          path: path instanceof URL ? path.toString() : path,
          len: e,
          options: t,
        });
      },
      watch: async function (e, t, a) {
        return await U(e, t, { delayMs: 2e3, ...a });
      },
      watchImmediate: async function (e, t, a) {
        return await U(e, t, { ...a, delayMs: void 0 });
      },
      writeFile: F,
      writeTextFile: writeTextFile,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
function j() {
  return {
    async: !1,
    breaks: !1,
    extensions: null,
    gfm: !0,
    hooks: null,
    pedantic: !1,
    renderer: null,
    silent: !1,
    tokenizer: null,
    walkTokens: null,
  };
}
var G = {
  async: !1,
  breaks: !1,
  extensions: null,
  gfm: !0,
  hooks: null,
  pedantic: !1,
  renderer: null,
  silent: !1,
  tokenizer: null,
  walkTokens: null,
};
function W(e) {
  G = e;
}
var $ = { exec: () => null };
function Z(e, t = "") {
  let a = "string" == typeof e ? e : e.source;
  const s = {
    replace: (name, e) => {
      let t = "string" == typeof e ? e : e.source;
      return ((t = t.replace(K.caret, "$1")), (a = a.replace(name, t)), s);
    },
    getRegex: () => new RegExp(a, t),
  };
  return s;
}
var K = {
    codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
    outputLinkReplace: /\\([\[\]])/g,
    indentCodeCompensation: /^(\s+)(?:```)/,
    beginningSpace: /^\s+/,
    endingHash: /#$/,
    startingSpaceChar: /^ /,
    endingSpaceChar: / $/,
    nonSpaceChar: /[^ ]/,
    newLineCharGlobal: /\n/g,
    tabCharGlobal: /\t/g,
    multipleSpaceGlobal: /\s+/g,
    blankLine: /^[ \t]*$/,
    doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
    blockquoteStart: /^ {0,3}>/,
    blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
    blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
    listReplaceTabs: /^\t+/,
    listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
    listIsTask: /^\[[ xX]\] /,
    listReplaceTask: /^\[[ xX]\] +/,
    anyLine: /\n.*\n/,
    hrefBrackets: /^<(.*)>$/,
    tableDelimiter: /[:|]/,
    tableAlignChars: /^\||\| *$/g,
    tableRowBlankLine: /\n[ \t]*$/,
    tableAlignRight: /^ *-+: *$/,
    tableAlignCenter: /^ *:-+: *$/,
    tableAlignLeft: /^ *:-+ *$/,
    startATag: /^<a /i,
    endATag: /^<\/a>/i,
    startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
    endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
    startAngleBracket: /^</,
    endAngleBracket: />$/,
    pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
    unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
    escapeTest: /[&<>"']/,
    escapeReplace: /[&<>"']/g,
    escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
    escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
    unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi,
    caret: /(^|[^\[])\^/g,
    percentDecode: /%25/g,
    findPipe: /\|/g,
    splitPipe: / \|/,
    slashPipe: /\\\|/g,
    carriageReturn: /\r\n|\r/g,
    spaceLine: /^ +$/gm,
    notSpaceStart: /^\S*/,
    endingNewline: /\n$/,
    listItemRegex: (e) =>
      new RegExp(`^( {0,3}${e})((?:[\t ][^\\n]*)?(?:\\n|$))`),
    nextBulletRegex: (e) =>
      new RegExp(
        `^ {0,${Math.min(3, e - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`,
      ),
    hrRegex: (e) =>
      new RegExp(
        `^ {0,${Math.min(3, e - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`,
      ),
    fencesBeginRegex: (e) =>
      new RegExp(`^ {0,${Math.min(3, e - 1)}}(?:\`\`\`|~~~)`),
    headingBeginRegex: (e) => new RegExp(`^ {0,${Math.min(3, e - 1)}}#`),
    htmlBeginRegex: (e) =>
      new RegExp(`^ {0,${Math.min(3, e - 1)}}<(?:[a-z].*>|!--)`, "i"),
  },
  Q = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,
  J = /(?:[*+-]|\d{1,9}[.)])/,
  ee =
    /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  te = Z(ee)
    .replace(/bull/g, J)
    .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
    .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
    .replace(/blockquote/g, / {0,3}>/)
    .replace(/heading/g, / {0,3}#{1,6}/)
    .replace(/html/g, / {0,3}<[^\n>]+>\n/)
    .replace(/\|table/g, "")
    .getRegex(),
  ne = Z(ee)
    .replace(/bull/g, J)
    .replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
    .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/)
    .replace(/blockquote/g, / {0,3}>/)
    .replace(/heading/g, / {0,3}#{1,6}/)
    .replace(/html/g, / {0,3}<[^\n>]+>\n/)
    .replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/)
    .getRegex(),
  ae =
    /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,
  se = /(?!\s*\])(?:\\.|[^\[\]\\])+/,
  re = Z(
    /^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/,
  )
    .replace("label", se)
    .replace(
      "title",
      /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/,
    )
    .getRegex(),
  ie = Z(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/)
    .replace(/bull/g, J)
    .getRegex(),
  le =
    "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",
  oe = /<!--(?:-?>|[\s\S]*?(?:-->|$))/,
  _e = Z(
    "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))",
    "i",
  )
    .replace("comment", oe)
    .replace("tag", le)
    .replace(
      "attribute",
      / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/,
    )
    .getRegex(),
  ce = Z(ae)
    .replace("hr", Q)
    .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
    .replace("|lheading", "")
    .replace("|table", "")
    .replace("blockquote", " {0,3}>")
    .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
    .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
    .replace(
      "html",
      "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)",
    )
    .replace("tag", le)
    .getRegex(),
  ue = {
    blockquote: Z(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/)
      .replace("paragraph", ce)
      .getRegex(),
    code: /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,
    def: re,
    fences:
      /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,
    heading: /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,
    hr: Q,
    html: _e,
    lheading: te,
    list: ie,
    newline: /^(?:[ \t]*(?:\n|$))+/,
    paragraph: ce,
    table: $,
    text: /^[^\n]+/,
  },
  fe = Z(
    "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)",
  )
    .replace("hr", Q)
    .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
    .replace("blockquote", " {0,3}>")
    .replace("code", "(?: {4}| {0,3}\t)[^\\n]")
    .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
    .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
    .replace(
      "html",
      "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)",
    )
    .replace("tag", le)
    .getRegex(),
  he = {
    ...ue,
    lheading: ne,
    table: fe,
    paragraph: Z(ae)
      .replace("hr", Q)
      .replace("heading", " {0,3}#{1,6}(?:\\s|$)")
      .replace("|lheading", "")
      .replace("table", fe)
      .replace("blockquote", " {0,3}>")
      .replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n")
      .replace("list", " {0,3}(?:[*+-]|1[.)]) ")
      .replace(
        "html",
        "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)",
      )
      .replace("tag", le)
      .getRegex(),
  },
  pe = {
    ...ue,
    html: Z(
      "^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:\"[^\"]*\"|'[^']*'|\\s[^'\"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))",
    )
      .replace("comment", oe)
      .replace(
        /tag/g,
        "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b",
      )
      .getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: $,
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: Z(ae)
      .replace("hr", Q)
      .replace("heading", " *#{1,6} *[^\n]")
      .replace("lheading", te)
      .replace("|table", "")
      .replace("blockquote", " {0,3}>")
      .replace("|fences", "")
      .replace("|list", "")
      .replace("|html", "")
      .replace("|tag", "")
      .getRegex(),
  },
  be = /^( {2,}|\\)\n(?!\s*$)/,
  de = /[\p{P}\p{S}]/u,
  me = /[\s\p{P}\p{S}]/u,
  ge = /[^\s\p{P}\p{S}]/u,
  ve = Z(/^((?![*_])punctSpace)/, "u")
    .replace(/punctSpace/g, me)
    .getRegex(),
  we = /(?!~)[\p{P}\p{S}]/u,
  ye = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,
  ke = Z(ye, "u").replace(/punct/g, de).getRegex(),
  Se = Z(ye, "u").replace(/punct/g, we).getRegex(),
  Re =
    "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",
  xe = Z(Re, "gu")
    .replace(/notPunctSpace/g, ge)
    .replace(/punctSpace/g, me)
    .replace(/punct/g, de)
    .getRegex(),
  Ae = Z(Re, "gu")
    .replace(/notPunctSpace/g, /(?:[^\s\p{P}\p{S}]|~)/u)
    .replace(/punctSpace/g, /(?!~)[\s\p{P}\p{S}]/u)
    .replace(/punct/g, we)
    .getRegex(),
  Me = Z(
    "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
    "gu",
  )
    .replace(/notPunctSpace/g, ge)
    .replace(/punctSpace/g, me)
    .replace(/punct/g, de)
    .getRegex(),
  Te = Z(/\\(punct)/, "gu")
    .replace(/punct/g, de)
    .getRegex(),
  Be = Z(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
    .replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
    .replace(
      "email",
      /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/,
    )
    .getRegex(),
  Ee = Z(oe).replace("(?:--\x3e|$)", "--\x3e").getRegex(),
  Pe = Z(
    "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>",
  )
    .replace("comment", Ee)
    .replace(
      "attribute",
      /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/,
    )
    .getRegex(),
  Le = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,
  Ie = Z(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/)
    .replace("label", Le)
    .replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/)
    .replace(
      "title",
      /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/,
    )
    .getRegex(),
  Oe = Z(/^!?\[(label)\]\[(ref)\]/)
    .replace("label", Le)
    .replace("ref", se)
    .getRegex(),
  De = Z(/^!?\[(ref)\](?:\[\])?/)
    .replace("ref", se)
    .getRegex(),
  Ne = {
    _backpedal: $,
    anyPunctuation: Te,
    autolink: Be,
    blockSkip:
      /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g,
    br: be,
    code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
    del: $,
    emStrongLDelim: ke,
    emStrongRDelimAst: xe,
    emStrongRDelimUnd: Me,
    escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
    link: Ie,
    nolink: De,
    punctuation: ve,
    reflink: Oe,
    reflinkSearch: Z("reflink|nolink(?!\\()", "g")
      .replace("reflink", Oe)
      .replace("nolink", De)
      .getRegex(),
    tag: Pe,
    text: /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,
    url: $,
  },
  Ve = {
    ...Ne,
    link: Z(/^!?\[(label)\]\((.*?)\)/)
      .replace("label", Le)
      .getRegex(),
    reflink: Z(/^!?\[(label)\]\s*\[([^\]]*)\]/)
      .replace("label", Le)
      .getRegex(),
  },
  He = {
    ...Ne,
    emStrongRDelimAst: Ae,
    emStrongLDelim: Se,
    url: Z(
      /^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,
      "i",
    )
      .replace(
        "email",
        /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/,
      )
      .getRegex(),
    _backpedal:
      /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
    text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/,
  },
  Ce = {
    ...He,
    br: Z(be).replace("{2,}", "*").getRegex(),
    text: Z(He.text)
      .replace("\\b_", "\\b_| {2,}\\n")
      .replace(/\{2,\}/g, "*")
      .getRegex(),
  },
  ze = { normal: ue, gfm: he, pedantic: pe },
  Fe = { normal: Ne, gfm: He, breaks: Ce, pedantic: Ve },
  Xe = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" },
  qe = (e) => Xe[e];
function Ue(e, t) {
  if (t) {
    if (K.escapeTest.test(e)) return e.replace(K.escapeReplace, qe);
  } else if (K.escapeTestNoEncode.test(e))
    return e.replace(K.escapeReplaceNoEncode, qe);
  return e;
}
function Ye(e) {
  try {
    e = encodeURI(e).replace(K.percentDecode, "%");
  } catch {
    return null;
  }
  return e;
}
function je(e, t) {
  var a;
  const s = e
    .replace(K.findPipe, (e, t, a) => {
      let s = !1,
        r = t;
      for (; --r >= 0 && "\\" === a[r]; ) s = !s;
      return s ? "|" : " |";
    })
    .split(K.splitPipe);
  let r = 0;
  if (
    (s[0].trim() || s.shift(),
    s.length > 0 && !(null == (a = s.at(-1)) ? void 0 : a.trim()) && s.pop(),
    t)
  )
    if (s.length > t) s.splice(t);
    else for (; s.length < t; ) s.push("");
  for (; r < s.length; r++) s[r] = s[r].trim().replace(K.slashPipe, "|");
  return s;
}
function Ge(e, t, a) {
  const s = e.length;
  if (0 === s) return "";
  let r = 0;
  for (; r < s; ) {
    if (e.charAt(s - r - 1) !== t) break;
    r++;
  }
  return e.slice(0, s - r);
}
function We(e, t, a, s, r) {
  const i = t.href,
    title = t.title || null,
    text = e[1].replace(r.other.outputLinkReplace, "$1");
  s.state.inLink = !0;
  const l = {
    type: "!" === e[0].charAt(0) ? "image" : "link",
    raw: a,
    href: i,
    title: title,
    text: text,
    tokens: s.inlineTokens(text),
  };
  return ((s.state.inLink = !1), l);
}
var $e = class {
    constructor(e) {
      (a(this, "options"),
        a(this, "rules"),
        a(this, "lexer"),
        (this.options = e || G));
    }
    space(e) {
      const t = this.rules.block.newline.exec(e);
      if (t && t[0].length > 0) return { type: "space", raw: t[0] };
    }
    code(e) {
      const t = this.rules.block.code.exec(e);
      if (t) {
        const text = t[0].replace(this.rules.other.codeRemoveIndent, "");
        return {
          type: "code",
          raw: t[0],
          codeBlockStyle: "indented",
          text: this.options.pedantic ? text : Ge(text, "\n"),
        };
      }
    }
    fences(e) {
      const t = this.rules.block.fences.exec(e);
      if (t) {
        const e = t[0],
          text = (function (e, text, t) {
            const a = e.match(t.other.indentCodeCompensation);
            if (null === a) return text;
            const s = a[1];
            return text
              .split("\n")
              .map((e) => {
                const a = e.match(t.other.beginningSpace);
                if (null === a) return e;
                const [r] = a;
                return r.length >= s.length ? e.slice(s.length) : e;
              })
              .join("\n");
          })(e, t[3] || "", this.rules);
        return {
          type: "code",
          raw: e,
          lang: t[2]
            ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1")
            : t[2],
          text: text,
        };
      }
    }
    heading(e) {
      const t = this.rules.block.heading.exec(e);
      if (t) {
        let text = t[2].trim();
        if (this.rules.other.endingHash.test(text)) {
          const e = Ge(text, "#");
          this.options.pedantic
            ? (text = e.trim())
            : (e && !this.rules.other.endingSpaceChar.test(e)) ||
              (text = e.trim());
        }
        return {
          type: "heading",
          raw: t[0],
          depth: t[1].length,
          text: text,
          tokens: this.lexer.inline(text),
        };
      }
    }
    hr(e) {
      const t = this.rules.block.hr.exec(e);
      if (t) return { type: "hr", raw: Ge(t[0], "\n") };
    }
    blockquote(e) {
      const t = this.rules.block.blockquote.exec(e);
      if (t) {
        let e = Ge(t[0], "\n").split("\n"),
          a = "",
          text = "";
        const s = [];
        for (; e.length > 0; ) {
          let t = !1;
          const r = [];
          let i;
          for (i = 0; i < e.length; i++)
            if (this.rules.other.blockquoteStart.test(e[i]))
              (r.push(e[i]), (t = !0));
            else {
              if (t) break;
              r.push(e[i]);
            }
          e = e.slice(i);
          const l = r.join("\n"),
            o = l
              .replace(this.rules.other.blockquoteSetextReplace, "\n    $1")
              .replace(this.rules.other.blockquoteSetextReplace2, "");
          ((a = a ? `${a}\n${l}` : l), (text = text ? `${text}\n${o}` : o));
          const _ = this.lexer.state.top;
          if (
            ((this.lexer.state.top = !0),
            this.lexer.blockTokens(o, s, !0),
            (this.lexer.state.top = _),
            0 === e.length)
          )
            break;
          const c = s.at(-1);
          if ("code" === (null == c ? void 0 : c.type)) break;
          if ("blockquote" === (null == c ? void 0 : c.type)) {
            const t = c,
              r = t.raw + "\n" + e.join("\n"),
              i = this.blockquote(r);
            ((s[s.length - 1] = i),
              (a = a.substring(0, a.length - t.raw.length) + i.raw),
              (text = text.substring(0, text.length - t.text.length) + i.text));
            break;
          }
          if ("list" === (null == c ? void 0 : c.type)) {
            const t = c,
              r = t.raw + "\n" + e.join("\n"),
              i = this.list(r);
            ((s[s.length - 1] = i),
              (a = a.substring(0, a.length - c.raw.length) + i.raw),
              (text = text.substring(0, text.length - t.raw.length) + i.raw),
              (e = r.substring(s.at(-1).raw.length).split("\n")));
            continue;
          }
        }
        return { type: "blockquote", raw: a, tokens: s, text: text };
      }
    }
    list(e) {
      let t = this.rules.block.list.exec(e);
      if (t) {
        let a = t[1].trim();
        const s = a.length > 1,
          r = {
            type: "list",
            raw: "",
            ordered: s,
            start: s ? +a.slice(0, -1) : "",
            loose: !1,
            items: [],
          };
        ((a = s ? `\\d{1,9}\\${a.slice(-1)}` : `\\${a}`),
          this.options.pedantic && (a = s ? a : "[*+-]"));
        const i = this.rules.other.listItemRegex(a);
        let l = !1;
        for (; e; ) {
          let a = !1,
            s = "",
            o = "";
          if (!(t = i.exec(e))) break;
          if (this.rules.block.hr.test(e)) break;
          ((s = t[0]), (e = e.substring(s.length)));
          let _ = t[2]
              .split("\n", 1)[0]
              .replace(this.rules.other.listReplaceTabs, (e) =>
                " ".repeat(3 * e.length),
              ),
            c = e.split("\n", 1)[0],
            u = !_.trim(),
            f = 0;
          if (
            (this.options.pedantic
              ? ((f = 2), (o = _.trimStart()))
              : u
                ? (f = t[1].length + 1)
                : ((f = t[2].search(this.rules.other.nonSpaceChar)),
                  (f = f > 4 ? 1 : f),
                  (o = _.slice(f)),
                  (f += t[1].length)),
            u &&
              this.rules.other.blankLine.test(c) &&
              ((s += c + "\n"), (e = e.substring(c.length + 1)), (a = !0)),
            !a)
          ) {
            const t = this.rules.other.nextBulletRegex(f),
              a = this.rules.other.hrRegex(f),
              r = this.rules.other.fencesBeginRegex(f),
              i = this.rules.other.headingBeginRegex(f),
              l = this.rules.other.htmlBeginRegex(f);
            for (; e; ) {
              const h = e.split("\n", 1)[0];
              let p;
              if (
                ((c = h),
                this.options.pedantic
                  ? ((c = c.replace(this.rules.other.listReplaceNesting, "  ")),
                    (p = c))
                  : (p = c.replace(this.rules.other.tabCharGlobal, "    ")),
                r.test(c))
              )
                break;
              if (i.test(c)) break;
              if (l.test(c)) break;
              if (t.test(c)) break;
              if (a.test(c)) break;
              if (p.search(this.rules.other.nonSpaceChar) >= f || !c.trim())
                o += "\n" + p.slice(f);
              else {
                if (u) break;
                if (
                  _.replace(this.rules.other.tabCharGlobal, "    ").search(
                    this.rules.other.nonSpaceChar,
                  ) >= 4
                )
                  break;
                if (r.test(_)) break;
                if (i.test(_)) break;
                if (a.test(_)) break;
                o += "\n" + c;
              }
              (u || c.trim() || (u = !0),
                (s += h + "\n"),
                (e = e.substring(h.length + 1)),
                (_ = p.slice(f)));
            }
          }
          r.loose ||
            (l
              ? (r.loose = !0)
              : this.rules.other.doubleBlankLine.test(s) && (l = !0));
          let h,
            p = null;
          (this.options.gfm &&
            ((p = this.rules.other.listIsTask.exec(o)),
            p &&
              ((h = "[ ] " !== p[0]),
              (o = o.replace(this.rules.other.listReplaceTask, "")))),
            r.items.push({
              type: "list_item",
              raw: s,
              task: !!p,
              checked: h,
              loose: !1,
              text: o,
              tokens: [],
            }),
            (r.raw += s));
        }
        const o = r.items.at(-1);
        if (!o) return;
        ((o.raw = o.raw.trimEnd()),
          (o.text = o.text.trimEnd()),
          (r.raw = r.raw.trimEnd()));
        for (let e = 0; e < r.items.length; e++)
          if (
            ((this.lexer.state.top = !1),
            (r.items[e].tokens = this.lexer.blockTokens(r.items[e].text, [])),
            !r.loose)
          ) {
            const t = r.items[e].tokens.filter((e) => "space" === e.type),
              a =
                t.length > 0 &&
                t.some((e) => this.rules.other.anyLine.test(e.raw));
            r.loose = a;
          }
        if (r.loose)
          for (let e = 0; e < r.items.length; e++) r.items[e].loose = !0;
        return r;
      }
    }
    html(e) {
      const t = this.rules.block.html.exec(e);
      if (t) {
        return {
          type: "html",
          block: !0,
          raw: t[0],
          pre: "pre" === t[1] || "script" === t[1] || "style" === t[1],
          text: t[0],
        };
      }
    }
    def(e) {
      const t = this.rules.block.def.exec(e);
      if (t) {
        const e = t[1]
            .toLowerCase()
            .replace(this.rules.other.multipleSpaceGlobal, " "),
          a = t[2]
            ? t[2]
                .replace(this.rules.other.hrefBrackets, "$1")
                .replace(this.rules.inline.anyPunctuation, "$1")
            : "",
          title = t[3]
            ? t[3]
                .substring(1, t[3].length - 1)
                .replace(this.rules.inline.anyPunctuation, "$1")
            : t[3];
        return { type: "def", tag: e, raw: t[0], href: a, title: title };
      }
    }
    table(e) {
      var t;
      const a = this.rules.block.table.exec(e);
      if (!a) return;
      if (!this.rules.other.tableDelimiter.test(a[2])) return;
      const headers = je(a[1]),
        s = a[2].replace(this.rules.other.tableAlignChars, "").split("|"),
        r = (null == (t = a[3]) ? void 0 : t.trim())
          ? a[3].replace(this.rules.other.tableRowBlankLine, "").split("\n")
          : [],
        i = { type: "table", raw: a[0], header: [], align: [], rows: [] };
      if (headers.length === s.length) {
        for (const e of s)
          this.rules.other.tableAlignRight.test(e)
            ? i.align.push("right")
            : this.rules.other.tableAlignCenter.test(e)
              ? i.align.push("center")
              : this.rules.other.tableAlignLeft.test(e)
                ? i.align.push("left")
                : i.align.push(null);
        for (let e = 0; e < headers.length; e++)
          i.header.push({
            text: headers[e],
            tokens: this.lexer.inline(headers[e]),
            header: !0,
            align: i.align[e],
          });
        for (const e of r)
          i.rows.push(
            je(e, i.header.length).map((e, t) => ({
              text: e,
              tokens: this.lexer.inline(e),
              header: !1,
              align: i.align[t],
            })),
          );
        return i;
      }
    }
    lheading(e) {
      const t = this.rules.block.lheading.exec(e);
      if (t)
        return {
          type: "heading",
          raw: t[0],
          depth: "=" === t[2].charAt(0) ? 1 : 2,
          text: t[1],
          tokens: this.lexer.inline(t[1]),
        };
    }
    paragraph(e) {
      const t = this.rules.block.paragraph.exec(e);
      if (t) {
        const text =
          "\n" === t[1].charAt(t[1].length - 1) ? t[1].slice(0, -1) : t[1];
        return {
          type: "paragraph",
          raw: t[0],
          text: text,
          tokens: this.lexer.inline(text),
        };
      }
    }
    text(e) {
      const t = this.rules.block.text.exec(e);
      if (t)
        return {
          type: "text",
          raw: t[0],
          text: t[0],
          tokens: this.lexer.inline(t[0]),
        };
    }
    escape(e) {
      const t = this.rules.inline.escape.exec(e);
      if (t) return { type: "escape", raw: t[0], text: t[1] };
    }
    tag(e) {
      const t = this.rules.inline.tag.exec(e);
      if (t)
        return (
          !this.lexer.state.inLink && this.rules.other.startATag.test(t[0])
            ? (this.lexer.state.inLink = !0)
            : this.lexer.state.inLink &&
              this.rules.other.endATag.test(t[0]) &&
              (this.lexer.state.inLink = !1),
          !this.lexer.state.inRawBlock &&
          this.rules.other.startPreScriptTag.test(t[0])
            ? (this.lexer.state.inRawBlock = !0)
            : this.lexer.state.inRawBlock &&
              this.rules.other.endPreScriptTag.test(t[0]) &&
              (this.lexer.state.inRawBlock = !1),
          {
            type: "html",
            raw: t[0],
            inLink: this.lexer.state.inLink,
            inRawBlock: this.lexer.state.inRawBlock,
            block: !1,
            text: t[0],
          }
        );
    }
    link(e) {
      const t = this.rules.inline.link.exec(e);
      if (t) {
        const e = t[2].trim();
        if (
          !this.options.pedantic &&
          this.rules.other.startAngleBracket.test(e)
        ) {
          if (!this.rules.other.endAngleBracket.test(e)) return;
          const t = Ge(e.slice(0, -1), "\\");
          if ((e.length - t.length) % 2 == 0) return;
        } else {
          const e = (function (e, t) {
            if (-1 === e.indexOf(t[1])) return -1;
            let a = 0;
            for (let s = 0; s < e.length; s++)
              if ("\\" === e[s]) s++;
              else if (e[s] === t[0]) a++;
              else if (e[s] === t[1] && (a--, a < 0)) return s;
            return a > 0 ? -2 : -1;
          })(t[2], "()");
          if (-2 === e) return;
          if (e > -1) {
            const a = (0 === t[0].indexOf("!") ? 5 : 4) + t[1].length + e;
            ((t[2] = t[2].substring(0, e)),
              (t[0] = t[0].substring(0, a).trim()),
              (t[3] = ""));
          }
        }
        let a = t[2],
          title = "";
        if (this.options.pedantic) {
          const e = this.rules.other.pedanticHrefTitle.exec(a);
          e && ((a = e[1]), (title = e[3]));
        } else title = t[3] ? t[3].slice(1, -1) : "";
        return (
          (a = a.trim()),
          this.rules.other.startAngleBracket.test(a) &&
            (a =
              this.options.pedantic && !this.rules.other.endAngleBracket.test(e)
                ? a.slice(1)
                : a.slice(1, -1)),
          We(
            t,
            {
              href: a ? a.replace(this.rules.inline.anyPunctuation, "$1") : a,
              title: title
                ? title.replace(this.rules.inline.anyPunctuation, "$1")
                : title,
            },
            t[0],
            this.lexer,
            this.rules,
          )
        );
      }
    }
    reflink(e, t) {
      let a;
      if (
        (a = this.rules.inline.reflink.exec(e)) ||
        (a = this.rules.inline.nolink.exec(e))
      ) {
        const e =
          t[
            (a[2] || a[1])
              .replace(this.rules.other.multipleSpaceGlobal, " ")
              .toLowerCase()
          ];
        if (!e) {
          const text = a[0].charAt(0);
          return { type: "text", raw: text, text: text };
        }
        return We(a, e, a[0], this.lexer, this.rules);
      }
    }
    emStrong(e, t, a = "") {
      let s = this.rules.inline.emStrongLDelim.exec(e);
      if (!s) return;
      if (s[3] && a.match(this.rules.other.unicodeAlphaNumeric)) return;
      if (
        !(s[1] || s[2] || "") ||
        !a ||
        this.rules.inline.punctuation.exec(a)
      ) {
        const a = [...s[0]].length - 1;
        let r,
          i,
          l = a,
          o = 0;
        const _ =
          "*" === s[0][0]
            ? this.rules.inline.emStrongRDelimAst
            : this.rules.inline.emStrongRDelimUnd;
        for (
          _.lastIndex = 0, t = t.slice(-1 * e.length + a);
          null != (s = _.exec(t));
        ) {
          if (((r = s[1] || s[2] || s[3] || s[4] || s[5] || s[6]), !r))
            continue;
          if (((i = [...r].length), s[3] || s[4])) {
            l += i;
            continue;
          }
          if ((s[5] || s[6]) && a % 3 && !((a + i) % 3)) {
            o += i;
            continue;
          }
          if (((l -= i), l > 0)) continue;
          i = Math.min(i, i + l + o);
          const t = [...s[0]][0].length,
            _ = e.slice(0, a + s.index + t + i);
          if (Math.min(a, i) % 2) {
            const e = _.slice(1, -1);
            return {
              type: "em",
              raw: _,
              text: e,
              tokens: this.lexer.inlineTokens(e),
            };
          }
          const text = _.slice(2, -2);
          return {
            type: "strong",
            raw: _,
            text: text,
            tokens: this.lexer.inlineTokens(text),
          };
        }
      }
    }
    codespan(e) {
      const t = this.rules.inline.code.exec(e);
      if (t) {
        let text = t[2].replace(this.rules.other.newLineCharGlobal, " ");
        const e = this.rules.other.nonSpaceChar.test(text),
          a =
            this.rules.other.startingSpaceChar.test(text) &&
            this.rules.other.endingSpaceChar.test(text);
        return (
          e && a && (text = text.substring(1, text.length - 1)),
          { type: "codespan", raw: t[0], text: text }
        );
      }
    }
    br(e) {
      const t = this.rules.inline.br.exec(e);
      if (t) return { type: "br", raw: t[0] };
    }
    del(e) {
      const t = this.rules.inline.del.exec(e);
      if (t)
        return {
          type: "del",
          raw: t[0],
          text: t[2],
          tokens: this.lexer.inlineTokens(t[2]),
        };
    }
    autolink(e) {
      const t = this.rules.inline.autolink.exec(e);
      if (t) {
        let text, e;
        return (
          "@" === t[2]
            ? ((text = t[1]), (e = "mailto:" + text))
            : ((text = t[1]), (e = text)),
          {
            type: "link",
            raw: t[0],
            text: text,
            href: e,
            tokens: [{ type: "text", raw: text, text: text }],
          }
        );
      }
    }
    url(e) {
      var t;
      let a;
      if ((a = this.rules.inline.url.exec(e))) {
        let text, e;
        if ("@" === a[2]) ((text = a[0]), (e = "mailto:" + text));
        else {
          let s;
          do {
            ((s = a[0]),
              (a[0] =
                (null == (t = this.rules.inline._backpedal.exec(a[0]))
                  ? void 0
                  : t[0]) ?? ""));
          } while (s !== a[0]);
          ((text = a[0]), (e = "www." === a[1] ? "http://" + a[0] : a[0]));
        }
        return {
          type: "link",
          raw: a[0],
          text: text,
          href: e,
          tokens: [{ type: "text", raw: text, text: text }],
        };
      }
    }
    inlineText(e) {
      const t = this.rules.inline.text.exec(e);
      if (t) {
        const e = this.lexer.state.inRawBlock;
        return { type: "text", raw: t[0], text: t[0], escaped: e };
      }
    }
  },
  Ze = class e {
    constructor(e) {
      (a(this, "tokens"),
        a(this, "options"),
        a(this, "state"),
        a(this, "tokenizer"),
        a(this, "inlineQueue"),
        (this.tokens = []),
        (this.tokens.links = Object.create(null)),
        (this.options = e || G),
        (this.options.tokenizer = this.options.tokenizer || new $e()),
        (this.tokenizer = this.options.tokenizer),
        (this.tokenizer.options = this.options),
        (this.tokenizer.lexer = this),
        (this.inlineQueue = []),
        (this.state = { inLink: !1, inRawBlock: !1, top: !0 }));
      const t = { other: K, block: ze.normal, inline: Fe.normal };
      (this.options.pedantic
        ? ((t.block = ze.pedantic), (t.inline = Fe.pedantic))
        : this.options.gfm &&
          ((t.block = ze.gfm),
          this.options.breaks ? (t.inline = Fe.breaks) : (t.inline = Fe.gfm)),
        (this.tokenizer.rules = t));
    }
    static get rules() {
      return { block: ze, inline: Fe };
    }
    static lex(t, a) {
      return new e(a).lex(t);
    }
    static lexInline(t, a) {
      return new e(a).inlineTokens(t);
    }
    lex(e) {
      ((e = e.replace(K.carriageReturn, "\n")),
        this.blockTokens(e, this.tokens));
      for (let t = 0; t < this.inlineQueue.length; t++) {
        const e = this.inlineQueue[t];
        this.inlineTokens(e.src, e.tokens);
      }
      return ((this.inlineQueue = []), this.tokens);
    }
    blockTokens(e, t = [], a = !1) {
      var s, r, i;
      for (
        this.options.pedantic &&
        (e = e.replace(K.tabCharGlobal, "    ").replace(K.spaceLine, ""));
        e;
      ) {
        let l;
        if (
          null == (r = null == (s = this.options.extensions) ? void 0 : s.block)
            ? void 0
            : r.some(
                (a) =>
                  !!(l = a.call({ lexer: this }, e, t)) &&
                  ((e = e.substring(l.raw.length)), t.push(l), !0),
              )
        )
          continue;
        if ((l = this.tokenizer.space(e))) {
          e = e.substring(l.raw.length);
          const a = t.at(-1);
          1 === l.raw.length && void 0 !== a ? (a.raw += "\n") : t.push(l);
          continue;
        }
        if ((l = this.tokenizer.code(e))) {
          e = e.substring(l.raw.length);
          const a = t.at(-1);
          "paragraph" === (null == a ? void 0 : a.type) ||
          "text" === (null == a ? void 0 : a.type)
            ? ((a.raw += "\n" + l.raw),
              (a.text += "\n" + l.text),
              (this.inlineQueue.at(-1).src = a.text))
            : t.push(l);
          continue;
        }
        if ((l = this.tokenizer.fences(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.heading(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.hr(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.blockquote(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.list(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.html(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.def(e))) {
          e = e.substring(l.raw.length);
          const a = t.at(-1);
          "paragraph" === (null == a ? void 0 : a.type) ||
          "text" === (null == a ? void 0 : a.type)
            ? ((a.raw += "\n" + l.raw),
              (a.text += "\n" + l.raw),
              (this.inlineQueue.at(-1).src = a.text))
            : this.tokens.links[l.tag] ||
              (this.tokens.links[l.tag] = { href: l.href, title: l.title });
          continue;
        }
        if ((l = this.tokenizer.table(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.lheading(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        let o = e;
        if (null == (i = this.options.extensions) ? void 0 : i.startBlock) {
          let t = 1 / 0;
          const a = e.slice(1);
          let s;
          (this.options.extensions.startBlock.forEach((e) => {
            ((s = e.call({ lexer: this }, a)),
              "number" == typeof s && s >= 0 && (t = Math.min(t, s)));
          }),
            t < 1 / 0 && t >= 0 && (o = e.substring(0, t + 1)));
        }
        if (this.state.top && (l = this.tokenizer.paragraph(o))) {
          const s = t.at(-1);
          (a && "paragraph" === (null == s ? void 0 : s.type)
            ? ((s.raw += "\n" + l.raw),
              (s.text += "\n" + l.text),
              this.inlineQueue.pop(),
              (this.inlineQueue.at(-1).src = s.text))
            : t.push(l),
            (a = o.length !== e.length),
            (e = e.substring(l.raw.length)));
          continue;
        }
        if ((l = this.tokenizer.text(e))) {
          e = e.substring(l.raw.length);
          const a = t.at(-1);
          "text" === (null == a ? void 0 : a.type)
            ? ((a.raw += "\n" + l.raw),
              (a.text += "\n" + l.text),
              this.inlineQueue.pop(),
              (this.inlineQueue.at(-1).src = a.text))
            : t.push(l);
          continue;
        }
        if (e) {
          const t = "Infinite loop on byte: " + e.charCodeAt(0);
          if (this.options.silent) {
            console.error(t);
            break;
          }
          throw new Error(t);
        }
      }
      return ((this.state.top = !0), t);
    }
    inline(e, t = []) {
      return (this.inlineQueue.push({ src: e, tokens: t }), t);
    }
    inlineTokens(e, t = []) {
      var a, s, r;
      let i = e,
        l = null;
      if (this.tokens.links) {
        const e = Object.keys(this.tokens.links);
        if (e.length > 0)
          for (
            ;
            null != (l = this.tokenizer.rules.inline.reflinkSearch.exec(i));
          )
            e.includes(l[0].slice(l[0].lastIndexOf("[") + 1, -1)) &&
              (i =
                i.slice(0, l.index) +
                "[" +
                "a".repeat(l[0].length - 2) +
                "]" +
                i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
      }
      for (; null != (l = this.tokenizer.rules.inline.anyPunctuation.exec(i)); )
        i =
          i.slice(0, l.index) +
          "++" +
          i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
      for (; null != (l = this.tokenizer.rules.inline.blockSkip.exec(i)); )
        i =
          i.slice(0, l.index) +
          "[" +
          "a".repeat(l[0].length - 2) +
          "]" +
          i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
      let o = !1,
        _ = "";
      for (; e; ) {
        let l;
        if (
          (o || (_ = ""),
          (o = !1),
          null ==
          (s = null == (a = this.options.extensions) ? void 0 : a.inline)
            ? void 0
            : s.some(
                (a) =>
                  !!(l = a.call({ lexer: this }, e, t)) &&
                  ((e = e.substring(l.raw.length)), t.push(l), !0),
              ))
        )
          continue;
        if ((l = this.tokenizer.escape(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.tag(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.link(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.reflink(e, this.tokens.links))) {
          e = e.substring(l.raw.length);
          const a = t.at(-1);
          "text" === l.type && "text" === (null == a ? void 0 : a.type)
            ? ((a.raw += l.raw), (a.text += l.text))
            : t.push(l);
          continue;
        }
        if ((l = this.tokenizer.emStrong(e, i, _))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.codespan(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.br(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.del(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if ((l = this.tokenizer.autolink(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        if (!this.state.inLink && (l = this.tokenizer.url(e))) {
          ((e = e.substring(l.raw.length)), t.push(l));
          continue;
        }
        let c = e;
        if (null == (r = this.options.extensions) ? void 0 : r.startInline) {
          let t = 1 / 0;
          const a = e.slice(1);
          let s;
          (this.options.extensions.startInline.forEach((e) => {
            ((s = e.call({ lexer: this }, a)),
              "number" == typeof s && s >= 0 && (t = Math.min(t, s)));
          }),
            t < 1 / 0 && t >= 0 && (c = e.substring(0, t + 1)));
        }
        if ((l = this.tokenizer.inlineText(c))) {
          ((e = e.substring(l.raw.length)),
            "_" !== l.raw.slice(-1) && (_ = l.raw.slice(-1)),
            (o = !0));
          const a = t.at(-1);
          "text" === (null == a ? void 0 : a.type)
            ? ((a.raw += l.raw), (a.text += l.text))
            : t.push(l);
          continue;
        }
        if (e) {
          const t = "Infinite loop on byte: " + e.charCodeAt(0);
          if (this.options.silent) {
            console.error(t);
            break;
          }
          throw new Error(t);
        }
      }
      return t;
    }
  },
  Ke = class {
    constructor(e) {
      (a(this, "options"), a(this, "parser"), (this.options = e || G));
    }
    space(e) {
      return "";
    }
    code({ text: text, lang: e, escaped: t }) {
      var a;
      const s = null == (a = (e || "").match(K.notSpaceStart)) ? void 0 : a[0],
        code = text.replace(K.endingNewline, "") + "\n";
      return s
        ? '<pre><code class="language-' +
            Ue(s) +
            '">' +
            (t ? code : Ue(code, !0)) +
            "</code></pre>\n"
        : "<pre><code>" + (t ? code : Ue(code, !0)) + "</code></pre>\n";
    }
    blockquote({ tokens: e }) {
      return `<blockquote>\n${this.parser.parse(e)}</blockquote>\n`;
    }
    html({ text: text }) {
      return text;
    }
    heading({ tokens: e, depth: t }) {
      return `<h${t}>${this.parser.parseInline(e)}</h${t}>\n`;
    }
    hr(e) {
      return "<hr>\n";
    }
    list(e) {
      const t = e.ordered,
        a = e.start;
      let body = "";
      for (let s = 0; s < e.items.length; s++) {
        const t = e.items[s];
        body += this.listitem(t);
      }
      const type = t ? "ol" : "ul";
      return (
        "<" +
        type +
        (t && 1 !== a ? ' start="' + a + '"' : "") +
        ">\n" +
        body +
        "</" +
        type +
        ">\n"
      );
    }
    listitem(e) {
      var t;
      let a = "";
      if (e.task) {
        const s = this.checkbox({ checked: !!e.checked });
        e.loose
          ? "paragraph" === (null == (t = e.tokens[0]) ? void 0 : t.type)
            ? ((e.tokens[0].text = s + " " + e.tokens[0].text),
              e.tokens[0].tokens &&
                e.tokens[0].tokens.length > 0 &&
                "text" === e.tokens[0].tokens[0].type &&
                ((e.tokens[0].tokens[0].text =
                  s + " " + Ue(e.tokens[0].tokens[0].text)),
                (e.tokens[0].tokens[0].escaped = !0)))
            : e.tokens.unshift({
                type: "text",
                raw: s + " ",
                text: s + " ",
                escaped: !0,
              })
          : (a += s + " ");
      }
      return ((a += this.parser.parse(e.tokens, !!e.loose)), `<li>${a}</li>\n`);
    }
    checkbox({ checked: e }) {
      return (
        "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox">'
      );
    }
    paragraph({ tokens: e }) {
      return `<p>${this.parser.parseInline(e)}</p>\n`;
    }
    table(e) {
      let t = "",
        a = "";
      for (let s = 0; s < e.header.length; s++)
        a += this.tablecell(e.header[s]);
      t += this.tablerow({ text: a });
      let body = "";
      for (let s = 0; s < e.rows.length; s++) {
        const t = e.rows[s];
        a = "";
        for (let e = 0; e < t.length; e++) a += this.tablecell(t[e]);
        body += this.tablerow({ text: a });
      }
      return (
        body && (body = `<tbody>${body}</tbody>`),
        "<table>\n<thead>\n" + t + "</thead>\n" + body + "</table>\n"
      );
    }
    tablerow({ text: text }) {
      return `<tr>\n${text}</tr>\n`;
    }
    tablecell(e) {
      const content = this.parser.parseInline(e.tokens),
        type = e.header ? "th" : "td";
      return (
        (e.align ? `<${type} align="${e.align}">` : `<${type}>`) +
        content +
        `</${type}>\n`
      );
    }
    strong({ tokens: e }) {
      return `<strong>${this.parser.parseInline(e)}</strong>`;
    }
    em({ tokens: e }) {
      return `<em>${this.parser.parseInline(e)}</em>`;
    }
    codespan({ text: text }) {
      return `<code>${Ue(text, !0)}</code>`;
    }
    br(e) {
      return "<br>";
    }
    del({ tokens: e }) {
      return `<del>${this.parser.parseInline(e)}</del>`;
    }
    link({ href: e, title: title, tokens: t }) {
      const text = this.parser.parseInline(t),
        a = Ye(e);
      if (null === a) return text;
      let s = '<a href="' + (e = a) + '"';
      return (
        title && (s += ' title="' + Ue(title) + '"'),
        (s += ">" + text + "</a>"),
        s
      );
    }
    image({ href: e, title: title, text: text, tokens: t }) {
      t && (text = this.parser.parseInline(t, this.parser.textRenderer));
      const a = Ye(e);
      if (null === a) return Ue(text);
      let s = `<img src="${(e = a)}" alt="${text}"`;
      return (title && (s += ` title="${Ue(title)}"`), (s += ">"), s);
    }
    text(e) {
      return "tokens" in e && e.tokens
        ? this.parser.parseInline(e.tokens)
        : "escaped" in e && e.escaped
          ? e.text
          : Ue(e.text);
    }
  },
  Qe = class {
    strong({ text: text }) {
      return text;
    }
    em({ text: text }) {
      return text;
    }
    codespan({ text: text }) {
      return text;
    }
    del({ text: text }) {
      return text;
    }
    html({ text: text }) {
      return text;
    }
    text({ text: text }) {
      return text;
    }
    link({ text: text }) {
      return "" + text;
    }
    image({ text: text }) {
      return "" + text;
    }
    br() {
      return "";
    }
  },
  Je = class e {
    constructor(e) {
      (a(this, "options"),
        a(this, "renderer"),
        a(this, "textRenderer"),
        (this.options = e || G),
        (this.options.renderer = this.options.renderer || new Ke()),
        (this.renderer = this.options.renderer),
        (this.renderer.options = this.options),
        (this.renderer.parser = this),
        (this.textRenderer = new Qe()));
    }
    static parse(t, a) {
      return new e(a).parse(t);
    }
    static parseInline(t, a) {
      return new e(a).parseInline(t);
    }
    parse(e, t = !0) {
      var a, s;
      let r = "";
      for (let i = 0; i < e.length; i++) {
        const l = e[i];
        if (
          null ==
          (s = null == (a = this.options.extensions) ? void 0 : a.renderers)
            ? void 0
            : s[l.type]
        ) {
          const e = l,
            t = this.options.extensions.renderers[e.type].call(
              { parser: this },
              e,
            );
          if (
            !1 !== t ||
            ![
              "space",
              "hr",
              "heading",
              "code",
              "table",
              "blockquote",
              "list",
              "html",
              "paragraph",
              "text",
            ].includes(e.type)
          ) {
            r += t || "";
            continue;
          }
        }
        const o = l;
        switch (o.type) {
          case "space":
            r += this.renderer.space(o);
            continue;
          case "hr":
            r += this.renderer.hr(o);
            continue;
          case "heading":
            r += this.renderer.heading(o);
            continue;
          case "code":
            r += this.renderer.code(o);
            continue;
          case "table":
            r += this.renderer.table(o);
            continue;
          case "blockquote":
            r += this.renderer.blockquote(o);
            continue;
          case "list":
            r += this.renderer.list(o);
            continue;
          case "html":
            r += this.renderer.html(o);
            continue;
          case "paragraph":
            r += this.renderer.paragraph(o);
            continue;
          case "text": {
            let a = o,
              body = this.renderer.text(a);
            for (; i + 1 < e.length && "text" === e[i + 1].type; )
              ((a = e[++i]), (body += "\n" + this.renderer.text(a)));
            r += t
              ? this.renderer.paragraph({
                  type: "paragraph",
                  raw: body,
                  text: body,
                  tokens: [
                    { type: "text", raw: body, text: body, escaped: !0 },
                  ],
                })
              : body;
            continue;
          }
          default: {
            const e = 'Token with "' + o.type + '" type was not found.';
            if (this.options.silent) return (console.error(e), "");
            throw new Error(e);
          }
        }
      }
      return r;
    }
    parseInline(e, t = this.renderer) {
      var a, s;
      let r = "";
      for (let i = 0; i < e.length; i++) {
        const l = e[i];
        if (
          null ==
          (s = null == (a = this.options.extensions) ? void 0 : a.renderers)
            ? void 0
            : s[l.type]
        ) {
          const e = this.options.extensions.renderers[l.type].call(
            { parser: this },
            l,
          );
          if (
            !1 !== e ||
            ![
              "escape",
              "html",
              "link",
              "image",
              "strong",
              "em",
              "codespan",
              "br",
              "del",
              "text",
            ].includes(l.type)
          ) {
            r += e || "";
            continue;
          }
        }
        const o = l;
        switch (o.type) {
          case "escape":
          case "text":
            r += t.text(o);
            break;
          case "html":
            r += t.html(o);
            break;
          case "link":
            r += t.link(o);
            break;
          case "image":
            r += t.image(o);
            break;
          case "strong":
            r += t.strong(o);
            break;
          case "em":
            r += t.em(o);
            break;
          case "codespan":
            r += t.codespan(o);
            break;
          case "br":
            r += t.br(o);
            break;
          case "del":
            r += t.del(o);
            break;
          default: {
            const e = 'Token with "' + o.type + '" type was not found.';
            if (this.options.silent) return (console.error(e), "");
            throw new Error(e);
          }
        }
      }
      return r;
    }
  },
  et =
    ((e = class {
      constructor(e) {
        (a(this, "options"), a(this, "block"), (this.options = e || G));
      }
      preprocess(e) {
        return e;
      }
      postprocess(e) {
        return e;
      }
      processAllTokens(e) {
        return e;
      }
      provideLexer() {
        return this.block ? Ze.lex : Ze.lexInline;
      }
      provideParser() {
        return this.block ? Je.parse : Je.parseInline;
      }
    }),
    a(
      e,
      "passThroughHooks",
      new Set(["preprocess", "postprocess", "processAllTokens"]),
    ),
    e),
  tt = new (class {
    constructor(...args) {
      (a(this, "defaults", {
        async: !1,
        breaks: !1,
        extensions: null,
        gfm: !0,
        hooks: null,
        pedantic: !1,
        renderer: null,
        silent: !1,
        tokenizer: null,
        walkTokens: null,
      }),
        a(this, "options", this.setOptions),
        a(this, "parse", this.parseMarkdown(!0)),
        a(this, "parseInline", this.parseMarkdown(!1)),
        a(this, "Parser", Je),
        a(this, "Renderer", Ke),
        a(this, "TextRenderer", Qe),
        a(this, "Lexer", Ze),
        a(this, "Tokenizer", $e),
        a(this, "Hooks", et),
        this.use(...args));
    }
    walkTokens(e, t) {
      var a, s;
      let r = [];
      for (const i of e)
        switch (((r = r.concat(t.call(this, i))), i.type)) {
          case "table": {
            const e = i;
            for (const a of e.header)
              r = r.concat(this.walkTokens(a.tokens, t));
            for (const a of e.rows)
              for (const e of a) r = r.concat(this.walkTokens(e.tokens, t));
            break;
          }
          case "list": {
            const e = i;
            r = r.concat(this.walkTokens(e.items, t));
            break;
          }
          default: {
            const e = i;
            (
              null ==
              (s =
                null == (a = this.defaults.extensions) ? void 0 : a.childTokens)
                ? void 0
                : s[e.type]
            )
              ? this.defaults.extensions.childTokens[e.type].forEach((a) => {
                  const s = e[a].flat(1 / 0);
                  r = r.concat(this.walkTokens(s, t));
                })
              : e.tokens && (r = r.concat(this.walkTokens(e.tokens, t)));
          }
        }
      return r;
    }
    use(...args) {
      const e = this.defaults.extensions || { renderers: {}, childTokens: {} };
      return (
        args.forEach((t) => {
          const a = { ...t };
          if (
            ((a.async = this.defaults.async || a.async || !1),
            t.extensions &&
              (t.extensions.forEach((t) => {
                if (!t.name) throw new Error("extension name required");
                if ("renderer" in t) {
                  const a = e.renderers[t.name];
                  e.renderers[t.name] = a
                    ? function (...e) {
                        let s = t.renderer.apply(this, e);
                        return (!1 === s && (s = a.apply(this, e)), s);
                      }
                    : t.renderer;
                }
                if ("tokenizer" in t) {
                  if (!t.level || ("block" !== t.level && "inline" !== t.level))
                    throw new Error(
                      "extension level must be 'block' or 'inline'",
                    );
                  const a = e[t.level];
                  (a ? a.unshift(t.tokenizer) : (e[t.level] = [t.tokenizer]),
                    t.start &&
                      ("block" === t.level
                        ? e.startBlock
                          ? e.startBlock.push(t.start)
                          : (e.startBlock = [t.start])
                        : "inline" === t.level &&
                          (e.startInline
                            ? e.startInline.push(t.start)
                            : (e.startInline = [t.start]))));
                }
                "childTokens" in t &&
                  t.childTokens &&
                  (e.childTokens[t.name] = t.childTokens);
              }),
              (a.extensions = e)),
            t.renderer)
          ) {
            const e = this.defaults.renderer || new Ke(this.defaults);
            for (const a in t.renderer) {
              if (!(a in e)) throw new Error(`renderer '${a}' does not exist`);
              if (["options", "parser"].includes(a)) continue;
              const s = a,
                r = t.renderer[s],
                i = e[s];
              e[s] = (...t) => {
                let a = r.apply(e, t);
                return (!1 === a && (a = i.apply(e, t)), a || "");
              };
            }
            a.renderer = e;
          }
          if (t.tokenizer) {
            const e = this.defaults.tokenizer || new $e(this.defaults);
            for (const a in t.tokenizer) {
              if (!(a in e)) throw new Error(`tokenizer '${a}' does not exist`);
              if (["options", "rules", "lexer"].includes(a)) continue;
              const s = a,
                r = t.tokenizer[s],
                i = e[s];
              e[s] = (...t) => {
                let a = r.apply(e, t);
                return (!1 === a && (a = i.apply(e, t)), a);
              };
            }
            a.tokenizer = e;
          }
          if (t.hooks) {
            const e = this.defaults.hooks || new et();
            for (const a in t.hooks) {
              if (!(a in e)) throw new Error(`hook '${a}' does not exist`);
              if (["options", "block"].includes(a)) continue;
              const s = a,
                r = t.hooks[s],
                i = e[s];
              et.passThroughHooks.has(a)
                ? (e[s] = (t) => {
                    if (this.defaults.async)
                      return Promise.resolve(r.call(e, t)).then((t) =>
                        i.call(e, t),
                      );
                    const a = r.call(e, t);
                    return i.call(e, a);
                  })
                : (e[s] = (...t) => {
                    let a = r.apply(e, t);
                    return (!1 === a && (a = i.apply(e, t)), a);
                  });
            }
            a.hooks = e;
          }
          if (t.walkTokens) {
            const e = this.defaults.walkTokens,
              s = t.walkTokens;
            a.walkTokens = function (t) {
              let a = [];
              return (
                a.push(s.call(this, t)),
                e && (a = a.concat(e.call(this, t))),
                a
              );
            };
          }
          this.defaults = { ...this.defaults, ...a };
        }),
        this
      );
    }
    setOptions(e) {
      return ((this.defaults = { ...this.defaults, ...e }), this);
    }
    lexer(e, t) {
      return Ze.lex(e, t ?? this.defaults);
    }
    parser(e, t) {
      return Je.parse(e, t ?? this.defaults);
    }
    parseMarkdown(e) {
      return (t, a) => {
        const s = { ...a },
          r = { ...this.defaults, ...s },
          i = this.onError(!!r.silent, !!r.async);
        if (!0 === this.defaults.async && !1 === s.async)
          return i(
            new Error(
              "marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise.",
            ),
          );
        if (null == t)
          return i(new Error("marked(): input parameter is undefined or null"));
        if ("string" != typeof t)
          return i(
            new Error(
              "marked(): input parameter is of type " +
                Object.prototype.toString.call(t) +
                ", string expected",
            ),
          );
        r.hooks && ((r.hooks.options = r), (r.hooks.block = e));
        const l = r.hooks ? r.hooks.provideLexer() : e ? Ze.lex : Ze.lexInline,
          o = r.hooks ? r.hooks.provideParser() : e ? Je.parse : Je.parseInline;
        if (r.async)
          return Promise.resolve(r.hooks ? r.hooks.preprocess(t) : t)
            .then((e) => l(e, r))
            .then((e) => (r.hooks ? r.hooks.processAllTokens(e) : e))
            .then((e) =>
              r.walkTokens
                ? Promise.all(this.walkTokens(e, r.walkTokens)).then(() => e)
                : e,
            )
            .then((e) => o(e, r))
            .then((e) => (r.hooks ? r.hooks.postprocess(e) : e))
            .catch(i);
        try {
          r.hooks && (t = r.hooks.preprocess(t));
          let e = l(t, r);
          (r.hooks && (e = r.hooks.processAllTokens(e)),
            r.walkTokens && this.walkTokens(e, r.walkTokens));
          let a = o(e, r);
          return (r.hooks && (a = r.hooks.postprocess(a)), a);
        } catch (_) {
          return i(_);
        }
      };
    }
    onError(e, t) {
      return (a) => {
        if (
          ((a.message +=
            "\nPlease report this to https://github.com/markedjs/marked."),
          e)
        ) {
          const e =
            "<p>An error occurred:</p><pre>" +
            Ue(a.message + "", !0) +
            "</pre>";
          return t ? Promise.resolve(e) : e;
        }
        if (t) return Promise.reject(a);
        throw a;
      };
    }
  })();
function nt(e, t) {
  return tt.parse(e, t);
}
((nt.options = nt.setOptions =
  function (e) {
    return (tt.setOptions(e), (nt.defaults = tt.defaults), W(nt.defaults), nt);
  }),
  (nt.getDefaults = j),
  (nt.defaults = G),
  (nt.use = function (...args) {
    return (tt.use(...args), (nt.defaults = tt.defaults), W(nt.defaults), nt);
  }),
  (nt.walkTokens = function (e, t) {
    return tt.walkTokens(e, t);
  }),
  (nt.parseInline = tt.parseInline),
  (nt.Parser = Je),
  (nt.parser = Je.parse),
  (nt.Renderer = Ke),
  (nt.TextRenderer = Qe),
  (nt.Lexer = Ze),
  (nt.lexer = Ze.lex),
  (nt.Tokenizer = $e),
  (nt.Hooks = et),
  (nt.parse = nt),
  nt.options,
  nt.setOptions,
  nt.use,
  nt.walkTokens,
  nt.parseInline,
  Je.parse,
  Ze.lex);
var at,
  st,
  rt,
  it,
  lt,
  ot,
  _t,
  ct,
  ut,
  ft,
  ht,
  pt,
  bt,
  dt,
  mt,
  gt,
  vt,
  wt,
  yt,
  kt,
  St,
  Rt,
  xt,
  At,
  Mt,
  Tt,
  Bt,
  Et,
  Pt,
  Lt,
  It,
  Ot,
  Dt,
  Nt,
  Vt,
  Ht,
  Ct,
  zt,
  Ft,
  Xt,
  qt,
  Ut,
  Yt,
  jt,
  Gt,
  Wt,
  $t,
  Zt,
  Kt,
  Qt,
  Jt,
  en,
  tn,
  nn,
  an,
  sn,
  rn,
  ln,
  on,
  _n,
  cn,
  un,
  fn,
  hn,
  pn,
  bn,
  dn,
  mn,
  gn,
  vn = {};
function wn() {
  if (st) return at;
  function e(e) {
    return new Int16Array(e);
  }
  function t(e) {
    return new Int32Array(e);
  }
  function a(e) {
    return new Float32Array(e);
  }
  st = 1;
  var s = {
      fill: function (e, t, a, s) {
        if (2 == arguments.length)
          for (var r = 0; r < e.length; r++) e[r] = arguments[1];
        else for (r = t; r < a; r++) e[r] = s;
      },
    },
    r = {
      arraycopy: function (e, t, a, s, r) {
        for (var i = t + r; t < i; ) a[s++] = e[t++];
      },
      out: {},
    };
  ((r.out.println = function (message) {
    console.log(message);
  }),
    (r.out.printf = function () {
      console.log.apply(console, arguments);
    }));
  var i = {};
  function l(e) {
    this.ordinal = e;
  }
  ((i.SQRT2 = 1.4142135623730951),
    (i.FAST_LOG10 = function (e) {
      return Math.log10(e);
    }),
    (i.FAST_LOG10_X = function (e, t) {
      return Math.log10(e) * t;
    }),
    (l.short_block_allowed = new l(0)),
    (l.short_block_coupled = new l(1)),
    (l.short_block_dispensed = new l(2)),
    (l.short_block_forced = new l(3)));
  var o = {};
  function _(e) {
    this.ordinal = e;
  }
  ((o.MAX_VALUE = 34028235e31),
    (_.vbr_off = new _(0)),
    (_.vbr_mt = new _(1)),
    (_.vbr_rh = new _(2)),
    (_.vbr_abr = new _(3)),
    (_.vbr_mtrh = new _(4)),
    (_.vbr_default = _.vbr_mtrh));
  return (
    (at = {
      System: r,
      VbrMode: _,
      Float: o,
      ShortBlock: l,
      Util: i,
      Arrays: s,
      new_array_n: function e(args) {
        if (1 == args.length) return new Array(args[0]);
        var t = args[0];
        args = args.slice(1);
        for (var a = [], s = 0; s < t; s++) a.push(e(args));
        return a;
      },
      new_byte: function (e) {
        return new Int8Array(e);
      },
      new_double: function (e) {
        return new Float64Array(e);
      },
      new_float: a,
      new_float_n: function e(args) {
        if (1 == args.length) return a(args[0]);
        var t = args[0];
        args = args.slice(1);
        for (var s = [], r = 0; r < t; r++) s.push(e(args));
        return s;
      },
      new_int: t,
      new_int_n: function e(args) {
        if (1 == args.length) return t(args[0]);
        var a = args[0];
        args = args.slice(1);
        for (var s = [], r = 0; r < a; r++) s.push(e(args));
        return s;
      },
      new_short: e,
      new_short_n: function t(args) {
        if (1 == args.length) return e(args[0]);
        var a = args[0];
        args = args.slice(1);
        for (var s = [], r = 0; r < a; r++) s.push(t(args));
        return s;
      },
      assert: function (e) {},
    }),
    at
  );
}
function yn() {
  if (ot) return lt;
  ot = 1;
  var e = kn(),
    t = wn(),
    a = t.System;
  (t.VbrMode,
    t.Float,
    t.ShortBlock,
    t.Util,
    t.Arrays,
    t.new_array_n,
    t.new_byte,
    t.new_double);
  var s = t.new_float,
    r = t.new_float_n;
  return (
    t.new_int,
    t.new_int_n,
    t.assert,
    (lt = function () {
      ((this.l = s(e.SBMAX_l)), (this.s = r([e.SBMAX_s, 3])));
      var t = this;
      this.assign = function (s) {
        a.arraycopy(s.l, 0, t.l, 0, e.SBMAX_l);
        for (var r = 0; r < e.SBMAX_s; r++)
          for (var i = 0; i < 3; i++) t.s[r][i] = s.s[r][i];
      };
    })
  );
}
function kn() {
  if (ft) return ut;
  ft = 1;
  var e = wn(),
    t = e.System,
    a = e.VbrMode;
  (e.Float, e.ShortBlock, e.Util, e.Arrays);
  var s = e.new_array_n;
  (e.new_byte, e.new_double);
  var r = e.new_float,
    i = e.new_float_n,
    l = e.new_int;
  e.new_int_n;
  var o = e.assert;
  function _() {
    var e = (function () {
        if (it) return rt;
        it = 1;
        var e = wn(),
          t = e.System;
        (e.VbrMode, e.Float, e.ShortBlock);
        var a = e.Util,
          s = e.Arrays;
        (e.new_array_n, e.new_byte, e.new_double);
        var r = e.new_float;
        (e.new_float_n, e.new_int, e.new_int_n, e.assert);
        var i = kn();
        return (rt = function () {
          var e = [
              -0.1482523854003001,
              32.308141959636465,
              296.40344946382766,
              883.1344870032432,
              11113.947376231741,
              1057.2713659324597,
              305.7402417275812,
              30.825928907280012,
              3.8533188138216365,
              59.42900443849514,
              709.5899960123345,
              5281.91112291017,
              -5829.66483675846,
              -817.6293103748613,
              -76.91656988279972,
              -4.594269939176596,
              0.9063471690191471,
              0.1960342806591213,
              -0.15466694054279598,
              34.324387823855965,
              301.8067566458425,
              817.599602898885,
              11573.795901679885,
              1181.2520595540152,
              321.59731579894424,
              31.232021761053772,
              3.7107095756221318,
              53.650946155329365,
              684.167428119626,
              5224.56624370173,
              -6366.391851890084,
              -908.9766368219582,
              -89.83068876699639,
              -5.411397422890401,
              0.8206787908286602,
              0.3901806440322567,
              -0.16070888947830023,
              36.147034243915876,
              304.11815768187864,
              732.7429163887613,
              11989.60988270091,
              1300.012278487897,
              335.28490093152146,
              31.48816102859945,
              3.373875931311736,
              47.232241542899175,
              652.7371796173471,
              5132.414255594984,
              -6909.087078780055,
              -1001.9990371107289,
              -103.62185754286375,
              -6.104916304710272,
              0.7416505462720353,
              0.5805693545089249,
              -0.16636367662261495,
              37.751650073343995,
              303.01103387567713,
              627.9747488785183,
              12358.763425278165,
              1412.2779918482834,
              346.7496836825721,
              31.598286663170416,
              3.1598635433980946,
              40.57878626349686,
              616.1671130880391,
              5007.833007176154,
              -7454.040671756168,
              -1095.7960341867115,
              -118.24411666465777,
              -6.818469345853504,
              0.6681786379192989,
              0.7653668647301797,
              -0.1716176790982088,
              39.11551877123304,
              298.3413246578966,
              503.5259106886539,
              12679.589408408976,
              1516.5821921214542,
              355.9850766329023,
              31.395241710249053,
              2.9164211881972335,
              33.79716964664243,
              574.8943997801362,
              4853.234992253242,
              -7997.57021486075,
              -1189.7624067269965,
              -133.6444792601766,
              -7.7202770609839915,
              0.5993769336819237,
              0.9427934736519954,
              -0.17645823955292173,
              40.21879108166477,
              289.9982036694474,
              359.3226160751053,
              12950.259102786438,
              1612.1013903507662,
              362.85067106591504,
              31.045922092242872,
              2.822222032597987,
              26.988862316190684,
              529.8996541764288,
              4671.371946949588,
              -8535.899136645805,
              -1282.5898586244496,
              -149.58553632943463,
              -8.643494270763135,
              0.5345111359507916,
              1.111140466039205,
              -0.36174739330527045,
              41.04429910497807,
              277.5463268268618,
              195.6386023135583,
              13169.43812144731,
              1697.6433561479398,
              367.40983966190305,
              30.557037410382826,
              2.531473372857427,
              20.070154905927314,
              481.50208566532336,
              4464.970341588308,
              -9065.36882077239,
              -1373.62841526722,
              -166.1660487028118,
              -9.58289321133207,
              0.4729647758913199,
              1.268786568327291,
              -0.36970682634889585,
              41.393213350082036,
              261.2935935556502,
              12.935476055240873,
              13336.131683328815,
              1772.508612059496,
              369.76534388639965,
              29.751323653701338,
              2.4023193045459172,
              13.304795348228817,
              430.5615775526625,
              4237.0568611071185,
              -9581.931701634761,
              -1461.6913552409758,
              -183.12733958476446,
              -10.718010163869403,
              0.41421356237309503,
              1.414213562373095,
              -0.37677560326535325,
              41.619486213528496,
              241.05423794991074,
              -187.94665032361226,
              13450.063605744153,
              1836.153896465782,
              369.4908799925761,
              29.001847876923147,
              2.0714759319987186,
              6.779591200894186,
              377.7767837205709,
              3990.386575512536,
              -10081.709459700915,
              -1545.947424837898,
              -200.3762958015653,
              -11.864482073055006,
              0.3578057213145241,
              1.546020906725474,
              -0.3829366947518991,
              41.1516456456653,
              216.47684307105183,
              -406.1569483347166,
              13511.136535077321,
              1887.8076599260432,
              367.3025214564151,
              28.136213436723654,
              1.913880671464418,
              0.3829366947518991,
              323.85365704338597,
              3728.1472257487526,
              -10561.233882199509,
              -1625.2025997821418,
              -217.62525175416,
              -13.015432208941645,
              0.3033466836073424,
              1.66293922460509,
              -0.5822628872992417,
              40.35639251440489,
              188.20071124269245,
              -640.2706748618148,
              13519.21490106562,
              1927.6022433578062,
              362.8197642637487,
              26.968821921868447,
              1.7463817695935329,
              -5.62650678237171,
              269.3016715297017,
              3453.386536448852,
              -11016.145278780888,
              -1698.6569643425091,
              -234.7658734267683,
              -14.16351421663124,
              0.2504869601913055,
              1.76384252869671,
              -0.5887180101749253,
              39.23429103868072,
              155.76096234403798,
              -889.2492977967378,
              13475.470561874661,
              1955.0535223723712,
              356.4450994756727,
              25.894952980042156,
              1.5695032905781554,
              -11.181939564328772,
              214.80884394039484,
              3169.1640829158237,
              -11443.321309975563,
              -1765.1588461316153,
              -251.68908574481912,
              -15.49755935939164,
              0.198912367379658,
              1.847759065022573,
              -0.7912582233652842,
              37.39369355329111,
              119.699486012458,
              -1151.0956593239027,
              13380.446257078214,
              1970.3952110853447,
              348.01959814116185,
              24.731487364283044,
              1.3850130831637748,
              -16.421408865300393,
              161.05030052864092,
              2878.3322807850063,
              -11838.991423510031,
              -1823.985884688674,
              -268.2854986386903,
              -16.81724543849939,
              0.1483359875383474,
              1.913880671464418,
              -0.7960642926861912,
              35.2322109610459,
              80.01928065061526,
              -1424.0212633405113,
              13235.794061869668,
              1973.804052543835,
              337.9908651258184,
              23.289159354463873,
              1.3934255946442087,
              -21.099669467133474,
              108.48348407242611,
              2583.700758091299,
              -12199.726194855148,
              -1874.2780658979746,
              -284.2467154529415,
              -18.11369784385905,
              0.09849140335716425,
              1.961570560806461,
              -0.998795456205172,
              32.56307803611191,
              36.958364584370486,
              -1706.075448829146,
              13043.287458812016,
              1965.3831106103316,
              326.43182772364605,
              22.175018750622293,
              1.198638339011324,
              -25.371248002043963,
              57.53505923036915,
              2288.41886619975,
              -12522.674544337233,
              -1914.8400385312243,
              -299.26241273417224,
              -19.37805630698734,
              0.04912684976946725,
              1.990369453344394,
              (0.035780907 * a.SQRT2 * 0.5) / 2384e-9,
              (0.017876148 * a.SQRT2 * 0.5) / 2384e-9,
              (0.003134727 * a.SQRT2 * 0.5) / 2384e-9,
              (0.002457142 * a.SQRT2 * 0.5) / 2384e-9,
              (971317e-9 * a.SQRT2 * 0.5) / 2384e-9,
              (218868e-9 * a.SQRT2 * 0.5) / 2384e-9,
              (101566e-9 * a.SQRT2 * 0.5) / 2384e-9,
              (13828e-9 * a.SQRT2 * 0.5) / 2384e-9,
              12804.797818791945,
              1945.5515939597317,
              313.4244966442953,
              20.801593959731544,
              1995.1556208053692,
              9.000838926174497,
              -29.20218120805369,
            ],
            l = [
              [
                2382191739347913e-28, 6423305872147834e-28,
                9400849094049688e-28, 1122435026096556e-27,
                1183840321267481e-27, 1122435026096556e-27, 940084909404969e-27,
                6423305872147839e-28, 2382191739347918e-28,
                5456116108943412e-27, 4878985199565852e-27,
                4240448995017367e-27, 3559909094758252e-27,
                2858043359288075e-27, 2156177623817898e-27,
                1475637723558783e-27, 8371015190102974e-28,
                2599706096327376e-28, -5456116108943412e-27,
                -4878985199565852e-27, -4240448995017367e-27,
                -3559909094758252e-27, -2858043359288076e-27,
                -2156177623817898e-27, -1475637723558783e-27,
                -8371015190102975e-28, -2599706096327376e-28,
                -2382191739347923e-28, -6423305872147843e-28,
                -9400849094049696e-28, -1122435026096556e-27,
                -1183840321267481e-27, -1122435026096556e-27,
                -9400849094049694e-28, -642330587214784e-27,
                -2382191739347918e-28,
              ],
              [
                2382191739347913e-28, 6423305872147834e-28,
                9400849094049688e-28, 1122435026096556e-27,
                1183840321267481e-27, 1122435026096556e-27,
                9400849094049688e-28, 6423305872147841e-28,
                2382191739347918e-28, 5456116108943413e-27,
                4878985199565852e-27, 4240448995017367e-27,
                3559909094758253e-27, 2858043359288075e-27,
                2156177623817898e-27, 1475637723558782e-27,
                8371015190102975e-28, 2599706096327376e-28,
                -5461314069809755e-27, -4921085770524055e-27,
                -4343405037091838e-27, -3732668368707687e-27,
                -3093523840190885e-27, -2430835727329465e-27,
                -1734679010007751e-27, -974825365660928e-27,
                -2797435120168326e-28, 0, 0, 0, 0, 0, 0, -2283748241799531e-28,
                -4037858874020686e-28, -2146547464825323e-28,
              ],
              [
                0.1316524975873958, 0.414213562373095, 0.7673269879789602,
                1.091308501069271, 1.303225372841206, 1.56968557711749,
                1.920982126971166, 2.414213562373094, 3.171594802363212,
                4.510708503662055, 7.595754112725146, 22.90376554843115,
                0.984807753012208, 0.6427876096865394, 0.3420201433256688,
                0.9396926207859084, -0.1736481776669303, -0.7660444431189779,
                0.8660254037844387, 0.5, -0.5144957554275265,
                -0.4717319685649723, -0.3133774542039019, -0.1819131996109812,
                -0.09457419252642064, -0.04096558288530405,
                -0.01419856857247115, -0.003699974673760037, 0.8574929257125442,
                0.8817419973177052, 0.9496286491027329, 0.9833145924917901,
                0.9955178160675857, 0.9991605581781475, 0.999899195244447,
                0.9999931550702802,
              ],
              [
                0, 0, 0, 0, 0, 0, 2283748241799531e-28, 4037858874020686e-28,
                2146547464825323e-28, 5461314069809755e-27,
                4921085770524055e-27, 4343405037091838e-27,
                3732668368707687e-27, 3093523840190885e-27,
                2430835727329466e-27, 1734679010007751e-27, 974825365660928e-27,
                2797435120168326e-28, -5456116108943413e-27,
                -4878985199565852e-27, -4240448995017367e-27,
                -3559909094758253e-27, -2858043359288075e-27,
                -2156177623817898e-27, -1475637723558782e-27,
                -8371015190102975e-28, -2599706096327376e-28,
                -2382191739347913e-28, -6423305872147834e-28,
                -9400849094049688e-28, -1122435026096556e-27,
                -1183840321267481e-27, -1122435026096556e-27,
                -9400849094049688e-28, -6423305872147841e-28,
                -2382191739347918e-28,
              ],
            ],
            o = l[i.SHORT_TYPE],
            _ = l[i.SHORT_TYPE],
            c = l[i.SHORT_TYPE],
            u = l[i.SHORT_TYPE],
            f = [
              0, 1, 16, 17, 8, 9, 24, 25, 4, 5, 20, 21, 12, 13, 28, 29, 2, 3,
              18, 19, 10, 11, 26, 27, 6, 7, 22, 23, 14, 15, 30, 31,
            ];
          function h(t, s, r) {
            for (
              var i, l, o, _ = 10, c = s + 238 - 14 - 286, u = -15;
              u < 0;
              u++
            ) {
              var f, h, p;
              ((f = e[_ + -10]),
                (h = t[c + -224] * f),
                (p = t[s + 224] * f),
                (f = e[_ + -9]),
                (h += t[c + -160] * f),
                (p += t[s + 160] * f),
                (f = e[_ + -8]),
                (h += t[c + -96] * f),
                (p += t[s + 96] * f),
                (f = e[_ + -7]),
                (h += t[c + -32] * f),
                (p += t[s + 32] * f),
                (f = e[_ + -6]),
                (h += t[c + 32] * f),
                (p += t[s + -32] * f),
                (f = e[_ + -5]),
                (h += t[c + 96] * f),
                (p += t[s + -96] * f),
                (f = e[_ + -4]),
                (h += t[c + 160] * f),
                (p += t[s + -160] * f),
                (f = e[_ + -3]),
                (h += t[c + 224] * f),
                (p += t[s + -224] * f),
                (f = e[_ + -2]),
                (h += t[s + -256] * f),
                (p -= t[c + 256] * f),
                (f = e[_ + -1]),
                (h += t[s + -192] * f),
                (p -= t[c + 192] * f),
                (f = e[_ + 0]),
                (h += t[s + -128] * f),
                (p -= t[c + 128] * f),
                (f = e[_ + 1]),
                (h += t[s + -64] * f),
                (p -= t[c + 64] * f),
                (f = e[_ + 2]),
                (h += t[s + 0] * f),
                (p -= t[c + 0] * f),
                (f = e[_ + 3]),
                (h += t[s + 64] * f),
                (p -= t[c + -64] * f),
                (f = e[_ + 4]),
                (h += t[s + 128] * f),
                (p -= t[c + -128] * f),
                (f = e[_ + 5]),
                (h += t[s + 192] * f),
                (f = (p -= t[c + -192] * f) - (h *= e[_ + 6])),
                (r[30 + 2 * u] = p + h),
                (r[31 + 2 * u] = e[_ + 7] * f),
                (_ += 18),
                s--,
                c++);
            }
            ((p = t[s + -16] * e[_ + -10]),
              (h = t[s + -32] * e[_ + -2]),
              (p += (t[s + -48] - t[s + 16]) * e[_ + -9]),
              (h += t[s + -96] * e[_ + -1]),
              (p += (t[s + -80] + t[s + 48]) * e[_ + -8]),
              (h += t[s + -160] * e[_ + 0]),
              (p += (t[s + -112] - t[s + 80]) * e[_ + -7]),
              (h += t[s + -224] * e[_ + 1]),
              (p += (t[s + -144] + t[s + 112]) * e[_ + -6]),
              (h -= t[s + 32] * e[_ + 2]),
              (p += (t[s + -176] - t[s + 144]) * e[_ + -5]),
              (h -= t[s + 96] * e[_ + 3]),
              (p += (t[s + -208] + t[s + 176]) * e[_ + -4]),
              (h -= t[s + 160] * e[_ + 4]),
              (p += (t[s + -240] - t[s + 208]) * e[_ + -3]),
              (i = (h -= t[s + 224]) - p),
              (l = h + p),
              (p = r[14]),
              (h = r[15] - p),
              (r[31] = l + p),
              (r[30] = i + h),
              (r[15] = i - h),
              (r[14] = l - p),
              (o = r[28] - r[0]),
              (r[0] += r[28]),
              (r[28] = o * e[_ + -36 + 7]),
              (o = r[29] - r[1]),
              (r[1] += r[29]),
              (r[29] = o * e[_ + -36 + 7]),
              (o = r[26] - r[2]),
              (r[2] += r[26]),
              (r[26] = o * e[_ + -72 + 7]),
              (o = r[27] - r[3]),
              (r[3] += r[27]),
              (r[27] = o * e[_ + -72 + 7]),
              (o = r[24] - r[4]),
              (r[4] += r[24]),
              (r[24] = o * e[_ + -108 + 7]),
              (o = r[25] - r[5]),
              (r[5] += r[25]),
              (r[25] = o * e[_ + -108 + 7]),
              (o = r[22] - r[6]),
              (r[6] += r[22]),
              (r[22] = o * a.SQRT2),
              (o = r[23] - r[7]),
              (r[7] += r[23]),
              (r[23] = o * a.SQRT2 - r[7]),
              (r[7] -= r[6]),
              (r[22] -= r[7]),
              (r[23] -= r[22]),
              (o = r[6]),
              (r[6] = r[31] - o),
              (r[31] = r[31] + o),
              (o = r[7]),
              (r[7] = r[30] - o),
              (r[30] = r[30] + o),
              (o = r[22]),
              (r[22] = r[15] - o),
              (r[15] = r[15] + o),
              (o = r[23]),
              (r[23] = r[14] - o),
              (r[14] = r[14] + o),
              (o = r[20] - r[8]),
              (r[8] += r[20]),
              (r[20] = o * e[_ + -180 + 7]),
              (o = r[21] - r[9]),
              (r[9] += r[21]),
              (r[21] = o * e[_ + -180 + 7]),
              (o = r[18] - r[10]),
              (r[10] += r[18]),
              (r[18] = o * e[_ + -216 + 7]),
              (o = r[19] - r[11]),
              (r[11] += r[19]),
              (r[19] = o * e[_ + -216 + 7]),
              (o = r[16] - r[12]),
              (r[12] += r[16]),
              (r[16] = o * e[_ + -252 + 7]),
              (o = r[17] - r[13]),
              (r[13] += r[17]),
              (r[17] = o * e[_ + -252 + 7]),
              (o = -r[20] + r[24]),
              (r[20] += r[24]),
              (r[24] = o * e[_ + -216 + 7]),
              (o = -r[21] + r[25]),
              (r[21] += r[25]),
              (r[25] = o * e[_ + -216 + 7]),
              (o = r[4] - r[8]),
              (r[4] += r[8]),
              (r[8] = o * e[_ + -216 + 7]),
              (o = r[5] - r[9]),
              (r[5] += r[9]),
              (r[9] = o * e[_ + -216 + 7]),
              (o = r[0] - r[12]),
              (r[0] += r[12]),
              (r[12] = o * e[_ + -72 + 7]),
              (o = r[1] - r[13]),
              (r[1] += r[13]),
              (r[13] = o * e[_ + -72 + 7]),
              (o = r[16] - r[28]),
              (r[16] += r[28]),
              (r[28] = o * e[_ + -72 + 7]),
              (o = -r[17] + r[29]),
              (r[17] += r[29]),
              (r[29] = o * e[_ + -72 + 7]),
              (o = a.SQRT2 * (r[2] - r[10])),
              (r[2] += r[10]),
              (r[10] = o),
              (o = a.SQRT2 * (r[3] - r[11])),
              (r[3] += r[11]),
              (r[11] = o),
              (o = a.SQRT2 * (-r[18] + r[26])),
              (r[18] += r[26]),
              (r[26] = o - r[18]),
              (o = a.SQRT2 * (-r[19] + r[27])),
              (r[19] += r[27]),
              (r[27] = o - r[19]),
              (o = r[2]),
              (r[19] -= r[3]),
              (r[3] -= o),
              (r[2] = r[31] - o),
              (r[31] += o),
              (o = r[3]),
              (r[11] -= r[19]),
              (r[18] -= o),
              (r[3] = r[30] - o),
              (r[30] += o),
              (o = r[18]),
              (r[27] -= r[11]),
              (r[19] -= o),
              (r[18] = r[15] - o),
              (r[15] += o),
              (o = r[19]),
              (r[10] -= o),
              (r[19] = r[14] - o),
              (r[14] += o),
              (o = r[10]),
              (r[11] -= o),
              (r[10] = r[23] - o),
              (r[23] += o),
              (o = r[11]),
              (r[26] -= o),
              (r[11] = r[22] - o),
              (r[22] += o),
              (o = r[26]),
              (r[27] -= o),
              (r[26] = r[7] - o),
              (r[7] += o),
              (o = r[27]),
              (r[27] = r[6] - o),
              (r[6] += o),
              (o = a.SQRT2 * (r[0] - r[4])),
              (r[0] += r[4]),
              (r[4] = o),
              (o = a.SQRT2 * (r[1] - r[5])),
              (r[1] += r[5]),
              (r[5] = o),
              (o = a.SQRT2 * (r[16] - r[20])),
              (r[16] += r[20]),
              (r[20] = o),
              (o = a.SQRT2 * (r[17] - r[21])),
              (r[17] += r[21]),
              (r[21] = o),
              (o = -a.SQRT2 * (r[8] - r[12])),
              (r[8] += r[12]),
              (r[12] = o - r[8]),
              (o = -a.SQRT2 * (r[9] - r[13])),
              (r[9] += r[13]),
              (r[13] = o - r[9]),
              (o = -a.SQRT2 * (r[25] - r[29])),
              (r[25] += r[29]),
              (r[29] = o - r[25]),
              (o = -a.SQRT2 * (r[24] + r[28])),
              (r[24] -= r[28]),
              (r[28] = o - r[24]),
              (o = r[24] - r[16]),
              (r[24] = o),
              (o = r[20] - o),
              (r[20] = o),
              (o = r[28] - o),
              (r[28] = o),
              (o = r[25] - r[17]),
              (r[25] = o),
              (o = r[21] - o),
              (r[21] = o),
              (o = r[29] - o),
              (r[29] = o),
              (o = r[17] - r[1]),
              (r[17] = o),
              (o = r[9] - o),
              (r[9] = o),
              (o = r[25] - o),
              (r[25] = o),
              (o = r[5] - o),
              (r[5] = o),
              (o = r[21] - o),
              (r[21] = o),
              (o = r[13] - o),
              (r[13] = o),
              (o = r[29] - o),
              (r[29] = o),
              (o = r[1] - r[0]),
              (r[1] = o),
              (o = r[16] - o),
              (r[16] = o),
              (o = r[17] - o),
              (r[17] = o),
              (o = r[8] - o),
              (r[8] = o),
              (o = r[9] - o),
              (r[9] = o),
              (o = r[24] - o),
              (r[24] = o),
              (o = r[25] - o),
              (r[25] = o),
              (o = r[4] - o),
              (r[4] = o),
              (o = r[5] - o),
              (r[5] = o),
              (o = r[20] - o),
              (r[20] = o),
              (o = r[21] - o),
              (r[21] = o),
              (o = r[12] - o),
              (r[12] = o),
              (o = r[13] - o),
              (r[13] = o),
              (o = r[28] - o),
              (r[28] = o),
              (o = r[29] - o),
              (r[29] = o),
              (o = r[0]),
              (r[0] += r[31]),
              (r[31] -= o),
              (o = r[1]),
              (r[1] += r[30]),
              (r[30] -= o),
              (o = r[16]),
              (r[16] += r[15]),
              (r[15] -= o),
              (o = r[17]),
              (r[17] += r[14]),
              (r[14] -= o),
              (o = r[8]),
              (r[8] += r[23]),
              (r[23] -= o),
              (o = r[9]),
              (r[9] += r[22]),
              (r[22] -= o),
              (o = r[24]),
              (r[24] += r[7]),
              (r[7] -= o),
              (o = r[25]),
              (r[25] += r[6]),
              (r[6] -= o),
              (o = r[4]),
              (r[4] += r[27]),
              (r[27] -= o),
              (o = r[5]),
              (r[5] += r[26]),
              (r[26] -= o),
              (o = r[20]),
              (r[20] += r[11]),
              (r[11] -= o),
              (o = r[21]),
              (r[21] += r[10]),
              (r[10] -= o),
              (o = r[12]),
              (r[12] += r[19]),
              (r[19] -= o),
              (o = r[13]),
              (r[13] += r[18]),
              (r[18] -= o),
              (o = r[28]),
              (r[28] += r[3]),
              (r[3] -= o),
              (o = r[29]),
              (r[29] += r[2]),
              (r[2] -= o));
          }
          function p(e, t) {
            for (var a = 0; a < 3; a++) {
              var s, r, o, _, c, u;
              ((r =
                (_ = e[t + 6] * l[i.SHORT_TYPE][0] - e[t + 15]) +
                (s = e[t + 0] * l[i.SHORT_TYPE][2] - e[t + 9])),
                (o = _ - s),
                (c =
                  (_ = e[t + 15] * l[i.SHORT_TYPE][0] + e[t + 6]) +
                  (s = e[t + 9] * l[i.SHORT_TYPE][2] + e[t + 0])),
                (u = -_ + s),
                (s =
                  2069978111953089e-26 *
                  (e[t + 3] * l[i.SHORT_TYPE][1] - e[t + 12])),
                (_ =
                  2069978111953089e-26 *
                  (e[t + 12] * l[i.SHORT_TYPE][1] + e[t + 3])),
                (e[t + 0] = 190752519173728e-25 * r + s),
                (e[t + 15] = 190752519173728e-25 * -c + _),
                (o = 0.8660254037844387 * o * 1907525191737281e-26),
                (c = 0.5 * c * 1907525191737281e-26 + _),
                (e[t + 3] = o - c),
                (e[t + 6] = o + c),
                (r = 0.5 * r * 1907525191737281e-26 - s),
                (u = 0.8660254037844387 * u * 1907525191737281e-26),
                (e[t + 9] = r + u),
                (e[t + 12] = r - u),
                t++);
            }
          }
          function b(e, t, a) {
            var s, r, i, l, o, c, u, f, h, p, b, d, m, g, v, w, y, k;
            ((i = a[17] - a[9]),
              (o = a[15] - a[11]),
              (c = a[14] - a[12]),
              (u = a[0] + a[8]),
              (f = a[1] + a[7]),
              (h = a[2] + a[6]),
              (p = a[3] + a[5]),
              (e[t + 17] = u + h - p - (f - a[4])),
              (r = (u + h - p) * _[19] + (f - a[4])),
              (s = (i - o - c) * _[18]),
              (e[t + 5] = s + r),
              (e[t + 6] = s - r),
              (l = (a[16] - a[10]) * _[18]),
              (f = f * _[19] + a[4]),
              (s = i * _[12] + l + o * _[13] + c * _[14]),
              (r = -u * _[16] + f - h * _[17] + p * _[15]),
              (e[t + 1] = s + r),
              (e[t + 2] = s - r),
              (s = i * _[13] - l - o * _[14] + c * _[12]),
              (r = -u * _[17] + f - h * _[15] + p * _[16]),
              (e[t + 9] = s + r),
              (e[t + 10] = s - r),
              (s = i * _[14] - l + o * _[12] - c * _[13]),
              (r = u * _[15] - f + h * _[16] - p * _[17]),
              (e[t + 13] = s + r),
              (e[t + 14] = s - r),
              (b = a[8] - a[0]),
              (m = a[6] - a[2]),
              (g = a[5] - a[3]),
              (v = a[17] + a[9]),
              (w = a[16] + a[10]),
              (y = a[15] + a[11]),
              (k = a[14] + a[12]),
              (e[t + 0] = v + y + k + (w + a[13])),
              (s = (v + y + k) * _[19] - (w + a[13])),
              (r = (b - m + g) * _[18]),
              (e[t + 11] = s + r),
              (e[t + 12] = s - r),
              (d = (a[7] - a[1]) * _[18]),
              (w = a[13] - w * _[19]),
              (s = v * _[15] - w + y * _[16] + k * _[17]),
              (r = b * _[14] + d + m * _[12] + g * _[13]),
              (e[t + 3] = s + r),
              (e[t + 4] = s - r),
              (s = -v * _[17] + w - y * _[15] - k * _[16]),
              (r = b * _[13] + d - m * _[14] - g * _[12]),
              (e[t + 7] = s + r),
              (e[t + 8] = s - r),
              (s = -v * _[16] + w - y * _[17] - k * _[15]),
              (r = b * _[12] - d + m * _[13] - g * _[14]),
              (e[t + 15] = s + r),
              (e[t + 16] = s - r));
          }
          this.mdct_sub48 = function (e, a, _) {
            for (var d = a, m = 286, g = 0; g < e.channels_out; g++) {
              for (var v = 0; v < e.mode_gr; v++) {
                for (
                  var w,
                    y = e.l3_side.tt[v][g],
                    k = y.xr,
                    S = 0,
                    R = e.sb_sample[g][1 - v],
                    x = 0,
                    A = 0;
                  A < 9;
                  A++
                )
                  for (
                    h(d, m, R[x]),
                      h(d, m + 32, R[x + 1]),
                      x += 2,
                      m += 64,
                      w = 1;
                    w < 32;
                    w += 2
                  )
                    R[x - 1][w] *= -1;
                for (w = 0; w < 32; w++, S += 18) {
                  var type = y.block_type,
                    M = e.sb_sample[g][v],
                    T = e.sb_sample[g][1 - v];
                  if (
                    (0 != y.mixed_block_flag && w < 2 && (type = 0),
                    e.amp_filter[w] < 1e-12)
                  )
                    s.fill(k, S + 0, S + 18, 0);
                  else {
                    if (e.amp_filter[w] < 1)
                      for (A = 0; A < 18; A++) T[A][f[w]] *= e.amp_filter[w];
                    if (type == i.SHORT_TYPE) {
                      for (A = -3; A < 0; A++) {
                        var B = l[i.SHORT_TYPE][A + 3];
                        ((k[S + 3 * A + 9] =
                          M[9 + A][f[w]] * B - M[8 - A][f[w]]),
                          (k[S + 3 * A + 18] =
                            M[14 - A][f[w]] * B + M[15 + A][f[w]]),
                          (k[S + 3 * A + 10] =
                            M[15 + A][f[w]] * B - M[14 - A][f[w]]),
                          (k[S + 3 * A + 19] =
                            T[2 - A][f[w]] * B + T[3 + A][f[w]]),
                          (k[S + 3 * A + 11] =
                            T[3 + A][f[w]] * B - T[2 - A][f[w]]),
                          (k[S + 3 * A + 20] =
                            T[8 - A][f[w]] * B + T[9 + A][f[w]]));
                      }
                      p(k, S);
                    } else {
                      var E = r(18);
                      for (A = -9; A < 0; A++) {
                        var P, L;
                        ((P =
                          l[type][A + 27] * T[A + 9][f[w]] +
                          l[type][A + 36] * T[8 - A][f[w]]),
                          (L =
                            l[type][A + 9] * M[A + 9][f[w]] -
                            l[type][A + 18] * M[8 - A][f[w]]),
                          (E[A + 9] = P - L * o[3 + A + 9]),
                          (E[A + 18] = P * o[3 + A + 9] + L));
                      }
                      b(k, S, E);
                    }
                  }
                  if (type != i.SHORT_TYPE && 0 != w)
                    for (A = 7; A >= 0; --A) {
                      var I, O;
                      ((I = k[S + A] * c[20 + A] + k[S + -1 - A] * u[28 + A]),
                        (O = k[S + A] * u[28 + A] - k[S + -1 - A] * c[20 + A]),
                        (k[S + -1 - A] = I),
                        (k[S + A] = O));
                    }
                }
              }
              if (((d = _), (m = 286), 1 == e.mode_gr))
                for (var D = 0; D < 18; D++)
                  t.arraycopy(
                    e.sb_sample[g][1][D],
                    0,
                    e.sb_sample[g][0][D],
                    0,
                    32,
                  );
            }
          };
        });
      })(),
      c = (function () {
        if (ct) return _t;
        ct = 1;
        var e = yn();
        return (_t = function () {
          ((this.thm = new e()), (this.en = new e()));
        });
      })(),
      u = _.FFTOFFSET,
      f = _.MPG_MD_MS_LR,
      h = null;
    this.psy = null;
    var p = null,
      b = null,
      d = null;
    this.setModules = function (e, t, a, s) {
      ((h = e), (this.psy = t), (p = t), (b = s), (d = a));
    };
    var m = new e();
    this.lame_encode_mp3_frame = function (e, g, v, w, y, k) {
      var S,
        R = s([2, 2]);
      ((R[0][0] = new c()),
        (R[0][1] = new c()),
        (R[1][0] = new c()),
        (R[1][1] = new c()));
      var x,
        A = s([2, 2]);
      ((A[0][0] = new c()),
        (A[0][1] = new c()),
        (A[1][0] = new c()),
        (A[1][1] = new c()));
      var M,
        T,
        B,
        E = [null, null],
        P = e.internal_flags,
        L = i([2, 4]),
        I = [0.5, 0.5],
        O = [
          [0, 0],
          [0, 0],
        ],
        D = [
          [0, 0],
          [0, 0],
        ];
      if (
        ((E[0] = g),
        (E[1] = v),
        0 == P.lame_encode_frame_init &&
          (function (e, t) {
            var a,
              s,
              i = e.internal_flags;
            if (0 == i.lame_encode_frame_init) {
              var l,
                c,
                u = r(2014),
                f = r(2014);
              for (
                i.lame_encode_frame_init = 1, l = 0, c = 0;
                l < 286 + 576 * (1 + i.mode_gr);
                ++l
              )
                l < 576 * i.mode_gr
                  ? ((u[l] = 0), 2 == i.channels_out && (f[l] = 0))
                  : ((u[l] = t[0][c]),
                    2 == i.channels_out && (f[l] = t[1][c]),
                    ++c);
              for (s = 0; s < i.mode_gr; s++)
                for (a = 0; a < i.channels_out; a++)
                  i.l3_side.tt[s][a].block_type = _.SHORT_TYPE;
              (m.mdct_sub48(i, u, f),
                o(576 >= _.FFTOFFSET),
                o(i.mf_size >= _.BLKSIZE + e.framesize - _.FFTOFFSET),
                o(i.mf_size >= 512 + e.framesize - 32));
            }
          })(e, E),
        (P.padding = 0),
        (P.slot_lag -= P.frac_SpF) < 0 &&
          ((P.slot_lag += e.out_samplerate), (P.padding = 1)),
        0 != P.psymodel)
      ) {
        var N = [null, null],
          V = 0,
          H = l(2);
        for (B = 0; B < P.mode_gr; B++) {
          for (T = 0; T < P.channels_out; T++)
            ((N[T] = E[T]), (V = 576 + 576 * B - _.FFTOFFSET));
          if (
            0 !=
            (e.VBR == a.vbr_mtrh || e.VBR == a.vbr_mt
              ? p.L3psycho_anal_vbr(e, N, V, B, R, A, O[B], D[B], L[B], H)
              : p.L3psycho_anal_ns(e, N, V, B, R, A, O[B], D[B], L[B], H))
          )
            return -4;
          for (
            e.mode == MPEGMode.JOINT_STEREO &&
              ((I[B] = L[B][2] + L[B][3]), I[B] > 0 && (I[B] = L[B][3] / I[B])),
              T = 0;
            T < P.channels_out;
            T++
          ) {
            var C = P.l3_side.tt[B][T];
            ((C.block_type = H[T]), (C.mixed_block_flag = 0));
          }
        }
      } else
        for (B = 0; B < P.mode_gr; B++)
          for (T = 0; T < P.channels_out; T++)
            ((P.l3_side.tt[B][T].block_type = _.NORM_TYPE),
              (P.l3_side.tt[B][T].mixed_block_flag = 0),
              (D[B][T] = O[B][T] = 700));
      if (
        ((function (e) {
          var t, a;
          if (0 != e.ATH.useAdjust)
            if (
              ((a = e.loudness_sq[0][0]),
              (t = e.loudness_sq[1][0]),
              2 == e.channels_out
                ? ((a += e.loudness_sq[0][1]), (t += e.loudness_sq[1][1]))
                : ((a += a), (t += t)),
              2 == e.mode_gr && (a = Math.max(a, t)),
              (a *= 0.5),
              (a *= e.ATH.aaSensitivityP) > 0.03125)
            )
              (e.ATH.adjust >= 1
                ? (e.ATH.adjust = 1)
                : e.ATH.adjust < e.ATH.adjustLimit &&
                  (e.ATH.adjust = e.ATH.adjustLimit),
                (e.ATH.adjustLimit = 1));
            else {
              var s = 31.98 * a + 625e-6;
              (e.ATH.adjust >= s
                ? ((e.ATH.adjust *= 0.075 * s + 0.925),
                  e.ATH.adjust < s && (e.ATH.adjust = s))
                : e.ATH.adjustLimit >= s
                  ? (e.ATH.adjust = s)
                  : e.ATH.adjust < e.ATH.adjustLimit &&
                    (e.ATH.adjust = e.ATH.adjustLimit),
                (e.ATH.adjustLimit = s));
            }
          else e.ATH.adjust = 1;
        })(P),
        m.mdct_sub48(P, E[0], E[1]),
        (P.mode_ext = _.MPG_MD_LR_LR),
        e.force_ms)
      )
        P.mode_ext = _.MPG_MD_MS_LR;
      else if (e.mode == MPEGMode.JOINT_STEREO) {
        var z = 0,
          F = 0;
        for (B = 0; B < P.mode_gr; B++)
          for (T = 0; T < P.channels_out; T++) ((z += D[B][T]), (F += O[B][T]));
        if (z <= 1 * F) {
          var X = P.l3_side.tt[0],
            q = P.l3_side.tt[P.mode_gr - 1];
          X[0].block_type == X[1].block_type &&
            q[0].block_type == q[1].block_type &&
            (P.mode_ext = _.MPG_MD_MS_LR);
        }
      }
      if (
        (P.mode_ext == f ? ((x = A), (M = D)) : ((x = R), (M = O)),
        e.analysis && null != P.pinfo)
      )
        for (B = 0; B < P.mode_gr; B++)
          for (T = 0; T < P.channels_out; T++)
            ((P.pinfo.ms_ratio[B] = P.ms_ratio[B]),
              (P.pinfo.ms_ener_ratio[B] = I[B]),
              (P.pinfo.blocktype[B][T] = P.l3_side.tt[B][T].block_type),
              (P.pinfo.pe[B][T] = M[B][T]),
              t.arraycopy(P.l3_side.tt[B][T].xr, 0, P.pinfo.xr[B][T], 0, 576),
              P.mode_ext == f &&
                ((P.pinfo.ers[B][T] = P.pinfo.ers[B][T + 2]),
                t.arraycopy(
                  P.pinfo.energy[B][T + 2],
                  0,
                  P.pinfo.energy[B][T],
                  0,
                  P.pinfo.energy[B][T].length,
                )));
      if (e.VBR == a.vbr_off || e.VBR == a.vbr_abr) {
        var U, Y;
        for (U = 0; U < 18; U++) P.nsPsy.pefirbuf[U] = P.nsPsy.pefirbuf[U + 1];
        for (Y = 0, B = 0; B < P.mode_gr; B++)
          for (T = 0; T < P.channels_out; T++) Y += M[B][T];
        for (
          P.nsPsy.pefirbuf[18] = Y, Y = P.nsPsy.pefirbuf[9], U = 0;
          U < 9;
          U++
        )
          Y += (P.nsPsy.pefirbuf[U] + P.nsPsy.pefirbuf[18 - U]) * _.fircoef[U];
        for (
          Y = (3350 * P.mode_gr * P.channels_out) / Y, B = 0;
          B < P.mode_gr;
          B++
        )
          for (T = 0; T < P.channels_out; T++) M[B][T] *= Y;
      }
      if (
        (P.iteration_loop.iteration_loop(e, M, I, x),
        h.format_bitstream(e),
        (S = h.copy_buffer(P, w, y, k, 1)),
        e.bWriteVbrTag && b.addVbrFrame(e),
        e.analysis && null != P.pinfo)
      ) {
        for (T = 0; T < P.channels_out; T++) {
          var j;
          for (j = 0; j < u; j++)
            P.pinfo.pcmdata[T][j] = P.pinfo.pcmdata[T][j + e.framesize];
          for (j = u; j < 1600; j++) P.pinfo.pcmdata[T][j] = E[T][j - u];
        }
        d.set_frame_pinfo(e, x);
      }
      return (
        (function (e) {
          var t, a;
          for (
            o(0 <= e.bitrate_index && e.bitrate_index < 16),
              o(0 <= e.mode_ext && e.mode_ext < 4),
              e.bitrate_stereoMode_Hist[e.bitrate_index][4]++,
              e.bitrate_stereoMode_Hist[15][4]++,
              2 == e.channels_out &&
                (e.bitrate_stereoMode_Hist[e.bitrate_index][e.mode_ext]++,
                e.bitrate_stereoMode_Hist[15][e.mode_ext]++),
              t = 0;
            t < e.mode_gr;
            ++t
          )
            for (a = 0; a < e.channels_out; ++a) {
              var s = 0 | e.l3_side.tt[t][a].block_type;
              (0 != e.l3_side.tt[t][a].mixed_block_flag && (s = 4),
                e.bitrate_blockType_Hist[e.bitrate_index][s]++,
                e.bitrate_blockType_Hist[e.bitrate_index][5]++,
                e.bitrate_blockType_Hist[15][s]++,
                e.bitrate_blockType_Hist[15][5]++);
            }
        })(P),
        S
      );
    };
  }
  return (
    (_.ENCDELAY = 576),
    (_.POSTDELAY = 1152),
    (_.MDCTDELAY = 48),
    (_.FFTOFFSET = 224 + _.MDCTDELAY),
    (_.DECDELAY = 528),
    (_.SBLIMIT = 32),
    (_.CBANDS = 64),
    (_.SBPSY_l = 21),
    (_.SBPSY_s = 12),
    (_.SBMAX_l = 22),
    (_.SBMAX_s = 13),
    (_.PSFB21 = 6),
    (_.PSFB12 = 6),
    (_.BLKSIZE = 1024),
    (_.HBLKSIZE = _.BLKSIZE / 2 + 1),
    (_.BLKSIZE_s = 256),
    (_.HBLKSIZE_s = _.BLKSIZE_s / 2 + 1),
    (_.NORM_TYPE = 0),
    (_.START_TYPE = 1),
    (_.SHORT_TYPE = 2),
    (_.STOP_TYPE = 3),
    (_.MPG_MD_LR_LR = 0),
    (_.MPG_MD_LR_I = 1),
    (_.MPG_MD_MS_LR = 2),
    (_.MPG_MD_MS_I = 3),
    (_.fircoef = [
      -0.1039435,
      -0.1892065,
      5 * -0.0432472,
      -0.155915,
      3898045e-23,
      0.0467745 * 5,
      0.50455,
      0.756825,
      0.187098 * 5,
    ]),
    (ut = _)
  );
}
function Sn() {
  if (dt) return bt;
  dt = 1;
  var e = wn();
  e.System;
  var t = e.VbrMode,
    a = e.Float,
    s = e.ShortBlock,
    r = e.Util,
    i = e.Arrays;
  (e.new_array_n, e.new_byte, e.new_double);
  var l = e.new_float,
    o = e.new_float_n,
    _ = e.new_int;
  e.new_int_n;
  var c = e.assert,
    u = (function () {
      if (pt) return ht;
      pt = 1;
      var e = wn();
      (e.System, e.VbrMode, e.Float, e.ShortBlock);
      var t = e.Util;
      (e.Arrays, e.new_array_n, e.new_byte, e.new_double);
      var a = e.new_float;
      (e.new_float_n, e.new_int, e.new_int_n, e.assert);
      var s = kn();
      return (ht = function () {
        var e = a(s.BLKSIZE),
          r = a(s.BLKSIZE_s / 2),
          i = [
            0.9238795325112867, 0.3826834323650898, 0.9951847266721969,
            0.0980171403295606, 0.9996988186962042, 0.02454122852291229,
            0.9999811752826011, 0.006135884649154475,
          ];
        function l(e, a, n) {
          var s,
            r,
            l,
            o = 0,
            _ = a + (n <<= 1);
          s = 4;
          do {
            var c, u, f, h, p, b, d;
            ((d = s >> 1),
              (b = (p = s << 1) + (h = s)),
              (s = p << 1),
              (l = (r = a) + d));
            do {
              ((S = e[r + 0] - e[r + h]),
                (k = e[r + 0] + e[r + h]),
                (M = e[r + p] - e[r + b]),
                (x = e[r + p] + e[r + b]),
                (e[r + p] = k - x),
                (e[r + 0] = k + x),
                (e[r + b] = S - M),
                (e[r + h] = S + M),
                (S = e[l + 0] - e[l + h]),
                (k = e[l + 0] + e[l + h]),
                (M = t.SQRT2 * e[l + b]),
                (x = t.SQRT2 * e[l + p]),
                (e[l + p] = k - x),
                (e[l + 0] = k + x),
                (e[l + b] = S - M),
                (e[l + h] = S + M),
                (l += s),
                (r += s));
            } while (r < _);
            for (u = i[o + 0], c = i[o + 1], f = 1; f < d; f++) {
              var m, g;
              ((m = 1 - 2 * c * c),
                (g = 2 * c * u),
                (r = a + f),
                (l = a + h - f));
              do {
                var v, w, y, k, S, R, x, A, M, T;
                ((w = g * e[r + h] - m * e[l + h]),
                  (v = m * e[r + h] + g * e[l + h]),
                  (S = e[r + 0] - v),
                  (k = e[r + 0] + v),
                  (R = e[l + 0] - w),
                  (y = e[l + 0] + w),
                  (w = g * e[r + b] - m * e[l + b]),
                  (v = m * e[r + b] + g * e[l + b]),
                  (M = e[r + p] - v),
                  (x = e[r + p] + v),
                  (T = e[l + p] - w),
                  (A = e[l + p] + w),
                  (w = c * x - u * T),
                  (v = u * x + c * T),
                  (e[r + p] = k - v),
                  (e[r + 0] = k + v),
                  (e[l + b] = R - w),
                  (e[l + h] = R + w),
                  (w = u * A - c * M),
                  (v = c * A + u * M),
                  (e[l + p] = y - v),
                  (e[l + 0] = y + v),
                  (e[r + b] = S - w),
                  (e[r + h] = S + w),
                  (l += s),
                  (r += s));
              } while (r < _);
              ((u = (m = u) * i[o + 0] - c * i[o + 1]),
                (c = m * i[o + 1] + c * i[o + 0]));
            }
            o += 2;
          } while (s < n);
        }
        var o = [
          0, 128, 64, 192, 32, 160, 96, 224, 16, 144, 80, 208, 48, 176, 112,
          240, 8, 136, 72, 200, 40, 168, 104, 232, 24, 152, 88, 216, 56, 184,
          120, 248, 4, 132, 68, 196, 36, 164, 100, 228, 20, 148, 84, 212, 52,
          180, 116, 244, 12, 140, 76, 204, 44, 172, 108, 236, 28, 156, 92, 220,
          60, 188, 124, 252, 2, 130, 66, 194, 34, 162, 98, 226, 18, 146, 82,
          210, 50, 178, 114, 242, 10, 138, 74, 202, 42, 170, 106, 234, 26, 154,
          90, 218, 58, 186, 122, 250, 6, 134, 70, 198, 38, 166, 102, 230, 22,
          150, 86, 214, 54, 182, 118, 246, 14, 142, 78, 206, 46, 174, 110, 238,
          30, 158, 94, 222, 62, 190, 126, 254,
        ];
        ((this.fft_short = function (e, t, a, i, _) {
          for (var c = 0; c < 3; c++) {
            var u = s.BLKSIZE_s / 2,
              f = 65535 & (192 * (c + 1)),
              h = s.BLKSIZE_s / 8 - 1;
            do {
              var p,
                b,
                d,
                m,
                g,
                v = 255 & o[h << 2];
              ((b =
                (p = r[v] * i[a][_ + v + f]) -
                (g = r[127 - v] * i[a][_ + v + f + 128])),
                (p += g),
                (m =
                  (d = r[v + 64] * i[a][_ + v + f + 64]) -
                  (g = r[63 - v] * i[a][_ + v + f + 192])),
                (d += g),
                (u -= 4),
                (t[c][u + 0] = p + d),
                (t[c][u + 2] = p - d),
                (t[c][u + 1] = b + m),
                (t[c][u + 3] = b - m),
                (b =
                  (p = r[v + 1] * i[a][_ + v + f + 1]) -
                  (g = r[126 - v] * i[a][_ + v + f + 129])),
                (p += g),
                (m =
                  (d = r[v + 65] * i[a][_ + v + f + 65]) -
                  (g = r[62 - v] * i[a][_ + v + f + 193])),
                (d += g),
                (t[c][u + s.BLKSIZE_s / 2 + 0] = p + d),
                (t[c][u + s.BLKSIZE_s / 2 + 2] = p - d),
                (t[c][u + s.BLKSIZE_s / 2 + 1] = b + m),
                (t[c][u + s.BLKSIZE_s / 2 + 3] = b - m));
            } while (--h >= 0);
            l(t[c], u, s.BLKSIZE_s / 2);
          }
        }),
          (this.fft_long = function (t, a, r, i, _) {
            var c = s.BLKSIZE / 8 - 1,
              u = s.BLKSIZE / 2;
            do {
              var f,
                h,
                p,
                b,
                d,
                m = 255 & o[c];
              ((h =
                (f = e[m] * i[r][_ + m]) -
                (d = e[m + 512] * i[r][_ + m + 512])),
                (f += d),
                (b =
                  (p = e[m + 256] * i[r][_ + m + 256]) -
                  (d = e[m + 768] * i[r][_ + m + 768])),
                (p += d),
                (a[0 + (u -= 4)] = f + p),
                (a[u + 2] = f - p),
                (a[u + 1] = h + b),
                (a[u + 3] = h - b),
                (h =
                  (f = e[m + 1] * i[r][_ + m + 1]) -
                  (d = e[m + 513] * i[r][_ + m + 513])),
                (f += d),
                (b =
                  (p = e[m + 257] * i[r][_ + m + 257]) -
                  (d = e[m + 769] * i[r][_ + m + 769])),
                (p += d),
                (a[u + s.BLKSIZE / 2 + 0] = f + p),
                (a[u + s.BLKSIZE / 2 + 2] = f - p),
                (a[u + s.BLKSIZE / 2 + 1] = h + b),
                (a[u + s.BLKSIZE / 2 + 3] = h - b));
            } while (--c >= 0);
            l(a, u, s.BLKSIZE / 2);
          }),
          (this.init_fft = function (t) {
            for (var a = 0; a < s.BLKSIZE; a++)
              e[a] =
                0.42 -
                0.5 * Math.cos((2 * Math.PI * (a + 0.5)) / s.BLKSIZE) +
                0.08 * Math.cos((4 * Math.PI * (a + 0.5)) / s.BLKSIZE);
            for (a = 0; a < s.BLKSIZE_s / 2; a++)
              r[a] =
                0.5 * (1 - Math.cos((2 * Math.PI * (a + 0.5)) / s.BLKSIZE_s));
          }));
      });
    })(),
    f = kn();
  return (bt = function () {
    var e = new u(),
      h = 2.302585092994046,
      p = 1 / 217621504 / (f.BLKSIZE / 2),
      b = 0.3,
      d = 21,
      m = 0.2302585093;
    function g(e) {
      return e;
    }
    function v(e, t) {
      for (var a = 0, s = 0; s < f.BLKSIZE / 2; ++s) a += e[s] * t.ATH.eql_w[s];
      return (a *= p);
    }
    function w(t, a, s, i, l, o, _, c, u, h, p) {
      var b = t.internal_flags;
      if (u < 2) (e.fft_long(b, i[l], u, h, p), e.fft_short(b, o[_], u, h, p));
      else if (2 == u) {
        for (var d = f.BLKSIZE - 1; d >= 0; --d) {
          var m = i[l + 0][d],
            w = i[l + 1][d];
          ((i[l + 0][d] = (m + w) * r.SQRT2 * 0.5),
            (i[l + 1][d] = (m - w) * r.SQRT2 * 0.5));
        }
        for (var y = 2; y >= 0; --y)
          for (d = f.BLKSIZE_s - 1; d >= 0; --d) {
            ((m = o[_ + 0][y][d]), (w = o[_ + 1][y][d]));
            ((o[_ + 0][y][d] = (m + w) * r.SQRT2 * 0.5),
              (o[_ + 1][y][d] = (m - w) * r.SQRT2 * 0.5));
          }
      }
      ((a[0] = i[l + 0][0]), (a[0] *= a[0]));
      for (d = f.BLKSIZE / 2 - 1; d >= 0; --d) {
        var k = i[l + 0][f.BLKSIZE / 2 - d],
          S = i[l + 0][f.BLKSIZE / 2 + d];
        a[f.BLKSIZE / 2 - d] = g(0.5 * (k * k + S * S));
      }
      for (y = 2; y >= 0; --y) {
        ((s[y][0] = o[_ + 0][y][0]), (s[y][0] *= s[y][0]));
        for (d = f.BLKSIZE_s / 2 - 1; d >= 0; --d) {
          ((k = o[_ + 0][y][f.BLKSIZE_s / 2 - d]),
            (S = o[_ + 0][y][f.BLKSIZE_s / 2 + d]));
          s[y][f.BLKSIZE_s / 2 - d] = g(0.5 * (k * k + S * S));
        }
      }
      var R = 0;
      for (d = 11; d < f.HBLKSIZE; d++) R += a[d];
      if (((b.tot_ener[u] = R), t.analysis)) {
        for (d = 0; d < f.HBLKSIZE; d++)
          ((b.pinfo.energy[c][u][d] = b.pinfo.energy_save[u][d]),
            (b.pinfo.energy_save[u][d] = a[d]));
        b.pinfo.pe[c][u] = b.pe[u];
      }
      2 == t.athaa_loudapprox &&
        u < 2 &&
        ((b.loudness_sq[c][u] = b.loudness_sq_save[u]),
        (b.loudness_sq_save[u] = v(a, b)));
    }
    var y,
      k,
      S,
      R = [
        1, 0.79433, 0.63096, 0.63096, 0.63096, 0.63096, 0.63096, 0.25119,
        0.11749,
      ],
      x = [
        3.3246 * 3.3246,
        3.23837 * 3.23837,
        9.9500500969,
        9.0247369744,
        8.1854926609,
        7.0440875649,
        2.46209 * 2.46209,
        2.284 * 2.284,
        4.4892710641,
        1.96552 * 1.96552,
        1.82335 * 1.82335,
        1.69146 * 1.69146,
        2.4621061921,
        2.1508568964,
        1.37074 * 1.37074,
        1.31036 * 1.31036,
        1.5691069696,
        1.4555939904,
        1.16203 * 1.16203,
        1.2715945225,
        1.09428 * 1.09428,
        1.0659 * 1.0659,
        1.0779838276,
        1.0382591025,
        1,
      ],
      A = [
        1.7782755904,
        1.35879 * 1.35879,
        1.38454 * 1.38454,
        1.39497 * 1.39497,
        1.40548 * 1.40548,
        1.3537 * 1.3537,
        1.6999465924,
        1.22321 * 1.22321,
        1.3169398564,
        1,
      ],
      M = [
        5.5396212496,
        2.29259 * 2.29259,
        4.9868695969,
        2.12675 * 2.12675,
        2.02545 * 2.02545,
        1.87894 * 1.87894,
        1.74303 * 1.74303,
        1.61695 * 1.61695,
        2.2499700001,
        1.39148 * 1.39148,
        1.29083 * 1.29083,
        1.19746 * 1.19746,
        1.2339655056,
        1.0779838276,
      ];
    function T(e, t, a, s, i, l) {
      var o;
      if (t > e) {
        if (!(t < e * k)) return e + t;
        o = t / e;
      } else {
        if (e >= t * k) return e + t;
        o = e / t;
      }
      if ((c(e >= 0), c(t >= 0), (e += t), s + 3 <= 6)) {
        if (o >= y) return e;
        var _ = 0 | r.FAST_LOG10_X(o, 16);
        return e * A[_];
      }
      var u, f;
      _ = 0 | r.FAST_LOG10_X(o, 16);
      return (
        (t = i.ATH.cb_l[a] * i.ATH.adjust),
        c(t >= 0),
        e < S * t
          ? e > t
            ? ((u = 1),
              _ <= 13 && (u = M[_]),
              (f = r.FAST_LOG10_X(e / t, 10 / 15)),
              e * ((x[_] - u) * f + u))
            : _ > 13
              ? e
              : e * M[_]
          : e * x[_]
      );
    }
    var B = [
      1.7782755904,
      1.35879 * 1.35879,
      1.38454 * 1.38454,
      1.39497 * 1.39497,
      1.40548 * 1.40548,
      1.3537 * 1.3537,
      1.6999465924,
      1.22321 * 1.22321,
      1.3169398564,
      1,
    ];
    function E(e, t, a) {
      var s;
      if ((e < 0 && (e = 0), t < 0 && (t = 0), e <= 0)) return t;
      if (t <= 0) return e;
      if (((s = t > e ? t / e : e / t), -2 <= a && a <= 2)) {
        if (s >= y) return e + t;
        var i = 0 | r.FAST_LOG10_X(s, 16);
        return (e + t) * B[i];
      }
      return s < k ? e + t : (e < t && (e = t), e);
    }
    function P(e, t, a, s, r) {
      var i,
        l,
        o = 0,
        _ = 0;
      for (i = l = 0; i < f.SBMAX_s; ++l, ++i) {
        for (var u = e.bo_s[i], h = e.npart_s, p = u < h ? u : h; l < p; )
          (c(t[l] >= 0), c(a[l] >= 0), (o += t[l]), (_ += a[l]), l++);
        if (((e.en[s].s[i][r] = o), (e.thm[s].s[i][r] = _), l >= h)) {
          ++i;
          break;
        }
        (c(t[l] >= 0), c(a[l] >= 0));
        var b = e.PSY.bo_s_weight[i],
          d = 1 - b;
        ((o = b * t[l]),
          (_ = b * a[l]),
          (e.en[s].s[i][r] += o),
          (e.thm[s].s[i][r] += _),
          (o = d * t[l]),
          (_ = d * a[l]));
      }
      for (; i < f.SBMAX_s; ++i)
        ((e.en[s].s[i][r] = 0), (e.thm[s].s[i][r] = 0));
    }
    function L(e, t, a, s) {
      var r,
        i,
        l = 0,
        o = 0;
      for (r = i = 0; r < f.SBMAX_l; ++i, ++r) {
        for (var _ = e.bo_l[r], u = e.npart_l, h = _ < u ? _ : u; i < h; )
          (c(t[i] >= 0), c(a[i] >= 0), (l += t[i]), (o += a[i]), i++);
        if (((e.en[s].l[r] = l), (e.thm[s].l[r] = o), i >= u)) {
          ++r;
          break;
        }
        (c(t[i] >= 0), c(a[i] >= 0));
        var p = e.PSY.bo_l_weight[r],
          b = 1 - p;
        ((l = p * t[i]),
          (o = p * a[i]),
          (e.en[s].l[r] += l),
          (e.thm[s].l[r] += o),
          (l = b * t[i]),
          (o = b * a[i]));
      }
      for (; r < f.SBMAX_l; ++r) ((e.en[s].l[r] = 0), (e.thm[s].l[r] = 0));
    }
    function I(e, t, a, s, r, i) {
      var l,
        o,
        _ = e.internal_flags;
      for (o = l = 0; o < _.npart_s; ++o) {
        for (var u = 0, n = _.numlines_s[o], h = 0; h < n; ++h, ++l) {
          u += t[i][l];
        }
        a[o] = u;
      }
      for (c(o == _.npart_s), c(129 == l), l = o = 0; o < _.npart_s; o++) {
        var p = _.s3ind_s[o][0],
          b = _.s3_ss[l++] * a[p];
        for (++p; p <= _.s3ind_s[o][1]; ) ((b += _.s3_ss[l] * a[p]), ++l, ++p);
        var d = 2 * _.nb_s1[r][o];
        if (((s[o] = Math.min(b, d)), _.blocktype_old[1 & r] == f.SHORT_TYPE)) {
          d = 16 * _.nb_s2[r][o];
          var m = s[o];
          s[o] = Math.min(d, m);
        }
        ((_.nb_s2[r][o] = _.nb_s1[r][o]), (_.nb_s1[r][o] = b), c(s[o] >= 0));
      }
      for (; o <= f.CBANDS; ++o) ((a[o] = 0), (s[o] = 0));
    }
    function O(e, t, a) {
      return a >= 1 ? e : a <= 0 ? t : t > 0 ? Math.pow(e / t, a) * t : 0;
    }
    var D = [
      11.8, 13.6, 17.2, 32, 46.5, 51.3, 57.5, 67.1, 71.5, 84.6, 97.6, 130,
    ];
    function N(e, t) {
      for (var a = 309.07, s = 0; s < f.SBMAX_s - 1; s++)
        for (var i = 0; i < 3; i++) {
          var l = e.thm.s[s][i];
          if ((c(s < D.length), l > 0)) {
            var o = l * t,
              _ = e.en.s[s][i];
            _ > o &&
              (_ > 1e10 * o
                ? (a += D[s] * (10 * h))
                : (c(o > 0), (a += D[s] * r.FAST_LOG10(_ / o))));
          }
        }
      return a;
    }
    var V = [
      6.8, 5.8, 5.8, 6.4, 6.5, 9.9, 12.1, 14.4, 15, 18.9, 21.6, 26.9, 34.2,
      40.2, 46.8, 56.5, 60.7, 73.9, 85.7, 93.4, 126.1,
    ];
    function H(e, t) {
      for (var a = 281.0575, s = 0; s < f.SBMAX_l - 1; s++) {
        var i = e.thm.l[s];
        if ((c(s < V.length), i > 0)) {
          var l = i * t,
            o = e.en.l[s];
          o > l &&
            (o > 1e10 * l
              ? (a += V[s] * (10 * h))
              : (c(l > 0), (a += V[s] * r.FAST_LOG10(o / l))));
        }
      }
      return a;
    }
    function C(e, t, a, s, r) {
      var i, l;
      for (i = l = 0; i < e.npart_l; ++i) {
        var o,
          _ = 0,
          u = 0;
        for (o = 0; o < e.numlines_l[i]; ++o, ++l) {
          var f = t[l];
          (c(f >= 0), (_ += f), u < f && (u = f));
        }
        ((a[i] = _),
          (s[i] = u),
          (r[i] = _ * e.rnumlines_l[i]),
          c(e.rnumlines_l[i] >= 0),
          c(_ >= 0),
          c(a[i] >= 0),
          c(s[i] >= 0),
          c(r[i] >= 0));
      }
    }
    function z(e, t, a, s) {
      var r = R.length - 1,
        i = 0,
        l = a[i] + a[i + 1];
      (c(l >= 0), l > 0)
        ? ((o = t[i]) < t[i + 1] && (o = t[i + 1]),
          c(e.numlines_l[i] + e.numlines_l[i + 1] - 1 > 0),
          (_ =
            0 |
            (l =
              (20 * (2 * o - l)) /
              (l * (e.numlines_l[i] + e.numlines_l[i + 1] - 1)))) > r &&
            (_ = r),
          (s[i] = _))
        : (s[i] = 0);
      for (i = 1; i < e.npart_l - 1; i++) {
        var o, _;
        if (((l = a[i - 1] + a[i] + a[i + 1]), c(l >= 0), l > 0))
          ((o = t[i - 1]) < t[i] && (o = t[i]),
            o < t[i + 1] && (o = t[i + 1]),
            c(
              e.numlines_l[i - 1] + e.numlines_l[i] + e.numlines_l[i + 1] - 1 >
                0,
            ),
            (_ =
              0 |
              (l =
                (20 * (3 * o - l)) /
                (l *
                  (e.numlines_l[i - 1] +
                    e.numlines_l[i] +
                    e.numlines_l[i + 1] -
                    1)))) > r && (_ = r),
            (s[i] = _));
        else s[i] = 0;
      }
      (c(i > 0), c(i == e.npart_l - 1), (l = a[i - 1] + a[i]), c(l >= 0), l > 0)
        ? ((o = t[i - 1]) < t[i] && (o = t[i]),
          c(e.numlines_l[i - 1] + e.numlines_l[i] - 1 > 0),
          (_ =
            0 |
            (l =
              (20 * (2 * o - l)) /
              (l * (e.numlines_l[i - 1] + e.numlines_l[i] - 1)))) > r &&
            (_ = r),
          (s[i] = _))
        : (s[i] = 0);
      c(i == e.npart_l - 1);
    }
    var F = [
      -1730326e-23, -0.01703172, -1349528e-23, 0.0418072, -673278e-22,
      -0.0876324, -30835e-21, 0.1863476, -1104424e-22, -0.627638,
    ];
    function X(t, a, s, i, l, o, _, c) {
      var u = t.internal_flags;
      if (i < 2) e.fft_long(u, _[c], i, a, s);
      else if (2 == i)
        for (var h = f.BLKSIZE - 1; h >= 0; --h) {
          var p = _[c + 0][h],
            b = _[c + 1][h];
          ((_[c + 0][h] = (p + b) * r.SQRT2 * 0.5),
            (_[c + 1][h] = (p - b) * r.SQRT2 * 0.5));
        }
      ((o[0] = _[c + 0][0]), (o[0] *= o[0]));
      for (h = f.BLKSIZE / 2 - 1; h >= 0; --h) {
        var d = _[c + 0][f.BLKSIZE / 2 - h],
          m = _[c + 0][f.BLKSIZE / 2 + h];
        o[f.BLKSIZE / 2 - h] = g(0.5 * (d * d + m * m));
      }
      var v = 0;
      for (h = 11; h < f.HBLKSIZE; h++) v += o[h];
      if (((u.tot_ener[i] = v), t.analysis)) {
        for (h = 0; h < f.HBLKSIZE; h++)
          ((u.pinfo.energy[l][i][h] = u.pinfo.energy_save[i][h]),
            (u.pinfo.energy_save[i][h] = o[h]));
        u.pinfo.pe[l][i] = u.pe[i];
      }
    }
    function q(t, a, s, i, l, o, _, c) {
      var u = t.internal_flags;
      if ((0 == l && i < 2 && e.fft_short(u, _[c], i, a, s), 2 == i))
        for (var h = f.BLKSIZE_s - 1; h >= 0; --h) {
          var p = _[c + 0][l][h],
            b = _[c + 1][l][h];
          ((_[c + 0][l][h] = (p + b) * r.SQRT2 * 0.5),
            (_[c + 1][l][h] = (p - b) * r.SQRT2 * 0.5));
        }
      ((o[l][0] = _[c + 0][l][0]), (o[l][0] *= o[l][0]));
      for (h = f.BLKSIZE_s / 2 - 1; h >= 0; --h) {
        var d = _[c + 0][l][f.BLKSIZE_s / 2 - h],
          m = _[c + 0][l][f.BLKSIZE_s / 2 + h];
        o[l][f.BLKSIZE_s / 2 - h] = g(0.5 * (d * d + m * m));
      }
    }
    function U(e, t, a, s) {
      var r = e.internal_flags;
      2 == e.athaa_loudapprox &&
        a < 2 &&
        ((r.loudness_sq[t][a] = r.loudness_sq_save[a]),
        (r.loudness_sq_save[a] = v(s, r)));
    }
    this.L3psycho_anal_ns = function (e, a, r, u, h, p, m, g, v, y) {
      var k,
        S,
        x,
        A,
        M,
        B,
        E,
        D,
        V,
        X,
        q = e.internal_flags,
        U = o([2, f.BLKSIZE]),
        Y = o([2, 3, f.BLKSIZE_s]),
        j = l(f.CBANDS + 1),
        G = l(f.CBANDS + 1),
        W = l(f.CBANDS + 2),
        $ = _(2),
        Z = _(2),
        K = o([2, 576]),
        Q = _(f.CBANDS + 2),
        J = _(f.CBANDS + 2);
      for (
        i.fill(J, 0),
          k = q.channels_out,
          e.mode == MPEGMode.JOINT_STEREO && (k = 4),
          V =
            e.VBR == t.vbr_off
              ? 0 == q.ResvMax
                ? 0
                : (q.ResvSize / q.ResvMax) * 0.5
              : e.VBR == t.vbr_rh || e.VBR == t.vbr_mtrh || e.VBR == t.vbr_mt
                ? 0.6
                : 1,
          S = 0;
        S < q.channels_out;
        S++
      ) {
        var ee = a[S],
          te = r + 576 - 350 - d + 192;
        for (c(10 == F.length), A = 0; A < 576; A++) {
          var ne, ae;
          for (ne = ee[te + A + 10], ae = 0, M = 0; M < 9; M += 2)
            ((ne += F[M] * (ee[te + A + M] + ee[te + A + d - M])),
              (ae += F[M + 1] * (ee[te + A + M + 1] + ee[te + A + d - M - 1])));
          K[S][A] = ne + ae;
        }
        (h[u][S].en.assign(q.en[S]),
          h[u][S].thm.assign(q.thm[S]),
          k > 2 &&
            (p[u][S].en.assign(q.en[S + 2]), p[u][S].thm.assign(q.thm[S + 2])));
      }
      for (S = 0; S < k; S++) {
        var se,
          re = l(12),
          ie = [0, 0, 0, 0],
          le = l(12),
          oe = 1,
          _e = l(f.CBANDS),
          ce = l(f.CBANDS),
          ue = [0, 0, 0, 0],
          fe = l(f.HBLKSIZE),
          he = o([3, f.HBLKSIZE_s]);
        for (
          c(q.npart_s <= f.CBANDS), c(q.npart_l <= f.CBANDS), A = 0;
          A < 3;
          A++
        )
          ((re[A] = q.nsPsy.last_en_subshort[S][A + 6]),
            c(q.nsPsy.last_en_subshort[S][A + 4] > 0),
            (le[A] = re[A] / q.nsPsy.last_en_subshort[S][A + 4]),
            (ie[0] += re[A]));
        if (2 == S)
          for (A = 0; A < 576; A++) {
            var pe, be;
            ((pe = K[0][A]),
              (be = K[1][A]),
              (K[0][A] = pe + be),
              (K[1][A] = pe - be));
          }
        var de = K[1 & S],
          me = 0;
        for (A = 0; A < 9; A++) {
          for (var ge = me + 64, ve = 1; me < ge; me++)
            ve < Math.abs(de[me]) && (ve = Math.abs(de[me]));
          ((q.nsPsy.last_en_subshort[S][A] = re[A + 3] = ve),
            (ie[1 + A / 3] += ve),
            ve > re[A + 3 - 2]
              ? (c(re[A + 3 - 2] > 0), (ve /= re[A + 3 - 2]))
              : re[A + 3 - 2] > 10 * ve
                ? (c(ve > 0), (ve = re[A + 3 - 2] / (10 * ve)))
                : (ve = 0),
            (le[A + 3] = ve));
        }
        if (e.analysis) {
          var we = le[0];
          for (A = 1; A < 12; A++) we < le[A] && (we = le[A]);
          ((q.pinfo.ers[u][S] = q.pinfo.ers_save[S]),
            (q.pinfo.ers_save[S] = we));
        }
        for (
          se = 3 == S ? q.nsPsy.attackthre_s : q.nsPsy.attackthre, A = 0;
          A < 12;
          A++
        )
          0 == ue[A / 3] && le[A] > se && (ue[A / 3] = (A % 3) + 1);
        for (A = 1; A < 4; A++) {
          var ye;
          (ie[A - 1] > ie[A]
            ? (c(ie[A] > 0), (ye = ie[A - 1] / ie[A]))
            : (c(ie[A - 1] > 0), (ye = ie[A] / ie[A - 1])),
            ye < 1.7 && ((ue[A] = 0), 1 == A && (ue[0] = 0)));
        }
        for (
          0 != ue[0] && 0 != q.nsPsy.lastAttacks[S] && (ue[0] = 0),
            (3 != q.nsPsy.lastAttacks[S] &&
              ue[0] + ue[1] + ue[2] + ue[3] == 0) ||
              ((oe = 0),
              0 != ue[1] && 0 != ue[0] && (ue[1] = 0),
              0 != ue[2] && 0 != ue[1] && (ue[2] = 0),
              0 != ue[3] && 0 != ue[2] && (ue[3] = 0)),
            S < 2 ? (Z[S] = oe) : 0 == oe && (Z[0] = Z[1] = 0),
            v[S] = q.tot_ener[S],
            w(e, fe, he, U, 1 & S, Y, 1 & S, u, S, a, r),
            C(q, fe, j, _e, ce),
            z(q, _e, ce, Q),
            D = 0;
          D < 3;
          D++
        ) {
          var ke, Se;
          for (
            I(e, he, G, W, S, D), P(q, G, W, S, D), E = 0;
            E < f.SBMAX_s;
            E++
          ) {
            if (
              ((Se = q.thm[S].s[E][D]),
              (Se *= 0.8),
              ue[D] >= 2 || 1 == ue[D + 1])
            ) {
              var Re = 0 != D ? D - 1 : 2;
              ve = O(q.thm[S].s[E][Re], Se, 0.6 * V);
              Se = Math.min(Se, ve);
            }
            if (1 == ue[D]) {
              ((Re = 0 != D ? D - 1 : 2),
                (ve = O(q.thm[S].s[E][Re], Se, b * V)));
              Se = Math.min(Se, ve);
            } else if (
              (0 != D && 3 == ue[D - 1]) ||
              (0 == D && 3 == q.nsPsy.lastAttacks[S])
            ) {
              ((Re = 2 != D ? D + 1 : 0),
                (ve = O(q.thm[S].s[E][Re], Se, b * V)));
              Se = Math.min(Se, ve);
            }
            ((ke = re[3 * D + 3] + re[3 * D + 4] + re[3 * D + 5]),
              6 * re[3 * D + 5] < ke &&
                ((Se *= 0.5), 6 * re[3 * D + 4] < ke && (Se *= 0.5)),
              (q.thm[S].s[E][D] = Se));
          }
        }
        for (q.nsPsy.lastAttacks[S] = ue[2], B = 0, x = 0; x < q.npart_l; x++) {
          for (
            var xe = q.s3ind[x][0],
              Ae = j[xe] * R[Q[xe]],
              Me = q.s3_ll[B++] * Ae;
            ++xe <= q.s3ind[x][1];
          )
            ((Ae = j[xe] * R[Q[xe]]),
              (Me = T(Me, q.s3_ll[B++] * Ae, xe, xe - x, q)));
          ((Me *= 0.158489319246111),
            q.blocktype_old[1 & S] == f.SHORT_TYPE
              ? (W[x] = Me)
              : (W[x] = O(
                  Math.min(Me, Math.min(2 * q.nb_1[S][x], 16 * q.nb_2[S][x])),
                  Me,
                  V,
                )),
            (q.nb_2[S][x] = q.nb_1[S][x]),
            (q.nb_1[S][x] = Me));
        }
        for (; x <= f.CBANDS; ++x) ((j[x] = 0), (W[x] = 0));
        L(q, j, W, S);
      }
      ((e.mode != MPEGMode.STEREO && e.mode != MPEGMode.JOINT_STEREO) ||
        (e.interChRatio > 0 &&
          (function (e, t) {
            var a = e.internal_flags;
            if (a.channels_out > 1) {
              for (var s = 0; s < f.SBMAX_l; s++) {
                var r = a.thm[0].l[s],
                  i = a.thm[1].l[s];
                ((a.thm[0].l[s] += i * t), (a.thm[1].l[s] += r * t));
              }
              for (s = 0; s < f.SBMAX_s; s++)
                for (var l = 0; l < 3; l++)
                  ((r = a.thm[0].s[s][l]),
                    (i = a.thm[1].s[s][l]),
                    (a.thm[0].s[s][l] += i * t),
                    (a.thm[1].s[s][l] += r * t));
            }
          })(e, e.interChRatio)),
      e.mode == MPEGMode.JOINT_STEREO) &&
        (!(function (e) {
          for (var t = 0; t < f.SBMAX_l; t++)
            if (
              !(
                e.thm[0].l[t] > 1.58 * e.thm[1].l[t] ||
                e.thm[1].l[t] > 1.58 * e.thm[0].l[t]
              )
            ) {
              var a = e.mld_l[t] * e.en[3].l[t],
                s = Math.max(e.thm[2].l[t], Math.min(e.thm[3].l[t], a));
              a = e.mld_l[t] * e.en[2].l[t];
              var r = Math.max(e.thm[3].l[t], Math.min(e.thm[2].l[t], a));
              ((e.thm[2].l[t] = s), (e.thm[3].l[t] = r));
            }
          for (t = 0; t < f.SBMAX_s; t++)
            for (var i = 0; i < 3; i++)
              e.thm[0].s[t][i] > 1.58 * e.thm[1].s[t][i] ||
                e.thm[1].s[t][i] > 1.58 * e.thm[0].s[t][i] ||
                ((a = e.mld_s[t] * e.en[3].s[t][i]),
                (s = Math.max(e.thm[2].s[t][i], Math.min(e.thm[3].s[t][i], a))),
                (a = e.mld_s[t] * e.en[2].s[t][i]),
                (r = Math.max(e.thm[3].s[t][i], Math.min(e.thm[2].s[t][i], a))),
                (e.thm[2].s[t][i] = s),
                (e.thm[3].s[t][i] = r));
        })(q),
        (X = e.msfix),
        Math.abs(X) > 0 &&
          (function (e, t, a) {
            var s = t,
              r = Math.pow(10, a);
            ((t *= 2), (s *= 2));
            for (var i = 0; i < f.SBMAX_l; i++)
              ((h = e.ATH.cb_l[e.bm_l[i]] * r),
                (o = Math.min(
                  Math.max(e.thm[0].l[i], h),
                  Math.max(e.thm[1].l[i], h),
                )) *
                  t <
                  (_ = Math.max(e.thm[2].l[i], h)) +
                    (u = Math.max(e.thm[3].l[i], h)) &&
                  c((_ *= p = (o * s) / (_ + u)) + (u *= p) > 0),
                (e.thm[2].l[i] = Math.min(_, e.thm[2].l[i])),
                (e.thm[3].l[i] = Math.min(u, e.thm[3].l[i])));
            for (r *= f.BLKSIZE_s / f.BLKSIZE, i = 0; i < f.SBMAX_s; i++)
              for (var l = 0; l < 3; l++) {
                var o, _, u, h, p;
                ((h = e.ATH.cb_s[e.bm_s[i]] * r),
                  (o = Math.min(
                    Math.max(e.thm[0].s[i][l], h),
                    Math.max(e.thm[1].s[i][l], h),
                  )) *
                    t <
                    (_ = Math.max(e.thm[2].s[i][l], h)) +
                      (u = Math.max(e.thm[3].s[i][l], h)) &&
                    c((_ *= p = (o * t) / (_ + u)) + (u *= p) > 0),
                  (e.thm[2].s[i][l] = Math.min(e.thm[2].s[i][l], _)),
                  (e.thm[3].s[i][l] = Math.min(e.thm[3].s[i][l], u)));
              }
          })(q, X, e.ATHlower * q.ATH.adjust));
      for (
        (function (e, t, a, r) {
          var i = e.internal_flags;
          e.short_blocks != s.short_block_coupled ||
            (0 != t[0] && 0 != t[1]) ||
            (t[0] = t[1] = 0);
          for (var l = 0; l < i.channels_out; l++)
            ((r[l] = f.NORM_TYPE),
              e.short_blocks == s.short_block_dispensed && (t[l] = 1),
              e.short_blocks == s.short_block_forced && (t[l] = 0),
              0 != t[l]
                ? (c(i.blocktype_old[l] != f.START_TYPE),
                  i.blocktype_old[l] == f.SHORT_TYPE && (r[l] = f.STOP_TYPE))
                : ((r[l] = f.SHORT_TYPE),
                  i.blocktype_old[l] == f.NORM_TYPE &&
                    (i.blocktype_old[l] = f.START_TYPE),
                  i.blocktype_old[l] == f.STOP_TYPE &&
                    (i.blocktype_old[l] = f.SHORT_TYPE)),
              (a[l] = i.blocktype_old[l]),
              (i.blocktype_old[l] = r[l]));
        })(e, Z, y, $),
          S = 0;
        S < k;
        S++
      ) {
        var Te,
          type,
          Be,
          Ee = 0;
        (S > 1
          ? ((Te = g),
            (Ee = -2),
            (type = f.NORM_TYPE),
            (y[0] != f.SHORT_TYPE && y[1] != f.SHORT_TYPE) ||
              (type = f.SHORT_TYPE),
            (Be = p[u][S - 2]))
          : ((Te = m), (Ee = 0), (type = y[S]), (Be = h[u][S])),
          type == f.SHORT_TYPE
            ? (Te[Ee + S] = N(Be, q.masking_lower))
            : (Te[Ee + S] = H(Be, q.masking_lower)),
          e.analysis && (q.pinfo.pe[u][S] = Te[Ee + S]));
      }
      return 0;
    };
    var Y = [
      -1730326e-23, -0.01703172, -1349528e-23, 0.0418072, -673278e-22,
      -0.0876324, -30835e-21, 0.1863476, -1104424e-22, -0.627638,
    ];
    function j(e, t, a) {
      if (0 == a)
        for (var s = 0; s < e.npart_s; s++)
          ((e.nb_s2[t][s] = e.nb_s1[t][s]), (e.nb_s1[t][s] = 0));
    }
    function G(e, t) {
      for (var a = 0; a < e.npart_l; a++)
        ((e.nb_2[t][a] = e.nb_1[t][a]), (e.nb_1[t][a] = 0));
    }
    function W(e, t, a, s, r, i) {
      var o,
        _,
        u,
        h = e.internal_flags,
        p = new float[f.CBANDS](),
        b = l(f.CBANDS),
        d = new int[f.CBANDS]();
      for (u = _ = 0; u < h.npart_s; ++u) {
        var m = 0,
          g = 0,
          n = h.numlines_s[u];
        for (o = 0; o < n; ++o, ++_) {
          var v = t[i][_];
          ((m += v), g < v && (g = v));
        }
        ((a[u] = m),
          c(m >= 0),
          (p[u] = g),
          c(n > 0),
          (b[u] = m / n),
          c(b[u] >= 0));
      }
      for (c(u == h.npart_s), c(129 == _); u < f.CBANDS; ++u)
        ((p[u] = 0), (b[u] = 0));
      for (
        (function (e, t, a, s) {
          var r = R.length - 1,
            i = 0,
            l = a[i] + a[i + 1];
          for (
            c(l >= 0),
              l > 0
                ? ((o = t[i]) < t[i + 1] && (o = t[i + 1]),
                  c(e.numlines_s[i] + e.numlines_s[i + 1] - 1 > 0),
                  (_ =
                    0 |
                    (l =
                      (20 * (2 * o - l)) /
                      (l * (e.numlines_s[i] + e.numlines_s[i + 1] - 1)))) > r &&
                    (_ = r),
                  (s[i] = _))
                : (s[i] = 0),
              i = 1;
            i < e.npart_s - 1;
            i++
          ) {
            var o, _;
            ((l = a[i - 1] + a[i] + a[i + 1]),
              c(i + 1 < e.npart_s),
              c(l >= 0),
              l > 0
                ? ((o = t[i - 1]) < t[i] && (o = t[i]),
                  o < t[i + 1] && (o = t[i + 1]),
                  c(
                    e.numlines_s[i - 1] +
                      e.numlines_s[i] +
                      e.numlines_s[i + 1] -
                      1 >
                      0,
                  ),
                  (_ =
                    0 |
                    (l =
                      (20 * (3 * o - l)) /
                      (l *
                        (e.numlines_s[i - 1] +
                          e.numlines_s[i] +
                          e.numlines_s[i + 1] -
                          1)))) > r && (_ = r),
                  (s[i] = _))
                : (s[i] = 0));
          }
          (c(i > 0),
            c(i == e.npart_s - 1),
            (l = a[i - 1] + a[i]),
            c(l >= 0),
            l > 0
              ? ((o = t[i - 1]) < t[i] && (o = t[i]),
                c(e.numlines_s[i - 1] + e.numlines_s[i] - 1 > 0),
                (_ =
                  0 |
                  (l =
                    (20 * (2 * o - l)) /
                    (l * (e.numlines_s[i - 1] + e.numlines_s[i] - 1)))) > r &&
                  (_ = r),
                (s[i] = _))
              : (s[i] = 0),
            c(i == e.npart_s - 1));
        })(h, p, b, d),
          _ = u = 0;
        u < h.npart_s;
        u++
      ) {
        var w,
          y,
          k,
          S,
          x,
          A = h.s3ind_s[u][0],
          M = h.s3ind_s[u][1];
        for (
          w = d[A], y = 1, S = h.s3_ss[_] * a[A] * R[d[A]], ++_, ++A;
          A <= M;
        )
          ((w += d[A]),
            (y += 1),
            (S = E(S, (k = h.s3_ss[_] * a[A] * R[d[A]]), A - u)),
            ++_,
            ++A);
        ((S *= x = 0.5 * R[(w = (1 + 2 * w) / (2 * y))]),
          (s[u] = S),
          (h.nb_s2[r][u] = h.nb_s1[r][u]),
          (h.nb_s1[r][u] = S),
          (k = p[u]),
          (k *= h.minval_s[u]),
          (k *= x),
          s[u] > k && (s[u] = k),
          h.masking_lower > 1 && (s[u] *= h.masking_lower),
          s[u] > a[u] && (s[u] = a[u]),
          h.masking_lower < 1 && (s[u] *= h.masking_lower),
          c(s[u] >= 0));
      }
      for (; u < f.CBANDS; ++u) ((a[u] = 0), (s[u] = 0));
    }
    function $(e, t, a, s, r) {
      var i,
        o = l(f.CBANDS),
        u = l(f.CBANDS),
        h = _(f.CBANDS + 2);
      (C(e, t, a, o, u), z(e, o, u, h));
      var p = 0;
      for (i = 0; i < e.npart_l; i++) {
        var d,
          m,
          g,
          v = e.s3ind[i][0],
          w = e.s3ind[i][1],
          y = 0,
          k = 0;
        for (
          y = h[v], k += 1, m = e.s3_ll[p] * a[v] * R[h[v]], ++p, ++v;
          v <= w;
        )
          ((y += h[v]),
            (k += 1),
            (m = E(m, (d = e.s3_ll[p] * a[v] * R[h[v]]), v - i)),
            ++p,
            ++v);
        if (
          ((m *= g = 0.5 * R[(y = (1 + 2 * y) / (2 * k))]),
          e.blocktype_old[1 & r] == f.SHORT_TYPE)
        ) {
          var S = 2 * e.nb_1[r][i];
          s[i] = S > 0 ? Math.min(m, S) : Math.min(m, a[i] * b);
        } else {
          var x = 16 * e.nb_2[r][i],
            A = 2 * e.nb_1[r][i];
          (x <= 0 && (x = m),
            A <= 0 && (A = m),
            (S = e.blocktype_old[1 & r] == f.NORM_TYPE ? Math.min(A, x) : A),
            (s[i] = Math.min(m, S)));
        }
        ((e.nb_2[r][i] = e.nb_1[r][i]),
          (e.nb_1[r][i] = m),
          (d = o[i]),
          (d *= e.minval_l[i]),
          (d *= g),
          s[i] > d && (s[i] = d),
          e.masking_lower > 1 && (s[i] *= e.masking_lower),
          s[i] > a[i] && (s[i] = a[i]),
          e.masking_lower < 1 && (s[i] *= e.masking_lower),
          c(s[i] >= 0));
      }
      for (; i < f.CBANDS; ++i) ((a[i] = 0), (s[i] = 0));
    }
    function Z(e, t, a, s, r, i, n) {
      for (
        var l, o, _ = 2 * i, u = i > 0 ? Math.pow(10, r) : 1, f = 0;
        f < n;
        ++f
      ) {
        var h = e[2][f],
          p = e[3][f],
          b = t[0][f],
          d = t[1][f],
          m = t[2][f],
          g = t[3][f];
        if (b <= 1.58 * d && d <= 1.58 * b) {
          var v = a[f] * p,
            w = a[f] * h;
          ((o = Math.max(m, Math.min(g, v))),
            (l = Math.max(g, Math.min(m, w))));
        } else ((o = m), (l = g));
        if (i > 0) {
          var y,
            k,
            S = s[f] * u;
          if (
            ((y = Math.min(Math.max(b, S), Math.max(d, S))),
            (k = (m = Math.max(o, S)) + (g = Math.max(l, S))) > 0 && y * _ < k)
          ) {
            var R = (y * _) / k;
            ((m *= R), (g *= R), c(k > 0));
          }
          ((o = Math.min(m, o)), (l = Math.min(g, l)));
        }
        (o > h && (o = h), l > p && (l = p), (t[2][f] = o), (t[3][f] = l));
      }
    }
    function K(e, t) {
      var a;
      return (a = e >= 0 ? 27 * -e : e * t) <= -72 ? 0 : Math.exp(a * m);
    }
    function Q(e) {
      var t,
        a,
        s = 0;
      for (s = 0; K(s, e) > 1e-20; s -= 1);
      for (r = s, i = 0; Math.abs(i - r) > 1e-12; )
        K((s = (i + r) / 2), e) > 0 ? (i = s) : (r = s);
      t = r;
      var r, i;
      s = 0;
      for (s = 0; K(s, e) > 1e-20; s += 1);
      for (r = 0, i = s; Math.abs(i - r) > 1e-12; )
        K((s = (i + r) / 2), e) > 0 ? (r = s) : (i = s);
      a = i;
      var l,
        o = 0,
        _ = 1e3;
      for (l = 0; l <= _; ++l) {
        o += K((s = t + (l * (a - t)) / _), e);
      }
      return (_ + 1) / (o * (a - t));
    }
    function J(e) {
      var t, a, s, r;
      return (
        (t = e),
        (a =
          (t *= t >= 0 ? 3 : 1.5) >= 0.5 && t <= 2.5
            ? 8 * ((r = t - 0.5) * r - 2 * r)
            : 0),
        (s = 15.811389 + 7.5 * (t += 0.474) - 17.5 * Math.sqrt(1 + t * t)) <=
        -60
          ? 0
          : ((t = Math.exp((a + s) * m)), (t /= 0.6609193))
      );
    }
    function ee(e) {
      return (
        e < 0 && (e = 0),
        (e *= 0.001),
        13 * Math.atan(0.76 * e) + 3.5 * Math.atan((e * e) / 56.25)
      );
    }
    function te(e, t, a, s, r, i, o, u, h, p, b, d) {
      var m,
        g = l(f.CBANDS + 1),
        v = u / (d > 15 ? 1152 : 384),
        w = _(f.HBLKSIZE);
      u /= h;
      var y = 0,
        k = 0;
      for (m = 0; m < f.CBANDS; m++) {
        var S;
        for (
          L = ee(u * y), g[m] = u * y, S = y;
          ee(u * S) - L < 0.34 && S <= h / 2;
          S++
        );
        for (e[m] = S - y, k = m + 1; y < S; )
          (c(y < f.HBLKSIZE), (w[y++] = m));
        if (y > h / 2) {
          ((y = h / 2), ++m);
          break;
        }
      }
      (c(m < f.CBANDS), (g[m] = u * y));
      for (var R = 0; R < d; R++) {
        var x, A, M, T, B;
        ((M = p[R]),
          (T = p[R + 1]),
          (x = 0 | Math.floor(0.5 + b * (M - 0.5))) < 0 && (x = 0),
          (A = 0 | Math.floor(0.5 + b * (T - 0.5))) > h / 2 && (A = h / 2),
          (a[R] = (w[x] + w[A]) / 2),
          (t[R] = w[A]));
        var E = v * T;
        ((o[R] = (E - g[t[R]]) / (g[t[R] + 1] - g[t[R]])),
          o[R] < 0 ? (o[R] = 0) : o[R] > 1 && (o[R] = 1),
          (B = ee(u * p[R] * b)),
          (B = Math.min(B, 15.5) / 15.5),
          (i[R] = Math.pow(10, 1.25 * (1 - Math.cos(Math.PI * B)) - 2.5)));
      }
      y = 0;
      for (var P = 0; P < k; P++) {
        var L,
          I,
          O = e[P];
        ((L = ee(u * y)),
          (I = ee(u * (y + O - 1))),
          (s[P] = 0.5 * (L + I)),
          (L = ee(u * (y - 0.5))),
          (I = ee(u * (y + O - 0.5))),
          (r[P] = I - L),
          (y += O));
      }
      return k;
    }
    function ne(e, t, a, s, r, i) {
      var _,
        c = o([f.CBANDS, f.CBANDS]),
        u = 0;
      if (i)
        for (var h = 0; h < t; h++)
          for (_ = 0; _ < t; _++) {
            var p = J(a[h] - a[_]) * s[_];
            c[h][_] = p * r[h];
          }
      else
        for (_ = 0; _ < t; _++) {
          var b = 15 + Math.min(21 / a[_], 12),
            d = Q(b);
          for (h = 0; h < t; h++) {
            p = d * K(a[h] - a[_], b) * s[_];
            c[h][_] = p * r[h];
          }
        }
      for (h = 0; h < t; h++) {
        for (_ = 0; _ < t && !(c[h][_] > 0); _++);
        for (e[h][0] = _, _ = t - 1; _ > 0 && !(c[h][_] > 0); _--);
        ((e[h][1] = _), (u += e[h][1] - e[h][0] + 1));
      }
      var m = l(u),
        g = 0;
      for (h = 0; h < t; h++)
        for (_ = e[h][0]; _ <= e[h][1]; _++) m[g++] = c[h][_];
      return m;
    }
    function ae(e) {
      var t = ee(e);
      return (
        (t = Math.min(t, 15.5) / 15.5),
        Math.pow(10, 1.25 * (1 - Math.cos(Math.PI * t)) - 2.5)
      );
    }
    function se(e, value) {
      return (
        e < -0.3 && (e = 3410),
        (e /= 1e3),
        (e = Math.max(0.1, e)),
        3.64 * Math.pow(e, -0.8) -
          6.8 * Math.exp(-0.6 * Math.pow(e - 3.4, 2)) +
          6 * Math.exp(-0.15 * Math.pow(e - 8.7, 2)) +
          0.001 * (0.6 + 0.04 * value) * Math.pow(e, 4)
      );
    }
    ((this.L3psycho_anal_vbr = function (e, t, a, r, i, u, h, p, b, m) {
      var g = e.internal_flags,
        v = l(f.HBLKSIZE),
        w = o([3, f.HBLKSIZE_s]),
        y = o([2, f.BLKSIZE]),
        k = o([2, 3, f.BLKSIZE_s]),
        S = o([4, f.CBANDS]),
        R = o([4, f.CBANDS]),
        x = o([4, 3]),
        A = [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        M = _(2),
        T = e.mode == MPEGMode.JOINT_STEREO ? 4 : g.channels_out;
      (!(function (e, t, a, s, r, i, _, u, f, h) {
        for (
          var p = o([2, 576]),
            b = e.internal_flags,
            m = b.channels_out,
            g = e.mode == MPEGMode.JOINT_STEREO ? 4 : m,
            v = 0;
          v < m;
          v++
        ) {
          firbuf = t[v];
          var w = a + 576 - 350 - d + 192;
          c(10 == Y.length);
          for (var y = 0; y < 576; y++) {
            var k, S;
            ((k = firbuf[w + y + 10]), (S = 0));
            for (var R = 0; R < 9; R += 2)
              ((k += Y[R] * (firbuf[w + y + R] + firbuf[w + y + d - R])),
                (S +=
                  Y[R + 1] *
                  (firbuf[w + y + R + 1] + firbuf[w + y + d - R - 1])));
            p[v][y] = k + S;
          }
          (r[s][v].en.assign(b.en[v]),
            r[s][v].thm.assign(b.thm[v]),
            g > 2 &&
              (i[s][v].en.assign(b.en[v + 2]),
              i[s][v].thm.assign(b.thm[v + 2])));
        }
        for (v = 0; v < g; v++) {
          var x = l(12),
            A = l(12),
            M = [0, 0, 0, 0],
            T = p[1 & v],
            B = 0,
            E = 3 == v ? b.nsPsy.attackthre_s : b.nsPsy.attackthre,
            P = 1;
          if (2 == v)
            for (y = 0, R = 576; R > 0; ++y, --R) {
              var L = p[0][y],
                I = p[1][y];
              ((p[0][y] = L + I), (p[1][y] = L - I));
            }
          for (y = 0; y < 3; y++)
            ((A[y] = b.nsPsy.last_en_subshort[v][y + 6]),
              c(b.nsPsy.last_en_subshort[v][y + 4] > 0),
              (x[y] = A[y] / b.nsPsy.last_en_subshort[v][y + 4]),
              (M[0] += A[y]));
          for (y = 0; y < 9; y++) {
            for (var O = B + 64, D = 1; B < O; B++)
              D < Math.abs(T[B]) && (D = Math.abs(T[B]));
            ((b.nsPsy.last_en_subshort[v][y] = A[y + 3] = D),
              (M[1 + y / 3] += D),
              D > A[y + 3 - 2]
                ? (c(A[y + 3 - 2] > 0), (D /= A[y + 3 - 2]))
                : A[y + 3 - 2] > 10 * D
                  ? (c(D > 0), (D = A[y + 3 - 2] / (10 * D)))
                  : (D = 0),
              (x[y + 3] = D));
          }
          for (y = 0; y < 3; ++y) {
            var N = A[3 * y + 3] + A[3 * y + 4] + A[3 * y + 5],
              V = 1;
            (6 * A[3 * y + 5] < N &&
              ((V *= 0.5), 6 * A[3 * y + 4] < N && (V *= 0.5)),
              (u[v][y] = V));
          }
          if (e.analysis) {
            var H = x[0];
            for (y = 1; y < 12; y++) H < x[y] && (H = x[y]);
            ((b.pinfo.ers[s][v] = b.pinfo.ers_save[v]),
              (b.pinfo.ers_save[v] = H));
          }
          for (y = 0; y < 12; y++)
            0 == f[v][y / 3] && x[y] > E && (f[v][y / 3] = (y % 3) + 1);
          for (y = 1; y < 4; y++) {
            var C = M[y - 1],
              z = M[y];
            Math.max(C, z) < 4e4 &&
              C < 1.7 * z &&
              z < 1.7 * C &&
              (1 == y && f[v][0] <= f[v][y] && (f[v][0] = 0), (f[v][y] = 0));
          }
          (f[v][0] <= b.nsPsy.lastAttacks[v] && (f[v][0] = 0),
            (3 != b.nsPsy.lastAttacks[v] &&
              f[v][0] + f[v][1] + f[v][2] + f[v][3] == 0) ||
              ((P = 0),
              0 != f[v][1] && 0 != f[v][0] && (f[v][1] = 0),
              0 != f[v][2] && 0 != f[v][1] && (f[v][2] = 0),
              0 != f[v][3] && 0 != f[v][2] && (f[v][3] = 0)),
            v < 2 ? (h[v] = P) : 0 == P && (h[0] = h[1] = 0),
            (_[v] = b.tot_ener[v]));
        }
      })(e, t, a, r, i, u, b, x, A, M),
        (function (e, t) {
          var a = e.internal_flags;
          e.short_blocks != s.short_block_coupled ||
            (0 != t[0] && 0 != t[1]) ||
            (t[0] = t[1] = 0);
          for (var r = 0; r < a.channels_out; r++)
            (e.short_blocks == s.short_block_dispensed && (t[r] = 1),
              e.short_blocks == s.short_block_forced && (t[r] = 0));
        })(e, M));
      for (var B = 0; B < T; B++) {
        (X(e, t, a, B, r, v, y, (I = 1 & B)),
          U(e, r, B, v),
          0 != M[I] ? $(g, v, S[B], R[B], B) : G(g, B));
      }
      M[0] + M[1] == 2 &&
        e.mode == MPEGMode.JOINT_STEREO &&
        Z(
          S,
          R,
          g.mld_cb_l,
          g.ATH.cb_l,
          e.ATHlower * g.ATH.adjust,
          e.msfix,
          g.npart_l,
        );
      for (B = 0; B < T; B++) {
        0 != M[(I = 1 & B)] && L(g, S[B], R[B], B);
      }
      for (var E = 0; E < 3; E++) {
        for (B = 0; B < T; ++B) {
          0 != M[(I = 1 & B)]
            ? j(g, B, E)
            : (q(e, t, a, B, E, w, k, I), W(e, w, S[B], R[B], B, E));
        }
        M[0] + M[1] == 0 &&
          e.mode == MPEGMode.JOINT_STEREO &&
          Z(
            S,
            R,
            g.mld_cb_s,
            g.ATH.cb_s,
            e.ATHlower * g.ATH.adjust,
            e.msfix,
            g.npart_s,
          );
        for (B = 0; B < T; ++B) {
          0 == M[(I = 1 & B)] && P(g, S[B], R[B], B, E);
        }
      }
      for (B = 0; B < T; B++) {
        var I;
        if (0 == M[(I = 1 & B)])
          for (var D = 0; D < f.SBMAX_s; D++) {
            var V = l(3);
            for (E = 0; E < 3; E++) {
              var C = g.thm[B].s[D][E];
              if (((C *= 0.8), A[B][E] >= 2 || 1 == A[B][E + 1])) {
                var z = 0 != E ? E - 1 : 2,
                  F = O(g.thm[B].s[D][z], C, 0.36);
                C = Math.min(C, F);
              } else if (1 == A[B][E]) {
                ((z = 0 != E ? E - 1 : 2), (F = O(g.thm[B].s[D][z], C, 0.18)));
                C = Math.min(C, F);
              } else if (
                (0 != E && 3 == A[B][E - 1]) ||
                (0 == E && 3 == g.nsPsy.lastAttacks[B])
              ) {
                ((z = 2 != E ? E + 1 : 0), (F = O(g.thm[B].s[D][z], C, 0.18)));
                C = Math.min(C, F);
              }
              ((C *= x[B][E]), (V[E] = C));
            }
            for (E = 0; E < 3; E++) g.thm[B].s[D][E] = V[E];
          }
      }
      for (B = 0; B < T; B++) g.nsPsy.lastAttacks[B] = A[B][2];
      !(function (e, t, a) {
        for (var s = e.internal_flags, r = 0; r < s.channels_out; r++) {
          var i = f.NORM_TYPE;
          (0 != t[r]
            ? (c(s.blocktype_old[r] != f.START_TYPE),
              s.blocktype_old[r] == f.SHORT_TYPE && (i = f.STOP_TYPE))
            : ((i = f.SHORT_TYPE),
              s.blocktype_old[r] == f.NORM_TYPE &&
                (s.blocktype_old[r] = f.START_TYPE),
              s.blocktype_old[r] == f.STOP_TYPE &&
                (s.blocktype_old[r] = f.SHORT_TYPE)),
            (a[r] = s.blocktype_old[r]),
            (s.blocktype_old[r] = i));
        }
      })(e, M, m);
      for (B = 0; B < T; B++) {
        var K, Q, type, J;
        (B > 1
          ? ((K = p),
            (Q = -2),
            (type = f.NORM_TYPE),
            (m[0] != f.SHORT_TYPE && m[1] != f.SHORT_TYPE) ||
              (type = f.SHORT_TYPE),
            (J = u[r][B - 2]))
          : ((K = h), (Q = 0), (type = m[B]), (J = i[r][B])),
          type == f.SHORT_TYPE
            ? (K[Q + B] = N(J, g.masking_lower))
            : (K[Q + B] = H(J, g.masking_lower)),
          e.analysis && (g.pinfo.pe[r][B] = K[Q + B]));
      }
      return 0;
    }),
      (this.psymodel_init = function (s) {
        var r,
          i = s.internal_flags,
          o = !0,
          _ = 13,
          u = 24,
          p = 0,
          b = 0,
          d = -8.25,
          m = -4.5,
          g = l(f.CBANDS),
          v = l(f.CBANDS),
          w = l(f.CBANDS),
          R = s.out_samplerate;
        switch (s.experimentalZ) {
          default:
          case 0:
            o = !0;
            break;
          case 1:
            o = s.VBR != t.vbr_mtrh && s.VBR != t.vbr_mt;
            break;
          case 2:
            o = !1;
            break;
          case 3:
            ((_ = 8), (p = -1.75), (b = -0.0125), (d = -8.25), (m = -2.25));
        }
        for (
          i.ms_ener_ratio_old = 0.25,
            i.blocktype_old[0] = i.blocktype_old[1] = f.NORM_TYPE,
            r = 0;
          r < 4;
          ++r
        ) {
          for (var x = 0; x < f.CBANDS; ++x)
            ((i.nb_1[r][x] = 1e20),
              (i.nb_2[r][x] = 1e20),
              (i.nb_s1[r][x] = i.nb_s2[r][x] = 1));
          for (var A = 0; A < f.SBMAX_l; A++)
            ((i.en[r].l[A] = 1e20), (i.thm[r].l[A] = 1e20));
          for (x = 0; x < 3; ++x) {
            for (A = 0; A < f.SBMAX_s; A++)
              ((i.en[r].s[A][x] = 1e20), (i.thm[r].s[A][x] = 1e20));
            i.nsPsy.lastAttacks[r] = 0;
          }
          for (x = 0; x < 9; x++) i.nsPsy.last_en_subshort[r][x] = 10;
        }
        for (
          i.loudness_sq_save[0] = i.loudness_sq_save[1] = 0,
            i.npart_l = te(
              i.numlines_l,
              i.bo_l,
              i.bm_l,
              g,
              v,
              i.mld_l,
              i.PSY.bo_l_weight,
              R,
              f.BLKSIZE,
              i.scalefac_band.l,
              f.BLKSIZE / 1152,
              f.SBMAX_l,
            ),
            c(i.npart_l < f.CBANDS),
            r = 0;
          r < i.npart_l;
          r++
        ) {
          var M = p;
          (g[r] >= _ &&
            (M = (b * (g[r] - _)) / (u - _) + (p * (u - g[r])) / (u - _)),
            (w[r] = Math.pow(10, M / 10)),
            i.numlines_l[r] > 0
              ? (i.rnumlines_l[r] = 1 / i.numlines_l[r])
              : (i.rnumlines_l[r] = 0));
        }
        i.s3_ll = ne(i.s3ind, i.npart_l, g, v, w, o);
        var T;
        x = 0;
        for (r = 0; r < i.npart_l; r++) {
          P = a.MAX_VALUE;
          for (var B = 0; B < i.numlines_l[r]; B++, x++) {
            var E = (R * x) / (1e3 * f.BLKSIZE);
            ((L = this.ATHformula(1e3 * E, s) - 20),
              (L = Math.pow(10, 0.1 * L)),
              P > (L *= i.numlines_l[r]) && (P = L));
          }
          ((i.ATH.cb_l[r] = P),
            (P = (20 * g[r]) / 10 - 20) > 6 && (P = 100),
            P < -15 && (P = -15),
            (P -= 8),
            (i.minval_l[r] = Math.pow(10, P / 10) * i.numlines_l[r]));
        }
        for (
          i.npart_s = te(
            i.numlines_s,
            i.bo_s,
            i.bm_s,
            g,
            v,
            i.mld_s,
            i.PSY.bo_s_weight,
            R,
            f.BLKSIZE_s,
            i.scalefac_band.s,
            f.BLKSIZE_s / 384,
            f.SBMAX_s,
          ),
            c(i.npart_s < f.CBANDS),
            x = 0,
            r = 0;
          r < i.npart_s;
          r++
        ) {
          var P;
          M = d;
          (g[r] >= _ &&
            (M = (m * (g[r] - _)) / (u - _) + (d * (u - g[r])) / (u - _)),
            (w[r] = Math.pow(10, M / 10)),
            (P = a.MAX_VALUE));
          for (B = 0; B < i.numlines_s[r]; B++, x++) {
            var L;
            E = (R * x) / (1e3 * f.BLKSIZE_s);
            ((L = this.ATHformula(1e3 * E, s) - 20),
              (L = Math.pow(10, 0.1 * L)),
              P > (L *= i.numlines_s[r]) && (P = L));
          }
          ((i.ATH.cb_s[r] = P),
            (P = (7 * g[r]) / 12 - 7),
            g[r] > 12 && (P *= 1 + 3.1 * Math.log(1 + P)),
            g[r] < 12 && (P *= 1 + 2.3 * Math.log(1 - P)),
            P < -15 && (P = -15),
            (P -= 8),
            (i.minval_s[r] = Math.pow(10, P / 10) * i.numlines_s[r]));
        }
        ((i.s3_ss = ne(i.s3ind_s, i.npart_s, g, v, w, o)),
          (y = Math.pow(10, 9 / 16)),
          (k = Math.pow(10, 1.5)),
          (S = Math.pow(10, 1.5)),
          e.init_fft(i),
          (i.decay = Math.exp((-1 * h) / ((0.01 * R) / 192))),
          (T = 3.5),
          2 & s.exp_nspsytune && (T = 1),
          Math.abs(s.msfix) > 0 && (T = s.msfix),
          (s.msfix = T));
        for (var I = 0; I < i.npart_l; I++)
          i.s3ind[I][1] > i.npart_l - 1 && (i.s3ind[I][1] = i.npart_l - 1);
        var O = (576 * i.mode_gr) / R;
        if (
          ((i.ATH.decay = Math.pow(10, -1.2 * O)),
          (i.ATH.adjust = 0.01),
          (i.ATH.adjustLimit = 1),
          c(i.bo_l[f.SBMAX_l - 1] <= i.npart_l),
          c(i.bo_s[f.SBMAX_s - 1] <= i.npart_s),
          -1 != s.ATHtype)
        ) {
          var D = s.out_samplerate / f.BLKSIZE,
            N = 0;
          for (E = 0, r = 0; r < f.BLKSIZE / 2; ++r)
            ((E += D),
              (i.ATH.eql_w[r] = 1 / Math.pow(10, this.ATHformula(E, s) / 10)),
              (N += i.ATH.eql_w[r]));
          for (N = 1 / N, r = f.BLKSIZE / 2; --r >= 0; ) i.ATH.eql_w[r] *= N;
        }
        for (I = x = 0; I < i.npart_s; ++I)
          for (r = 0; r < i.numlines_s[I]; ++r) ++x;
        c(129 == x);
        for (I = x = 0; I < i.npart_l; ++I)
          for (r = 0; r < i.numlines_l[I]; ++r) ++x;
        for (c(513 == x), x = 0, r = 0; r < i.npart_l; r++) {
          E = (R * (x + i.numlines_l[r] / 2)) / (1 * f.BLKSIZE);
          ((i.mld_cb_l[r] = ae(E)), (x += i.numlines_l[r]));
        }
        for (; r < f.CBANDS; ++r) i.mld_cb_l[r] = 1;
        for (x = 0, r = 0; r < i.npart_s; r++) {
          E = (R * (x + i.numlines_s[r] / 2)) / (1 * f.BLKSIZE_s);
          ((i.mld_cb_s[r] = ae(E)), (x += i.numlines_s[r]));
        }
        for (; r < f.CBANDS; ++r) i.mld_cb_s[r] = 1;
        return 0;
      }),
      (this.ATHformula = function (e, t) {
        var a;
        switch (t.ATHtype) {
          case 0:
            a = se(e, 9);
            break;
          case 1:
            a = se(e, -1);
            break;
          case 2:
          default:
            a = se(e, 0);
            break;
          case 3:
            a = se(e, 1) + 6;
            break;
          case 4:
            a = se(e, t.ATHcurve);
        }
        return a;
      }));
  });
}
function Rn() {
  if (gt) return mt;
  function e(e) {
    var t = e;
    this.ordinal = function () {
      return t;
    };
  }
  return (
    (gt = 1),
    (e.STEREO = new e(0)),
    (e.JOINT_STEREO = new e(1)),
    (e.DUAL_CHANNEL = new e(2)),
    (e.MONO = new e(3)),
    (e.NOT_SET = new e(4)),
    (mt = e)
  );
}
function xn() {
  if (kt) return yt;
  kt = 1;
  var e = kn(),
    t = {};
  return ((t.SFBMAX = 3 * e.SBMAX_s), (yt = t));
}
function An() {
  if (Rt) return St;
  Rt = 1;
  var e = wn();
  (e.System,
    e.VbrMode,
    e.Float,
    e.ShortBlock,
    e.Util,
    e.Arrays,
    e.new_array_n,
    e.new_byte,
    e.new_double);
  var t = e.new_float;
  e.new_float_n;
  var a = e.new_int;
  (e.new_int_n, e.assert);
  var s = xn();
  return (St = function () {
    ((this.xr = t(576)),
      (this.l3_enc = a(576)),
      (this.scalefac = a(s.SFBMAX)),
      (this.xrpow_max = 0),
      (this.part2_3_length = 0),
      (this.big_values = 0),
      (this.count1 = 0),
      (this.global_gain = 0),
      (this.scalefac_compress = 0),
      (this.block_type = 0),
      (this.mixed_block_flag = 0),
      (this.table_select = a(3)),
      (this.subblock_gain = a(4)),
      (this.region0_count = 0),
      (this.region1_count = 0),
      (this.preflag = 0),
      (this.scalefac_scale = 0),
      (this.count1table_select = 0),
      (this.part2_length = 0),
      (this.sfb_lmax = 0),
      (this.sfb_smin = 0),
      (this.psy_lmax = 0),
      (this.sfbmax = 0),
      (this.psymax = 0),
      (this.sfbdivide = 0),
      (this.width = a(s.SFBMAX)),
      (this.window = a(s.SFBMAX)),
      (this.count1bits = 0),
      (this.sfb_partition_table = null),
      (this.slen = a(4)),
      (this.max_nonzero_coeff = 0));
    var e = this;
    function r(e) {
      return new Int32Array(e);
    }
    this.assign = function (t) {
      var a;
      ((e.xr = ((a = t.xr), new Float32Array(a))),
        (e.l3_enc = r(t.l3_enc)),
        (e.scalefac = r(t.scalefac)),
        (e.xrpow_max = t.xrpow_max),
        (e.part2_3_length = t.part2_3_length),
        (e.big_values = t.big_values),
        (e.count1 = t.count1),
        (e.global_gain = t.global_gain),
        (e.scalefac_compress = t.scalefac_compress),
        (e.block_type = t.block_type),
        (e.mixed_block_flag = t.mixed_block_flag),
        (e.table_select = r(t.table_select)),
        (e.subblock_gain = r(t.subblock_gain)),
        (e.region0_count = t.region0_count),
        (e.region1_count = t.region1_count),
        (e.preflag = t.preflag),
        (e.scalefac_scale = t.scalefac_scale),
        (e.count1table_select = t.count1table_select),
        (e.part2_length = t.part2_length),
        (e.sfb_lmax = t.sfb_lmax),
        (e.sfb_smin = t.sfb_smin),
        (e.psy_lmax = t.psy_lmax),
        (e.sfbmax = t.sfbmax),
        (e.psymax = t.psymax),
        (e.sfbdivide = t.sfbdivide),
        (e.width = r(t.width)),
        (e.window = r(t.window)),
        (e.count1bits = t.count1bits),
        (e.sfb_partition_table = t.sfb_partition_table.slice(0)),
        (e.slen = r(t.slen)),
        (e.max_nonzero_coeff = t.max_nonzero_coeff));
    };
  });
}
function Mn() {
  if (Tt) return Mt;
  Tt = 1;
  var e = wn(),
    t = e.System;
  (e.VbrMode,
    e.Float,
    e.ShortBlock,
    e.Util,
    e.Arrays,
    e.new_array_n,
    e.new_byte,
    e.new_double,
    e.new_float,
    e.new_float_n);
  var a = e.new_int;
  (e.new_int_n, e.assert);
  var s = kn();
  return (
    (Mt = function (e, r, i, l) {
      ((this.l = a(1 + s.SBMAX_l)),
        (this.s = a(1 + s.SBMAX_s)),
        (this.psfb21 = a(1 + s.PSFB21)),
        (this.psfb12 = a(1 + s.PSFB12)));
      var o = this.l,
        _ = this.s;
      4 == arguments.length &&
        ((this.arrL = arguments[0]),
        (this.arrS = arguments[1]),
        (this.arr21 = arguments[2]),
        (this.arr12 = arguments[3]),
        t.arraycopy(
          this.arrL,
          0,
          o,
          0,
          Math.min(this.arrL.length, this.l.length),
        ),
        t.arraycopy(
          this.arrS,
          0,
          _,
          0,
          Math.min(this.arrS.length, this.s.length),
        ),
        t.arraycopy(
          this.arr21,
          0,
          this.psfb21,
          0,
          Math.min(this.arr21.length, this.psfb21.length),
        ),
        t.arraycopy(
          this.arr12,
          0,
          this.psfb12,
          0,
          Math.min(this.arr12.length, this.psfb12.length),
        ));
    }),
    Mt
  );
}
function Tn() {
  if (Ot) return It;
  Ot = 1;
  var e = wn();
  (e.System, e.VbrMode, e.Float, e.ShortBlock, e.Util, e.Arrays, e.new_array_n);
  var t = e.new_byte,
    a = e.new_double,
    s = e.new_float,
    r = e.new_float_n,
    i = e.new_int,
    l = e.new_int_n;
  e.assert;
  var o = (function () {
      if (At) return xt;
      At = 1;
      var e = wn();
      (e.System,
        e.VbrMode,
        e.Float,
        e.ShortBlock,
        e.Util,
        e.Arrays,
        e.new_array_n,
        e.new_byte,
        e.new_double,
        e.new_float,
        e.new_float_n);
      var t = e.new_int;
      (e.new_int_n, e.assert);
      var a = An();
      return (xt = function () {
        ((this.tt = [
          [null, null],
          [null, null],
        ]),
          (this.main_data_begin = 0),
          (this.private_bits = 0),
          (this.resvDrain_pre = 0),
          (this.resvDrain_post = 0),
          (this.scfsi = [t(4), t(4)]));
        for (var e = 0; e < 2; e++)
          for (var s = 0; s < 2; s++) this.tt[e][s] = new a();
      });
    })(),
    _ = Mn(),
    c = (function () {
      if (Et) return Bt;
      Et = 1;
      var e = wn();
      (e.System,
        e.VbrMode,
        e.Float,
        e.ShortBlock,
        e.Util,
        e.Arrays,
        e.new_array_n,
        e.new_byte,
        e.new_double);
      var t = e.new_float,
        a = e.new_float_n,
        s = e.new_int;
      (e.new_int_n, e.assert);
      var r = kn();
      return (Bt = function () {
        ((this.last_en_subshort = a([4, 9])),
          (this.lastAttacks = s(4)),
          (this.pefirbuf = t(19)),
          (this.longfact = t(r.SBMAX_l)),
          (this.shortfact = t(r.SBMAX_s)),
          (this.attackthre = 0),
          (this.attackthre_s = 0));
      });
    })(),
    u = Lt
      ? Pt
      : ((Lt = 1),
        (Pt = function () {
          ((this.sum = 0),
            (this.seen = 0),
            (this.want = 0),
            (this.pos = 0),
            (this.size = 0),
            (this.bag = null),
            (this.nVbrNumFrames = 0),
            (this.nBytesWritten = 0),
            (this.TotalFrameSize = 0));
        })),
    f = yn(),
    h = kn(),
    p = xn();
  function b() {
    function e() {
      ((this.write_timing = 0), (this.ptr = 0), (this.buf = t(40)));
    }
    ((this.Class_ID = 0),
      (this.lame_encode_frame_init = 0),
      (this.iteration_init_init = 0),
      (this.fill_buffer_resample_init = 0),
      (this.mfbuf = r([2, b.MFSIZE])),
      (this.mode_gr = 0),
      (this.channels_in = 0),
      (this.channels_out = 0),
      (this.resample_ratio = 0),
      (this.mf_samples_to_encode = 0),
      (this.mf_size = 0),
      (this.VBR_min_bitrate = 0),
      (this.VBR_max_bitrate = 0),
      (this.bitrate_index = 0),
      (this.samplerate_index = 0),
      (this.mode_ext = 0),
      (this.lowpass1 = 0),
      (this.lowpass2 = 0),
      (this.highpass1 = 0),
      (this.highpass2 = 0),
      (this.noise_shaping = 0),
      (this.noise_shaping_amp = 0),
      (this.substep_shaping = 0),
      (this.psymodel = 0),
      (this.noise_shaping_stop = 0),
      (this.subblock_gain = 0),
      (this.use_best_huffman = 0),
      (this.full_outer_loop = 0),
      (this.l3_side = new o()),
      (this.ms_ratio = s(2)),
      (this.padding = 0),
      (this.frac_SpF = 0),
      (this.slot_lag = 0),
      (this.tag_spec = null),
      (this.nMusicCRC = 0),
      (this.OldValue = i(2)),
      (this.CurrentStep = i(2)),
      (this.masking_lower = 0),
      (this.bv_scf = i(576)),
      (this.pseudohalf = i(p.SFBMAX)),
      (this.sfb21_extra = !1),
      (this.inbuf_old = new Array(2)),
      (this.blackfilt = new Array(2 * b.BPC + 1)),
      (this.itime = a(2)),
      (this.sideinfo_len = 0),
      (this.sb_sample = r([2, 2, 18, h.SBLIMIT])),
      (this.amp_filter = s(32)),
      (this.header = new Array(b.MAX_HEADER_BUF)),
      (this.h_ptr = 0),
      (this.w_ptr = 0),
      (this.ancillary_flag = 0),
      (this.ResvSize = 0),
      (this.ResvMax = 0),
      (this.scalefac_band = new _()),
      (this.minval_l = s(h.CBANDS)),
      (this.minval_s = s(h.CBANDS)),
      (this.nb_1 = r([4, h.CBANDS])),
      (this.nb_2 = r([4, h.CBANDS])),
      (this.nb_s1 = r([4, h.CBANDS])),
      (this.nb_s2 = r([4, h.CBANDS])),
      (this.s3_ss = null),
      (this.s3_ll = null),
      (this.decay = 0),
      (this.thm = new Array(4)),
      (this.en = new Array(4)),
      (this.tot_ener = s(4)),
      (this.loudness_sq = r([2, 2])),
      (this.loudness_sq_save = s(2)),
      (this.mld_l = s(h.SBMAX_l)),
      (this.mld_s = s(h.SBMAX_s)),
      (this.bm_l = i(h.SBMAX_l)),
      (this.bo_l = i(h.SBMAX_l)),
      (this.bm_s = i(h.SBMAX_s)),
      (this.bo_s = i(h.SBMAX_s)),
      (this.npart_l = 0),
      (this.npart_s = 0),
      (this.s3ind = l([h.CBANDS, 2])),
      (this.s3ind_s = l([h.CBANDS, 2])),
      (this.numlines_s = i(h.CBANDS)),
      (this.numlines_l = i(h.CBANDS)),
      (this.rnumlines_l = s(h.CBANDS)),
      (this.mld_cb_l = s(h.CBANDS)),
      (this.mld_cb_s = s(h.CBANDS)),
      (this.numlines_s_num1 = 0),
      (this.numlines_l_num1 = 0),
      (this.pe = s(4)),
      (this.ms_ratio_s_old = 0),
      (this.ms_ratio_l_old = 0),
      (this.ms_ener_ratio_old = 0),
      (this.blocktype_old = i(2)),
      (this.nsPsy = new c()),
      (this.VBR_seek_table = new u()),
      (this.ATH = null),
      (this.PSY = null),
      (this.nogap_total = 0),
      (this.nogap_current = 0),
      (this.decode_on_the_fly = !0),
      (this.findReplayGain = !0),
      (this.findPeakSample = !0),
      (this.PeakSample = 0),
      (this.RadioGain = 0),
      (this.AudiophileGain = 0),
      (this.rgdata = null),
      (this.noclipGainChange = 0),
      (this.noclipScale = 0),
      (this.bitrate_stereoMode_Hist = l([16, 5])),
      (this.bitrate_blockType_Hist = l([16, 6])),
      (this.pinfo = null),
      (this.hip = null),
      (this.in_buffer_nsamples = 0),
      (this.in_buffer_0 = null),
      (this.in_buffer_1 = null),
      (this.iteration_loop = null));
    for (var d = 0; d < this.en.length; d++) this.en[d] = new f();
    for (d = 0; d < this.thm.length; d++) this.thm[d] = new f();
    for (d = 0; d < this.header.length; d++) this.header[d] = new e();
  }
  return (
    (b.MFSIZE = 3456 + h.ENCDELAY - h.MDCTDELAY),
    (b.MAX_HEADER_BUF = 256),
    (b.MAX_BITS_PER_CHANNEL = 4095),
    (b.MAX_BITS_PER_GRANULE = 7680),
    (b.BPC = 320),
    (It = b)
  );
}
function Bn() {
  if (Ht) return Vt;
  Ht = 1;
  var e = wn(),
    t = e.System;
  (e.VbrMode, e.Float, e.ShortBlock, e.Util);
  var a = e.Arrays;
  function s() {
    s.YULE_ORDER;
    s.MAX_SAMP_FREQ;
    var e = s.RMS_WINDOW_TIME_NUMERATOR,
      r = s.RMS_WINDOW_TIME_DENOMINATOR;
    s.MAX_SAMPLES_PER_WINDOW;
    var i = [
        [
          0.038575994352, -3.84664617118067, -0.02160367184185,
          7.81501653005538, -0.00123395316851, -11.34170355132042,
          -9291677959e-14, 13.05504219327545, -0.01655260341619,
          -12.28759895145294, 0.02161526843274, 9.4829380631979,
          -0.02074045215285, -5.87257861775999, 0.00594298065125,
          2.75465861874613, 0.00306428023191, -0.86984376593551,
          0.00012025322027, 0.13919314567432, 0.00288463683916,
        ],
        [
          0.0541865640643, -3.47845948550071, -0.02911007808948,
          6.36317777566148, -0.00848709379851, -8.54751527471874,
          -0.00851165645469, 9.4769360780128, -0.00834990904936,
          -8.81498681370155, 0.02245293253339, 6.85401540936998,
          -0.02596338512915, -4.39470996079559, 0.01624864962975,
          2.19611684890774, -0.00240879051584, -0.75104302451432,
          0.00674613682247, 0.13149317958808, -0.00187763777362,
        ],
        [
          0.15457299681924, -2.37898834973084, -0.09331049056315,
          2.84868151156327, -0.06247880153653, -2.64577170229825,
          0.02163541888798, 2.23697657451713, -0.05588393329856,
          -1.67148153367602, 0.04781476674921, 1.00595954808547,
          0.00222312597743, -0.45953458054983, 0.03174092540049,
          0.16378164858596, -0.01390589421898, -0.05032077717131,
          0.00651420667831, 0.0234789740702, -0.00881362733839,
        ],
        [
          0.30296907319327, -1.61273165137247, -0.22613988682123,
          1.0797749225997, -0.08587323730772, -0.2565625775407,
          0.03282930172664, -0.1627671912044, -0.00915702933434,
          -0.22638893773906, -0.02364141202522, 0.39120800788284,
          -0.00584456039913, -0.22138138954925, 0.06276101321749,
          0.04500235387352, -828086748e-14, 0.02005851806501, 0.00205861885564,
          0.00302439095741, -0.02950134983287,
        ],
        [
          0.33642304856132, -1.49858979367799, -0.2557224142557,
          0.87350271418188, -0.11828570177555, 0.12205022308084,
          0.11921148675203, -0.80774944671438, -0.07834489609479,
          0.47854794562326, -0.0046997791438, -0.12453458140019,
          -0.0058950022444, -0.04067510197014, 0.05724228140351,
          0.08333755284107, 0.00832043980773, -0.04237348025746,
          -0.0163538138454, 0.02977207319925, -0.0176017656815,
        ],
        [
          0.4491525660845, -0.62820619233671, -0.14351757464547,
          0.29661783706366, -0.22784394429749, -0.372563729424,
          -0.01419140100551, 0.00213767857124, 0.04078262797139,
          -0.42029820170918, -0.12398163381748, 0.22199650564824,
          0.04097565135648, 0.00613424350682, 0.10478503600251,
          0.06747620744683, -0.01863887810927, 0.05784820375801,
          -0.03193428438915, 0.03222754072173, 0.00541907748707,
        ],
        [
          0.56619470757641, -1.04800335126349, -0.75464456939302,
          0.29156311971249, 0.1624213774223, -0.26806001042947,
          0.16744243493672, 0.00819999645858, -0.18901604199609,
          0.45054734505008, 0.3093178284183, -0.33032403314006,
          -0.27562961986224, 0.0673936833311, 0.00647310677246,
          -0.04784254229033, 0.08647503780351, 0.01639907836189,
          -0.0378898455484, 0.01807364323573, -0.00588215443421,
        ],
        [
          0.58100494960553, -0.51035327095184, -0.53174909058578,
          -0.31863563325245, -0.14289799034253, -0.20256413484477,
          0.17520704835522, 0.1472815413433, 0.02377945217615, 0.38952639978999,
          0.15558449135573, -0.23313271880868, -0.25344790059353,
          -0.05246019024463, 0.01628462406333, -0.02505961724053,
          0.06920467763959, 0.02442357316099, -0.03721611395801,
          0.01818801111503, -0.00749618797172,
        ],
        [
          0.53648789255105, -0.2504987195602, -0.42163034350696,
          -0.43193942311114, -0.00275953611929, -0.03424681017675,
          0.04267842219415, -0.04678328784242, -0.10214864179676,
          0.26408300200955, 0.14590772289388, 0.15113130533216,
          -0.02459864859345, -0.17556493366449, -0.11202315195388,
          -0.18823009262115, -0.04060034127, 0.05477720428674, 0.0478866554818,
          0.0470440968812, -0.02217936801134,
        ],
      ],
      l = [
        [
          0.98621192462708, -1.97223372919527, -1.97242384925416,
          0.97261396931306, 0.98621192462708,
        ],
        [
          0.98500175787242, -1.96977855582618, -1.97000351574484,
          0.9702284756635, 0.98500175787242,
        ],
        [
          0.97938932735214, -1.95835380975398, -1.95877865470428,
          0.95920349965459, 0.97938932735214,
        ],
        [
          0.97531843204928, -1.95002759149878, -1.95063686409857,
          0.95124613669835, 0.97531843204928,
        ],
        [
          0.97316523498161, -1.94561023566527, -1.94633046996323,
          0.94705070426118, 0.97316523498161,
        ],
        [
          0.96454515552826, -1.92783286977036, -1.92909031105652,
          0.93034775234268, 0.96454515552826,
        ],
        [
          0.96009142950541, -1.91858953033784, -1.92018285901082,
          0.92177618768381, 0.96009142950541,
        ],
        [
          0.95856916599601, -1.9154210807478, -1.91713833199203,
          0.91885558323625, 0.95856916599601,
        ],
        [
          0.94597685600279, -1.88903307939452, -1.89195371200558,
          0.89487434461664, 0.94597685600279,
        ],
      ];
    function o(e, t, a, s, r, i) {
      for (; 0 != r--; )
        ((a[s] =
          1e-10 +
          e[t + 0] * i[0] -
          a[s - 1] * i[1] +
          e[t - 1] * i[2] -
          a[s - 2] * i[3] +
          e[t - 2] * i[4] -
          a[s - 3] * i[5] +
          e[t - 3] * i[6] -
          a[s - 4] * i[7] +
          e[t - 4] * i[8] -
          a[s - 5] * i[9] +
          e[t - 5] * i[10] -
          a[s - 6] * i[11] +
          e[t - 6] * i[12] -
          a[s - 7] * i[13] +
          e[t - 7] * i[14] -
          a[s - 8] * i[15] +
          e[t - 8] * i[16] -
          a[s - 9] * i[17] +
          e[t - 9] * i[18] -
          a[s - 10] * i[19] +
          e[t - 10] * i[20]),
          ++s,
          ++t);
    }
    function _(e, t, a, s, r, i) {
      for (; 0 != r--; )
        ((a[s] =
          e[t + 0] * i[0] -
          a[s - 1] * i[1] +
          e[t - 1] * i[2] -
          a[s - 2] * i[3] +
          e[t - 2] * i[4]),
          ++s,
          ++t);
    }
    function c(e) {
      return e * e;
    }
    ((this.InitGainAnalysis = function (t, s) {
      return (function (t, s) {
        for (var i = 0; i < MAX_ORDER; i++)
          t.linprebuf[i] =
            t.lstepbuf[i] =
            t.loutbuf[i] =
            t.rinprebuf[i] =
            t.rstepbuf[i] =
            t.routbuf[i] =
              0;
        switch (0 | s) {
          case 48e3:
            t.reqindex = 0;
            break;
          case 44100:
            t.reqindex = 1;
            break;
          case 32e3:
            t.reqindex = 2;
            break;
          case 24e3:
            t.reqindex = 3;
            break;
          case 22050:
            t.reqindex = 4;
            break;
          case 16e3:
            t.reqindex = 5;
            break;
          case 12e3:
            t.reqindex = 6;
            break;
          case 11025:
            t.reqindex = 7;
            break;
          case 8e3:
            t.reqindex = 8;
            break;
          default:
            return INIT_GAIN_ANALYSIS_ERROR;
        }
        return (
          (t.sampleWindow = 0 | ((s * e + r - 1) / r)),
          (t.lsum = 0),
          (t.rsum = 0),
          (t.totsamp = 0),
          a.ill(t.A, 0),
          INIT_GAIN_ANALYSIS_OK
        );
      })(t, s) != INIT_GAIN_ANALYSIS_OK
        ? INIT_GAIN_ANALYSIS_ERROR
        : ((t.linpre = MAX_ORDER),
          (t.rinpre = MAX_ORDER),
          (t.lstep = MAX_ORDER),
          (t.rstep = MAX_ORDER),
          (t.lout = MAX_ORDER),
          (t.rout = MAX_ORDER),
          a.fill(t.B, 0),
          INIT_GAIN_ANALYSIS_OK);
    }),
      (this.AnalyzeSamples = function (e, a, r, u, f, h, p) {
        var b, d, m, g, v, w, y;
        if (0 == h) return GAIN_ANALYSIS_OK;
        switch (((y = 0), (v = h), p)) {
          case 1:
            ((u = a), (f = r));
            break;
          case 2:
            break;
          default:
            return GAIN_ANALYSIS_ERROR;
        }
        for (
          h < MAX_ORDER
            ? (t.arraycopy(a, r, e.linprebuf, MAX_ORDER, h),
              t.arraycopy(u, f, e.rinprebuf, MAX_ORDER, h))
            : (t.arraycopy(a, r, e.linprebuf, MAX_ORDER, MAX_ORDER),
              t.arraycopy(u, f, e.rinprebuf, MAX_ORDER, MAX_ORDER));
          v > 0;
        ) {
          ((w =
            v > e.sampleWindow - e.totsamp ? e.sampleWindow - e.totsamp : v),
            y < MAX_ORDER
              ? ((b = e.linpre + y),
                (d = e.linprebuf),
                (m = e.rinpre + y),
                (g = e.rinprebuf),
                w > MAX_ORDER - y && (w = MAX_ORDER - y))
              : ((b = r + y), (d = a), (m = f + y), (g = u)),
            o(d, b, e.lstepbuf, e.lstep + e.totsamp, w, i[e.reqindex]),
            o(g, m, e.rstepbuf, e.rstep + e.totsamp, w, i[e.reqindex]),
            _(
              e.lstepbuf,
              e.lstep + e.totsamp,
              e.loutbuf,
              e.lout + e.totsamp,
              w,
              l[e.reqindex],
            ),
            _(
              e.rstepbuf,
              e.rstep + e.totsamp,
              e.routbuf,
              e.rout + e.totsamp,
              w,
              l[e.reqindex],
            ),
            (b = e.lout + e.totsamp),
            (d = e.loutbuf),
            (m = e.rout + e.totsamp),
            (g = e.routbuf));
          for (var k = w % 8; 0 != k--; )
            ((e.lsum += c(d[b++])), (e.rsum += c(g[m++])));
          for (k = w / 8; 0 != k--; )
            ((e.lsum +=
              c(d[b + 0]) +
              c(d[b + 1]) +
              c(d[b + 2]) +
              c(d[b + 3]) +
              c(d[b + 4]) +
              c(d[b + 5]) +
              c(d[b + 6]) +
              c(d[b + 7])),
              (b += 8),
              (e.rsum +=
                c(g[m + 0]) +
                c(g[m + 1]) +
                c(g[m + 2]) +
                c(g[m + 3]) +
                c(g[m + 4]) +
                c(g[m + 5]) +
                c(g[m + 6]) +
                c(g[m + 7])),
              (m += 8));
          if (
            ((v -= w), (y += w), (e.totsamp += w), e.totsamp == e.sampleWindow)
          ) {
            var S =
                10 *
                s.STEPS_per_dB *
                Math.log10(((e.lsum + e.rsum) / e.totsamp) * 0.5 + 1e-37),
              R = S <= 0 ? 0 : 0 | S;
            (R >= e.A.length && (R = e.A.length - 1),
              e.A[R]++,
              (e.lsum = e.rsum = 0),
              t.arraycopy(e.loutbuf, e.totsamp, e.loutbuf, 0, MAX_ORDER),
              t.arraycopy(e.routbuf, e.totsamp, e.routbuf, 0, MAX_ORDER),
              t.arraycopy(e.lstepbuf, e.totsamp, e.lstepbuf, 0, MAX_ORDER),
              t.arraycopy(e.rstepbuf, e.totsamp, e.rstepbuf, 0, MAX_ORDER),
              (e.totsamp = 0));
          }
          if (e.totsamp > e.sampleWindow) return GAIN_ANALYSIS_ERROR;
        }
        return (
          h < MAX_ORDER
            ? (t.arraycopy(e.linprebuf, h, e.linprebuf, 0, MAX_ORDER - h),
              t.arraycopy(e.rinprebuf, h, e.rinprebuf, 0, MAX_ORDER - h),
              t.arraycopy(a, r, e.linprebuf, MAX_ORDER - h, h),
              t.arraycopy(u, f, e.rinprebuf, MAX_ORDER - h, h))
            : (t.arraycopy(a, r + h - MAX_ORDER, e.linprebuf, 0, MAX_ORDER),
              t.arraycopy(u, f + h - MAX_ORDER, e.rinprebuf, 0, MAX_ORDER)),
          GAIN_ANALYSIS_OK
        );
      }),
      (this.GetTitleGain = function (e) {
        for (
          var t = (function (e, t) {
              var a,
                r = 0;
              for (a = 0; a < t; a++) r += e[a];
              if (0 == r) return GAIN_NOT_ENOUGH_SAMPLES;
              var i = 0 | Math.ceil(r * (1 - 0.95));
              for (a = t; a-- > 0 && !((i -= e[a]) <= 0); );
              return 64.82 - a / s.STEPS_per_dB;
            })(e.A, e.A.length),
            a = 0;
          a < e.A.length;
          a++
        )
          ((e.B[a] += e.A[a]), (e.A[a] = 0));
        for (a = 0; a < MAX_ORDER; a++)
          e.linprebuf[a] =
            e.lstepbuf[a] =
            e.loutbuf[a] =
            e.rinprebuf[a] =
            e.rstepbuf[a] =
            e.routbuf[a] =
              0;
        return ((e.totsamp = 0), (e.lsum = e.rsum = 0), t);
      }));
  }
  return (
    e.new_array_n,
    e.new_byte,
    e.new_double,
    e.new_float,
    e.new_float_n,
    e.new_int,
    e.new_int_n,
    e.assert,
    (s.STEPS_per_dB = 100),
    (s.MAX_dB = 120),
    (s.GAIN_NOT_ENOUGH_SAMPLES = -24601),
    (s.GAIN_ANALYSIS_ERROR = 0),
    (s.GAIN_ANALYSIS_OK = 1),
    (s.INIT_GAIN_ANALYSIS_ERROR = 0),
    (s.INIT_GAIN_ANALYSIS_OK = 1),
    (s.YULE_ORDER = 10),
    (s.MAX_ORDER = s.YULE_ORDER),
    (s.MAX_SAMP_FREQ = 48e3),
    (s.RMS_WINDOW_TIME_NUMERATOR = 1),
    (s.RMS_WINDOW_TIME_DENOMINATOR = 20),
    (s.MAX_SAMPLES_PER_WINDOW =
      (s.MAX_SAMP_FREQ * s.RMS_WINDOW_TIME_NUMERATOR) /
        s.RMS_WINDOW_TIME_DENOMINATOR +
      1),
    (Vt = s)
  );
}
function En() {
  if (Xt) return Ft;
  return (
    (Xt = 1),
    (Ft = function (e) {
      this.bits = e;
    })
  );
}
function Pn() {
  if (jt) return Yt;
  function e(e, t, a, s) {
    ((this.xlen = e), (this.linmax = t), (this.table = a), (this.hlen = s));
  }
  jt = 1;
  var t = {
    t1HB: [1, 1, 1, 0],
    t2HB: [1, 2, 1, 3, 1, 1, 3, 2, 0],
    t3HB: [3, 2, 1, 1, 1, 1, 3, 2, 0],
    t5HB: [1, 2, 6, 5, 3, 1, 4, 4, 7, 5, 7, 1, 6, 1, 1, 0],
    t6HB: [7, 3, 5, 1, 6, 2, 3, 2, 5, 4, 4, 1, 3, 3, 2, 0],
    t7HB: [
      1, 2, 10, 19, 16, 10, 3, 3, 7, 10, 5, 3, 11, 4, 13, 17, 8, 4, 12, 11, 18,
      15, 11, 2, 7, 6, 9, 14, 3, 1, 6, 4, 5, 3, 2, 0,
    ],
    t8HB: [
      3, 4, 6, 18, 12, 5, 5, 1, 2, 16, 9, 3, 7, 3, 5, 14, 7, 3, 19, 17, 15, 13,
      10, 4, 13, 5, 8, 11, 5, 1, 12, 4, 4, 1, 1, 0,
    ],
    t9HB: [
      7, 5, 9, 14, 15, 7, 6, 4, 5, 5, 6, 7, 7, 6, 8, 8, 8, 5, 15, 6, 9, 10, 5,
      1, 11, 7, 9, 6, 4, 1, 14, 4, 6, 2, 6, 0,
    ],
    t10HB: [
      1, 2, 10, 23, 35, 30, 12, 17, 3, 3, 8, 12, 18, 21, 12, 7, 11, 9, 15, 21,
      32, 40, 19, 6, 14, 13, 22, 34, 46, 23, 18, 7, 20, 19, 33, 47, 27, 22, 9,
      3, 31, 22, 41, 26, 21, 20, 5, 3, 14, 13, 10, 11, 16, 6, 5, 1, 9, 8, 7, 8,
      4, 4, 2, 0,
    ],
    t11HB: [
      3, 4, 10, 24, 34, 33, 21, 15, 5, 3, 4, 10, 32, 17, 11, 10, 11, 7, 13, 18,
      30, 31, 20, 5, 25, 11, 19, 59, 27, 18, 12, 5, 35, 33, 31, 58, 30, 16, 7,
      5, 28, 26, 32, 19, 17, 15, 8, 14, 14, 12, 9, 13, 14, 9, 4, 1, 11, 4, 6, 6,
      6, 3, 2, 0,
    ],
    t12HB: [
      9, 6, 16, 33, 41, 39, 38, 26, 7, 5, 6, 9, 23, 16, 26, 11, 17, 7, 11, 14,
      21, 30, 10, 7, 17, 10, 15, 12, 18, 28, 14, 5, 32, 13, 22, 19, 18, 16, 9,
      5, 40, 17, 31, 29, 17, 13, 4, 2, 27, 12, 11, 15, 10, 7, 4, 1, 27, 12, 8,
      12, 6, 3, 1, 0,
    ],
    t13HB: [
      1, 5, 14, 21, 34, 51, 46, 71, 42, 52, 68, 52, 67, 44, 43, 19, 3, 4, 12,
      19, 31, 26, 44, 33, 31, 24, 32, 24, 31, 35, 22, 14, 15, 13, 23, 36, 59,
      49, 77, 65, 29, 40, 30, 40, 27, 33, 42, 16, 22, 20, 37, 61, 56, 79, 73,
      64, 43, 76, 56, 37, 26, 31, 25, 14, 35, 16, 60, 57, 97, 75, 114, 91, 54,
      73, 55, 41, 48, 53, 23, 24, 58, 27, 50, 96, 76, 70, 93, 84, 77, 58, 79,
      29, 74, 49, 41, 17, 47, 45, 78, 74, 115, 94, 90, 79, 69, 83, 71, 50, 59,
      38, 36, 15, 72, 34, 56, 95, 92, 85, 91, 90, 86, 73, 77, 65, 51, 44, 43,
      42, 43, 20, 30, 44, 55, 78, 72, 87, 78, 61, 46, 54, 37, 30, 20, 16, 53,
      25, 41, 37, 44, 59, 54, 81, 66, 76, 57, 54, 37, 18, 39, 11, 35, 33, 31,
      57, 42, 82, 72, 80, 47, 58, 55, 21, 22, 26, 38, 22, 53, 25, 23, 38, 70,
      60, 51, 36, 55, 26, 34, 23, 27, 14, 9, 7, 34, 32, 28, 39, 49, 75, 30, 52,
      48, 40, 52, 28, 18, 17, 9, 5, 45, 21, 34, 64, 56, 50, 49, 45, 31, 19, 12,
      15, 10, 7, 6, 3, 48, 23, 20, 39, 36, 35, 53, 21, 16, 23, 13, 10, 6, 1, 4,
      2, 16, 15, 17, 27, 25, 20, 29, 11, 17, 12, 16, 8, 1, 1, 0, 1,
    ],
    t15HB: [
      7, 12, 18, 53, 47, 76, 124, 108, 89, 123, 108, 119, 107, 81, 122, 63, 13,
      5, 16, 27, 46, 36, 61, 51, 42, 70, 52, 83, 65, 41, 59, 36, 19, 17, 15, 24,
      41, 34, 59, 48, 40, 64, 50, 78, 62, 80, 56, 33, 29, 28, 25, 43, 39, 63,
      55, 93, 76, 59, 93, 72, 54, 75, 50, 29, 52, 22, 42, 40, 67, 57, 95, 79,
      72, 57, 89, 69, 49, 66, 46, 27, 77, 37, 35, 66, 58, 52, 91, 74, 62, 48,
      79, 63, 90, 62, 40, 38, 125, 32, 60, 56, 50, 92, 78, 65, 55, 87, 71, 51,
      73, 51, 70, 30, 109, 53, 49, 94, 88, 75, 66, 122, 91, 73, 56, 42, 64, 44,
      21, 25, 90, 43, 41, 77, 73, 63, 56, 92, 77, 66, 47, 67, 48, 53, 36, 20,
      71, 34, 67, 60, 58, 49, 88, 76, 67, 106, 71, 54, 38, 39, 23, 15, 109, 53,
      51, 47, 90, 82, 58, 57, 48, 72, 57, 41, 23, 27, 62, 9, 86, 42, 40, 37, 70,
      64, 52, 43, 70, 55, 42, 25, 29, 18, 11, 11, 118, 68, 30, 55, 50, 46, 74,
      65, 49, 39, 24, 16, 22, 13, 14, 7, 91, 44, 39, 38, 34, 63, 52, 45, 31, 52,
      28, 19, 14, 8, 9, 3, 123, 60, 58, 53, 47, 43, 32, 22, 37, 24, 17, 12, 15,
      10, 2, 1, 71, 37, 34, 30, 28, 20, 17, 26, 21, 16, 10, 6, 8, 6, 2, 0,
    ],
    t16HB: [
      1, 5, 14, 44, 74, 63, 110, 93, 172, 149, 138, 242, 225, 195, 376, 17, 3,
      4, 12, 20, 35, 62, 53, 47, 83, 75, 68, 119, 201, 107, 207, 9, 15, 13, 23,
      38, 67, 58, 103, 90, 161, 72, 127, 117, 110, 209, 206, 16, 45, 21, 39, 69,
      64, 114, 99, 87, 158, 140, 252, 212, 199, 387, 365, 26, 75, 36, 68, 65,
      115, 101, 179, 164, 155, 264, 246, 226, 395, 382, 362, 9, 66, 30, 59, 56,
      102, 185, 173, 265, 142, 253, 232, 400, 388, 378, 445, 16, 111, 54, 52,
      100, 184, 178, 160, 133, 257, 244, 228, 217, 385, 366, 715, 10, 98, 48,
      91, 88, 165, 157, 148, 261, 248, 407, 397, 372, 380, 889, 884, 8, 85, 84,
      81, 159, 156, 143, 260, 249, 427, 401, 392, 383, 727, 713, 708, 7, 154,
      76, 73, 141, 131, 256, 245, 426, 406, 394, 384, 735, 359, 710, 352, 11,
      139, 129, 67, 125, 247, 233, 229, 219, 393, 743, 737, 720, 885, 882, 439,
      4, 243, 120, 118, 115, 227, 223, 396, 746, 742, 736, 721, 712, 706, 223,
      436, 6, 202, 224, 222, 218, 216, 389, 386, 381, 364, 888, 443, 707, 440,
      437, 1728, 4, 747, 211, 210, 208, 370, 379, 734, 723, 714, 1735, 883, 877,
      876, 3459, 865, 2, 377, 369, 102, 187, 726, 722, 358, 711, 709, 866, 1734,
      871, 3458, 870, 434, 0, 12, 10, 7, 11, 10, 17, 11, 9, 13, 12, 10, 7, 5, 3,
      1, 3,
    ],
    t24HB: [
      15, 13, 46, 80, 146, 262, 248, 434, 426, 669, 653, 649, 621, 517, 1032,
      88, 14, 12, 21, 38, 71, 130, 122, 216, 209, 198, 327, 345, 319, 297, 279,
      42, 47, 22, 41, 74, 68, 128, 120, 221, 207, 194, 182, 340, 315, 295, 541,
      18, 81, 39, 75, 70, 134, 125, 116, 220, 204, 190, 178, 325, 311, 293, 271,
      16, 147, 72, 69, 135, 127, 118, 112, 210, 200, 188, 352, 323, 306, 285,
      540, 14, 263, 66, 129, 126, 119, 114, 214, 202, 192, 180, 341, 317, 301,
      281, 262, 12, 249, 123, 121, 117, 113, 215, 206, 195, 185, 347, 330, 308,
      291, 272, 520, 10, 435, 115, 111, 109, 211, 203, 196, 187, 353, 332, 313,
      298, 283, 531, 381, 17, 427, 212, 208, 205, 201, 193, 186, 177, 169, 320,
      303, 286, 268, 514, 377, 16, 335, 199, 197, 191, 189, 181, 174, 333, 321,
      305, 289, 275, 521, 379, 371, 11, 668, 184, 183, 179, 175, 344, 331, 314,
      304, 290, 277, 530, 383, 373, 366, 10, 652, 346, 171, 168, 164, 318, 309,
      299, 287, 276, 263, 513, 375, 368, 362, 6, 648, 322, 316, 312, 307, 302,
      292, 284, 269, 261, 512, 376, 370, 364, 359, 4, 620, 300, 296, 294, 288,
      282, 273, 266, 515, 380, 374, 369, 365, 361, 357, 2, 1033, 280, 278, 274,
      267, 264, 259, 382, 378, 372, 367, 363, 360, 358, 356, 0, 43, 20, 19, 17,
      15, 13, 11, 9, 7, 6, 4, 7, 5, 3, 1, 3,
    ],
    t32HB: [1, 10, 8, 20, 12, 20, 16, 32, 14, 12, 24, 0, 28, 16, 24, 16],
    t33HB: [15, 28, 26, 48, 22, 40, 36, 64, 14, 24, 20, 32, 12, 16, 8, 0],
    t1l: [1, 4, 3, 5],
    t2l: [1, 4, 7, 4, 5, 7, 6, 7, 8],
    t3l: [2, 3, 7, 4, 4, 7, 6, 7, 8],
    t5l: [1, 4, 7, 8, 4, 5, 8, 9, 7, 8, 9, 10, 8, 8, 9, 10],
    t6l: [3, 4, 6, 8, 4, 4, 6, 7, 5, 6, 7, 8, 7, 7, 8, 9],
    t7l: [
      1, 4, 7, 9, 9, 10, 4, 6, 8, 9, 9, 10, 7, 7, 9, 10, 10, 11, 8, 9, 10, 11,
      11, 11, 8, 9, 10, 11, 11, 12, 9, 10, 11, 12, 12, 12,
    ],
    t8l: [
      2, 4, 7, 9, 9, 10, 4, 4, 6, 10, 10, 10, 7, 6, 8, 10, 10, 11, 9, 10, 10,
      11, 11, 12, 9, 9, 10, 11, 12, 12, 10, 10, 11, 11, 13, 13,
    ],
    t9l: [
      3, 4, 6, 7, 9, 10, 4, 5, 6, 7, 8, 10, 5, 6, 7, 8, 9, 10, 7, 7, 8, 9, 9,
      10, 8, 8, 9, 9, 10, 11, 9, 9, 10, 10, 11, 11,
    ],
    t10l: [
      1, 4, 7, 9, 10, 10, 10, 11, 4, 6, 8, 9, 10, 11, 10, 10, 7, 8, 9, 10, 11,
      12, 11, 11, 8, 9, 10, 11, 12, 12, 11, 12, 9, 10, 11, 12, 12, 12, 12, 12,
      10, 11, 12, 12, 13, 13, 12, 13, 9, 10, 11, 12, 12, 12, 13, 13, 10, 10, 11,
      12, 12, 13, 13, 13,
    ],
    t11l: [
      2, 4, 6, 8, 9, 10, 9, 10, 4, 5, 6, 8, 10, 10, 9, 10, 6, 7, 8, 9, 10, 11,
      10, 10, 8, 8, 9, 11, 10, 12, 10, 11, 9, 10, 10, 11, 11, 12, 11, 12, 9, 10,
      11, 12, 12, 13, 12, 13, 9, 9, 9, 10, 11, 12, 12, 12, 9, 9, 10, 11, 12, 12,
      12, 12,
    ],
    t12l: [
      4, 4, 6, 8, 9, 10, 10, 10, 4, 5, 6, 7, 9, 9, 10, 10, 6, 6, 7, 8, 9, 10, 9,
      10, 7, 7, 8, 8, 9, 10, 10, 10, 8, 8, 9, 9, 10, 10, 10, 11, 9, 9, 10, 10,
      10, 11, 10, 11, 9, 9, 9, 10, 10, 11, 11, 12, 10, 10, 10, 11, 11, 11, 11,
      12,
    ],
    t13l: [
      1, 5, 7, 8, 9, 10, 10, 11, 10, 11, 12, 12, 13, 13, 14, 14, 4, 6, 8, 9, 10,
      10, 11, 11, 11, 11, 12, 12, 13, 14, 14, 14, 7, 8, 9, 10, 11, 11, 12, 12,
      11, 12, 12, 13, 13, 14, 15, 15, 8, 9, 10, 11, 11, 12, 12, 12, 12, 13, 13,
      13, 13, 14, 15, 15, 9, 9, 11, 11, 12, 12, 13, 13, 12, 13, 13, 14, 14, 15,
      15, 16, 10, 10, 11, 12, 12, 12, 13, 13, 13, 13, 14, 13, 15, 15, 16, 16,
      10, 11, 12, 12, 13, 13, 13, 13, 13, 14, 14, 14, 15, 15, 16, 16, 11, 11,
      12, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 16, 18, 18, 10, 10, 11, 12,
      12, 13, 13, 14, 14, 14, 14, 15, 15, 16, 17, 17, 11, 11, 12, 12, 13, 13,
      13, 15, 14, 15, 15, 16, 16, 16, 18, 17, 11, 12, 12, 13, 13, 14, 14, 15,
      14, 15, 16, 15, 16, 17, 18, 19, 12, 12, 12, 13, 14, 14, 14, 14, 15, 15,
      15, 16, 17, 17, 17, 18, 12, 13, 13, 14, 14, 15, 14, 15, 16, 16, 17, 17,
      17, 18, 18, 18, 13, 13, 14, 15, 15, 15, 16, 16, 16, 16, 16, 17, 18, 17,
      18, 18, 14, 14, 14, 15, 15, 15, 17, 16, 16, 19, 17, 17, 17, 19, 18, 18,
      13, 14, 15, 16, 16, 16, 17, 16, 17, 17, 18, 18, 21, 20, 21, 18,
    ],
    t15l: [
      3, 5, 6, 8, 8, 9, 10, 10, 10, 11, 11, 12, 12, 12, 13, 14, 5, 5, 7, 8, 9,
      9, 10, 10, 10, 11, 11, 12, 12, 12, 13, 13, 6, 7, 7, 8, 9, 9, 10, 10, 10,
      11, 11, 12, 12, 13, 13, 13, 7, 8, 8, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12,
      13, 13, 13, 8, 8, 9, 9, 10, 10, 11, 11, 11, 11, 12, 12, 12, 13, 13, 13, 9,
      9, 9, 10, 10, 10, 11, 11, 11, 11, 12, 12, 13, 13, 13, 14, 10, 9, 10, 10,
      10, 11, 11, 11, 11, 12, 12, 12, 13, 13, 14, 14, 10, 10, 10, 11, 11, 11,
      11, 12, 12, 12, 12, 12, 13, 13, 13, 14, 10, 10, 10, 11, 11, 11, 11, 12,
      12, 12, 12, 13, 13, 14, 14, 14, 10, 10, 11, 11, 11, 11, 12, 12, 12, 13,
      13, 13, 13, 14, 14, 14, 11, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13,
      13, 14, 15, 14, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14,
      14, 15, 12, 12, 11, 12, 12, 12, 13, 13, 13, 13, 13, 13, 14, 14, 15, 15,
      12, 12, 12, 12, 12, 13, 13, 13, 13, 14, 14, 14, 14, 14, 15, 15, 13, 13,
      13, 13, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 14, 15, 13, 13, 13, 13,
      13, 13, 13, 14, 14, 14, 14, 14, 15, 15, 15, 15,
    ],
    t16_5l: [
      1, 5, 7, 9, 10, 10, 11, 11, 12, 12, 12, 13, 13, 13, 14, 11, 4, 6, 8, 9,
      10, 11, 11, 11, 12, 12, 12, 13, 14, 13, 14, 11, 7, 8, 9, 10, 11, 11, 12,
      12, 13, 12, 13, 13, 13, 14, 14, 12, 9, 9, 10, 11, 11, 12, 12, 12, 13, 13,
      14, 14, 14, 15, 15, 13, 10, 10, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14,
      15, 15, 15, 12, 10, 10, 11, 11, 12, 13, 13, 14, 13, 14, 14, 15, 15, 15,
      16, 13, 11, 11, 11, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 16, 13,
      11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 15, 15, 17, 17, 13, 11, 12,
      12, 13, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 13, 12, 12, 12, 13,
      13, 14, 14, 15, 15, 15, 15, 16, 15, 16, 15, 14, 12, 13, 12, 13, 14, 14,
      14, 14, 15, 16, 16, 16, 17, 17, 16, 13, 13, 13, 13, 13, 14, 14, 15, 16,
      16, 16, 16, 16, 16, 15, 16, 14, 13, 14, 14, 14, 14, 15, 15, 15, 15, 17,
      16, 16, 16, 16, 18, 14, 15, 14, 14, 14, 15, 15, 16, 16, 16, 18, 17, 17,
      17, 19, 17, 14, 14, 15, 13, 14, 16, 16, 15, 16, 16, 17, 18, 17, 19, 17,
      16, 14, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14, 14, 14, 14, 14, 12,
    ],
    t16l: [
      1, 5, 7, 9, 10, 10, 11, 11, 12, 12, 12, 13, 13, 13, 14, 10, 4, 6, 8, 9,
      10, 11, 11, 11, 12, 12, 12, 13, 14, 13, 14, 10, 7, 8, 9, 10, 11, 11, 12,
      12, 13, 12, 13, 13, 13, 14, 14, 11, 9, 9, 10, 11, 11, 12, 12, 12, 13, 13,
      14, 14, 14, 15, 15, 12, 10, 10, 11, 11, 12, 12, 13, 13, 13, 14, 14, 14,
      15, 15, 15, 11, 10, 10, 11, 11, 12, 13, 13, 14, 13, 14, 14, 15, 15, 15,
      16, 12, 11, 11, 11, 12, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 16, 12,
      11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 15, 15, 17, 17, 12, 11, 12,
      12, 13, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 12, 12, 12, 12, 13,
      13, 14, 14, 15, 15, 15, 15, 16, 15, 16, 15, 13, 12, 13, 12, 13, 14, 14,
      14, 14, 15, 16, 16, 16, 17, 17, 16, 12, 13, 13, 13, 13, 14, 14, 15, 16,
      16, 16, 16, 16, 16, 15, 16, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 17,
      16, 16, 16, 16, 18, 13, 15, 14, 14, 14, 15, 15, 16, 16, 16, 18, 17, 17,
      17, 19, 17, 13, 14, 15, 13, 14, 16, 16, 15, 16, 16, 17, 18, 17, 19, 17,
      16, 13, 10, 10, 10, 11, 11, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13, 10,
    ],
    t24l: [
      4, 5, 7, 8, 9, 10, 10, 11, 11, 12, 12, 12, 12, 12, 13, 10, 5, 6, 7, 8, 9,
      10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 10, 7, 7, 8, 9, 9, 10, 10, 11, 11,
      11, 11, 12, 12, 12, 13, 9, 8, 8, 9, 9, 10, 10, 10, 11, 11, 11, 11, 12, 12,
      12, 12, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 9, 10,
      9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12, 9, 10, 10, 10, 10,
      10, 11, 11, 11, 11, 12, 12, 12, 12, 12, 13, 9, 11, 10, 10, 10, 11, 11, 11,
      11, 12, 12, 12, 12, 12, 13, 13, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11,
      12, 12, 12, 12, 13, 13, 10, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12,
      12, 13, 13, 13, 10, 12, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 13, 13,
      13, 13, 10, 12, 12, 11, 11, 11, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13,
      10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13, 13, 10, 12,
      12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13, 10, 13, 12, 12,
      12, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13, 13, 10, 9, 9, 9, 9, 9, 9, 9,
      9, 9, 9, 9, 10, 10, 10, 10, 6,
    ],
    t32l: [1, 5, 5, 7, 5, 8, 7, 9, 5, 7, 7, 9, 7, 9, 9, 10],
    t33l: [4, 5, 5, 6, 5, 6, 6, 7, 5, 6, 6, 7, 6, 7, 7, 8],
  };
  return (
    (t.ht = [
      new e(0, 0, null, null),
      new e(2, 0, t.t1HB, t.t1l),
      new e(3, 0, t.t2HB, t.t2l),
      new e(3, 0, t.t3HB, t.t3l),
      new e(0, 0, null, null),
      new e(4, 0, t.t5HB, t.t5l),
      new e(4, 0, t.t6HB, t.t6l),
      new e(6, 0, t.t7HB, t.t7l),
      new e(6, 0, t.t8HB, t.t8l),
      new e(6, 0, t.t9HB, t.t9l),
      new e(8, 0, t.t10HB, t.t10l),
      new e(8, 0, t.t11HB, t.t11l),
      new e(8, 0, t.t12HB, t.t12l),
      new e(16, 0, t.t13HB, t.t13l),
      new e(0, 0, null, t.t16_5l),
      new e(16, 0, t.t15HB, t.t15l),
      new e(1, 1, t.t16HB, t.t16l),
      new e(2, 3, t.t16HB, t.t16l),
      new e(3, 7, t.t16HB, t.t16l),
      new e(4, 15, t.t16HB, t.t16l),
      new e(6, 63, t.t16HB, t.t16l),
      new e(8, 255, t.t16HB, t.t16l),
      new e(10, 1023, t.t16HB, t.t16l),
      new e(13, 8191, t.t16HB, t.t16l),
      new e(4, 15, t.t24HB, t.t24l),
      new e(5, 31, t.t24HB, t.t24l),
      new e(6, 63, t.t24HB, t.t24l),
      new e(7, 127, t.t24HB, t.t24l),
      new e(8, 255, t.t24HB, t.t24l),
      new e(9, 511, t.t24HB, t.t24l),
      new e(11, 2047, t.t24HB, t.t24l),
      new e(13, 8191, t.t24HB, t.t24l),
      new e(0, 0, t.t32HB, t.t32l),
      new e(0, 0, t.t33HB, t.t33l),
    ]),
    (t.largetbl = [
      65540, 327685, 458759, 589832, 655369, 655370, 720906, 720907, 786443,
      786444, 786444, 851980, 851980, 851980, 917517, 655370, 262149, 393222,
      524295, 589832, 655369, 720906, 720906, 720907, 786443, 786443, 786444,
      851980, 917516, 851980, 917516, 655370, 458759, 524295, 589832, 655369,
      720905, 720906, 786442, 786443, 851979, 786443, 851979, 851980, 851980,
      917516, 917517, 720905, 589832, 589832, 655369, 720905, 720906, 786442,
      786442, 786443, 851979, 851979, 917515, 917516, 917516, 983052, 983052,
      786441, 655369, 655369, 720905, 720906, 786442, 786442, 851978, 851979,
      851979, 917515, 917516, 917516, 983052, 983052, 983053, 720905, 655370,
      655369, 720906, 720906, 786442, 851978, 851979, 917515, 851979, 917515,
      917516, 983052, 983052, 983052, 1048588, 786441, 720906, 720906, 720906,
      786442, 851978, 851979, 851979, 851979, 917515, 917516, 917516, 917516,
      983052, 983052, 1048589, 786441, 720907, 720906, 786442, 786442, 851979,
      851979, 851979, 917515, 917516, 983052, 983052, 983052, 983052, 1114125,
      1114125, 786442, 720907, 786443, 786443, 851979, 851979, 851979, 917515,
      917515, 983051, 983052, 983052, 983052, 1048588, 1048589, 1048589, 786442,
      786443, 786443, 786443, 851979, 851979, 917515, 917515, 983052, 983052,
      983052, 983052, 1048588, 983053, 1048589, 983053, 851978, 786444, 851979,
      786443, 851979, 917515, 917516, 917516, 917516, 983052, 1048588, 1048588,
      1048589, 1114125, 1114125, 1048589, 786442, 851980, 851980, 851979,
      851979, 917515, 917516, 983052, 1048588, 1048588, 1048588, 1048588,
      1048589, 1048589, 983053, 1048589, 851978, 851980, 917516, 917516, 917516,
      917516, 983052, 983052, 983052, 983052, 1114124, 1048589, 1048589,
      1048589, 1048589, 1179661, 851978, 983052, 917516, 917516, 917516, 983052,
      983052, 1048588, 1048588, 1048589, 1179661, 1114125, 1114125, 1114125,
      1245197, 1114125, 851978, 917517, 983052, 851980, 917516, 1048588,
      1048588, 983052, 1048589, 1048589, 1114125, 1179661, 1114125, 1245197,
      1114125, 1048589, 851978, 655369, 655369, 655369, 720905, 720905, 786441,
      786441, 786441, 851977, 851977, 851977, 851978, 851978, 851978, 851978,
      655366,
    ]),
    (t.table23 = [
      65538, 262147, 458759, 262148, 327684, 458759, 393222, 458759, 524296,
    ]),
    (t.table56 = [
      65539, 262148, 458758, 524296, 262148, 327684, 524294, 589831, 458757,
      524294, 589831, 655368, 524295, 524295, 589832, 655369,
    ]),
    (t.bitrate_table = [
      [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1],
      [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1],
      [0, 8, 16, 24, 32, 40, 48, 56, 64, -1, -1, -1, -1, -1, -1, -1],
    ]),
    (t.samplerate_table = [
      [22050, 24e3, 16e3, -1],
      [44100, 48e3, 32e3, -1],
      [11025, 12e3, 8e3, -1],
    ]),
    (t.scfsi_band = [0, 6, 11, 16, 21]),
    (Yt = t)
  );
}
function Ln() {
  if (Wt) return Gt;
  Wt = 1;
  var e = Mn(),
    t = wn();
  t.System;
  var a = t.VbrMode,
    s = t.Float;
  t.ShortBlock;
  var r = t.Util;
  (t.Arrays, t.new_array_n, t.new_byte, t.new_double);
  var i = t.new_float;
  t.new_float_n;
  var l = t.new_int;
  t.new_int_n;
  var o = t.assert,
    _ = kn(),
    c = En(),
    u = Tn();
  function f() {
    var t = null,
      h = null,
      p = null;
    function b(e) {
      return (o(0 <= e + f.Q_MAX2 && e < f.Q_MAX), y[e + f.Q_MAX2]);
    }
    ((this.setModules = function (e, a, s) {
      ((t = e), (h = a), (p = s));
    }),
      (this.IPOW20 = function (e) {
        return (o(0 <= e && e < f.Q_MAX), k[e]);
      }));
    var d = 2220446049250313e-31,
      m = f.IXMAX_VAL + 2,
      g = f.Q_MAX,
      v = f.Q_MAX2;
    f.LARGE_BITS;
    this.nr_of_sfb_block = [
      [
        [6, 5, 5, 5],
        [9, 9, 9, 9],
        [6, 9, 9, 9],
      ],
      [
        [6, 5, 7, 3],
        [9, 9, 12, 6],
        [6, 9, 12, 6],
      ],
      [
        [11, 10, 0, 0],
        [18, 18, 0, 0],
        [15, 18, 0, 0],
      ],
      [
        [7, 7, 7, 0],
        [12, 12, 12, 0],
        [6, 15, 12, 0],
      ],
      [
        [6, 6, 6, 3],
        [12, 9, 9, 6],
        [6, 12, 9, 6],
      ],
      [
        [8, 8, 5, 0],
        [15, 12, 9, 0],
        [6, 18, 9, 0],
      ],
    ];
    var w = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 2, 0];
    ((this.pretab = w),
      (this.sfBandIndex = [
        new e(
          [
            0, 6, 12, 18, 24, 30, 36, 44, 54, 66, 80, 96, 116, 140, 168, 200,
            238, 284, 336, 396, 464, 522, 576,
          ],
          [0, 4, 8, 12, 18, 24, 32, 42, 56, 74, 100, 132, 174, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 6, 12, 18, 24, 30, 36, 44, 54, 66, 80, 96, 114, 136, 162, 194,
            232, 278, 332, 394, 464, 540, 576,
          ],
          [0, 4, 8, 12, 18, 26, 36, 48, 62, 80, 104, 136, 180, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 6, 12, 18, 24, 30, 36, 44, 54, 66, 80, 96, 116, 140, 168, 200,
            238, 284, 336, 396, 464, 522, 576,
          ],
          [0, 4, 8, 12, 18, 26, 36, 48, 62, 80, 104, 134, 174, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 4, 8, 12, 16, 20, 24, 30, 36, 44, 52, 62, 74, 90, 110, 134, 162,
            196, 238, 288, 342, 418, 576,
          ],
          [0, 4, 8, 12, 16, 22, 30, 40, 52, 66, 84, 106, 136, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 4, 8, 12, 16, 20, 24, 30, 36, 42, 50, 60, 72, 88, 106, 128, 156,
            190, 230, 276, 330, 384, 576,
          ],
          [0, 4, 8, 12, 16, 22, 28, 38, 50, 64, 80, 100, 126, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 4, 8, 12, 16, 20, 24, 30, 36, 44, 54, 66, 82, 102, 126, 156, 194,
            240, 296, 364, 448, 550, 576,
          ],
          [0, 4, 8, 12, 16, 22, 30, 42, 58, 78, 104, 138, 180, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 6, 12, 18, 24, 30, 36, 44, 54, 66, 80, 96, 116, 140, 168, 200,
            238, 284, 336, 396, 464, 522, 576,
          ],
          [0, 4, 8, 12, 18, 26, 36, 48, 62, 80, 104, 134, 174, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 6, 12, 18, 24, 30, 36, 44, 54, 66, 80, 96, 116, 140, 168, 200,
            238, 284, 336, 396, 464, 522, 576,
          ],
          [0, 4, 8, 12, 18, 26, 36, 48, 62, 80, 104, 134, 174, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
        new e(
          [
            0, 12, 24, 36, 48, 60, 72, 88, 108, 132, 160, 192, 232, 280, 336,
            400, 476, 566, 568, 570, 572, 574, 576,
          ],
          [0, 8, 16, 24, 36, 52, 72, 96, 124, 160, 162, 164, 166, 192],
          [0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0],
        ),
      ]));
    var y = i(g + v + 1),
      k = i(g),
      S = i(m),
      R = i(m);
    function x(e, t) {
      var a = p.ATHformula(t, e);
      return ((a -= 100), (a = Math.pow(10, a / 10 + e.ATHlower)));
    }
    function A(e) {
      this.s = e;
    }
    ((this.adj43 = R),
      (this.iteration_init = function (e) {
        var a,
          r = e.internal_flags,
          i = r.l3_side;
        if (0 == r.iteration_init_init) {
          for (
            r.iteration_init_init = 1,
              i.main_data_begin = 0,
              (function (e) {
                for (
                  var t = e.internal_flags.ATH.l,
                    a = e.internal_flags.ATH.psfb21,
                    r = e.internal_flags.ATH.s,
                    i = e.internal_flags.ATH.psfb12,
                    l = e.internal_flags,
                    o = e.out_samplerate,
                    c = 0;
                  c < _.SBMAX_l;
                  c++
                ) {
                  var u = l.scalefac_band.l[c],
                    f = l.scalefac_band.l[c + 1];
                  t[c] = s.MAX_VALUE;
                  for (var h = u; h < f; h++) {
                    var p = x(e, (h * o) / 1152);
                    t[c] = Math.min(t[c], p);
                  }
                }
                for (c = 0; c < _.PSFB21; c++)
                  for (
                    u = l.scalefac_band.psfb21[c],
                      f = l.scalefac_band.psfb21[c + 1],
                      a[c] = s.MAX_VALUE,
                      h = u;
                    h < f;
                    h++
                  )
                    ((p = x(e, (h * o) / 1152)), (a[c] = Math.min(a[c], p)));
                for (c = 0; c < _.SBMAX_s; c++) {
                  for (
                    u = l.scalefac_band.s[c],
                      f = l.scalefac_band.s[c + 1],
                      r[c] = s.MAX_VALUE,
                      h = u;
                    h < f;
                    h++
                  )
                    ((p = x(e, (h * o) / 384)), (r[c] = Math.min(r[c], p)));
                  r[c] *= l.scalefac_band.s[c + 1] - l.scalefac_band.s[c];
                }
                for (c = 0; c < _.PSFB12; c++) {
                  for (
                    u = l.scalefac_band.psfb12[c],
                      f = l.scalefac_band.psfb12[c + 1],
                      i[c] = s.MAX_VALUE,
                      h = u;
                    h < f;
                    h++
                  )
                    ((p = x(e, (h * o) / 384)), (i[c] = Math.min(i[c], p)));
                  i[c] *= l.scalefac_band.s[13] - l.scalefac_band.s[12];
                }
                if (e.noATH) {
                  for (c = 0; c < _.SBMAX_l; c++) t[c] = 1e-20;
                  for (c = 0; c < _.PSFB21; c++) a[c] = 1e-20;
                  for (c = 0; c < _.SBMAX_s; c++) r[c] = 1e-20;
                  for (c = 0; c < _.PSFB12; c++) i[c] = 1e-20;
                }
                l.ATH.floor = 10 * Math.log10(x(e, -1));
              })(e),
              S[0] = 0,
              a = 1;
            a < m;
            a++
          )
            S[a] = Math.pow(a, 4 / 3);
          for (a = 0; a < m - 1; a++)
            R[a] = a + 1 - Math.pow(0.5 * (S[a] + S[a + 1]), 0.75);
          for (R[a] = 0.5, a = 0; a < g; a++)
            k[a] = Math.pow(2, -0.1875 * (a - 210));
          for (a = 0; a <= g + v; a++) y[a] = Math.pow(2, 0.25 * (a - 210 - v));
          var l, o, c, u;
          for (
            t.huffman_init(r),
              (a = (e.exp_nspsytune >> 2) & 63) >= 32 && (a -= 64),
              l = Math.pow(10, a / 4 / 10),
              (a = (e.exp_nspsytune >> 8) & 63) >= 32 && (a -= 64),
              o = Math.pow(10, a / 4 / 10),
              (a = (e.exp_nspsytune >> 14) & 63) >= 32 && (a -= 64),
              c = Math.pow(10, a / 4 / 10),
              (a = (e.exp_nspsytune >> 20) & 63) >= 32 && (a -= 64),
              u = c * Math.pow(10, a / 4 / 10),
              a = 0;
            a < _.SBMAX_l;
            a++
          ) {
            ((f = a <= 6 ? l : a <= 13 ? o : a <= 20 ? c : u),
              (r.nsPsy.longfact[a] = f));
          }
          for (a = 0; a < _.SBMAX_s; a++) {
            var f;
            ((f = a <= 5 ? l : a <= 10 ? o : a <= 11 ? c : u),
              (r.nsPsy.shortfact[a] = f));
          }
        }
      }),
      (this.on_pe = function (e, t, a, s, r, i) {
        var _,
          f,
          p = e.internal_flags,
          b = 0,
          d = l(2),
          m = new c(b),
          g = h.ResvMaxBits(e, s, m, i),
          v = (b = m.bits) + g;
        for (
          v > u.MAX_BITS_PER_GRANULE && (v = u.MAX_BITS_PER_GRANULE),
            _ = 0,
            f = 0;
          f < p.channels_out;
          ++f
        )
          ((a[f] = Math.min(u.MAX_BITS_PER_CHANNEL, b / p.channels_out)),
            (d[f] = 0 | ((a[f] * t[r][f]) / 700 - a[f])),
            d[f] > (3 * s) / 4 && (d[f] = (3 * s) / 4),
            d[f] < 0 && (d[f] = 0),
            d[f] + a[f] > u.MAX_BITS_PER_CHANNEL &&
              (d[f] = Math.max(0, u.MAX_BITS_PER_CHANNEL - a[f])),
            (_ += d[f]));
        if (_ > g) for (f = 0; f < p.channels_out; ++f) d[f] = (g * d[f]) / _;
        for (f = 0; f < p.channels_out; ++f) ((a[f] += d[f]), (g -= d[f]));
        for (_ = 0, f = 0; f < p.channels_out; ++f) _ += a[f];
        if (_ > u.MAX_BITS_PER_GRANULE) {
          var w = 0;
          for (f = 0; f < p.channels_out; ++f)
            ((a[f] *= u.MAX_BITS_PER_GRANULE), (a[f] /= _), (w += a[f]));
          o(w <= u.MAX_BITS_PER_GRANULE);
        }
        return v;
      }),
      (this.reduce_side = function (e, t, a, s) {
        (o(s <= u.MAX_BITS_PER_GRANULE),
          o(e[0] + e[1] <= u.MAX_BITS_PER_GRANULE));
        var r = (0.33 * (0.5 - t)) / 0.5;
        (r < 0 && (r = 0), r > 0.5 && (r = 0.5));
        var i = 0 | (0.5 * r * (e[0] + e[1]));
        (i > u.MAX_BITS_PER_CHANNEL - e[0] &&
          (i = u.MAX_BITS_PER_CHANNEL - e[0]),
          i < 0 && (i = 0),
          e[1] >= 125 &&
            (e[1] - i > 125
              ? (e[0] < a && (e[0] += i), (e[1] -= i))
              : ((e[0] += e[1] - 125), (e[1] = 125))),
          (i = e[0] + e[1]) > s &&
            ((e[0] = (s * e[0]) / i), (e[1] = (s * e[1]) / i)),
          o(e[0] <= u.MAX_BITS_PER_CHANNEL),
          o(e[1] <= u.MAX_BITS_PER_CHANNEL),
          o(e[0] + e[1] <= u.MAX_BITS_PER_GRANULE));
      }),
      (this.athAdjust = function (e, t, a) {
        var s = 90.30873362,
          i = r.FAST_LOG10_X(t, 10),
          l = e * e,
          o = 0;
        return (
          (i -= a),
          l > 1e-20 && (o = 1 + r.FAST_LOG10_X(l, 10 / s)),
          o < 0 && (o = 0),
          (i *= o),
          (i += a + s - 94.82444863),
          Math.pow(10, 0.1 * i)
        );
      }),
      (this.calc_xmin = function (e, t, s, r) {
        var i,
          l = 0,
          o = e.internal_flags,
          c = 0,
          u = 0,
          f = o.ATH,
          h = s.xr,
          p = e.VBR == a.vbr_mtrh ? 1 : 0,
          b = o.masking_lower;
        for (
          (e.VBR != a.vbr_mtrh && e.VBR != a.vbr_mt) || (b = 1), i = 0;
          i < s.psy_lmax;
          i++
        ) {
          ((S =
            (k =
              e.VBR == a.vbr_rh || e.VBR == a.vbr_mtrh
                ? athAdjust(f.adjust, f.l[i], f.floor)
                : f.adjust * f.l[i]) / (width = s.width[i])),
            (R = d),
            (T = width >> 1),
            (M = 0));
          do {
            ((M += B = h[c] * h[c]),
              (R += B < S ? B : S),
              (M += E = h[++c] * h[c]),
              (R += E < S ? E : S),
              c++);
          } while (--T > 0);
          if ((M > k && u++, i == _.SBPSY_l))
            R < (A = k * o.nsPsy.longfact[i]) && (R = A);
          if ((0 != p && (k = R), !e.ATHonly))
            if ((x = t.en.l[i]) > 0)
              ((A = (M * t.thm.l[i] * b) / x),
                0 != p && (A *= o.nsPsy.longfact[i]),
                k < A && (k = A));
          r[l++] = 0 != p ? k : k * o.nsPsy.longfact[i];
        }
        var m = 575;
        if (s.block_type != _.SHORT_TYPE)
          for (var g = 576; 0 != g-- && BitStream.EQ(h[g], 0); ) m = g;
        s.max_nonzero_coeff = m;
        for (var v = s.sfb_smin; i < s.psymax; v++, i += 3) {
          var width, w, y;
          for (
            y =
              e.VBR == a.vbr_rh || e.VBR == a.vbr_mtrh
                ? athAdjust(f.adjust, f.s[v], f.floor)
                : f.adjust * f.s[v],
              width = s.width[i],
              w = 0;
            w < 3;
            w++
          ) {
            var k,
              S,
              R,
              x,
              A,
              M = 0,
              T = width >> 1;
            ((S = y / width), (R = d));
            do {
              var B, E;
              ((M += B = h[c] * h[c]),
                (R += B < S ? B : S),
                (M += E = h[++c] * h[c]),
                (R += E < S ? E : S),
                c++);
            } while (--T > 0);
            if ((M > y && u++, v == _.SBPSY_s))
              R < (A = y * o.nsPsy.shortfact[v]) && (R = A);
            if (((k = 0 != p ? R : y), !e.ATHonly && !e.ATHshort))
              if ((x = t.en.s[v][w]) > 0)
                ((A = (M * t.thm.s[v][w] * b) / x),
                  0 != p && (A *= o.nsPsy.shortfact[v]),
                  k < A && (k = A));
            r[l++] = 0 != p ? k : k * o.nsPsy.shortfact[v];
          }
          e.useTemporal &&
            (r[l - 3] > r[l - 3 + 1] &&
              (r[l - 3 + 1] += (r[l - 3] - r[l - 3 + 1]) * o.decay),
            r[l - 3 + 1] > r[l - 3 + 2] &&
              (r[l - 3 + 2] += (r[l - 3 + 1] - r[l - 3 + 2]) * o.decay));
        }
        return u;
      }),
      (this.calc_noise_core = function (e, t, a, s) {
        var r = 0,
          l = t.s,
          o = e.l3_enc;
        if (l > e.count1)
          for (; 0 != a--; ) {
            ((c = e.xr[l]),
              l++,
              (r += c * c),
              (c = e.xr[l]),
              l++,
              (r += c * c));
          }
        else if (l > e.big_values) {
          var _ = i(2);
          for (_[0] = 0, _[1] = s; 0 != a--; ) {
            ((c = Math.abs(e.xr[l]) - _[o[l]]),
              l++,
              (r += c * c),
              (c = Math.abs(e.xr[l]) - _[o[l]]),
              l++,
              (r += c * c));
          }
        } else
          for (; 0 != a--; ) {
            var c;
            ((c = Math.abs(e.xr[l]) - S[o[l]] * s),
              l++,
              (r += c * c),
              (c = Math.abs(e.xr[l]) - S[o[l]] * s),
              l++,
              (r += c * c));
          }
        return ((t.s = l), r);
      }),
      (this.calc_noise = function (e, t, a, s, i) {
        var l,
          o,
          _ = 0,
          c = 0,
          u = 0,
          f = 0,
          h = 0,
          p = -20,
          d = 0,
          m = e.scalefac,
          g = 0;
        for (s.over_SSD = 0, l = 0; l < e.psymax; l++) {
          var v,
            y =
              e.global_gain -
              ((m[g++] + (0 != e.preflag ? w[l] : 0)) <<
                (e.scalefac_scale + 1)) -
              8 * e.subblock_gain[e.window[l]],
            k = 0;
          if (null != i && i.step[l] == y)
            ((k = i.noise[l]),
              (d += e.width[l]),
              (a[_++] = k / t[c++]),
              (k = i.noise_log[l]));
          else {
            var S,
              R = b(y);
            if (((o = e.width[l] >> 1), d + e.width[l] > e.max_nonzero_coeff))
              o = (S = e.max_nonzero_coeff - d + 1) > 0 ? S >> 1 : 0;
            var x = new A(d);
            ((k = this.calc_noise_core(e, x, o, R)),
              (d = x.s),
              null != i && ((i.step[l] = y), (i.noise[l] = k)),
              (k = a[_++] = k / t[c++]),
              (k = r.FAST_LOG10(Math.max(k, 1e-20))),
              null != i && (i.noise_log[l] = k));
          }
          if ((null != i && (i.global_gain = e.global_gain), (h += k), k > 0))
            ((v = Math.max(0 | (10 * k + 0.5), 1)),
              (s.over_SSD += v * v),
              u++,
              (f += k));
          p = Math.max(p, k);
        }
        return (
          (s.over_count = u),
          (s.tot_noise = h),
          (s.over_noise = f),
          (s.max_noise = p),
          u
        );
      }),
      (this.set_pinfo = function (e, t, a, s, r) {
        var l,
          c,
          u,
          f,
          h,
          p = e.internal_flags,
          b = 0 == t.scalefac_scale ? 0.5 : 1,
          d = t.scalefac,
          m = i(L3Side.SFBMAX),
          g = i(L3Side.SFBMAX),
          v = new CalcNoiseResult();
        (calc_xmin(e, a, t, m), calc_noise(t, m, g, v, null));
        var y = 0;
        for (
          c = t.sfb_lmax,
            t.block_type != _.SHORT_TYPE && 0 == t.mixed_block_flag && (c = 22),
            l = 0;
          l < c;
          l++
        ) {
          var k = p.scalefac_band.l[l],
            S = (R = p.scalefac_band.l[l + 1]) - k;
          for (f = 0; y < R; y++) f += t.xr[y] * t.xr[y];
          ((f /= S),
            (h = 1e15),
            (p.pinfo.en[s][r][l] = h * f),
            (p.pinfo.xfsf[s][r][l] = (h * m[l] * g[l]) / S),
            a.en.l[l] > 0 && !e.ATHonly ? (f /= a.en.l[l]) : (f = 0),
            (p.pinfo.thr[s][r][l] = h * Math.max(f * a.thm.l[l], p.ATH.l[l])),
            (p.pinfo.LAMEsfb[s][r][l] = 0),
            0 != t.preflag && l >= 11 && (p.pinfo.LAMEsfb[s][r][l] = -b * w[l]),
            l < _.SBPSY_l &&
              (o(d[l] >= 0), (p.pinfo.LAMEsfb[s][r][l] -= b * d[l])));
        }
        if (t.block_type == _.SHORT_TYPE)
          for (c = l, l = t.sfb_smin; l < _.SBMAX_s; l++) {
            ((k = p.scalefac_band.s[l]),
              (S = (R = p.scalefac_band.s[l + 1]) - k));
            for (var R, x = 0; x < 3; x++) {
              for (f = 0, u = k; u < R; u++) ((f += t.xr[y] * t.xr[y]), y++);
              ((f = Math.max(f / S, 1e-20)),
                (h = 1e15),
                (p.pinfo.en_s[s][r][3 * l + x] = h * f),
                (p.pinfo.xfsf_s[s][r][3 * l + x] = (h * m[c] * g[c]) / S),
                a.en.s[l][x] > 0 ? (f /= a.en.s[l][x]) : (f = 0),
                (e.ATHonly || e.ATHshort) && (f = 0),
                (p.pinfo.thr_s[s][r][3 * l + x] =
                  h * Math.max(f * a.thm.s[l][x], p.ATH.s[l])),
                (p.pinfo.LAMEsfb_s[s][r][3 * l + x] = -2 * t.subblock_gain[x]),
                l < _.SBPSY_s &&
                  (p.pinfo.LAMEsfb_s[s][r][3 * l + x] -= b * d[c]),
                c++);
            }
          }
        ((p.pinfo.LAMEqss[s][r] = t.global_gain),
          (p.pinfo.LAMEmainbits[s][r] = t.part2_3_length + t.part2_length),
          (p.pinfo.LAMEsfbits[s][r] = t.part2_length),
          (p.pinfo.over[s][r] = v.over_count),
          (p.pinfo.max_noise[s][r] = 10 * v.max_noise),
          (p.pinfo.over_noise[s][r] = 10 * v.over_noise),
          (p.pinfo.tot_noise[s][r] = 10 * v.tot_noise),
          (p.pinfo.over_SSD[s][r] = v.over_SSD));
      }));
  }
  return (
    (f.Q_MAX = 257),
    (f.Q_MAX2 = 116),
    (f.LARGE_BITS = 1e5),
    (f.IXMAX_VAL = 8206),
    (Gt = f)
  );
}
function In() {
  if (Zt) return $t;
  Zt = 1;
  var e = wn(),
    t = e.System;
  (e.VbrMode, e.Float, e.ShortBlock, e.Util);
  var a = e.Arrays;
  (e.new_array_n, e.new_byte, e.new_double, e.new_float, e.new_float_n);
  var s = e.new_int;
  e.new_int_n;
  var r = e.assert,
    i = kn(),
    l = Pn(),
    o = An(),
    _ = Ln();
  return (
    ($t = function e() {
      var c = null;
      function u(e) {
        this.bits = 0 | e;
      }
      ((this.qupvt = null),
        (this.setModules = function (e) {
          ((this.qupvt = e), (c = e));
        }));
      var f = [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 1],
        [1, 2],
        [2, 2],
        [2, 3],
        [2, 3],
        [3, 4],
        [3, 4],
        [3, 4],
        [4, 5],
        [4, 5],
        [4, 6],
        [5, 6],
        [5, 6],
        [5, 7],
        [6, 7],
        [6, 7],
      ];
      function h(e, t, a, s, i, l) {
        var o = 0.5946 / t;
        for (r(e > 0), e >>= 1; 0 != e--; )
          ((i[l++] = o > a[s++] ? 0 : 1), (i[l++] = o > a[s++] ? 0 : 1));
      }
      function p(e, t, a, s, i, l) {
        r(e > 0);
        var o = (e >>= 1) % 2;
        for (e >>= 1; 0 != e--; ) {
          var _, u, f, h, p, b, d, m;
          ((_ = a[s++] * t),
            (u = a[s++] * t),
            (p = 0 | _),
            (f = a[s++] * t),
            (b = 0 | u),
            (h = a[s++] * t),
            (d = 0 | f),
            (_ += c.adj43[p]),
            (m = 0 | h),
            (u += c.adj43[b]),
            (i[l++] = 0 | _),
            (f += c.adj43[d]),
            (i[l++] = 0 | u),
            (h += c.adj43[m]),
            (i[l++] = 0 | f),
            (i[l++] = 0 | h));
        }
        0 != o &&
          ((p = 0 | (_ = a[s++] * t)),
          (b = 0 | (u = a[s++] * t)),
          (_ += c.adj43[p]),
          (u += c.adj43[b]),
          (i[l++] = 0 | _),
          (i[l++] = 0 | u));
      }
      var b = [1, 2, 5, 7, 7, 10, 10, 13, 13, 13, 13, 13, 13, 13, 13];
      function d(e, t, a, s) {
        var r = (function (e, t, a) {
          var s = 0,
            r = 0;
          do {
            var i = e[t++],
              l = e[t++];
            (s < i && (s = i), r < l && (r = l));
          } while (t < a);
          return (s < r && (s = r), s);
        })(e, t, a);
        switch (r) {
          case 0:
            return r;
          case 1:
            return (function (e, t, a, s) {
              var r = 0,
                i = l.ht[1].hlen;
              do {
                var o = 2 * e[t + 0] + e[t + 1];
                ((t += 2), (r += i[o]));
              } while (t < a);
              return ((s.bits += r), 1);
            })(e, t, a, s);
          case 2:
          case 3:
            return (function (e, t, a, s, r) {
              var i,
                o,
                _ = 0,
                c = l.ht[s].xlen;
              o = 2 == s ? l.table23 : l.table56;
              do {
                var u = e[t + 0] * c + e[t + 1];
                ((t += 2), (_ += o[u]));
              } while (t < a);
              return (
                (i = 65535 & _),
                (_ >>= 16) > i && ((_ = i), s++),
                (r.bits += _),
                s
              );
            })(e, t, a, b[r - 1], s);
          case 4:
          case 5:
          case 6:
          case 7:
          case 8:
          case 9:
          case 10:
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
            return (function (e, t, a, s, r) {
              var i = 0,
                o = 0,
                _ = 0,
                c = l.ht[s].xlen,
                u = l.ht[s].hlen,
                f = l.ht[s + 1].hlen,
                h = l.ht[s + 2].hlen;
              do {
                var p = e[t + 0] * c + e[t + 1];
                ((t += 2), (i += u[p]), (o += f[p]), (_ += h[p]));
              } while (t < a);
              var b = s;
              return (
                i > o && ((i = o), b++),
                i > _ && ((i = _), (b = s + 2)),
                (r.bits += i),
                b
              );
            })(e, t, a, b[r - 1], s);
          default:
            if (r > _.IXMAX_VAL) return ((s.bits = _.LARGE_BITS), -1);
            var i, o;
            for (r -= 15, i = 24; i < 32 && !(l.ht[i].linmax >= r); i++);
            for (o = i - 8; o < 24 && !(l.ht[o].linmax >= r); o++);
            return (function (e, t, a, s, r, i) {
              var o,
                _ = 65536 * l.ht[s].xlen + l.ht[r].xlen,
                c = 0;
              do {
                var u = e[t++],
                  f = e[t++];
                (0 != u && (u > 14 && ((u = 15), (c += _)), (u *= 16)),
                  0 != f && (f > 14 && ((f = 15), (c += _)), (u += f)),
                  (c += l.largetbl[u]));
              } while (t < a);
              return (
                (o = 65535 & c),
                (c >>= 16) > o && ((c = o), (s = r)),
                (i.bits += c),
                s
              );
            })(e, t, a, o, i, s);
        }
      }
      function m(e, t, a, s, r, l, o, _) {
        for (var c = t.big_values, f = 2; f < i.SBMAX_l + 1; f++) {
          var h = e.scalefac_band.l[f];
          if (h >= c) break;
          var p = r[f - 2] + t.count1bits;
          if (a.part2_3_length <= p) break;
          var b = new u(p),
            m = d(s, h, c, b);
          ((p = b.bits),
            a.part2_3_length <= p ||
              (a.assign(t),
              (a.part2_3_length = p),
              (a.region0_count = l[f - 2]),
              (a.region1_count = f - 2 - l[f - 2]),
              (a.table_select[0] = o[f - 2]),
              (a.table_select[1] = _[f - 2]),
              (a.table_select[2] = m)));
        }
      }
      ((this.noquant_count_bits = function (e, t, a) {
        var s = t.l3_enc,
          o = Math.min(576, ((t.max_nonzero_coeff + 2) >> 1) << 1);
        for (
          null != a && (a.sfb_count1 = 0);
          o > 1 && 0 == (s[o - 1] | s[o - 2]);
          o -= 2
        );
        t.count1 = o;
        for (var _ = 0, c = 0; o > 3; o -= 4) {
          var f;
          if ((2147483647 & (s[o - 1] | s[o - 2] | s[o - 3] | s[o - 4])) > 1)
            break;
          ((f = 2 * (2 * (2 * s[o - 4] + s[o - 3]) + s[o - 2]) + s[o - 1]),
            (_ += l.t32l[f]),
            (c += l.t33l[f]));
        }
        var h = _;
        if (
          ((t.count1table_select = 0),
          _ > c && ((h = c), (t.count1table_select = 1)),
          (t.count1bits = h),
          (t.big_values = o),
          0 == o)
        )
          return h;
        if (t.block_type == i.SHORT_TYPE)
          ((_ = 3 * e.scalefac_band.s[3]) > t.big_values && (_ = t.big_values),
            (c = t.big_values));
        else if (t.block_type == i.NORM_TYPE) {
          if (
            (r(o <= 576),
            (_ = t.region0_count = e.bv_scf[o - 2]),
            (c = t.region1_count = e.bv_scf[o - 1]),
            r(_ + c + 2 < i.SBPSY_l),
            (c = e.scalefac_band.l[_ + c + 2]),
            (_ = e.scalefac_band.l[_ + 1]),
            c < o)
          ) {
            var p = new u(h);
            ((t.table_select[2] = d(s, c, o, p)), (h = p.bits));
          }
        } else
          ((t.region0_count = 7),
            (t.region1_count = i.SBMAX_l - 1 - 7 - 1),
            (_ = e.scalefac_band.l[8]) > (c = o) && (_ = c));
        if (
          ((_ = Math.min(_, o)),
          (c = Math.min(c, o)),
          r(_ >= 0),
          r(c >= 0),
          0 < _)
        ) {
          p = new u(h);
          ((t.table_select[0] = d(s, 0, _, p)), (h = p.bits));
        }
        if (_ < c) {
          p = new u(h);
          ((t.table_select[1] = d(s, _, c, p)), (h = p.bits));
        }
        if (
          (2 == e.use_best_huffman &&
            ((t.part2_3_length = h),
            best_huffman_divide(e, t),
            (h = t.part2_3_length)),
          null != a && t.block_type == i.NORM_TYPE)
        ) {
          for (var b = 0; e.scalefac_band.l[b] < t.big_values; ) b++;
          a.sfb_count1 = b;
        }
        return h;
      }),
        (this.count_bits = function (e, t, s, l) {
          var o = s.l3_enc,
            u = _.IXMAX_VAL / c.IPOW20(s.global_gain);
          if (s.xrpow_max > u) return _.LARGE_BITS;
          if (
            ((function (e, t, s, l, o) {
              var _,
                u,
                f,
                b = 0,
                d = 0,
                m = 0,
                g = 0,
                v = t,
                w = 0,
                y = v,
                k = 0,
                S = e,
                R = 0;
              for (
                f = null != o && l.global_gain == o.global_gain,
                  u = l.block_type == i.SHORT_TYPE ? 38 : 21,
                  _ = 0;
                _ <= u;
                _++
              ) {
                var x = -1;
                if (
                  ((f || l.block_type == i.NORM_TYPE) &&
                    (x =
                      l.global_gain -
                      ((l.scalefac[_] + (0 != l.preflag ? c.pretab[_] : 0)) <<
                        (l.scalefac_scale + 1)) -
                      8 * l.subblock_gain[l.window[_]]),
                  r(l.width[_] >= 0),
                  f && o.step[_] == x)
                )
                  (0 != d && (p(d, s, S, R, y, k), (d = 0)),
                    0 != m && (h(m, s, S, R, y, k), (m = 0)));
                else {
                  var A,
                    M = l.width[_];
                  if (
                    (b + l.width[_] > l.max_nonzero_coeff &&
                      ((A = l.max_nonzero_coeff - b + 1),
                      a.fill(t, l.max_nonzero_coeff, 576, 0),
                      (M = A) < 0 && (M = 0),
                      (_ = u + 1)),
                    0 == d && 0 == m && ((y = v), (k = w), (S = e), (R = g)),
                    null != o &&
                    o.sfb_count1 > 0 &&
                    _ >= o.sfb_count1 &&
                    o.step[_] > 0 &&
                    x >= o.step[_]
                      ? (0 != d &&
                          (p(d, s, S, R, y, k),
                          (d = 0),
                          (y = v),
                          (k = w),
                          (S = e),
                          (R = g)),
                        (m += M))
                      : (0 != m &&
                          (h(m, s, S, R, y, k),
                          (m = 0),
                          (y = v),
                          (k = w),
                          (S = e),
                          (R = g)),
                        (d += M)),
                    M <= 0)
                  ) {
                    (0 != m && (h(m, s, S, R, y, k), (m = 0)),
                      0 != d && (p(d, s, S, R, y, k), (d = 0)));
                    break;
                  }
                }
                _ <= u &&
                  ((w += l.width[_]), (g += l.width[_]), (b += l.width[_]));
              }
              (0 != d && (p(d, s, S, R, y, k), (d = 0)),
                0 != m && (h(m, s, S, R, y, k), (m = 0)));
            })(t, o, c.IPOW20(s.global_gain), s, l),
            2 & e.substep_shaping)
          )
            for (
              var f = 0,
                b = s.global_gain + s.scalefac_scale,
                d = 0.634521682242439 / c.IPOW20(b),
                m = 0;
              m < s.sfbmax;
              m++
            ) {
              var g,
                width = s.width[m];
              if ((r(width >= 0), 0 == e.pseudohalf[m])) f += width;
              else
                for (g = f, f += width; g < f; ++g) o[g] = t[g] >= d ? o[g] : 0;
            }
          return this.noquant_count_bits(e, s, l);
        }),
        (this.best_huffman_divide = function (e, t) {
          var a = new o(),
            c = t.l3_enc,
            f = s(23),
            h = s(23),
            p = s(23),
            b = s(23);
          if (t.block_type != i.SHORT_TYPE || 1 != e.mode_gr) {
            (a.assign(t),
              t.block_type == i.NORM_TYPE &&
                (!(function (e, t, a, s, r, i, l) {
                  for (var o = t.big_values, c = 0; c <= 22; c++)
                    s[c] = _.LARGE_BITS;
                  for (c = 0; c < 16; c++) {
                    var f = e.scalefac_band.l[c + 1];
                    if (f >= o) break;
                    var h = 0,
                      p = new u(h),
                      b = d(a, 0, f, p);
                    h = p.bits;
                    for (var m = 0; m < 8; m++) {
                      var g = e.scalefac_band.l[c + m + 2];
                      if (g >= o) break;
                      var v = h,
                        w = d(a, f, g, (p = new u(v)));
                      ((v = p.bits),
                        s[c + m] > v &&
                          ((s[c + m] = v),
                          (r[c + m] = c),
                          (i[c + m] = b),
                          (l[c + m] = w)));
                    }
                  }
                })(e, t, c, f, h, p, b),
                m(e, a, t, c, f, h, p, b)));
            var g = a.big_values;
            if (
              !(0 == g || (c[g - 2] | c[g - 1]) > 1 || (g = t.count1 + 2) > 576)
            ) {
              (a.assign(t), (a.count1 = g));
              var v = 0,
                w = 0;
              for (r(g <= 576); g > a.big_values; g -= 4) {
                var y =
                  2 * (2 * (2 * c[g - 4] + c[g - 3]) + c[g - 2]) + c[g - 1];
                ((v += l.t32l[y]), (w += l.t33l[y]));
              }
              if (
                ((a.big_values = g),
                (a.count1table_select = 0),
                v > w && ((v = w), (a.count1table_select = 1)),
                (a.count1bits = v),
                a.block_type == i.NORM_TYPE)
              )
                m(e, a, t, c, f, h, p, b);
              else {
                if (
                  ((a.part2_3_length = v),
                  (v = e.scalefac_band.l[8]) > g && (v = g),
                  v > 0)
                ) {
                  var k = new u(a.part2_3_length);
                  ((a.table_select[0] = d(c, 0, v, k)),
                    (a.part2_3_length = k.bits));
                }
                if (g > v) {
                  k = new u(a.part2_3_length);
                  ((a.table_select[1] = d(c, v, g, k)),
                    (a.part2_3_length = k.bits));
                }
                t.part2_3_length > a.part2_3_length && t.assign(a);
              }
            }
          }
        }));
      var g = [1, 1, 1, 1, 8, 2, 2, 2, 4, 4, 4, 8, 8, 8, 16, 16],
        v = [1, 2, 4, 8, 1, 2, 4, 8, 2, 4, 8, 2, 4, 8, 4, 8],
        w = [0, 0, 0, 0, 3, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4],
        y = [0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 1, 2, 3, 2, 3];
      ((e.slen1_tab = w),
        (e.slen2_tab = y),
        (this.best_scalefac_store = function (e, t, a, s) {
          var o,
            _,
            u,
            f,
            h = s.tt[t][a],
            p = 0;
          for (u = 0, o = 0; o < h.sfbmax; o++) {
            var width = h.width[o];
            for (
              r(width >= 0), u += width, f = -width;
              f < 0 && 0 == h.l3_enc[f + u];
              f++
            );
            0 == f && (h.scalefac[o] = p = -2);
          }
          if (0 == h.scalefac_scale && 0 == h.preflag) {
            var b = 0;
            for (o = 0; o < h.sfbmax; o++)
              h.scalefac[o] > 0 && (b |= h.scalefac[o]);
            if (!(1 & b) && 0 != b) {
              for (o = 0; o < h.sfbmax; o++)
                h.scalefac[o] > 0 && (h.scalefac[o] >>= 1);
              h.scalefac_scale = p = 1;
            }
          }
          if (
            0 == h.preflag &&
            h.block_type != i.SHORT_TYPE &&
            2 == e.mode_gr
          ) {
            for (
              o = 11;
              o < i.SBPSY_l &&
              !(h.scalefac[o] < c.pretab[o] && -2 != h.scalefac[o]);
              o++
            );
            if (o == i.SBPSY_l) {
              for (o = 11; o < i.SBPSY_l; o++)
                h.scalefac[o] > 0 && (h.scalefac[o] -= c.pretab[o]);
              h.preflag = p = 1;
            }
          }
          for (_ = 0; _ < 4; _++) s.scfsi[a][_] = 0;
          for (
            2 == e.mode_gr &&
              1 == t &&
              s.tt[0][a].block_type != i.SHORT_TYPE &&
              s.tt[1][a].block_type != i.SHORT_TYPE &&
              (!(function (e, t) {
                for (
                  var a, s = t.tt[1][e], r = t.tt[0][e], o = 0;
                  o < l.scfsi_band.length - 1;
                  o++
                ) {
                  for (
                    a = l.scfsi_band[o];
                    a < l.scfsi_band[o + 1] &&
                    !(r.scalefac[a] != s.scalefac[a] && s.scalefac[a] >= 0);
                    a++
                  );
                  if (a == l.scfsi_band[o + 1]) {
                    for (a = l.scfsi_band[o]; a < l.scfsi_band[o + 1]; a++)
                      s.scalefac[a] = -1;
                    t.scfsi[e][o] = 1;
                  }
                }
                var _ = 0,
                  c = 0;
                for (a = 0; a < 11; a++)
                  -1 != s.scalefac[a] &&
                    (c++, _ < s.scalefac[a] && (_ = s.scalefac[a]));
                for (var u = 0, f = 0; a < i.SBPSY_l; a++)
                  -1 != s.scalefac[a] &&
                    (f++, u < s.scalefac[a] && (u = s.scalefac[a]));
                for (o = 0; o < 16; o++)
                  if (_ < g[o] && u < v[o]) {
                    var h = w[o] * c + y[o] * f;
                    s.part2_length > h &&
                      ((s.part2_length = h), (s.scalefac_compress = o));
                  }
              })(a, s),
              (p = 0)),
              o = 0;
            o < h.sfbmax;
            o++
          )
            -2 == h.scalefac[o] && (h.scalefac[o] = 0);
          0 != p &&
            (2 == e.mode_gr
              ? this.scale_bitcount(h)
              : this.scale_bitcount_lsf(e, h));
        }));
      var k = [
          0, 18, 36, 54, 54, 36, 54, 72, 54, 72, 90, 72, 90, 108, 108, 126,
        ],
        S = [0, 18, 36, 54, 51, 35, 53, 71, 52, 70, 88, 69, 87, 105, 104, 122],
        R = [0, 10, 20, 30, 33, 21, 31, 41, 32, 42, 52, 43, 53, 63, 64, 74];
      this.scale_bitcount = function (e) {
        var t,
          a,
          s,
          l = 0,
          o = 0,
          u = e.scalefac;
        if (
          (r(
            (function (e, n) {
              for (var t = 0; t < n; ++t) if (e[t] < 0) return !1;
              return !0;
            })(u, e.sfbmax),
          ),
          e.block_type == i.SHORT_TYPE)
        )
          ((s = k), 0 != e.mixed_block_flag && (s = S));
        else if (((s = R), 0 == e.preflag)) {
          for (a = 11; a < i.SBPSY_l && !(u[a] < c.pretab[a]); a++);
          if (a == i.SBPSY_l)
            for (e.preflag = 1, a = 11; a < i.SBPSY_l; a++) u[a] -= c.pretab[a];
        }
        for (a = 0; a < e.sfbdivide; a++) l < u[a] && (l = u[a]);
        for (; a < e.sfbmax; a++) o < u[a] && (o = u[a]);
        for (e.part2_length = _.LARGE_BITS, t = 0; t < 16; t++)
          l < g[t] &&
            o < v[t] &&
            e.part2_length > s[t] &&
            ((e.part2_length = s[t]), (e.scalefac_compress = t));
        return e.part2_length == _.LARGE_BITS;
      };
      var x = [
        [15, 15, 7, 7],
        [15, 15, 7, 0],
        [7, 3, 0, 0],
        [15, 31, 31, 0],
        [7, 7, 7, 0],
        [3, 3, 0, 0],
      ];
      this.scale_bitcount_lsf = function (e, a) {
        var l,
          o,
          _,
          u,
          f,
          h,
          p,
          b,
          d = s(4),
          m = a.scalefac;
        for (l = 0 != a.preflag ? 2 : 0, p = 0; p < 4; p++) d[p] = 0;
        if (a.block_type == i.SHORT_TYPE) {
          o = 1;
          var g = c.nr_of_sfb_block[l][o];
          for (b = 0, _ = 0; _ < 4; _++)
            for (u = g[_] / 3, p = 0; p < u; p++, b++)
              for (f = 0; f < 3; f++)
                m[3 * b + f] > d[_] && (d[_] = m[3 * b + f]);
        } else {
          o = 0;
          g = c.nr_of_sfb_block[l][o];
          for (b = 0, _ = 0; _ < 4; _++)
            for (u = g[_], p = 0; p < u; p++, b++) m[b] > d[_] && (d[_] = m[b]);
        }
        for (h = !1, _ = 0; _ < 4; _++) d[_] > x[l][_] && (h = !0);
        if (!h) {
          var v, w, y, k;
          for (
            a.sfb_partition_table = c.nr_of_sfb_block[l][o], _ = 0;
            _ < 4;
            _++
          )
            a.slen[_] = A[d[_]];
          switch (
            ((v = a.slen[0]),
            (w = a.slen[1]),
            (y = a.slen[2]),
            (k = a.slen[3]),
            l)
          ) {
            case 0:
              a.scalefac_compress = ((5 * v + w) << 4) + (y << 2) + k;
              break;
            case 1:
              a.scalefac_compress = 400 + ((5 * v + w) << 2) + y;
              break;
            case 2:
              a.scalefac_compress = 500 + 3 * v + w;
              break;
            default:
              t.err.printf("intensity stereo not implemented yet\n");
          }
        }
        if (!h)
          for (
            r(null != a.sfb_partition_table), a.part2_length = 0, _ = 0;
            _ < 4;
            _++
          )
            a.part2_length += a.slen[_] * a.sfb_partition_table[_];
        return h;
      };
      var A = [0, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4];
      this.huffman_init = function (e) {
        for (var t = 2; t <= 576; t += 2) {
          for (var a, s = 0; e.scalefac_band.l[++s] < t; );
          for (a = f[s][0]; e.scalefac_band.l[a + 1] > t; ) a--;
          for (
            a < 0 && (a = f[s][0]), e.bv_scf[t - 2] = a, a = f[s][1];
            e.scalefac_band.l[a + e.bv_scf[t - 2] + 2] > t;
          )
            a--;
          (a < 0 && (a = f[s][1]), (e.bv_scf[t - 1] = a));
        }
      };
    }),
    $t
  );
}
function On() {
  if (Qt) return Kt;
  Qt = 1;
  var e = wn(),
    t = e.System;
  (e.VbrMode, e.Float, e.ShortBlock, e.Util);
  var a = e.Arrays;
  e.new_array_n;
  var s = e.new_byte;
  (e.new_double, e.new_float);
  var r = e.new_float_n,
    i = e.new_int;
  e.new_int_n;
  var l = e.assert,
    o = In(),
    _ = Pn(),
    c = kn(),
    u = Tn();
  function f() {
    var e = this,
      f = 32,
      h = null,
      p = null,
      b = null,
      d = null;
    this.setModules = function (e, t, a, s) {
      ((h = e), (p = t), (b = a), (d = s));
    };
    var m = null,
      g = 0,
      v = 0,
      w = 0;
    function y(e) {
      (t.arraycopy(e.header[e.w_ptr].buf, 0, m, v, e.sideinfo_len),
        (v += e.sideinfo_len),
        (g += 8 * e.sideinfo_len),
        (e.w_ptr = (e.w_ptr + 1) & (u.MAX_HEADER_BUF - 1)));
    }
    function k(e, t, a) {
      for (l(a < 30); a > 0; ) {
        var s;
        (0 == w &&
          ((w = 8),
          v++,
          l(v < Lame.LAME_MAXMP3BUFFER),
          l(e.header[e.w_ptr].write_timing >= g),
          e.header[e.w_ptr].write_timing == g && y(e),
          (m[v] = 0)),
          (s = Math.min(a, w)),
          (w -= s),
          l((a -= s) < f),
          l(w < f),
          (m[v] |= (t >> a) << w),
          (g += s));
      }
    }
    function S(e, t, a) {
      for (l(a < 30); a > 0; ) {
        var s;
        (0 == w && ((w = 8), v++, l(v < Lame.LAME_MAXMP3BUFFER), (m[v] = 0)),
          (s = Math.min(a, w)),
          (w -= s),
          l((a -= s) < f),
          l(w < f),
          (m[v] |= (t >> a) << w),
          (g += s));
      }
    }
    function R(e, t) {
      var a,
        s = e.internal_flags;
      if (
        (l(t >= 0),
        t >= 8 && (k(s, 76, 8), (t -= 8)),
        t >= 8 && (k(s, 65, 8), (t -= 8)),
        t >= 8 && (k(s, 77, 8), (t -= 8)),
        t >= 8 && (k(s, 69, 8), (t -= 8)),
        t >= 32)
      ) {
        var r = b.getLameShortVersion();
        if (t >= 32)
          for (a = 0; a < r.length && t >= 8; ++a)
            ((t -= 8), k(s, r.charAt(a), 8));
      }
      for (; t >= 1; t -= 1)
        (k(s, s.ancillary_flag, 1),
          (s.ancillary_flag ^= e.disable_reservoir ? 0 : 1));
      l(0 == t);
    }
    function x(e, t, a) {
      for (var s = e.header[e.h_ptr].ptr; a > 0; ) {
        var r = Math.min(a, 8 - (7 & s));
        (l((a -= r) < f),
          (e.header[e.h_ptr].buf[s >> 3] |= (t >> a) << (8 - (7 & s) - r)),
          (s += r));
      }
      e.header[e.h_ptr].ptr = s;
    }
    function A(value, e) {
      value <<= 8;
      for (var t = 0; t < 8; t++)
        65536 & ((e <<= 1) ^ (value <<= 1)) && (e ^= 32773);
      return e;
    }
    function M(e, t) {
      var a,
        s = _.ht[t.count1table_select + 32],
        r = 0,
        i = t.big_values,
        o = t.big_values;
      for (
        l(t.count1table_select < 2), a = (t.count1 - t.big_values) / 4;
        a > 0;
        --a
      ) {
        var c,
          u = 0,
          f = 0;
        (0 != (c = t.l3_enc[i + 0]) &&
          ((f += 8), t.xr[o + 0] < 0 && u++, l(c <= 1)),
          0 != (c = t.l3_enc[i + 1]) &&
            ((f += 4), (u *= 2), t.xr[o + 1] < 0 && u++, l(c <= 1)),
          0 != (c = t.l3_enc[i + 2]) &&
            ((f += 2), (u *= 2), t.xr[o + 2] < 0 && u++, l(c <= 1)),
          0 != (c = t.l3_enc[i + 3]) &&
            (f++, (u *= 2), t.xr[o + 3] < 0 && u++, l(c <= 1)),
          (i += 4),
          (o += 4),
          k(e, u + s.table[f], s.hlen[f]),
          (r += s.hlen[f]));
      }
      return r;
    }
    function T(e, t, a, s, r) {
      var i = _.ht[t],
        o = 0;
      if ((l(t < 32), 0 == t)) return o;
      for (var c = a; c < s; c += 2) {
        var u = 0,
          h = 0,
          p = i.xlen,
          b = i.xlen,
          d = 0,
          m = r.l3_enc[c],
          g = r.l3_enc[c + 1];
        if ((0 != m && (r.xr[c] < 0 && d++, u--), t > 15)) {
          if (m > 14) {
            var v = m - 15;
            (l(v <= i.linmax), (d |= v << 1), (h = p), (m = 15));
          }
          if (g > 14) {
            var w = g - 15;
            (l(w <= i.linmax), (d <<= p), (d |= w), (h += p), (g = 15));
          }
          b = 16;
        }
        (0 != g && ((d <<= 1), r.xr[c + 1] < 0 && d++, u--),
          l((m | g) < 16),
          (m = m * b + g),
          (h -= u),
          (u += i.hlen[m]),
          l(u <= f),
          l(h <= f),
          k(e, i.table[m], u),
          k(e, d, h),
          (o += u + h));
      }
      return o;
    }
    function B(e, t) {
      var a = 3 * e.scalefac_band.s[3];
      a > t.big_values && (a = t.big_values);
      var s = T(e, t.table_select[0], 0, a, t);
      return (s += T(e, t.table_select[1], a, t.big_values, t));
    }
    function E(e, t) {
      var a, s, r, i;
      ((a = t.big_values), l(0 <= a && a <= 576));
      var o = t.region0_count + 1;
      return (
        l(0 <= o),
        l(o < e.scalefac_band.l.length),
        (r = e.scalefac_band.l[o]),
        (o += t.region1_count + 1),
        l(0 <= o),
        l(o < e.scalefac_band.l.length),
        r > a && (r = a),
        (i = e.scalefac_band.l[o]) > a && (i = a),
        (s = T(e, t.table_select[0], 0, r, t)),
        (s += T(e, t.table_select[1], r, i, t)),
        (s += T(e, t.table_select[2], i, a, t))
      );
    }
    function P() {
      this.total = 0;
    }
    function L(a, s) {
      var r,
        i,
        l,
        o,
        _,
        c = a.internal_flags;
      return (
        (_ = c.w_ptr),
        -1 == (o = c.h_ptr - 1) && (o = u.MAX_HEADER_BUF - 1),
        (r = c.header[o].write_timing - g),
        (s.total = r),
        r >= 0 &&
          ((i = 1 + o - _),
          o < _ && (i = 1 + o - _ + u.MAX_HEADER_BUF),
          (r -= 8 * i * c.sideinfo_len)),
        (r += l = e.getframebits(a)),
        (s.total += l),
        s.total % 8 != 0
          ? (s.total = 1 + s.total / 8)
          : (s.total = s.total / 8),
        (s.total += v + 1),
        r < 0 && t.err.println("strange error flushing buffer ... \n"),
        r
      );
    }
    ((this.getframebits = function (e) {
      var t,
        a = e.internal_flags;
      return (
        (t =
          0 != a.bitrate_index
            ? _.bitrate_table[e.version][a.bitrate_index]
            : e.brate),
        l(8 <= t && t <= 640),
        8 * (0 | ((72e3 * (e.version + 1) * t) / e.out_samplerate + a.padding))
      );
    }),
      (this.CRC_writeheader = function (e, t) {
        var a = 65535;
        ((a = A(255 & t[2], a)), (a = A(255 & t[3], a)));
        for (var s = 6; s < e.sideinfo_len; s++) a = A(255 & t[s], a);
        ((t[4] = byte(a >> 8)), (t[5] = byte(255 & a)));
      }),
      (this.flush_bitstream = function (e) {
        var t,
          a,
          s = e.internal_flags,
          r = s.h_ptr - 1;
        if (
          (-1 == r && (r = u.MAX_HEADER_BUF - 1),
          (t = s.l3_side),
          !((a = L(e, new P())) < 0))
        ) {
          if (
            (R(e, a),
            l(s.header[r].write_timing + this.getframebits(e) == g),
            (s.ResvSize = 0),
            (t.main_data_begin = 0),
            s.findReplayGain)
          ) {
            var i = h.GetTitleGain(s.rgdata);
            (l(NEQ(i, GainAnalysis.GAIN_NOT_ENOUGH_SAMPLES)),
              (s.RadioGain = 0 | Math.floor(10 * i + 0.5)));
          }
          s.findPeakSample &&
            ((s.noclipGainChange =
              0 | Math.ceil(20 * Math.log10(s.PeakSample / 32767) * 10)),
            s.noclipGainChange > 0 && (EQ(e.scale, 1) || EQ(e.scale, 0))
              ? (s.noclipScale = Math.floor((32767 / s.PeakSample) * 100) / 100)
              : (s.noclipScale = -1));
        }
      }),
      (this.add_dummy_byte = function (e, t, n) {
        for (var a, s = e.internal_flags; n-- > 0; )
          for (S(0, t, 8), a = 0; a < u.MAX_HEADER_BUF; ++a)
            s.header[a].write_timing += 8;
      }),
      (this.format_bitstream = function (e) {
        var s,
          r = e.internal_flags;
        s = r.l3_side;
        var i = this.getframebits(e);
        (R(e, s.resvDrain_pre),
          (function (e, s) {
            var r,
              i,
              o,
              _ = e.internal_flags;
            if (
              ((r = _.l3_side),
              (_.header[_.h_ptr].ptr = 0),
              a.fill(_.header[_.h_ptr].buf, 0, _.sideinfo_len, 0),
              e.out_samplerate < 16e3 ? x(_, 4094, 12) : x(_, 4095, 12),
              x(_, e.version, 1),
              x(_, 1, 2),
              x(_, e.error_protection ? 0 : 1, 1),
              x(_, _.bitrate_index, 4),
              x(_, _.samplerate_index, 2),
              x(_, _.padding, 1),
              x(_, e.extension, 1),
              x(_, e.mode.ordinal(), 2),
              x(_, _.mode_ext, 2),
              x(_, e.copyright, 1),
              x(_, e.original, 1),
              x(_, e.emphasis, 2),
              e.error_protection && x(_, 0, 16),
              1 == e.version)
            ) {
              for (
                l(r.main_data_begin >= 0),
                  x(_, r.main_data_begin, 9),
                  2 == _.channels_out
                    ? x(_, r.private_bits, 3)
                    : x(_, r.private_bits, 5),
                  o = 0;
                o < _.channels_out;
                o++
              ) {
                var f;
                for (f = 0; f < 4; f++) x(_, r.scfsi[o][f], 1);
              }
              for (i = 0; i < 2; i++)
                for (o = 0; o < _.channels_out; o++)
                  (x(_, (h = r.tt[i][o]).part2_3_length + h.part2_length, 12),
                    x(_, h.big_values / 2, 9),
                    x(_, h.global_gain, 8),
                    x(_, h.scalefac_compress, 4),
                    h.block_type != c.NORM_TYPE
                      ? (x(_, 1, 1),
                        x(_, h.block_type, 2),
                        x(_, h.mixed_block_flag, 1),
                        14 == h.table_select[0] && (h.table_select[0] = 16),
                        x(_, h.table_select[0], 5),
                        14 == h.table_select[1] && (h.table_select[1] = 16),
                        x(_, h.table_select[1], 5),
                        x(_, h.subblock_gain[0], 3),
                        x(_, h.subblock_gain[1], 3),
                        x(_, h.subblock_gain[2], 3))
                      : (x(_, 0, 1),
                        14 == h.table_select[0] && (h.table_select[0] = 16),
                        x(_, h.table_select[0], 5),
                        14 == h.table_select[1] && (h.table_select[1] = 16),
                        x(_, h.table_select[1], 5),
                        14 == h.table_select[2] && (h.table_select[2] = 16),
                        x(_, h.table_select[2], 5),
                        l(0 <= h.region0_count && h.region0_count < 16),
                        l(0 <= h.region1_count && h.region1_count < 8),
                        x(_, h.region0_count, 4),
                        x(_, h.region1_count, 3)),
                    x(_, h.preflag, 1),
                    x(_, h.scalefac_scale, 1),
                    x(_, h.count1table_select, 1));
            } else
              for (
                l(r.main_data_begin >= 0),
                  x(_, r.main_data_begin, 8),
                  x(_, r.private_bits, _.channels_out),
                  i = 0,
                  o = 0;
                o < _.channels_out;
                o++
              ) {
                var h;
                (x(_, (h = r.tt[i][o]).part2_3_length + h.part2_length, 12),
                  x(_, h.big_values / 2, 9),
                  x(_, h.global_gain, 8),
                  x(_, h.scalefac_compress, 9),
                  h.block_type != c.NORM_TYPE
                    ? (x(_, 1, 1),
                      x(_, h.block_type, 2),
                      x(_, h.mixed_block_flag, 1),
                      14 == h.table_select[0] && (h.table_select[0] = 16),
                      x(_, h.table_select[0], 5),
                      14 == h.table_select[1] && (h.table_select[1] = 16),
                      x(_, h.table_select[1], 5),
                      x(_, h.subblock_gain[0], 3),
                      x(_, h.subblock_gain[1], 3),
                      x(_, h.subblock_gain[2], 3))
                    : (x(_, 0, 1),
                      14 == h.table_select[0] && (h.table_select[0] = 16),
                      x(_, h.table_select[0], 5),
                      14 == h.table_select[1] && (h.table_select[1] = 16),
                      x(_, h.table_select[1], 5),
                      14 == h.table_select[2] && (h.table_select[2] = 16),
                      x(_, h.table_select[2], 5),
                      l(0 <= h.region0_count && h.region0_count < 16),
                      l(0 <= h.region1_count && h.region1_count < 8),
                      x(_, h.region0_count, 4),
                      x(_, h.region1_count, 3)),
                  x(_, h.scalefac_scale, 1),
                  x(_, h.count1table_select, 1));
              }
            e.error_protection && CRC_writeheader(_, _.header[_.h_ptr].buf);
            var p = _.h_ptr;
            (l(_.header[p].ptr == 8 * _.sideinfo_len),
              (_.h_ptr = (p + 1) & (u.MAX_HEADER_BUF - 1)),
              (_.header[_.h_ptr].write_timing = _.header[p].write_timing + s),
              _.h_ptr == _.w_ptr &&
                t.err.println(
                  "Error: MAX_HEADER_BUF too small in bitstream.c \n",
                ));
          })(e, i));
        var _ = 8 * r.sideinfo_len;
        if (
          ((_ += (function (e) {
            var t,
              a,
              s,
              r,
              i = 0,
              _ = e.internal_flags,
              u = _.l3_side;
            if (1 == e.version)
              for (t = 0; t < 2; t++)
                for (a = 0; a < _.channels_out; a++) {
                  var f = u.tt[t][a],
                    h = o.slen1_tab[f.scalefac_compress],
                    p = o.slen2_tab[f.scalefac_compress];
                  for (r = 0, s = 0; s < f.sfbdivide; s++)
                    -1 != f.scalefac[s] && (k(_, f.scalefac[s], h), (r += h));
                  for (; s < f.sfbmax; s++)
                    -1 != f.scalefac[s] && (k(_, f.scalefac[s], p), (r += p));
                  (l(r == f.part2_length),
                    f.block_type == c.SHORT_TYPE
                      ? (r += B(_, f))
                      : (r += E(_, f)),
                    (r += M(_, f)),
                    l(r == f.part2_3_length + f.part2_length),
                    (i += r));
                }
            else
              for (t = 0, a = 0; a < _.channels_out; a++) {
                f = u.tt[t][a];
                var b,
                  d,
                  m = 0;
                if (
                  (l(null != f.sfb_partition_table),
                  (r = 0),
                  (s = 0),
                  (d = 0),
                  f.block_type == c.SHORT_TYPE)
                ) {
                  for (; d < 4; d++) {
                    var g = f.sfb_partition_table[d] / 3,
                      v = f.slen[d];
                    for (b = 0; b < g; b++, s++)
                      (k(_, Math.max(f.scalefac[3 * s + 0], 0), v),
                        k(_, Math.max(f.scalefac[3 * s + 1], 0), v),
                        k(_, Math.max(f.scalefac[3 * s + 2], 0), v),
                        (m += 3 * v));
                  }
                  r += B(_, f);
                } else {
                  for (; d < 4; d++)
                    for (
                      g = f.sfb_partition_table[d], v = f.slen[d], b = 0;
                      b < g;
                      b++, s++
                    )
                      (k(_, Math.max(f.scalefac[s], 0), v), (m += v));
                  r += E(_, f);
                }
                ((r += M(_, f)),
                  l(r == f.part2_3_length),
                  l(m == f.part2_length),
                  (i += m + r));
              }
            return i;
          })(e)),
          R(e, s.resvDrain_post),
          (_ += s.resvDrain_post),
          (s.main_data_begin += (i - _) / 8),
          L(e, new P()) != r.ResvSize &&
            t.err.println(
              "Internal buffer inconsistency. flushbits <> ResvSize",
            ),
          8 * s.main_data_begin != r.ResvSize &&
            (t.err.printf(
              "bit reservoir error: \nl3_side.main_data_begin: %d \nResvoir size:             %d \nresv drain (post)         %d \nresv drain (pre)          %d \nheader and sideinfo:      %d \ndata bits:                %d \ntotal bits:               %d (remainder: %d) \nbitsperframe:             %d \n",
              8 * s.main_data_begin,
              r.ResvSize,
              s.resvDrain_post,
              s.resvDrain_pre,
              8 * r.sideinfo_len,
              _ - s.resvDrain_post - 8 * r.sideinfo_len,
              _,
              _ % 8,
              i,
            ),
            t.err.println(
              "This is a fatal error.  It has several possible causes:",
            ),
            t.err.println(
              "90%%  LAME compiled with buggy version of gcc using advanced optimizations",
            ),
            t.err.println(" 9%%  Your system is overclocked"),
            t.err.println(" 1%%  bug in LAME encoding library"),
            (r.ResvSize = 8 * s.main_data_begin)),
          l(g % 8 == 0),
          g > 1e9)
        ) {
          var f;
          for (f = 0; f < u.MAX_HEADER_BUF; ++f) r.header[f].write_timing -= g;
          g = 0;
        }
        return 0;
      }),
      (this.copy_buffer = function (e, a, s, o, _) {
        var c = v + 1;
        if (c <= 0) return 0;
        if (0 != o && c > o) return -1;
        if ((t.arraycopy(m, 0, a, s, c), (v = -1), (w = 0), 0 != _)) {
          var u = i(1);
          if (
            ((u[0] = e.nMusicCRC),
            d.updateMusicCRC(u, a, s, c),
            (e.nMusicCRC = u[0]),
            c > 0 && (e.VBR_seek_table.nBytesWritten += c),
            e.decode_on_the_fly)
          )
            for (var f, b = r([2, 1152]), g = c, y = -1; 0 != y; )
              if (
                ((y = p.hip_decode1_unclipped(e.hip, a, s, g, b[0], b[1])),
                (g = 0),
                -1 == y && (y = 0),
                y > 0)
              ) {
                if ((l(y <= 1152), e.findPeakSample)) {
                  for (f = 0; f < y; f++)
                    b[0][f] > e.PeakSample
                      ? (e.PeakSample = b[0][f])
                      : -b[0][f] > e.PeakSample && (e.PeakSample = -b[0][f]);
                  if (e.channels_out > 1)
                    for (f = 0; f < y; f++)
                      b[1][f] > e.PeakSample
                        ? (e.PeakSample = b[1][f])
                        : -b[1][f] > e.PeakSample && (e.PeakSample = -b[1][f]);
                }
                if (
                  e.findReplayGain &&
                  h.AnalyzeSamples(
                    e.rgdata,
                    b[0],
                    0,
                    b[1],
                    0,
                    y,
                    e.channels_out,
                  ) == GainAnalysis.GAIN_ANALYSIS_ERROR
                )
                  return -6;
              }
        }
        return c;
      }),
      (this.init_bit_stream_w = function (e) {
        ((m = s(Lame.LAME_MAXMP3BUFFER)),
          (e.h_ptr = e.w_ptr = 0),
          (e.header[e.h_ptr].write_timing = 0),
          (v = -1),
          (w = 0),
          (g = 0));
      }));
  }
  return (
    (f.EQ = function (e, t) {
      return Math.abs(e) > Math.abs(t)
        ? Math.abs(e - t) <= 1e-6 * Math.abs(e)
        : Math.abs(e - t) <= 1e-6 * Math.abs(t);
    }),
    (f.NEQ = function (e, t) {
      return !f.EQ(e, t);
    }),
    (Kt = f)
  );
}
function Dn() {
  if (en) return Jt;
  en = 1;
  var e = wn(),
    t = e.System,
    a = e.VbrMode;
  e.Float;
  var s = e.ShortBlock;
  (e.Util, e.Arrays, e.new_array_n, e.new_byte, e.new_double);
  var r = e.new_float;
  (e.new_float_n, e.new_int);
  var i = e.new_int_n,
    l = e.new_short_n,
    o = e.assert,
    _ = Sn(),
    c = (function () {
      if (wt) return vt;
      wt = 1;
      var e = Rn();
      return (vt = function () {
        ((this.class_id = 0),
          (this.num_samples = 0),
          (this.num_channels = 0),
          (this.in_samplerate = 0),
          (this.out_samplerate = 0),
          (this.scale = 0),
          (this.scale_left = 0),
          (this.scale_right = 0),
          (this.analysis = !1),
          (this.bWriteVbrTag = !1),
          (this.decode_only = !1),
          (this.quality = 0),
          (this.mode = e.STEREO),
          (this.force_ms = !1),
          (this.free_format = !1),
          (this.findReplayGain = !1),
          (this.decode_on_the_fly = !1),
          (this.write_id3tag_automatic = !1),
          (this.brate = 0),
          (this.compression_ratio = 0),
          (this.copyright = 0),
          (this.original = 0),
          (this.extension = 0),
          (this.emphasis = 0),
          (this.error_protection = 0),
          (this.strict_ISO = !1),
          (this.disable_reservoir = !1),
          (this.quant_comp = 0),
          (this.quant_comp_short = 0),
          (this.experimentalY = !1),
          (this.experimentalZ = 0),
          (this.exp_nspsytune = 0),
          (this.preset = 0),
          (this.VBR = null),
          (this.VBR_q_frac = 0),
          (this.VBR_q = 0),
          (this.VBR_mean_bitrate_kbps = 0),
          (this.VBR_min_bitrate_kbps = 0),
          (this.VBR_max_bitrate_kbps = 0),
          (this.VBR_hard_min = 0),
          (this.lowpassfreq = 0),
          (this.highpassfreq = 0),
          (this.lowpasswidth = 0),
          (this.highpasswidth = 0),
          (this.maskingadjust = 0),
          (this.maskingadjust_short = 0),
          (this.ATHonly = !1),
          (this.ATHshort = !1),
          (this.noATH = !1),
          (this.ATHtype = 0),
          (this.ATHcurve = 0),
          (this.ATHlower = 0),
          (this.athaa_type = 0),
          (this.athaa_loudapprox = 0),
          (this.athaa_sensitivity = 0),
          (this.short_blocks = null),
          (this.useTemporal = !1),
          (this.interChRatio = 0),
          (this.msfix = 0),
          (this.tune = !1),
          (this.tune_value_a = 0),
          (this.version = 0),
          (this.encoder_delay = 0),
          (this.encoder_padding = 0),
          (this.framesize = 0),
          (this.frameNum = 0),
          (this.lame_allocated_gfp = 0),
          (this.internal_flags = null));
      });
    })(),
    u = Tn(),
    f = (function () {
      if (Nt) return Dt;
      Nt = 1;
      var e = wn();
      (e.System,
        e.VbrMode,
        e.Float,
        e.ShortBlock,
        e.Util,
        e.Arrays,
        e.new_array_n,
        e.new_byte,
        e.new_double);
      var t = e.new_float;
      (e.new_float_n, e.new_int, e.new_int_n, e.assert);
      var a = kn();
      return (Dt = function () {
        ((this.useAdjust = 0),
          (this.aaSensitivityP = 0),
          (this.adjust = 0),
          (this.adjustLimit = 0),
          (this.decay = 0),
          (this.floor = 0),
          (this.l = t(a.SBMAX_l)),
          (this.s = t(a.SBMAX_s)),
          (this.psfb21 = t(a.PSFB21)),
          (this.psfb12 = t(a.PSFB12)),
          (this.cb_l = t(a.CBANDS)),
          (this.cb_s = t(a.CBANDS)),
          (this.eql_w = t(a.BLKSIZE / 2)));
      });
    })(),
    h = (function () {
      if (zt) return Ct;
      zt = 1;
      var e = wn();
      (e.System,
        e.VbrMode,
        e.Float,
        e.ShortBlock,
        e.Util,
        e.Arrays,
        e.new_array_n,
        e.new_byte,
        e.new_double);
      var t = e.new_float;
      e.new_float_n;
      var a = e.new_int;
      (e.new_int_n, e.assert);
      var s = Bn();
      return (Ct = function () {
        ((this.linprebuf = t(2 * s.MAX_ORDER)),
          (this.linpre = 0),
          (this.lstepbuf = t(s.MAX_SAMPLES_PER_WINDOW + s.MAX_ORDER)),
          (this.lstep = 0),
          (this.loutbuf = t(s.MAX_SAMPLES_PER_WINDOW + s.MAX_ORDER)),
          (this.lout = 0),
          (this.rinprebuf = t(2 * s.MAX_ORDER)),
          (this.rinpre = 0),
          (this.rstepbuf = t(s.MAX_SAMPLES_PER_WINDOW + s.MAX_ORDER)),
          (this.rstep = 0),
          (this.routbuf = t(s.MAX_SAMPLES_PER_WINDOW + s.MAX_ORDER)),
          (this.rout = 0),
          (this.sampleWindow = 0),
          (this.totsamp = 0),
          (this.lsum = 0),
          (this.rsum = 0),
          (this.freqindex = 0),
          (this.first = 0),
          (this.A = a(0 | (s.STEPS_per_dB * s.MAX_dB))),
          (this.B = a(0 | (s.STEPS_per_dB * s.MAX_dB))));
      });
    })(),
    p = (function () {
      if (Ut) return qt;
      Ut = 1;
      var e = wn();
      (e.System,
        e.VbrMode,
        e.Float,
        e.ShortBlock,
        e.Util,
        e.Arrays,
        e.new_array_n,
        e.new_byte,
        e.new_double);
      var t = e.new_float;
      e.new_float_n;
      var a = e.new_int;
      e.new_int_n;
      var s = e.assert,
        r = En(),
        i = kn(),
        l = xn(),
        o = Tn();
      return (qt = function (e) {
        var _ = e;
        ((this.quantize = _),
          (this.iteration_loop = function (e, _, c, u) {
            var f,
              h = e.internal_flags,
              p = t(l.SFBMAX),
              b = t(576),
              d = a(2),
              m = 0,
              g = h.l3_side,
              v = new r(m);
            (this.quantize.rv.ResvFrameBegin(e, v), (m = v.bits));
            for (var w = 0; w < h.mode_gr; w++) {
              ((f = this.quantize.qupvt.on_pe(e, _, d, m, w, w)),
                h.mode_ext == i.MPG_MD_MS_LR &&
                  (this.quantize.ms_convert(h.l3_side, w),
                  this.quantize.qupvt.reduce_side(d, c[w], m, f)));
              for (var y = 0; y < h.channels_out; y++) {
                var k,
                  S,
                  R = g.tt[w][y];
                (R.block_type != i.SHORT_TYPE
                  ? ((k = 0), (S = h.PSY.mask_adjust - k))
                  : ((k = 0), (S = h.PSY.mask_adjust_short - k)),
                  (h.masking_lower = Math.pow(10, 0.1 * S)),
                  this.quantize.init_outer_loop(h, R),
                  this.quantize.init_xrpow(h, R, b) &&
                    (this.quantize.qupvt.calc_xmin(e, u[w][y], R, p),
                    this.quantize.outer_loop(e, R, p, b, y, d[y])),
                  this.quantize.iteration_finish_one(h, w, y),
                  s(R.part2_3_length <= o.MAX_BITS_PER_CHANNEL),
                  s(R.part2_3_length <= d[y]));
              }
            }
            this.quantize.rv.ResvFrameEnd(h, m);
          }));
      });
    })(),
    b = On(),
    d = Pn(),
    m = kn();
  return (
    (Jt = function e() {
      var g,
        v,
        w,
        y,
        k,
        S = this;
      ((e.V9 = 410),
        (e.V8 = 420),
        (e.V7 = 430),
        (e.V6 = 440),
        (e.V5 = 450),
        (e.V4 = 460),
        (e.V3 = 470),
        (e.V2 = 480),
        (e.V1 = 490),
        (e.V0 = 500),
        (e.R3MIX = 1e3),
        (e.STANDARD = 1001),
        (e.EXTREME = 1002),
        (e.INSANE = 1003),
        (e.STANDARD_FAST = 1004),
        (e.EXTREME_FAST = 1005),
        (e.MEDIUM = 1006),
        (e.MEDIUM_FAST = 1007),
        (e.LAME_MAXMP3BUFFER = 147456));
      var R,
        x,
        A,
        M = new _();
      function T() {
        ((this.mask_adjust = 0),
          (this.mask_adjust_short = 0),
          (this.bo_l_weight = r(m.SBMAX_l)),
          (this.bo_s_weight = r(m.SBMAX_s)));
      }
      function B() {
        this.lowerlimit = 0;
      }
      function E(e, t) {
        this.lowpass = t;
      }
      ((this.enc = new m()),
        (this.setModules = function (e, t, a, s, r, i, l, o, _) {
          ((g = e),
            (v = t),
            (w = a),
            (y = s),
            (k = r),
            (R = i),
            (x = o),
            (A = _),
            this.enc.setModules(v, M, y, R));
        }));
      var P = 4294479419;
      function L(e) {
        return e > 1 ? 0 : e <= 0 ? 1 : Math.cos((Math.PI / 2) * e);
      }
      function I(e, t) {
        switch (e) {
          case 44100:
            return ((t.version = 1), 0);
          case 48e3:
            return ((t.version = 1), 1);
          case 32e3:
            return ((t.version = 1), 2);
          case 22050:
          case 11025:
            return ((t.version = 0), 0);
          case 24e3:
          case 12e3:
            return ((t.version = 0), 1);
          case 16e3:
          case 8e3:
            return ((t.version = 0), 2);
          default:
            return ((t.version = 0), -1);
        }
      }
      function O(e, t, a) {
        a < 16e3 && (t = 2);
        for (var s = d.bitrate_table[t][1], r = 2; r <= 14; r++)
          d.bitrate_table[t][r] > 0 &&
            Math.abs(d.bitrate_table[t][r] - e) < Math.abs(s - e) &&
            (s = d.bitrate_table[t][r]);
        return s;
      }
      function D(e, t, a) {
        a < 16e3 && (t = 2);
        for (var s = 0; s <= 14; s++)
          if (d.bitrate_table[t][s] > 0 && d.bitrate_table[t][s] == e) return s;
        return -1;
      }
      function N(e, t) {
        var a = [
            new E(8, 2e3),
            new E(16, 3700),
            new E(24, 3900),
            new E(32, 5500),
            new E(40, 7e3),
            new E(48, 7500),
            new E(56, 1e4),
            new E(64, 11e3),
            new E(80, 13500),
            new E(96, 15100),
            new E(112, 15600),
            new E(128, 17e3),
            new E(160, 17500),
            new E(192, 18600),
            new E(224, 19400),
            new E(256, 19700),
            new E(320, 20500),
          ],
          s = S.nearestBitrateFullIndex(t);
        e.lowerlimit = a[s].lowpass;
      }
      function V(e) {
        var t = m.BLKSIZE + e.framesize - m.FFTOFFSET;
        return ((t = Math.max(t, 512 + e.framesize - 32)), o(u.MFSIZE >= t), t);
      }
      function H(e, t, a, s, r, i) {
        var l = S.enc.lame_encode_mp3_frame(e, t, a, s, r, i);
        return (e.frameNum++, l);
      }
      function C() {
        ((this.n_in = 0), (this.n_out = 0));
      }
      function z() {
        this.num_used = 0;
      }
      function F(e, t) {
        return 0 != t ? F(t, e % t) : e;
      }
      function X(e, t, a) {
        var s = Math.PI * t;
        ((e /= a) < 0 && (e = 0), e > 1 && (e = 1));
        var r = e - 0.5,
          i =
            0.42 -
            0.5 * Math.cos(2 * e * Math.PI) +
            0.08 * Math.cos(4 * e * Math.PI);
        return Math.abs(r) < 1e-9
          ? s / Math.PI
          : (i * Math.sin(a * s * r)) / (Math.PI * a * r);
      }
      function q(e, t, a, s, i, l, _, c, f) {
        var h,
          p,
          b = e.internal_flags,
          d = 0,
          m = e.out_samplerate / F(e.out_samplerate, e.in_samplerate);
        m > u.BPC && (m = u.BPC);
        var g =
            Math.abs(b.resample_ratio - Math.floor(0.5 + b.resample_ratio)) <
            1e-4
              ? 1
              : 0,
          v = 1 / b.resample_ratio;
        v > 1 && (v = 1);
        var w = 31;
        0 == w % 2 && --w;
        var y = (w += g) + 1;
        if (0 == b.fill_buffer_resample_init) {
          for (
            b.inbuf_old[0] = r(y), b.inbuf_old[1] = r(y), h = 0;
            h <= 2 * m;
            ++h
          )
            b.blackfilt[h] = r(y);
          for (b.itime[0] = 0, b.itime[1] = 0, d = 0; d <= 2 * m; d++) {
            var k = 0,
              S = (d - m) / (2 * m);
            for (h = 0; h <= w; h++) k += b.blackfilt[d][h] = X(h - S, v, w);
            for (h = 0; h <= w; h++) b.blackfilt[d][h] /= k;
          }
          b.fill_buffer_resample_init = 1;
        }
        var R = b.inbuf_old[f];
        for (p = 0; p < s; p++) {
          var x, A;
          if (
            ((x = p * b.resample_ratio),
            w + (d = 0 | Math.floor(x - b.itime[f])) - w / 2 >= _)
          )
            break;
          S = x - b.itime[f] - (d + (w % 2) * 0.5);
          (o(Math.abs(S) <= 0.501), (A = 0 | Math.floor(2 * S * m + m + 0.5)));
          var M = 0;
          for (h = 0; h <= w; ++h) {
            var T = 0 | (h + d - w / 2);
            (o(T < _),
              o(T + y >= 0),
              (M += (T < 0 ? R[y + T] : i[l + T]) * b.blackfilt[A][h]));
          }
          t[a + p] = M;
        }
        if (
          ((c.num_used = Math.min(_, w + d - w / 2)),
          (b.itime[f] += c.num_used - p * b.resample_ratio),
          c.num_used >= y)
        )
          for (h = 0; h < y; h++) R[h] = i[l + c.num_used + h - y];
        else {
          var B = y - c.num_used;
          for (h = 0; h < B; ++h) R[h] = R[h + c.num_used];
          for (d = 0; h < y; ++h, ++d) R[h] = i[l + d];
          o(d == c.num_used);
        }
        return p;
      }
      function U(e, t, a, s, r, i) {
        var l = e.internal_flags;
        if (l.resample_ratio < 0.9999 || l.resample_ratio > 1.0001)
          for (var o = 0; o < l.channels_out; o++) {
            var _ = new z();
            ((i.n_out = q(e, t[o], l.mf_size, e.framesize, a[o], s, r, _, o)),
              (i.n_in = _.num_used));
          }
        else {
          ((i.n_out = Math.min(e.framesize, r)), (i.n_in = i.n_out));
          for (var c = 0; c < i.n_out; ++c)
            ((t[0][l.mf_size + c] = a[0][s + c]),
              2 == l.channels_out && (t[1][l.mf_size + c] = a[1][s + c]));
        }
      }
      ((this.lame_init = function () {
        var e = new c();
        return (
          (function (e) {
            var t;
            ((e.class_id = P),
              (t = e.internal_flags = new u()),
              (e.mode = MPEGMode.NOT_SET),
              (e.original = 1),
              (e.in_samplerate = 44100),
              (e.num_channels = 2),
              (e.num_samples = -1),
              (e.bWriteVbrTag = !0),
              (e.quality = -1),
              (e.short_blocks = null),
              (t.subblock_gain = -1),
              (e.lowpassfreq = 0),
              (e.highpassfreq = 0),
              (e.lowpasswidth = -1),
              (e.highpasswidth = -1),
              (e.VBR = a.vbr_off),
              (e.VBR_q = 4),
              (e.ATHcurve = -1),
              (e.VBR_mean_bitrate_kbps = 128),
              (e.VBR_min_bitrate_kbps = 0),
              (e.VBR_max_bitrate_kbps = 0),
              (e.VBR_hard_min = 0),
              (t.VBR_min_bitrate = 1),
              (t.VBR_max_bitrate = 13),
              (e.quant_comp = -1),
              (e.quant_comp_short = -1),
              (e.msfix = -1),
              (t.resample_ratio = 1),
              (t.OldValue[0] = 180),
              (t.OldValue[1] = 180),
              (t.CurrentStep[0] = 4),
              (t.CurrentStep[1] = 4),
              (t.masking_lower = 1),
              (t.nsPsy.attackthre = -1),
              (t.nsPsy.attackthre_s = -1),
              (e.scale = -1),
              (e.athaa_type = -1),
              (e.ATHtype = -1),
              (e.athaa_loudapprox = -1),
              (e.athaa_sensitivity = 0),
              (e.useTemporal = null),
              (e.interChRatio = -1),
              (t.mf_samples_to_encode = m.ENCDELAY + m.POSTDELAY),
              (e.encoder_padding = 0),
              (t.mf_size = m.ENCDELAY - m.MDCTDELAY),
              (e.findReplayGain = !1),
              (e.decode_on_the_fly = !1),
              (t.decode_on_the_fly = !1),
              (t.findReplayGain = !1),
              (t.findPeakSample = !1),
              (t.RadioGain = 0),
              (t.AudiophileGain = 0),
              (t.noclipGainChange = 0),
              (t.noclipScale = -1),
              (e.preset = 0),
              (e.write_id3tag_automatic = !0));
          })(e),
          (e.lame_allocated_gfp = 1),
          e
        );
      }),
        (this.nearestBitrateFullIndex = function (e) {
          var t = [
              8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224,
              256, 320,
            ],
            a = 0,
            s = 0,
            r = 0,
            i = 0;
          ((i = t[16]), (r = 16), (s = t[16]), (a = 16));
          for (var l = 0; l < 16; l++)
            if (Math.max(e, t[l + 1]) != e) {
              ((i = t[l + 1]), (r = l + 1), (s = t[l]), (a = l));
              break;
            }
          return i - e > e - s ? a : r;
        }),
        (this.lame_init_params = function (e) {
          var r = e.internal_flags;
          if (
            ((r.Class_ID = 0),
            null == r.ATH && (r.ATH = new f()),
            null == r.PSY && (r.PSY = new T()),
            null == r.rgdata && (r.rgdata = new h()),
            (r.channels_in = e.num_channels),
            1 == r.channels_in && (e.mode = MPEGMode.MONO),
            (r.channels_out = e.mode == MPEGMode.MONO ? 1 : 2),
            (r.mode_ext = m.MPG_MD_MS_LR),
            e.mode == MPEGMode.MONO && (e.force_ms = !1),
            e.VBR == a.vbr_off &&
              128 != e.VBR_mean_bitrate_kbps &&
              0 == e.brate &&
              (e.brate = e.VBR_mean_bitrate_kbps),
            e.VBR == a.vbr_off ||
              e.VBR == a.vbr_mtrh ||
              e.VBR == a.vbr_mt ||
              (e.free_format = !1),
            e.VBR == a.vbr_off &&
              0 == e.brate &&
              b.EQ(e.compression_ratio, 0) &&
              (e.compression_ratio = 11.025),
            e.VBR == a.vbr_off &&
              e.compression_ratio > 0 &&
              (0 == e.out_samplerate &&
                (e.out_samplerate = map2MP3Frequency(
                  int(0.97 * e.in_samplerate),
                )),
              (e.brate =
                0 |
                ((16 * e.out_samplerate * r.channels_out) /
                  (1e3 * e.compression_ratio))),
              (r.samplerate_index = I(e.out_samplerate, e)),
              e.free_format ||
                (e.brate = O(e.brate, e.version, e.out_samplerate))),
            0 != e.out_samplerate &&
              (e.out_samplerate < 16e3
                ? ((e.VBR_mean_bitrate_kbps = Math.max(
                    e.VBR_mean_bitrate_kbps,
                    8,
                  )),
                  (e.VBR_mean_bitrate_kbps = Math.min(
                    e.VBR_mean_bitrate_kbps,
                    64,
                  )))
                : e.out_samplerate < 32e3
                  ? ((e.VBR_mean_bitrate_kbps = Math.max(
                      e.VBR_mean_bitrate_kbps,
                      8,
                    )),
                    (e.VBR_mean_bitrate_kbps = Math.min(
                      e.VBR_mean_bitrate_kbps,
                      160,
                    )))
                  : ((e.VBR_mean_bitrate_kbps = Math.max(
                      e.VBR_mean_bitrate_kbps,
                      32,
                    )),
                    (e.VBR_mean_bitrate_kbps = Math.min(
                      e.VBR_mean_bitrate_kbps,
                      320,
                    )))),
            0 == e.lowpassfreq)
          ) {
            var l = 16e3;
            switch (e.VBR) {
              case a.vbr_off:
                (N((c = new B()), e.brate), (l = c.lowerlimit));
                break;
              case a.vbr_abr:
                var c;
                (N((c = new B()), e.VBR_mean_bitrate_kbps), (l = c.lowerlimit));
                break;
              case a.vbr_rh:
                var u = [
                  19500, 19e3, 18600, 18e3, 17500, 16e3, 15600, 14900, 12500,
                  1e4, 3950,
                ];
                if (0 <= e.VBR_q && e.VBR_q <= 9) {
                  var S = u[e.VBR_q],
                    E = u[e.VBR_q + 1],
                    V = e.VBR_q_frac;
                  l = linear_int(S, E, V);
                } else l = 19500;
                break;
              default:
                u = [
                  19500, 19e3, 18500, 18e3, 17500, 16500, 15500, 14500, 12500,
                  9500, 3950,
                ];
                if (0 <= e.VBR_q && e.VBR_q <= 9) {
                  ((S = u[e.VBR_q]), (E = u[e.VBR_q + 1]), (V = e.VBR_q_frac));
                  l = linear_int(S, E, V);
                } else l = 19500;
            }
            (e.mode != MPEGMode.MONO ||
              (e.VBR != a.vbr_off && e.VBR != a.vbr_abr) ||
              (l *= 1.5),
              (e.lowpassfreq = 0 | l));
          }
          if (
            (0 == e.out_samplerate &&
              (2 * e.lowpassfreq > e.in_samplerate &&
                (e.lowpassfreq = e.in_samplerate / 2),
              (e.out_samplerate = (function (e, t) {
                var a = 44100;
                return (
                  t >= 48e3
                    ? (a = 48e3)
                    : t >= 44100
                      ? (a = 44100)
                      : t >= 32e3
                        ? (a = 32e3)
                        : t >= 24e3
                          ? (a = 24e3)
                          : t >= 22050
                            ? (a = 22050)
                            : t >= 16e3
                              ? (a = 16e3)
                              : t >= 12e3
                                ? (a = 12e3)
                                : t >= 11025
                                  ? (a = 11025)
                                  : t >= 8e3 && (a = 8e3),
                  -1 == e
                    ? a
                    : (e <= 15960 && (a = 44100),
                      e <= 15250 && (a = 32e3),
                      e <= 11220 && (a = 24e3),
                      e <= 9970 && (a = 22050),
                      e <= 7230 && (a = 16e3),
                      e <= 5420 && (a = 12e3),
                      e <= 4510 && (a = 11025),
                      e <= 3970 && (a = 8e3),
                      t < a
                        ? t > 44100
                          ? 48e3
                          : t > 32e3
                            ? 44100
                            : t > 24e3
                              ? 32e3
                              : t > 22050
                                ? 24e3
                                : t > 16e3
                                  ? 22050
                                  : t > 12e3
                                    ? 16e3
                                    : t > 11025
                                      ? 12e3
                                      : t > 8e3
                                        ? 11025
                                        : 8e3
                        : a)
                );
              })(0 | e.lowpassfreq, e.in_samplerate))),
            (e.lowpassfreq = Math.min(20500, e.lowpassfreq)),
            (e.lowpassfreq = Math.min(e.out_samplerate / 2, e.lowpassfreq)),
            e.VBR == a.vbr_off &&
              (e.compression_ratio =
                (16 * e.out_samplerate * r.channels_out) / (1e3 * e.brate)),
            e.VBR == a.vbr_abr &&
              (e.compression_ratio =
                (16 * e.out_samplerate * r.channels_out) /
                (1e3 * e.VBR_mean_bitrate_kbps)),
            e.bWriteVbrTag ||
              ((e.findReplayGain = !1),
              (e.decode_on_the_fly = !1),
              (r.findPeakSample = !1)),
            (r.findReplayGain = e.findReplayGain),
            (r.decode_on_the_fly = e.decode_on_the_fly),
            r.decode_on_the_fly && (r.findPeakSample = !0),
            r.findReplayGain &&
              g.InitGainAnalysis(r.rgdata, e.out_samplerate) ==
                GainAnalysis.INIT_GAIN_ANALYSIS_ERROR)
          )
            return ((e.internal_flags = null), -6);
          switch (
            (r.decode_on_the_fly &&
              !e.decode_only &&
              (null != r.hip && A.hip_decode_exit(r.hip),
              (r.hip = A.hip_decode_init())),
            (r.mode_gr = e.out_samplerate <= 24e3 ? 1 : 2),
            (e.framesize = 576 * r.mode_gr),
            (e.encoder_delay = m.ENCDELAY),
            (r.resample_ratio = e.in_samplerate / e.out_samplerate),
            e.VBR)
          ) {
            case a.vbr_mt:
            case a.vbr_rh:
            case a.vbr_mtrh:
              e.compression_ratio = [
                5.7, 6.5, 7.3, 8.2, 10, 11.9, 13, 14, 15, 16.5,
              ][e.VBR_q];
              break;
            case a.vbr_abr:
              e.compression_ratio =
                (16 * e.out_samplerate * r.channels_out) /
                (1e3 * e.VBR_mean_bitrate_kbps);
              break;
            default:
              e.compression_ratio =
                (16 * e.out_samplerate * r.channels_out) / (1e3 * e.brate);
          }
          if (
            (e.mode == MPEGMode.NOT_SET && (e.mode = MPEGMode.JOINT_STEREO),
            e.highpassfreq > 0
              ? ((r.highpass1 = 2 * e.highpassfreq),
                e.highpasswidth >= 0
                  ? (r.highpass2 = 2 * (e.highpassfreq + e.highpasswidth))
                  : (r.highpass2 = 2 * e.highpassfreq),
                (r.highpass1 /= e.out_samplerate),
                (r.highpass2 /= e.out_samplerate))
              : ((r.highpass1 = 0), (r.highpass2 = 0)),
            e.lowpassfreq > 0
              ? ((r.lowpass2 = 2 * e.lowpassfreq),
                e.lowpasswidth >= 0
                  ? ((r.lowpass1 = 2 * (e.lowpassfreq - e.lowpasswidth)),
                    r.lowpass1 < 0 && (r.lowpass1 = 0))
                  : (r.lowpass1 = 2 * e.lowpassfreq),
                (r.lowpass1 /= e.out_samplerate),
                (r.lowpass2 /= e.out_samplerate))
              : ((r.lowpass1 = 0), (r.lowpass2 = 0)),
            (function (e) {
              var a = e.internal_flags,
                s = 32,
                r = -1;
              if (a.lowpass1 > 0) {
                for (var i = 999, l = 0; l <= 31; l++)
                  ((u = l / 31) >= a.lowpass2 && (s = Math.min(s, l)),
                    a.lowpass1 < u && u < a.lowpass2 && (i = Math.min(i, l)));
                ((a.lowpass1 = 999 == i ? (s - 0.75) / 31 : (i - 0.75) / 31),
                  (a.lowpass2 = s / 31));
              }
              if (
                (a.highpass2 > 0 &&
                  a.highpass2 < (0.75 / 31) * 0.9 &&
                  ((a.highpass1 = 0),
                  (a.highpass2 = 0),
                  t.err.println(
                    "Warning: highpass filter disabled.  highpass frequency too small\n",
                  )),
                a.highpass2 > 0)
              ) {
                var o = -1;
                for (l = 0; l <= 31; l++)
                  ((u = l / 31) <= a.highpass1 && (r = Math.max(r, l)),
                    a.highpass1 < u && u < a.highpass2 && (o = Math.max(o, l)));
                ((a.highpass1 = r / 31),
                  (a.highpass2 = -1 == o ? (r + 0.75) / 31 : (o + 0.75) / 31));
              }
              for (l = 0; l < 32; l++) {
                var _,
                  c,
                  u = l / 31;
                ((_ =
                  a.highpass2 > a.highpass1
                    ? L((a.highpass2 - u) / (a.highpass2 - a.highpass1 + 1e-20))
                    : 1),
                  (c =
                    a.lowpass2 > a.lowpass1
                      ? L((u - a.lowpass1) / (a.lowpass2 - a.lowpass1 + 1e-20))
                      : 1),
                  (a.amp_filter[l] = _ * c));
              }
            })(e),
            (r.samplerate_index = I(e.out_samplerate, e)),
            r.samplerate_index < 0)
          )
            return ((e.internal_flags = null), -1);
          if (e.VBR == a.vbr_off) {
            if (e.free_format) r.bitrate_index = 0;
            else if (
              ((e.brate = O(e.brate, e.version, e.out_samplerate)),
              (r.bitrate_index = D(e.brate, e.version, e.out_samplerate)),
              r.bitrate_index <= 0)
            )
              return ((e.internal_flags = null), -1);
          } else r.bitrate_index = 1;
          (e.analysis && (e.bWriteVbrTag = !1),
            null != r.pinfo && (e.bWriteVbrTag = !1),
            v.init_bit_stream_w(r));
          for (
            var H,
              C =
                r.samplerate_index +
                3 * e.version +
                6 * (e.out_samplerate < 16e3 ? 1 : 0),
              z = 0;
            z < m.SBMAX_l + 1;
            z++
          )
            r.scalefac_band.l[z] = y.sfBandIndex[C].l[z];
          for (z = 0; z < m.PSFB21 + 1; z++) {
            var F = (r.scalefac_band.l[22] - r.scalefac_band.l[21]) / m.PSFB21,
              X = r.scalefac_band.l[21] + z * F;
            r.scalefac_band.psfb21[z] = X;
          }
          r.scalefac_band.psfb21[m.PSFB21] = 576;
          for (z = 0; z < m.SBMAX_s + 1; z++)
            r.scalefac_band.s[z] = y.sfBandIndex[C].s[z];
          for (z = 0; z < m.PSFB12 + 1; z++) {
            ((F = (r.scalefac_band.s[13] - r.scalefac_band.s[12]) / m.PSFB12),
              (X = r.scalefac_band.s[12] + z * F));
            r.scalefac_band.psfb12[z] = X;
          }
          for (
            r.scalefac_band.psfb12[m.PSFB12] = 192,
              1 == e.version
                ? (r.sideinfo_len = 1 == r.channels_out ? 21 : 36)
                : (r.sideinfo_len = 1 == r.channels_out ? 13 : 21),
              e.error_protection && (r.sideinfo_len += 2),
              (function (e) {
                var t = e.internal_flags;
                ((e.frameNum = 0),
                  e.write_id3tag_automatic && x.id3tag_write_v2(e),
                  (t.bitrate_stereoMode_Hist = i([16, 5])),
                  (t.bitrate_blockType_Hist = i([16, 6])),
                  (t.PeakSample = 0),
                  e.bWriteVbrTag && R.InitVbrTag(e));
              })(e),
              r.Class_ID = P,
              H = 0;
            H < 19;
            H++
          )
            r.nsPsy.pefirbuf[H] = 700 * r.mode_gr * r.channels_out;
          switch (
            (-1 == e.ATHtype && (e.ATHtype = 4),
            o(e.VBR_q <= 9),
            o(e.VBR_q >= 0),
            e.VBR)
          ) {
            case a.vbr_mt:
              e.VBR = a.vbr_mtrh;
            case a.vbr_mtrh:
              (null == e.useTemporal && (e.useTemporal = !1),
                w.apply_preset(e, 500 - 10 * e.VBR_q, 0),
                e.quality < 0 && (e.quality = LAME_DEFAULT_QUALITY),
                e.quality < 5 && (e.quality = 0),
                e.quality > 5 && (e.quality = 5),
                (r.PSY.mask_adjust = e.maskingadjust),
                (r.PSY.mask_adjust_short = e.maskingadjust_short),
                e.experimentalY
                  ? (r.sfb21_extra = !1)
                  : (r.sfb21_extra = e.out_samplerate > 44e3),
                (r.iteration_loop = new VBRNewIterationLoop(k)));
              break;
            case a.vbr_rh:
              (w.apply_preset(e, 500 - 10 * e.VBR_q, 0),
                (r.PSY.mask_adjust = e.maskingadjust),
                (r.PSY.mask_adjust_short = e.maskingadjust_short),
                e.experimentalY
                  ? (r.sfb21_extra = !1)
                  : (r.sfb21_extra = e.out_samplerate > 44e3),
                e.quality > 6 && (e.quality = 6),
                e.quality < 0 && (e.quality = LAME_DEFAULT_QUALITY),
                (r.iteration_loop = new VBROldIterationLoop(k)));
              break;
            default:
              var q;
              ((r.sfb21_extra = !1),
                e.quality < 0 && (e.quality = LAME_DEFAULT_QUALITY),
                (q = e.VBR) == a.vbr_off && (e.VBR_mean_bitrate_kbps = e.brate),
                w.apply_preset(e, e.VBR_mean_bitrate_kbps, 0),
                (e.VBR = q),
                (r.PSY.mask_adjust = e.maskingadjust),
                (r.PSY.mask_adjust_short = e.maskingadjust_short),
                q == a.vbr_off
                  ? (r.iteration_loop = new p(k))
                  : (r.iteration_loop = new ABRIterationLoop(k)));
          }
          if ((o(e.scale >= 0), e.VBR != a.vbr_off)) {
            if (
              ((r.VBR_min_bitrate = 1),
              (r.VBR_max_bitrate = 14),
              e.out_samplerate < 16e3 && (r.VBR_max_bitrate = 8),
              0 != e.VBR_min_bitrate_kbps &&
                ((e.VBR_min_bitrate_kbps = O(
                  e.VBR_min_bitrate_kbps,
                  e.version,
                  e.out_samplerate,
                )),
                (r.VBR_min_bitrate = D(
                  e.VBR_min_bitrate_kbps,
                  e.version,
                  e.out_samplerate,
                )),
                r.VBR_min_bitrate < 0))
            )
              return -1;
            if (
              0 != e.VBR_max_bitrate_kbps &&
              ((e.VBR_max_bitrate_kbps = O(
                e.VBR_max_bitrate_kbps,
                e.version,
                e.out_samplerate,
              )),
              (r.VBR_max_bitrate = D(
                e.VBR_max_bitrate_kbps,
                e.version,
                e.out_samplerate,
              )),
              r.VBR_max_bitrate < 0)
            )
              return -1;
            ((e.VBR_min_bitrate_kbps =
              d.bitrate_table[e.version][r.VBR_min_bitrate]),
              (e.VBR_max_bitrate_kbps =
                d.bitrate_table[e.version][r.VBR_max_bitrate]),
              (e.VBR_mean_bitrate_kbps = Math.min(
                d.bitrate_table[e.version][r.VBR_max_bitrate],
                e.VBR_mean_bitrate_kbps,
              )),
              (e.VBR_mean_bitrate_kbps = Math.max(
                d.bitrate_table[e.version][r.VBR_min_bitrate],
                e.VBR_mean_bitrate_kbps,
              )));
          }
          return (
            e.tune &&
              ((r.PSY.mask_adjust += e.tune_value_a),
              (r.PSY.mask_adjust_short += e.tune_value_a)),
            (function (e) {
              var t = e.internal_flags;
              switch (e.quality) {
                default:
                case 9:
                  ((t.psymodel = 0),
                    (t.noise_shaping = 0),
                    (t.noise_shaping_amp = 0),
                    (t.noise_shaping_stop = 0),
                    (t.use_best_huffman = 0),
                    (t.full_outer_loop = 0));
                  break;
                case 8:
                  e.quality = 7;
                case 7:
                  ((t.psymodel = 1),
                    (t.noise_shaping = 0),
                    (t.noise_shaping_amp = 0),
                    (t.noise_shaping_stop = 0),
                    (t.use_best_huffman = 0),
                    (t.full_outer_loop = 0));
                  break;
                case 6:
                case 5:
                  ((t.psymodel = 1),
                    0 == t.noise_shaping && (t.noise_shaping = 1),
                    (t.noise_shaping_amp = 0),
                    (t.noise_shaping_stop = 0),
                    -1 == t.subblock_gain && (t.subblock_gain = 1),
                    (t.use_best_huffman = 0),
                    (t.full_outer_loop = 0));
                  break;
                case 4:
                  ((t.psymodel = 1),
                    0 == t.noise_shaping && (t.noise_shaping = 1),
                    (t.noise_shaping_amp = 0),
                    (t.noise_shaping_stop = 0),
                    -1 == t.subblock_gain && (t.subblock_gain = 1),
                    (t.use_best_huffman = 1),
                    (t.full_outer_loop = 0));
                  break;
                case 3:
                  ((t.psymodel = 1),
                    0 == t.noise_shaping && (t.noise_shaping = 1),
                    (t.noise_shaping_amp = 1),
                    (t.noise_shaping_stop = 1),
                    -1 == t.subblock_gain && (t.subblock_gain = 1),
                    (t.use_best_huffman = 1),
                    (t.full_outer_loop = 0));
                  break;
                case 2:
                  ((t.psymodel = 1),
                    0 == t.noise_shaping && (t.noise_shaping = 1),
                    0 == t.substep_shaping && (t.substep_shaping = 2),
                    (t.noise_shaping_amp = 1),
                    (t.noise_shaping_stop = 1),
                    -1 == t.subblock_gain && (t.subblock_gain = 1),
                    (t.use_best_huffman = 1),
                    (t.full_outer_loop = 0));
                  break;
                case 1:
                case 0:
                  ((t.psymodel = 1),
                    0 == t.noise_shaping && (t.noise_shaping = 1),
                    0 == t.substep_shaping && (t.substep_shaping = 2),
                    (t.noise_shaping_amp = 2),
                    (t.noise_shaping_stop = 1),
                    -1 == t.subblock_gain && (t.subblock_gain = 1),
                    (t.use_best_huffman = 1),
                    (t.full_outer_loop = 0));
              }
            })(e),
            o(e.scale >= 0),
            e.athaa_type < 0
              ? (r.ATH.useAdjust = 3)
              : (r.ATH.useAdjust = e.athaa_type),
            (r.ATH.aaSensitivityP = Math.pow(10, e.athaa_sensitivity / -10)),
            null == e.short_blocks && (e.short_blocks = s.short_block_allowed),
            e.short_blocks != s.short_block_allowed ||
              (e.mode != MPEGMode.JOINT_STEREO && e.mode != MPEGMode.STEREO) ||
              (e.short_blocks = s.short_block_coupled),
            e.quant_comp < 0 && (e.quant_comp = 1),
            e.quant_comp_short < 0 && (e.quant_comp_short = 0),
            e.msfix < 0 && (e.msfix = 0),
            (e.exp_nspsytune = 1 | e.exp_nspsytune),
            e.internal_flags.nsPsy.attackthre < 0 &&
              (e.internal_flags.nsPsy.attackthre = _.NSATTACKTHRE),
            e.internal_flags.nsPsy.attackthre_s < 0 &&
              (e.internal_flags.nsPsy.attackthre_s = _.NSATTACKTHRE_S),
            o(e.scale >= 0),
            e.scale < 0 && (e.scale = 1),
            e.ATHtype < 0 && (e.ATHtype = 4),
            e.ATHcurve < 0 && (e.ATHcurve = 4),
            e.athaa_loudapprox < 0 && (e.athaa_loudapprox = 2),
            e.interChRatio < 0 && (e.interChRatio = 0),
            null == e.useTemporal && (e.useTemporal = !0),
            (r.slot_lag = r.frac_SpF = 0),
            e.VBR == a.vbr_off &&
              (r.slot_lag = r.frac_SpF =
                ((72e3 * (e.version + 1) * e.brate) % e.out_samplerate) | 0),
            y.iteration_init(e),
            M.psymodel_init(e),
            o(e.scale >= 0),
            0
          );
        }),
        (this.lame_encode_flush = function (e, t, a, s) {
          var r,
            i,
            o,
            _,
            c = e.internal_flags,
            u = l([2, 1152]),
            f = 0,
            h = c.mf_samples_to_encode - m.POSTDELAY,
            p = V(e);
          if (c.mf_samples_to_encode < 1) return 0;
          for (
            r = 0,
              e.in_samplerate != e.out_samplerate &&
                (h += (16 * e.out_samplerate) / e.in_samplerate),
              (o = e.framesize - (h % e.framesize)) < 576 && (o += e.framesize),
              e.encoder_padding = o,
              _ = (h + o) / e.framesize;
            _ > 0 && f >= 0;
          ) {
            var b = p - c.mf_size,
              d = e.frameNum;
            ((b *= e.in_samplerate),
              (b /= e.out_samplerate) > 1152 && (b = 1152),
              b < 1 && (b = 1),
              (i = s - r),
              0 == s && (i = 0),
              (a += f = this.lame_encode_buffer(e, u[0], u[1], b, t, a, i)),
              (r += f),
              (_ -= d != e.frameNum ? 1 : 0));
          }
          if (((c.mf_samples_to_encode = 0), f < 0)) return f;
          if (
            ((i = s - r),
            0 == s && (i = 0),
            v.flush_bitstream(e),
            (f = v.copy_buffer(c, t, a, i, 1)) < 0)
          )
            return f;
          if (
            ((a += f),
            (i = s - (r += f)),
            0 == s && (i = 0),
            e.write_id3tag_automatic)
          ) {
            if ((x.id3tag_write_v1(e), (f = v.copy_buffer(c, t, a, i, 0)) < 0))
              return f;
            r += f;
          }
          return r;
        }),
        (this.lame_encode_buffer = function (e, t, a, s, i, l, _) {
          var c = e.internal_flags,
            f = [null, null];
          if (c.Class_ID != P) return -3;
          if (0 == s) return 0;
          (!(function (e, t) {
            (null == e.in_buffer_0 || e.in_buffer_nsamples < t) &&
              ((e.in_buffer_0 = r(t)),
              (e.in_buffer_1 = r(t)),
              (e.in_buffer_nsamples = t));
          })(c, s),
            (f[0] = c.in_buffer_0),
            (f[1] = c.in_buffer_1));
          for (var h = 0; h < s; h++)
            ((f[0][h] = t[h]), c.channels_in > 1 && (f[1][h] = a[h]));
          return (function (e, t, a, s, r, i, l) {
            var _,
              c,
              f,
              h,
              p,
              d = e.internal_flags,
              w = 0,
              y = [null, null],
              k = [null, null];
            if (d.Class_ID != P) return -3;
            if (0 == s) return 0;
            if (((p = v.copy_buffer(d, r, i, l, 0)), p < 0)) return p;
            if (
              ((i += p),
              (w += p),
              (k[0] = t),
              (k[1] = a),
              b.NEQ(e.scale, 0) && b.NEQ(e.scale, 1))
            )
              for (c = 0; c < s; ++c)
                ((k[0][c] *= e.scale),
                  2 == d.channels_out && (k[1][c] *= e.scale));
            if (b.NEQ(e.scale_left, 0) && b.NEQ(e.scale_left, 1))
              for (c = 0; c < s; ++c) k[0][c] *= e.scale_left;
            if (b.NEQ(e.scale_right, 0) && b.NEQ(e.scale_right, 1))
              for (c = 0; c < s; ++c) k[1][c] *= e.scale_right;
            if (2 == e.num_channels && 1 == d.channels_out)
              for (c = 0; c < s; ++c)
                ((k[0][c] = 0.5 * (k[0][c] + k[1][c])), (k[1][c] = 0));
            ((h = V(e)), (y[0] = d.mfbuf[0]), (y[1] = d.mfbuf[1]));
            var S = 0;
            for (; s > 0; ) {
              var R = [null, null],
                x = 0,
                A = 0;
              ((R[0] = k[0]), (R[1] = k[1]));
              var M = new C();
              if (
                (U(e, y, R, S, s, M),
                (x = M.n_in),
                (A = M.n_out),
                d.findReplayGain &&
                  !d.decode_on_the_fly &&
                  g.AnalyzeSamples(
                    d.rgdata,
                    y[0],
                    d.mf_size,
                    y[1],
                    d.mf_size,
                    A,
                    d.channels_out,
                  ) == GainAnalysis.GAIN_ANALYSIS_ERROR)
              )
                return -6;
              if (
                ((s -= x),
                (S += x),
                d.channels_out,
                (d.mf_size += A),
                o(d.mf_size <= u.MFSIZE),
                d.mf_samples_to_encode < 1 &&
                  (d.mf_samples_to_encode = m.ENCDELAY + m.POSTDELAY),
                (d.mf_samples_to_encode += A),
                d.mf_size >= h)
              ) {
                var T = l - w;
                if ((0 == l && (T = 0), (_ = H(e, y[0], y[1], r, i, T)) < 0))
                  return _;
                for (
                  i += _,
                    w += _,
                    d.mf_size -= e.framesize,
                    d.mf_samples_to_encode -= e.framesize,
                    f = 0;
                  f < d.channels_out;
                  f++
                )
                  for (c = 0; c < d.mf_size; c++)
                    y[f][c] = y[f][c + e.framesize];
              }
            }
            return (o(0 == s), w);
          })(e, f[0], f[1], s, i, l, _);
        }));
    }),
    Jt
  );
}
function Nn() {
  if (un) return cn;
  un = 1;
  var e = wn(),
    t = e.System,
    a = e.VbrMode;
  (e.Float, e.ShortBlock);
  var s = e.Util,
    r = e.Arrays;
  (e.new_array_n, e.new_byte, e.new_double);
  var i = e.new_float;
  (e.new_float_n, e.new_int, e.new_int_n);
  var l = e.assert,
    o = sn
      ? an
      : ((sn = 1),
        (an = function () {
          this.setModules = function (e, t) {};
        })),
    _ = ln
      ? rn
      : ((ln = 1),
        (rn = function () {
          ((this.over_noise = 0),
            (this.tot_noise = 0),
            (this.max_noise = 0),
            (this.over_count = 0),
            (this.over_SSD = 0),
            (this.bits = 0));
        })),
    c = (function () {
      if (_n) return on;
      _n = 1;
      var e = wn(),
        t = e.new_float,
        a = e.new_int;
      return (
        e.assert,
        (on = function () {
          ((this.global_gain = 0),
            (this.sfb_count1 = 0),
            (this.step = a(39)),
            (this.noise = t(39)),
            (this.noise_log = t(39)));
        })
      );
    })(),
    u = kn(),
    f = An(),
    h = xn();
  return (cn = function () {
    var e, p, b;
    ((this.rv = null), (this.qupvt = null));
    var d,
      m = new o();
    function g(e) {
      this.ordinal = e;
    }
    function v(e) {
      for (var t = 0; t < e.sfbmax; t++)
        if (e.scalefac[t] + e.subblock_gain[e.window[t]] == 0) return !1;
      return !0;
    }
    function w(e) {
      return s.FAST_LOG10(0.368 + 0.632 * e * e * e);
    }
    function y(e, t, a, s, r) {
      var i;
      switch (e) {
        default:
        case 9:
          t.over_count > 0
            ? ((i = a.over_SSD <= t.over_SSD),
              a.over_SSD == t.over_SSD && (i = a.bits < t.bits))
            : (i =
                a.max_noise < 0 &&
                10 * a.max_noise + a.bits <= 10 * t.max_noise + t.bits);
          break;
        case 0:
          i =
            a.over_count < t.over_count ||
            (a.over_count == t.over_count && a.over_noise < t.over_noise) ||
            (a.over_count == t.over_count &&
              BitStream.EQ(a.over_noise, t.over_noise) &&
              a.tot_noise < t.tot_noise);
          break;
        case 8:
          a.max_noise = (function (e, t) {
            for (var a = 1e-37, s = 0; s < t.psymax; s++) a += w(e[s]);
            return Math.max(1e-20, a);
          })(r, s);
        case 1:
          i = a.max_noise < t.max_noise;
          break;
        case 2:
          i = a.tot_noise < t.tot_noise;
          break;
        case 3:
          i = a.tot_noise < t.tot_noise && a.max_noise < t.max_noise;
          break;
        case 4:
          i =
            (a.max_noise <= 0 && t.max_noise > 0.2) ||
            (a.max_noise <= 0 &&
              t.max_noise < 0 &&
              t.max_noise > a.max_noise - 0.2 &&
              a.tot_noise < t.tot_noise) ||
            (a.max_noise <= 0 &&
              t.max_noise > 0 &&
              t.max_noise > a.max_noise - 0.2 &&
              a.tot_noise < t.tot_noise + t.over_noise) ||
            (a.max_noise > 0 &&
              t.max_noise > -0.05 &&
              t.max_noise > a.max_noise - 0.1 &&
              a.tot_noise + a.over_noise < t.tot_noise + t.over_noise) ||
            (a.max_noise > 0 &&
              t.max_noise > -0.1 &&
              t.max_noise > a.max_noise - 0.15 &&
              a.tot_noise + a.over_noise + a.over_noise <
                t.tot_noise + t.over_noise + t.over_noise);
          break;
        case 5:
          i =
            a.over_noise < t.over_noise ||
            (BitStream.EQ(a.over_noise, t.over_noise) &&
              a.tot_noise < t.tot_noise);
          break;
        case 6:
          i =
            a.over_noise < t.over_noise ||
            (BitStream.EQ(a.over_noise, t.over_noise) &&
              (a.max_noise < t.max_noise ||
                (BitStream.EQ(a.max_noise, t.max_noise) &&
                  a.tot_noise <= t.tot_noise)));
          break;
        case 7:
          i = a.over_count < t.over_count || a.over_noise < t.over_noise;
      }
      return (0 == t.over_count && (i = i && a.bits < t.bits), i);
    }
    function k(e, t, a, s, i) {
      var o = e.internal_flags;
      !(function (e, t, a, s, r) {
        var i,
          l = e.internal_flags;
        i = 0 == t.scalefac_scale ? 1.2968395546510096 : 1.6817928305074292;
        for (var o = 0, _ = 0; _ < t.sfbmax; _++) o < a[_] && (o = a[_]);
        var c = l.noise_shaping_amp;
        switch ((3 == c && (c = r ? 2 : 1), c)) {
          case 2:
            break;
          case 1:
            o > 1 ? (o = Math.pow(o, 0.5)) : (o *= 0.95);
            break;
          default:
            o > 1 ? (o = 1) : (o *= 0.95);
        }
        var u = 0;
        for (_ = 0; _ < t.sfbmax; _++) {
          var f,
            width = t.width[_];
          if (((u += width), !(a[_] < o))) {
            if (
              2 & l.substep_shaping &&
              ((l.pseudohalf[_] = 0 == l.pseudohalf[_] ? 1 : 0),
              0 == l.pseudohalf[_] && 2 == l.noise_shaping_amp)
            )
              return;
            for (t.scalefac[_]++, f = -width; f < 0; f++)
              ((s[u + f] *= i),
                s[u + f] > t.xrpow_max && (t.xrpow_max = s[u + f]));
            if (2 == l.noise_shaping_amp) return;
          }
        }
      })(e, t, a, s, i);
      var _ = v(t);
      return (
        !_ &&
        (!(_ =
          2 == o.mode_gr ? d.scale_bitcount(t) : d.scale_bitcount_lsf(o, t)) ||
          (o.noise_shaping > 1 &&
            (r.fill(o.pseudohalf, 0),
            0 == t.scalefac_scale
              ? (!(function (e, t) {
                  for (var a = 0, s = 0; s < e.sfbmax; s++) {
                    var width = e.width[s],
                      r = e.scalefac[s];
                    if (
                      (0 != e.preflag && (r += b.pretab[s]),
                      (a += width),
                      1 & r)
                    ) {
                      r++;
                      for (var i = -width; i < 0; i++)
                        ((t[a + i] *= 1.2968395546510096),
                          t[a + i] > e.xrpow_max && (e.xrpow_max = t[a + i]));
                    }
                    e.scalefac[s] = r >> 1;
                  }
                  ((e.preflag = 0), (e.scalefac_scale = 1));
                })(t, s),
                (_ = !1))
              : t.block_type == u.SHORT_TYPE &&
                o.subblock_gain > 0 &&
                (_ =
                  (function (e, t, a) {
                    var s,
                      r = t.scalefac;
                    for (s = 0; s < t.sfb_lmax; s++) if (r[s] >= 16) return !0;
                    for (var i = 0; i < 3; i++) {
                      var o = 0,
                        _ = 0;
                      for (s = t.sfb_lmax + i; s < t.sfbdivide; s += 3)
                        o < r[s] && (o = r[s]);
                      for (; s < t.sfbmax; s += 3) _ < r[s] && (_ = r[s]);
                      if (!(o < 16 && _ < 8)) {
                        if (t.subblock_gain[i] >= 7) return !0;
                        t.subblock_gain[i]++;
                        var c = e.scalefac_band.l[t.sfb_lmax];
                        for (s = t.sfb_lmax + i; s < t.sfbmax; s += 3) {
                          var width = t.width[s],
                            u = r[s];
                          if ((l(u >= 0), (u -= 4 >> t.scalefac_scale) >= 0))
                            ((r[s] = u), (c += 3 * width));
                          else {
                            r[s] = 0;
                            var f = 210 + (u << (t.scalefac_scale + 1));
                            ((p = b.IPOW20(f)), (c += width * (i + 1)));
                            for (var h = -width; h < 0; h++)
                              ((a[c + h] *= p),
                                a[c + h] > t.xrpow_max &&
                                  (t.xrpow_max = a[c + h]));
                            c += width * (3 - i - 1);
                          }
                        }
                        var p = b.IPOW20(202);
                        for (
                          c += t.width[s] * (i + 1), h = -t.width[s];
                          h < 0;
                          h++
                        )
                          ((a[c + h] *= p),
                            a[c + h] > t.xrpow_max && (t.xrpow_max = a[c + h]));
                      }
                    }
                    return !1;
                  })(o, t, s) || v(t))),
          _ ||
            (_ =
              2 == o.mode_gr
                ? d.scale_bitcount(t)
                : d.scale_bitcount_lsf(o, t)),
          !_))
      );
    }
    ((this.setModules = function (t, a, s, r) {
      ((e = t),
        (p = a),
        (this.rv = a),
        (b = s),
        (this.qupvt = s),
        (d = r),
        m.setModules(b, d));
    }),
      (this.ms_convert = function (e, t) {
        for (var a = 0; a < 576; ++a) {
          var r = e.tt[t][0].xr[a],
            i = e.tt[t][1].xr[a];
          ((e.tt[t][0].xr[a] = (r + i) * (0.5 * s.SQRT2)),
            (e.tt[t][1].xr[a] = (r - i) * (0.5 * s.SQRT2)));
        }
      }),
      (this.init_xrpow = function (e, t, a) {
        var s = 0,
          i = 0 | t.max_nonzero_coeff;
        if (
          (l(null != a),
          (t.xrpow_max = 0),
          l(0 <= i && i <= 575),
          r.fill(a, i, 576, 0),
          (s = (function (e, t, a, s) {
            s = 0;
            for (var r = 0; r <= a; ++r) {
              var i = Math.abs(e.xr[r]);
              ((s += i),
                (t[r] = Math.sqrt(i * Math.sqrt(i))),
                t[r] > e.xrpow_max && (e.xrpow_max = t[r]));
            }
            return s;
          })(t, a, i, s)),
          s > 1e-20)
        ) {
          var o = 0;
          2 & e.substep_shaping && (o = 1);
          for (var _ = 0; _ < t.psymax; _++) e.pseudohalf[_] = o;
          return !0;
        }
        return (r.fill(t.l3_enc, 0, 576, 0), !1);
      }),
      (this.init_outer_loop = function (e, a) {
        ((a.part2_3_length = 0),
          (a.big_values = 0),
          (a.count1 = 0),
          (a.global_gain = 210),
          (a.scalefac_compress = 0),
          (a.table_select[0] = 0),
          (a.table_select[1] = 0),
          (a.table_select[2] = 0),
          (a.subblock_gain[0] = 0),
          (a.subblock_gain[1] = 0),
          (a.subblock_gain[2] = 0),
          (a.subblock_gain[3] = 0),
          (a.region0_count = 0),
          (a.region1_count = 0),
          (a.preflag = 0),
          (a.scalefac_scale = 0),
          (a.count1table_select = 0),
          (a.part2_length = 0),
          (a.sfb_lmax = u.SBPSY_l),
          (a.sfb_smin = u.SBPSY_s),
          (a.psy_lmax = e.sfb21_extra ? u.SBMAX_l : u.SBPSY_l),
          (a.psymax = a.psy_lmax),
          (a.sfbmax = a.sfb_lmax),
          (a.sfbdivide = 11));
        for (var s = 0; s < u.SBMAX_l; s++)
          ((a.width[s] = e.scalefac_band.l[s + 1] - e.scalefac_band.l[s]),
            (a.window[s] = 3));
        if (a.block_type == u.SHORT_TYPE) {
          var l = i(576);
          ((a.sfb_smin = 0),
            (a.sfb_lmax = 0),
            0 != a.mixed_block_flag &&
              ((a.sfb_smin = 3), (a.sfb_lmax = 2 * e.mode_gr + 4)),
            (a.psymax =
              a.sfb_lmax +
              3 * ((e.sfb21_extra ? u.SBMAX_s : u.SBPSY_s) - a.sfb_smin)),
            (a.sfbmax = a.sfb_lmax + 3 * (u.SBPSY_s - a.sfb_smin)),
            (a.sfbdivide = a.sfbmax - 18),
            (a.psy_lmax = a.sfb_lmax));
          var o = e.scalefac_band.l[a.sfb_lmax];
          t.arraycopy(a.xr, 0, l, 0, 576);
          for (s = a.sfb_smin; s < u.SBMAX_s; s++)
            for (
              var _ = e.scalefac_band.s[s], c = e.scalefac_band.s[s + 1], f = 0;
              f < 3;
              f++
            )
              for (var h = _; h < c; h++) a.xr[o++] = l[3 * h + f];
          var p = a.sfb_lmax;
          for (s = a.sfb_smin; s < u.SBMAX_s; s++)
            ((a.width[p] =
              a.width[p + 1] =
              a.width[p + 2] =
                e.scalefac_band.s[s + 1] - e.scalefac_band.s[s]),
              (a.window[p] = 0),
              (a.window[p + 1] = 1),
              (a.window[p + 2] = 2),
              (p += 3));
        }
        ((a.count1bits = 0),
          (a.sfb_partition_table = b.nr_of_sfb_block[0][0]),
          (a.slen[0] = 0),
          (a.slen[1] = 0),
          (a.slen[2] = 0),
          (a.slen[3] = 0),
          (a.max_nonzero_coeff = 575),
          r.fill(a.scalefac, 0),
          (function (e, t) {
            var a = e.ATH,
              s = t.xr;
            if (t.block_type != u.SHORT_TYPE)
              for (var stop = !1, r = u.PSFB21 - 1; r >= 0 && !stop; r--) {
                var i = e.scalefac_band.psfb21[r],
                  l = e.scalefac_band.psfb21[r + 1],
                  o = b.athAdjust(a.adjust, a.psfb21[r], a.floor);
                e.nsPsy.longfact[21] > 1e-12 && (o *= e.nsPsy.longfact[21]);
                for (var _ = l - 1; _ >= i; _--) {
                  if (!(Math.abs(s[_]) < o)) {
                    stop = !0;
                    break;
                  }
                  s[_] = 0;
                }
              }
            else
              for (var c = 0; c < 3; c++)
                for (stop = !1, r = u.PSFB12 - 1; r >= 0 && !stop; r--) {
                  l =
                    (i =
                      3 * e.scalefac_band.s[12] +
                      (e.scalefac_band.s[13] - e.scalefac_band.s[12]) * c +
                      (e.scalefac_band.psfb12[r] - e.scalefac_band.psfb12[0])) +
                    (e.scalefac_band.psfb12[r + 1] - e.scalefac_band.psfb12[r]);
                  var f = b.athAdjust(a.adjust, a.psfb12[r], a.floor);
                  for (
                    e.nsPsy.shortfact[12] > 1e-12 &&
                      (f *= e.nsPsy.shortfact[12]),
                      _ = l - 1;
                    _ >= i;
                    _--
                  ) {
                    if (!(Math.abs(s[_]) < f)) {
                      stop = !0;
                      break;
                    }
                    s[_] = 0;
                  }
                }
          })(e, a));
      }),
      (g.BINSEARCH_NONE = new g(0)),
      (g.BINSEARCH_UP = new g(1)),
      (g.BINSEARCH_DOWN = new g(2)),
      (this.trancate_smallspectrums = function (e, t, a, s) {
        var l = i(h.SFBMAX);
        if (
          (4 & e.substep_shaping || t.block_type != u.SHORT_TYPE) &&
          !(128 & e.substep_shaping)
        ) {
          b.calc_noise(t, a, l, new _(), null);
          for (var o = 0; o < 576; o++) {
            var c = 0;
            (0 != t.l3_enc[o] && (c = Math.abs(t.xr[o])), (s[o] = c));
          }
          o = 0;
          var f = 8;
          t.block_type == u.SHORT_TYPE && (f = 6);
          do {
            var p,
              m,
              g,
              v,
              width = t.width[f];
            if (
              ((o += width),
              !(
                l[f] >= 1 ||
                (r.sort(s, o - width, width), BitStream.EQ(s[o - 1], 0))
              ))
            ) {
              ((p = (1 - l[f]) * a[f]), (m = 0), (v = 0));
              do {
                var w;
                for (
                  g = 1;
                  v + g < width &&
                  !BitStream.NEQ(s[v + o - width], s[v + o + g - width]);
                  g++
                );
                if (p < (w = s[v + o - width] * s[v + o - width] * g)) {
                  0 != v && (m = s[v + o - width - 1]);
                  break;
                }
                ((p -= w), (v += g));
              } while (v < width);
              if (!BitStream.EQ(m, 0))
                do {
                  Math.abs(t.xr[o - width]) <= m && (t.l3_enc[o - width] = 0);
                } while (--width > 0);
            }
          } while (++f < t.psymax);
          t.part2_3_length = d.noquant_count_bits(e, t, null);
        }
      }),
      (this.outer_loop = function (e, s, r, o, p, m) {
        var v = e.internal_flags,
          w = new f(),
          S = i(576),
          R = i(h.SFBMAX),
          x = new _(),
          A = new c(),
          M = 9999999,
          T = !1,
          B = !1,
          E = 0;
        if (
          ((function (e, t, a, s, r) {
            var i,
              o = e.CurrentStep[s],
              _ = !1,
              c = e.OldValue[s],
              u = g.BINSEARCH_NONE;
            for (t.global_gain = c, a -= t.part2_length, l(0 != o); ; ) {
              var f;
              if (((i = d.count_bits(e, r, t, null)), 1 == o || i == a)) break;
              (i > a
                ? (u == g.BINSEARCH_DOWN && (_ = !0),
                  _ && (o /= 2),
                  (u = g.BINSEARCH_UP),
                  (f = o))
                : (u == g.BINSEARCH_UP && (_ = !0),
                  _ && (o /= 2),
                  (u = g.BINSEARCH_DOWN),
                  (f = -o)),
                (t.global_gain += f),
                t.global_gain < 0 && ((t.global_gain = 0), (_ = !0)),
                t.global_gain > 255 && ((t.global_gain = 255), (_ = !0)));
            }
            for (
              l(t.global_gain >= 0), l(t.global_gain < 256);
              i > a && t.global_gain < 255;
            )
              (t.global_gain++, (i = d.count_bits(e, r, t, null)));
            ((e.CurrentStep[s] = c - t.global_gain >= 4 ? 4 : 2),
              (e.OldValue[s] = t.global_gain),
              (t.part2_3_length = i));
          })(v, s, m, p, o),
          0 == v.noise_shaping)
        )
          return 100;
        (b.calc_noise(s, r, R, x, A), (x.bits = s.part2_3_length), w.assign(s));
        var P = 0;
        for (t.arraycopy(o, 0, S, 0, 576); !T; ) {
          do {
            var L,
              I = new _(),
              O = 255;
            if (((L = 2 & v.substep_shaping ? 20 : 3), v.sfb21_extra)) {
              if (R[w.sfbmax] > 1) break;
              if (
                w.block_type == u.SHORT_TYPE &&
                (R[w.sfbmax + 1] > 1 || R[w.sfbmax + 2] > 1)
              )
                break;
            }
            if (!k(e, w, R, o, B)) break;
            0 != w.scalefac_scale && (O = 254);
            var D = m - w.part2_length;
            if (D <= 0) break;
            for (
              ;
              (w.part2_3_length = d.count_bits(v, o, w, A)) > D &&
              w.global_gain <= O;
            )
              w.global_gain++;
            if (w.global_gain > O) break;
            if (0 == x.over_count) {
              for (
                ;
                (w.part2_3_length = d.count_bits(v, o, w, A)) > M &&
                w.global_gain <= O;
              )
                w.global_gain++;
              if (w.global_gain > O) break;
            }
            if (
              (b.calc_noise(w, r, R, I, A),
              (I.bits = w.part2_3_length),
              0 !=
                (y(
                  s.block_type != u.SHORT_TYPE
                    ? e.quant_comp
                    : e.quant_comp_short,
                  x,
                  I,
                  w,
                  R,
                )
                  ? 1
                  : 0))
            )
              ((M = s.part2_3_length),
                (x = I),
                s.assign(w),
                (P = 0),
                t.arraycopy(o, 0, S, 0, 576));
            else if (0 == v.full_outer_loop) {
              if (++P > L && 0 == x.over_count) break;
              if (3 == v.noise_shaping_amp && B && P > 30) break;
              if (3 == v.noise_shaping_amp && B && w.global_gain - E > 15)
                break;
            }
          } while (w.global_gain + w.scalefac_scale < 255);
          3 == v.noise_shaping_amp
            ? B
              ? (T = !0)
              : (w.assign(s),
                t.arraycopy(S, 0, o, 0, 576),
                (P = 0),
                (E = w.global_gain),
                (B = !0))
            : (T = !0);
        }
        return (
          l(s.global_gain + s.scalefac_scale <= 255),
          e.VBR == a.vbr_rh || e.VBR == a.vbr_mtrh
            ? t.arraycopy(S, 0, o, 0, 576)
            : 1 & v.substep_shaping && trancate_smallspectrums(v, s, r, o),
          x.over_count
        );
      }),
      (this.iteration_finish_one = function (e, t, a) {
        var s = e.l3_side,
          r = s.tt[t][a];
        (d.best_scalefac_store(e, t, a, s),
          1 == e.use_best_huffman && d.best_huffman_divide(e, r),
          p.ResvAdjust(e, r));
      }),
      (this.VBR_encode_granule = function (e, a, s, o, _, c, u) {
        var h,
          p = e.internal_flags,
          b = new f(),
          d = i(576),
          m = u,
          g = u + 1,
          v = (u + c) / 2,
          w = 0,
          y = p.sfb21_extra;
        (l(m <= LameInternalFlags.MAX_BITS_PER_CHANNEL), r.fill(b.l3_enc, 0));
        do {
          (l(v >= c),
            l(v <= u),
            l(c <= u),
            (p.sfb21_extra = !(v > m - 42) && y),
            outer_loop(e, a, s, o, _, v) <= 0
              ? ((w = 1),
                (g = a.part2_3_length),
                b.assign(a),
                t.arraycopy(o, 0, d, 0, 576),
                (h = (u = g - 32) - c),
                (v = (u + c) / 2))
              : ((h = u - (c = v + 32)),
                (v = (u + c) / 2),
                0 != w &&
                  ((w = 2), a.assign(b), t.arraycopy(d, 0, o, 0, 576))));
        } while (h > 12);
        ((p.sfb21_extra = y),
          2 == w && t.arraycopy(b.l3_enc, 0, a.l3_enc, 0, 576),
          l(a.part2_3_length <= m));
      }),
      (this.get_framebits = function (t, a) {
        var s = t.internal_flags;
        s.bitrate_index = s.VBR_min_bitrate;
        var r = e.getframebits(t);
        ((s.bitrate_index = 1), (r = e.getframebits(t)));
        for (var i = 1; i <= s.VBR_max_bitrate; i++) {
          s.bitrate_index = i;
          var l = new MeanBits(r);
          ((a[i] = p.ResvFrameBegin(t, l)), (r = l.bits));
        }
      }),
      (this.VBR_old_prepare = function (e, t, a, s, r, i, l, o, _) {
        var c,
          f = e.internal_flags,
          h = 0,
          d = 1,
          m = 0;
        f.bitrate_index = f.VBR_max_bitrate;
        var g = p.ResvFrameBegin(e, new MeanBits(0)) / f.mode_gr;
        get_framebits(e, i);
        for (var v = 0; v < f.mode_gr; v++) {
          var w = b.on_pe(e, t, o[v], g, v, 0);
          f.mode_ext == u.MPG_MD_MS_LR &&
            (ms_convert(f.l3_side, v), b.reduce_side(o[v], a[v], g, w));
          for (var y = 0; y < f.channels_out; ++y) {
            var k = f.l3_side.tt[v][y];
            (k.block_type != u.SHORT_TYPE
              ? ((h = 1.28 / (1 + Math.exp(3.5 - t[v][y] / 300)) - 0.05),
                (c = f.PSY.mask_adjust - h))
              : ((h = 2.56 / (1 + Math.exp(3.5 - t[v][y] / 300)) - 0.14),
                (c = f.PSY.mask_adjust_short - h)),
              (f.masking_lower = Math.pow(10, 0.1 * c)),
              init_outer_loop(f, k),
              (_[v][y] = b.calc_xmin(e, s[v][y], k, r[v][y])),
              0 != _[v][y] && (d = 0),
              (l[v][y] = 126),
              (m += o[v][y]));
          }
        }
        for (v = 0; v < f.mode_gr; v++)
          for (y = 0; y < f.channels_out; y++)
            (m > i[f.VBR_max_bitrate] &&
              ((o[v][y] *= i[f.VBR_max_bitrate]), (o[v][y] /= m)),
              l[v][y] > o[v][y] && (l[v][y] = o[v][y]));
        return d;
      }),
      (this.bitpressure_strategy = function (e, t, a, s) {
        for (var r = 0; r < e.mode_gr; r++)
          for (var i = 0; i < e.channels_out; i++) {
            for (
              var l = e.l3_side.tt[r][i], o = t[r][i], _ = 0, c = 0;
              c < l.psy_lmax;
              c++
            )
              o[_++] *= 1 + (0.029 * c * c) / u.SBMAX_l / u.SBMAX_l;
            if (l.block_type == u.SHORT_TYPE)
              for (c = l.sfb_smin; c < u.SBMAX_s; c++)
                ((o[_++] *= 1 + (0.029 * c * c) / u.SBMAX_s / u.SBMAX_s),
                  (o[_++] *= 1 + (0.029 * c * c) / u.SBMAX_s / u.SBMAX_s),
                  (o[_++] *= 1 + (0.029 * c * c) / u.SBMAX_s / u.SBMAX_s));
            s[r][i] = 0 | Math.max(a[r][i], 0.9 * s[r][i]);
          }
      }),
      (this.VBR_new_prepare = function (e, t, a, s, r, i) {
        var l,
          o = e.internal_flags,
          _ = 1,
          c = 0,
          f = 0;
        if (e.free_format) {
          o.bitrate_index = 0;
          h = new MeanBits(c);
          ((l = p.ResvFrameBegin(e, h)), (c = h.bits), (r[0] = l));
        } else {
          o.bitrate_index = o.VBR_max_bitrate;
          var h = new MeanBits(c);
          (p.ResvFrameBegin(e, h),
            (c = h.bits),
            get_framebits(e, r),
            (l = r[o.VBR_max_bitrate]));
        }
        for (var d = 0; d < o.mode_gr; d++) {
          (b.on_pe(e, t, i[d], c, d, 0),
            o.mode_ext == u.MPG_MD_MS_LR && ms_convert(o.l3_side, d));
          for (var m = 0; m < o.channels_out; ++m) {
            var g = o.l3_side.tt[d][m];
            ((o.masking_lower = Math.pow(10, 0.1 * o.PSY.mask_adjust)),
              init_outer_loop(o, g),
              0 != b.calc_xmin(e, a[d][m], g, s[d][m]) && (_ = 0),
              (f += i[d][m]));
          }
        }
        for (d = 0; d < o.mode_gr; d++)
          for (m = 0; m < o.channels_out; m++)
            f > l && ((i[d][m] *= l), (i[d][m] /= f));
        return _;
      }),
      (this.calc_target_bits = function (t, a, s, r, i, l) {
        var o,
          _,
          c,
          f,
          h = t.internal_flags,
          d = h.l3_side,
          m = 0;
        h.bitrate_index = h.VBR_max_bitrate;
        var g = new MeanBits(m);
        for (
          l[0] = p.ResvFrameBegin(t, g),
            m = g.bits,
            h.bitrate_index = 1,
            m = e.getframebits(t) - 8 * h.sideinfo_len,
            i[0] = m / (h.mode_gr * h.channels_out),
            m = t.VBR_mean_bitrate_kbps * t.framesize * 1e3,
            1 & h.substep_shaping && (m *= 1.09),
            m /= t.out_samplerate,
            m -= 8 * h.sideinfo_len,
            m /= h.mode_gr * h.channels_out,
            (o = 0.93 + (0.07 * (11 - t.compression_ratio)) / 5.5) < 0.9 &&
              (o = 0.9),
            o > 1 && (o = 1),
            _ = 0;
          _ < h.mode_gr;
          _++
        ) {
          var v = 0;
          for (c = 0; c < h.channels_out; c++) {
            if (((r[_][c] = int(o * m)), a[_][c] > 700)) {
              var w = int((a[_][c] - 700) / 1.4),
                y = d.tt[_][c];
              ((r[_][c] = int(o * m)),
                y.block_type == u.SHORT_TYPE && w < m / 2 && (w = m / 2),
                w > (3 * m) / 2 ? (w = (3 * m) / 2) : w < 0 && (w = 0),
                (r[_][c] += w));
            }
            (r[_][c] > LameInternalFlags.MAX_BITS_PER_CHANNEL &&
              (r[_][c] = LameInternalFlags.MAX_BITS_PER_CHANNEL),
              (v += r[_][c]));
          }
          if (v > LameInternalFlags.MAX_BITS_PER_GRANULE)
            for (c = 0; c < h.channels_out; ++c)
              ((r[_][c] *= LameInternalFlags.MAX_BITS_PER_GRANULE),
                (r[_][c] /= v));
        }
        if (h.mode_ext == u.MPG_MD_MS_LR)
          for (_ = 0; _ < h.mode_gr; _++)
            b.reduce_side(
              r[_],
              s[_],
              m * h.channels_out,
              LameInternalFlags.MAX_BITS_PER_GRANULE,
            );
        for (f = 0, _ = 0; _ < h.mode_gr; _++)
          for (c = 0; c < h.channels_out; c++)
            (r[_][c] > LameInternalFlags.MAX_BITS_PER_CHANNEL &&
              (r[_][c] = LameInternalFlags.MAX_BITS_PER_CHANNEL),
              (f += r[_][c]));
        if (f > l[0])
          for (_ = 0; _ < h.mode_gr; _++)
            for (c = 0; c < h.channels_out; c++)
              ((r[_][c] *= l[0]), (r[_][c] /= f));
      }));
  });
}
function Vn() {
  if (mn) return dn;
  mn = 1;
  var e = wn(),
    t = e.System,
    a = e.VbrMode;
  e.Float;
  var s = e.ShortBlock;
  e.Util;
  var r = e.Arrays;
  e.new_array_n;
  var i = e.new_byte;
  (e.new_double, e.new_float, e.new_float_n, e.new_int, e.new_int_n);
  var l = e.assert;
  function o() {
    var e, _, c;
    this.setModules = function (t, a, s) {
      ((e = t), (_ = a), (c = s));
    };
    var u = o.NUMTOCENTRIES,
      f = o.MAXFRAMESIZE,
      h =
        u +
        4 +
        4 +
        4 +
        4 +
        4 +
        9 +
        1 +
        1 +
        8 +
        1 +
        1 +
        3 +
        1 +
        1 +
        2 +
        4 +
        2 +
        2,
      p = "Xing",
      b = "Info",
      d = [
        0, 49345, 49537, 320, 49921, 960, 640, 49729, 50689, 1728, 1920, 51009,
        1280, 50625, 50305, 1088, 52225, 3264, 3456, 52545, 3840, 53185, 52865,
        3648, 2560, 51905, 52097, 2880, 51457, 2496, 2176, 51265, 55297, 6336,
        6528, 55617, 6912, 56257, 55937, 6720, 7680, 57025, 57217, 8e3, 56577,
        7616, 7296, 56385, 5120, 54465, 54657, 5440, 55041, 6080, 5760, 54849,
        53761, 4800, 4992, 54081, 4352, 53697, 53377, 4160, 61441, 12480, 12672,
        61761, 13056, 62401, 62081, 12864, 13824, 63169, 63361, 14144, 62721,
        13760, 13440, 62529, 15360, 64705, 64897, 15680, 65281, 16320, 16e3,
        65089, 64001, 15040, 15232, 64321, 14592, 63937, 63617, 14400, 10240,
        59585, 59777, 10560, 60161, 11200, 10880, 59969, 60929, 11968, 12160,
        61249, 11520, 60865, 60545, 11328, 58369, 9408, 9600, 58689, 9984,
        59329, 59009, 9792, 8704, 58049, 58241, 9024, 57601, 8640, 8320, 57409,
        40961, 24768, 24960, 41281, 25344, 41921, 41601, 25152, 26112, 42689,
        42881, 26432, 42241, 26048, 25728, 42049, 27648, 44225, 44417, 27968,
        44801, 28608, 28288, 44609, 43521, 27328, 27520, 43841, 26880, 43457,
        43137, 26688, 30720, 47297, 47489, 31040, 47873, 31680, 31360, 47681,
        48641, 32448, 32640, 48961, 32e3, 48577, 48257, 31808, 46081, 29888,
        30080, 46401, 30464, 47041, 46721, 30272, 29184, 45761, 45953, 29504,
        45313, 29120, 28800, 45121, 20480, 37057, 37249, 20800, 37633, 21440,
        21120, 37441, 38401, 22208, 22400, 38721, 21760, 38337, 38017, 21568,
        39937, 23744, 23936, 40257, 24320, 40897, 40577, 24128, 23040, 39617,
        39809, 23360, 39169, 22976, 22656, 38977, 34817, 18624, 18816, 35137,
        19200, 35777, 35457, 19008, 19968, 36545, 36737, 20288, 36097, 19904,
        19584, 35905, 17408, 33985, 34177, 17728, 34561, 18368, 18048, 34369,
        33281, 17088, 17280, 33601, 16640, 33217, 32897, 16448,
      ];
    function m(e, t) {
      var a = 255 & e[t + 0];
      return (
        (a <<= 8),
        (a |= 255 & e[t + 1]),
        (a <<= 8),
        (a |= 255 & e[t + 2]),
        (a <<= 8),
        (a |= 255 & e[t + 3])
      );
    }
    function g(e, t, value) {
      ((e[t + 0] = 255 & (value >> 24)),
        (e[t + 1] = 255 & (value >> 16)),
        (e[t + 2] = 255 & (value >> 8)),
        (e[t + 3] = 255 & value));
    }
    function v(e, t, value) {
      ((e[t + 0] = 255 & (value >> 8)), (e[t + 1] = 255 & value));
    }
    function w(e, n, t) {
      return 255 & ((e << n) | (t & ~(-1 << n)));
    }
    function y(t, s) {
      var r = t.internal_flags;
      ((s[0] = w(s[0], 8, 255)),
        (s[1] = w(s[1], 3, 7)),
        (s[1] = w(s[1], 1, t.out_samplerate < 16e3 ? 0 : 1)),
        (s[1] = w(s[1], 1, t.version)),
        (s[1] = w(s[1], 2, 1)),
        (s[1] = w(s[1], 1, t.error_protection ? 0 : 1)),
        (s[2] = w(s[2], 4, r.bitrate_index)),
        (s[2] = w(s[2], 2, r.samplerate_index)),
        (s[2] = w(s[2], 1, 0)),
        (s[2] = w(s[2], 1, t.extension)),
        (s[3] = w(s[3], 2, t.mode.ordinal())),
        (s[3] = w(s[3], 2, r.mode_ext)),
        (s[3] = w(s[3], 1, t.copyright)),
        (s[3] = w(s[3], 1, t.original)),
        (s[3] = w(s[3], 2, t.emphasis)),
        (s[0] = 255));
      var i,
        l,
        o = 241 & s[1];
      ((i = 1 == t.version ? 128 : t.out_samplerate < 16e3 ? 32 : 64),
        t.VBR == a.vbr_off && (i = t.brate),
        (l = t.free_format
          ? 0
          : 255 & (16 * e.BitrateIndex(i, t.version, t.out_samplerate))),
        1 == t.version
          ? ((s[1] = (255 & o) | 10), (o = 13 & s[2]), (s[2] = 255 & (l | o)))
          : ((s[1] = (255 & o) | 2), (o = 13 & s[2]), (s[2] = 255 & (l | o))));
    }
    function k(value, e) {
      return (e = (e >> 8) ^ d[255 & (e ^ value)]);
    }
    ((this.addVbrFrame = function (e) {
      var t = e.internal_flags,
        a = Tables.bitrate_table[e.version][t.bitrate_index];
      (l(null != t.VBR_seek_table.bag),
        (function (e, t) {
          if (
            (e.nVbrNumFrames++,
            (e.sum += t),
            e.seen++,
            !(e.seen < e.want) &&
              (e.pos < e.size &&
                ((e.bag[e.pos] = e.sum), e.pos++, (e.seen = 0)),
              e.pos == e.size))
          ) {
            for (var a = 1; a < e.size; a += 2) e.bag[a / 2] = e.bag[a];
            ((e.want *= 2), (e.pos /= 2));
          }
        })(t.VBR_seek_table, a));
    }),
      (this.getVbrTag = function (e) {
        var t = new VBRTagData(),
          a = 0;
        t.flags = 0;
        var s = (e[a + 1] >> 3) & 1,
          r = (e[a + 2] >> 2) & 3,
          i = (e[a + 3] >> 6) & 3,
          l = (e[a + 2] >> 4) & 15;
        if (
          ((l = Tables.bitrate_table[s][l]),
          e[a + 1] >> 4 == 14
            ? (t.samprate = Tables.samplerate_table[2][r])
            : (t.samprate = Tables.samplerate_table[s][r]),
          !(function (e, t) {
            return (
              new String(e, t, 4(), null).equals(p) ||
              new String(e, t, 4(), null).equals(b)
            );
          })(e, (a += 0 != s ? (3 != i ? 36 : 21) : 3 != i ? 21 : 13)))
        )
          return null;
        ((a += 4), (t.hId = s));
        var o = (t.flags = m(e, a));
        if (
          ((a += 4),
          1 & o && ((t.frames = m(e, a)), (a += 4)),
          2 & o && ((t.bytes = m(e, a)), (a += 4)),
          4 & o)
        ) {
          if (null != t.toc) for (var _ = 0; _ < u; _++) t.toc[_] = e[a + _];
          a += u;
        }
        ((t.vbrScale = -1),
          8 & o && ((t.vbrScale = m(e, a)), (a += 4)),
          (t.headersize = (72e3 * (s + 1) * l) / t.samprate));
        var c = e[(a += 21) + 0] << 4;
        c += e[a + 1] >> 4;
        var f = (15 & e[a + 1]) << 8;
        return (
          (c < 0 || c > 3e3) && (c = -1),
          ((f += 255 & e[a + 2]) < 0 || f > 3e3) && (f = -1),
          (t.encDelay = c),
          (t.encPadding = f),
          t
        );
      }),
      (this.InitVbrTag = function (e) {
        var t,
          s = e.internal_flags;
        ((t = 1 == e.version ? 128 : e.out_samplerate < 16e3 ? 32 : 64),
          e.VBR == a.vbr_off && (t = e.brate));
        var r = (72e3 * (e.version + 1) * t) / e.out_samplerate,
          l = s.sideinfo_len + h;
        if (((s.VBR_seek_table.TotalFrameSize = r), r < l || r > f))
          e.bWriteVbrTag = !1;
        else {
          ((s.VBR_seek_table.nVbrNumFrames = 0),
            (s.VBR_seek_table.nBytesWritten = 0),
            (s.VBR_seek_table.sum = 0),
            (s.VBR_seek_table.seen = 0),
            (s.VBR_seek_table.want = 1),
            (s.VBR_seek_table.pos = 0),
            null == s.VBR_seek_table.bag &&
              ((s.VBR_seek_table.bag = new int[400]()),
              (s.VBR_seek_table.size = 400)));
          var o = i(f);
          y(e, o);
          for (var n = s.VBR_seek_table.TotalFrameSize, c = 0; c < n; ++c)
            _.add_dummy_byte(e, 255 & o[c], 1);
        }
      }),
      (this.updateMusicCRC = function (e, t, a, s) {
        for (var r = 0; r < s; ++r) e[0] = k(t[a + r], e[0]);
      }),
      (this.getLameTagFrame = function (e, l) {
        var o = e.internal_flags;
        if (!e.bWriteVbrTag) return 0;
        if (o.Class_ID != Lame.LAME_ID) return 0;
        if (o.VBR_seek_table.pos <= 0) return 0;
        if (l.length < o.VBR_seek_table.TotalFrameSize)
          return o.VBR_seek_table.TotalFrameSize;
        (r.fill(l, 0, o.VBR_seek_table.TotalFrameSize, 0), y(e, l));
        var f = i(u);
        if (e.free_format)
          for (var h = 1; h < u; ++h) f[h] = 255 & ((255 * h) / 100);
        else
          !(function (e, t) {
            if (!(e.pos <= 0))
              for (var a = 1; a < u; ++a) {
                var s = a / u,
                  r = 0 | Math.floor(s * e.pos);
                r > e.pos - 1 && (r = e.pos - 1);
                var i = 0 | ((256 * e.bag[r]) / e.sum);
                (i > 255 && (i = 255), (t[a] = 255 & i));
              }
          })(o.VBR_seek_table, f);
        var d = o.sideinfo_len;
        (e.error_protection && (d -= 2),
          e.VBR == a.vbr_off
            ? ((l[d++] = 255 & b.charAt(0)),
              (l[d++] = 255 & b.charAt(1)),
              (l[d++] = 255 & b.charAt(2)),
              (l[d++] = 255 & b.charAt(3)))
            : ((l[d++] = 255 & p.charAt(0)),
              (l[d++] = 255 & p.charAt(1)),
              (l[d++] = 255 & p.charAt(2)),
              (l[d++] = 255 & p.charAt(3))),
          g(l, d, 15),
          g(l, (d += 4), o.VBR_seek_table.nVbrNumFrames),
          (d += 4));
        var m =
          o.VBR_seek_table.nBytesWritten + o.VBR_seek_table.TotalFrameSize;
        (g(l, d, 0 | m),
          (d += 4),
          t.arraycopy(f, 0, l, d, f.length),
          (d += f.length),
          e.error_protection && _.CRC_writeheader(o, l));
        var w = 0;
        for (h = 0; h < d; h++) w = k(l[h], w);
        return (
          (d += (function (e, t, a, r, i) {
            var l,
              o,
              _,
              u,
              f,
              h = e.internal_flags,
              p = 0,
              b = e.encoder_delay,
              d = e.encoder_padding,
              m = 100 - 10 * e.VBR_q - e.quality,
              w = c.getLameVeryShortVersion(),
              y = [1, 5, 3, 2, 4, 0, 3],
              S =
                0 |
                (e.lowpassfreq / 100 + 0.5 > 255
                  ? 255
                  : e.lowpassfreq / 100 + 0.5),
              R = 0,
              x = 0,
              A = e.internal_flags.noise_shaping,
              M = 0,
              T = 0,
              B = 0,
              E = !!(1 & e.exp_nspsytune),
              P = !!(2 & e.exp_nspsytune),
              L = !1,
              I = !1,
              O = e.internal_flags.nogap_total,
              D = e.internal_flags.nogap_current,
              N = e.ATHtype;
            switch (e.VBR) {
              case vbr_abr:
                f = e.VBR_mean_bitrate_kbps;
                break;
              case vbr_off:
                f = e.brate;
                break;
              default:
                f = e.VBR_min_bitrate_kbps;
            }
            switch (
              ((l = 0 + (e.VBR.ordinal() < y.length ? y[e.VBR.ordinal()] : 0)),
              h.findReplayGain &&
                (h.RadioGain > 510 && (h.RadioGain = 510),
                h.RadioGain < -510 && (h.RadioGain = -510),
                (x = 8192),
                (x |= 3072),
                h.RadioGain >= 0
                  ? (x |= h.RadioGain)
                  : ((x |= 512), (x |= -h.RadioGain))),
              h.findPeakSample &&
                (R = Math.abs(
                  0 | ((h.PeakSample / 32767) * Math.pow(2, 23) + 0.5),
                )),
              -1 != O && (D > 0 && (I = !0), D < O - 1 && (L = !0)),
              (u =
                N +
                ((E ? 1 : 0) << 4) +
                ((P ? 1 : 0) << 5) +
                ((L ? 1 : 0) << 6) +
                ((I ? 1 : 0) << 7)),
              m < 0 && (m = 0),
              e.mode)
            ) {
              case MONO:
                M = 0;
                break;
              case STEREO:
                M = 1;
                break;
              case DUAL_CHANNEL:
                M = 2;
                break;
              case JOINT_STEREO:
                M = e.force_ms ? 4 : 3;
                break;
              case NOT_SET:
              default:
                M = 7;
            }
            ((B =
              e.in_samplerate <= 32e3
                ? 0
                : 48e3 == e.in_samplerate
                  ? 2
                  : e.in_samplerate > 48e3
                    ? 3
                    : 1),
              (e.short_blocks == s.short_block_forced ||
                e.short_blocks == s.short_block_dispensed ||
                (-1 == e.lowpassfreq && -1 == e.highpassfreq) ||
                e.scale_left < e.scale_right ||
                e.scale_left > e.scale_right ||
                (e.disable_reservoir && e.brate < 320) ||
                e.noATH ||
                e.ATHonly ||
                0 == N ||
                e.in_samplerate <= 32e3) &&
                (T = 1),
              (o = A + (M << 2) + (T << 5) + (B << 6)),
              (_ = h.nMusicCRC),
              g(a, r + p, m),
              (p += 4));
            for (var V = 0; V < 9; V++) a[r + p + V] = 255 & w.charAt(V);
            ((a[r + (p += 9)] = 255 & l),
              (a[r + ++p] = 255 & S),
              g(a, r + ++p, R),
              v(a, r + (p += 4), x),
              v(a, r + (p += 2), 0),
              (a[r + (p += 2)] = 255 & u),
              (a[r + ++p] = f >= 255 ? 255 : 255 & f),
              (a[r + ++p] = 255 & (b >> 4)),
              (a[r + p + 1] = 255 & ((b << 4) + (d >> 8))),
              (a[r + p + 2] = 255 & d),
              (a[r + (p += 3)] = 255 & o),
              p++,
              (a[r + p++] = 0),
              v(a, r + p, e.preset),
              g(a, r + (p += 2), t),
              v(a, r + (p += 4), _),
              (p += 2));
            for (var H = 0; H < p; H++) i = k(a[r + H], i);
            return (v(a, r + p, i), p + 2);
          })(e, m, l, d, w)),
          o.VBR_seek_table.TotalFrameSize
        );
      }),
      (this.putVbrTag = function (e, stream) {
        if (e.internal_flags.VBR_seek_table.pos <= 0) return -1;
        if ((stream.seek(stream.length()), 0 == stream.length())) return -1;
        var t = (function (e) {
          e.seek(0);
          var t = i(10);
          return (
            e.readFully(t),
            new String(t, "ISO-8859-1").startsWith("ID3")
              ? 0
              : (((127 & t[6]) << 21) |
                  ((127 & t[7]) << 14) |
                  ((127 & t[8]) << 7) |
                  (127 & t[9])) +
                t.length
          );
        })(stream);
        stream.seek(t);
        var a = i(f),
          s = getLameTagFrame(e, a);
        return s > a.length ? -1 : (s < 1 || stream.write(a, 0, s), 0);
      }));
  }
  return ((o.NUMTOCENTRIES = 100), (o.MAXFRAMESIZE = 2880), (dn = o));
}
var Hn = (function () {
  if (gn) return vn;
  gn = 1;
  var e = wn();
  (e.System, e.VbrMode, e.Float, e.ShortBlock, e.Util, e.Arrays, e.new_array_n);
  var t = e.new_byte;
  (e.new_double, e.new_float, e.new_float_n, e.new_int, e.new_int_n);
  var a = e.assert,
    s = Dn(),
    r = (function () {
      if (nn) return tn;
      nn = 1;
      var e = wn();
      e.System;
      var t = e.VbrMode;
      return (
        e.Float,
        e.ShortBlock,
        e.Util,
        e.Arrays,
        e.new_array_n,
        e.new_byte,
        e.new_double,
        e.new_float,
        e.new_float_n,
        e.new_int,
        e.new_int_n,
        e.assert,
        (tn = function () {
          function e(e, t, a, s, r, i, l, o, _, c, u, f, h, p, b) {
            ((this.vbr_q = e),
              (this.quant_comp = t),
              (this.quant_comp_s = a),
              (this.expY = s),
              (this.st_lrm = r),
              (this.st_s = i),
              (this.masking_adj = l),
              (this.masking_adj_short = o),
              (this.ath_lower = _),
              (this.ath_curve = c),
              (this.ath_sensitivity = u),
              (this.interch = f),
              (this.safejoint = h),
              (this.sfb21mod = p),
              (this.msfix = b));
          }
          function a(e, t, a, s, r, i, l, o, _, c, u, f, h, p) {
            ((this.quant_comp = t),
              (this.quant_comp_s = a),
              (this.safejoint = s),
              (this.nsmsfix = r),
              (this.st_lrm = i),
              (this.st_s = l),
              (this.nsbass = o),
              (this.scale = _),
              (this.masking_adj = c),
              (this.ath_lower = u),
              (this.ath_curve = f),
              (this.interch = h),
              (this.sfscale = p));
          }
          var s;
          this.setModules = function (e) {
            s = e;
          };
          var r = [
              new e(
                0,
                9,
                9,
                0,
                5.2,
                125,
                -4.2,
                -6.3,
                4.8,
                1,
                0,
                0,
                2,
                21,
                0.97,
              ),
              new e(
                1,
                9,
                9,
                0,
                5.3,
                125,
                -3.6,
                -5.6,
                4.5,
                1.5,
                0,
                0,
                2,
                21,
                1.35,
              ),
              new e(
                2,
                9,
                9,
                0,
                5.6,
                125,
                -2.2,
                -3.5,
                2.8,
                2,
                0,
                0,
                2,
                21,
                1.49,
              ),
              new e(
                3,
                9,
                9,
                1,
                5.8,
                130,
                -1.8,
                -2.8,
                2.6,
                3,
                -4,
                0,
                2,
                20,
                1.64,
              ),
              new e(
                4,
                9,
                9,
                1,
                6,
                135,
                -0.7,
                -1.1,
                1.1,
                3.5,
                -8,
                0,
                2,
                0,
                1.79,
              ),
              new e(
                5,
                9,
                9,
                1,
                6.4,
                140,
                0.5,
                0.4,
                -7.5,
                4,
                -12,
                2e-4,
                0,
                0,
                1.95,
              ),
              new e(
                6,
                9,
                9,
                1,
                6.6,
                145,
                0.67,
                0.65,
                -14.7,
                6.5,
                -19,
                4e-4,
                0,
                0,
                2.3,
              ),
              new e(
                7,
                9,
                9,
                1,
                6.6,
                145,
                0.8,
                0.75,
                -19.7,
                8,
                -22,
                6e-4,
                0,
                0,
                2.7,
              ),
              new e(
                8,
                9,
                9,
                1,
                6.6,
                145,
                1.2,
                1.15,
                -27.5,
                10,
                -23,
                7e-4,
                0,
                0,
                0,
              ),
              new e(
                9,
                9,
                9,
                1,
                6.6,
                145,
                1.6,
                1.6,
                -36,
                11,
                -25,
                8e-4,
                0,
                0,
                0,
              ),
              new e(10, 9, 9, 1, 6.6, 145, 2, 2, -36, 12, -25, 8e-4, 0, 0, 0),
            ],
            i = [
              new e(0, 9, 9, 0, 4.2, 25, -7, -4, 7.5, 1, 0, 0, 2, 26, 0.97),
              new e(
                1,
                9,
                9,
                0,
                4.2,
                25,
                -5.6,
                -3.6,
                4.5,
                1.5,
                0,
                0,
                2,
                21,
                1.35,
              ),
              new e(2, 9, 9, 0, 4.2, 25, -4.4, -1.8, 2, 2, 0, 0, 2, 18, 1.49),
              new e(
                3,
                9,
                9,
                1,
                4.2,
                25,
                -3.4,
                -1.25,
                1.1,
                3,
                -4,
                0,
                2,
                15,
                1.64,
              ),
              new e(4, 9, 9, 1, 4.2, 25, -2.2, 0.1, 0, 3.5, -8, 0, 2, 0, 1.79),
              new e(
                5,
                9,
                9,
                1,
                4.2,
                25,
                -1,
                1.65,
                -7.7,
                4,
                -12,
                2e-4,
                0,
                0,
                1.95,
              ),
              new e(
                6,
                9,
                9,
                1,
                4.2,
                25,
                -0,
                2.47,
                -7.7,
                6.5,
                -19,
                4e-4,
                0,
                0,
                2,
              ),
              new e(7, 9, 9, 1, 4.2, 25, 0.5, 2, -14.5, 8, -22, 6e-4, 0, 0, 2),
              new e(8, 9, 9, 1, 4.2, 25, 1, 2.4, -22, 10, -23, 7e-4, 0, 0, 2),
              new e(
                9,
                9,
                9,
                1,
                4.2,
                25,
                1.5,
                2.95,
                -30,
                11,
                -25,
                8e-4,
                0,
                0,
                2,
              ),
              new e(10, 9, 9, 1, 4.2, 25, 2, 2.95, -36, 12, -30, 8e-4, 0, 0, 2),
            ];
          function l(e, a, s) {
            var l = e.VBR == t.vbr_rh ? r : i,
              o = e.VBR_q_frac,
              _ = l[a],
              c = l[a + 1],
              u = _;
            ((_.st_lrm = _.st_lrm + o * (c.st_lrm - _.st_lrm)),
              (_.st_s = _.st_s + o * (c.st_s - _.st_s)),
              (_.masking_adj =
                _.masking_adj + o * (c.masking_adj - _.masking_adj)),
              (_.masking_adj_short =
                _.masking_adj_short +
                o * (c.masking_adj_short - _.masking_adj_short)),
              (_.ath_lower = _.ath_lower + o * (c.ath_lower - _.ath_lower)),
              (_.ath_curve = _.ath_curve + o * (c.ath_curve - _.ath_curve)),
              (_.ath_sensitivity =
                _.ath_sensitivity +
                o * (c.ath_sensitivity - _.ath_sensitivity)),
              (_.interch = _.interch + o * (c.interch - _.interch)),
              (_.msfix = _.msfix + o * (c.msfix - _.msfix)),
              (function (e, t) {
                (0 > t && (t = 0),
                  9 < t && (t = 9),
                  (e.VBR_q = t),
                  (e.VBR_q_frac = 0));
              })(e, u.vbr_q),
              0 != s
                ? (e.quant_comp = u.quant_comp)
                : Math.abs(e.quant_comp - -1) > 0 ||
                  (e.quant_comp = u.quant_comp),
              0 != s
                ? (e.quant_comp_short = u.quant_comp_s)
                : Math.abs(e.quant_comp_short - -1) > 0 ||
                  (e.quant_comp_short = u.quant_comp_s),
              0 != u.expY && (e.experimentalY = 0 != u.expY),
              0 != s
                ? (e.internal_flags.nsPsy.attackthre = u.st_lrm)
                : Math.abs(e.internal_flags.nsPsy.attackthre - -1) > 0 ||
                  (e.internal_flags.nsPsy.attackthre = u.st_lrm),
              0 != s
                ? (e.internal_flags.nsPsy.attackthre_s = u.st_s)
                : Math.abs(e.internal_flags.nsPsy.attackthre_s - -1) > 0 ||
                  (e.internal_flags.nsPsy.attackthre_s = u.st_s),
              0 != s
                ? (e.maskingadjust = u.masking_adj)
                : Math.abs(e.maskingadjust - 0) > 0 ||
                  (e.maskingadjust = u.masking_adj),
              0 != s
                ? (e.maskingadjust_short = u.masking_adj_short)
                : Math.abs(e.maskingadjust_short - 0) > 0 ||
                  (e.maskingadjust_short = u.masking_adj_short),
              0 != s
                ? (e.ATHlower = -u.ath_lower / 10)
                : Math.abs(10 * -e.ATHlower - 0) > 0 ||
                  (e.ATHlower = -u.ath_lower / 10),
              0 != s
                ? (e.ATHcurve = u.ath_curve)
                : Math.abs(e.ATHcurve - -1) > 0 || (e.ATHcurve = u.ath_curve),
              0 != s
                ? (e.athaa_sensitivity = u.ath_sensitivity)
                : Math.abs(e.athaa_sensitivity - -1) > 0 ||
                  (e.athaa_sensitivity = u.ath_sensitivity),
              u.interch > 0 &&
                (0 != s
                  ? (e.interChRatio = u.interch)
                  : Math.abs(e.interChRatio - -1) > 0 ||
                    (e.interChRatio = u.interch)),
              u.safejoint > 0 &&
                (e.exp_nspsytune = e.exp_nspsytune | u.safejoint),
              u.sfb21mod > 0 &&
                (e.exp_nspsytune = e.exp_nspsytune | (u.sfb21mod << 20)),
              0 != s
                ? (e.msfix = u.msfix)
                : Math.abs(e.msfix - -1) > 0 || (e.msfix = u.msfix),
              0 == s && ((e.VBR_q = a), (e.VBR_q_frac = o)));
          }
          var o = [
            new a(8, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -30, 11, 0.0012, 1),
            new a(16, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -25, 11, 0.001, 1),
            new a(24, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -20, 11, 0.001, 1),
            new a(32, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -15, 11, 0.001, 1),
            new a(40, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -10, 11, 9e-4, 1),
            new a(48, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -10, 11, 9e-4, 1),
            new a(56, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -6, 11, 8e-4, 1),
            new a(64, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, -2, 11, 8e-4, 1),
            new a(80, 9, 9, 0, 0, 6.6, 145, 0, 0.95, 0, 0, 8, 7e-4, 1),
            new a(96, 9, 9, 0, 2.5, 6.6, 145, 0, 0.95, 0, 1, 5.5, 6e-4, 1),
            new a(112, 9, 9, 0, 2.25, 6.6, 145, 0, 0.95, 0, 2, 4.5, 5e-4, 1),
            new a(128, 9, 9, 0, 1.95, 6.4, 140, 0, 0.95, 0, 3, 4, 2e-4, 1),
            new a(160, 9, 9, 1, 1.79, 6, 135, 0, 0.95, -2, 5, 3.5, 0, 1),
            new a(192, 9, 9, 1, 1.49, 5.6, 125, 0, 0.97, -4, 7, 3, 0, 0),
            new a(224, 9, 9, 1, 1.25, 5.2, 125, 0, 0.98, -6, 9, 2, 0, 0),
            new a(256, 9, 9, 1, 0.97, 5.2, 125, 0, 1, -8, 10, 1, 0, 0),
            new a(320, 9, 9, 1, 0.9, 5.2, 125, 0, 1, -10, 12, 0, 0, 0),
          ];
          function _(e, a, r) {
            var i = a,
              l = s.nearestBitrateFullIndex(a);
            if (
              ((e.VBR = t.vbr_abr),
              (e.VBR_mean_bitrate_kbps = i),
              (e.VBR_mean_bitrate_kbps = Math.min(
                e.VBR_mean_bitrate_kbps,
                320,
              )),
              (e.VBR_mean_bitrate_kbps = Math.max(e.VBR_mean_bitrate_kbps, 8)),
              (e.brate = e.VBR_mean_bitrate_kbps),
              e.VBR_mean_bitrate_kbps > 320 && (e.disable_reservoir = !0),
              o[l].safejoint > 0 && (e.exp_nspsytune = 2 | e.exp_nspsytune),
              o[l].sfscale > 0 && (e.internal_flags.noise_shaping = 2),
              Math.abs(o[l].nsbass) > 0)
            ) {
              var _ = int(4 * o[l].nsbass);
              (_ < 0 && (_ += 64),
                (e.exp_nspsytune = e.exp_nspsytune | (_ << 2)));
            }
            return (
              0 != r
                ? (e.quant_comp = o[l].quant_comp)
                : Math.abs(e.quant_comp - -1) > 0 ||
                  (e.quant_comp = o[l].quant_comp),
              0 != r
                ? (e.quant_comp_short = o[l].quant_comp_s)
                : Math.abs(e.quant_comp_short - -1) > 0 ||
                  (e.quant_comp_short = o[l].quant_comp_s),
              0 != r
                ? (e.msfix = o[l].nsmsfix)
                : Math.abs(e.msfix - -1) > 0 || (e.msfix = o[l].nsmsfix),
              0 != r
                ? (e.internal_flags.nsPsy.attackthre = o[l].st_lrm)
                : Math.abs(e.internal_flags.nsPsy.attackthre - -1) > 0 ||
                  (e.internal_flags.nsPsy.attackthre = o[l].st_lrm),
              0 != r
                ? (e.internal_flags.nsPsy.attackthre_s = o[l].st_s)
                : Math.abs(e.internal_flags.nsPsy.attackthre_s - -1) > 0 ||
                  (e.internal_flags.nsPsy.attackthre_s = o[l].st_s),
              0 != r
                ? (e.scale = o[l].scale)
                : Math.abs(e.scale - -1) > 0 || (e.scale = o[l].scale),
              0 != r
                ? (e.maskingadjust = o[l].masking_adj)
                : Math.abs(e.maskingadjust - 0) > 0 ||
                  (e.maskingadjust = o[l].masking_adj),
              o[l].masking_adj > 0
                ? 0 != r
                  ? (e.maskingadjust_short = 0.9 * o[l].masking_adj)
                  : Math.abs(e.maskingadjust_short - 0) > 0 ||
                    (e.maskingadjust_short = 0.9 * o[l].masking_adj)
                : 0 != r
                  ? (e.maskingadjust_short = 1.1 * o[l].masking_adj)
                  : Math.abs(e.maskingadjust_short - 0) > 0 ||
                    (e.maskingadjust_short = 1.1 * o[l].masking_adj),
              0 != r
                ? (e.ATHlower = -o[l].ath_lower / 10)
                : Math.abs(10 * -e.ATHlower - 0) > 0 ||
                  (e.ATHlower = -o[l].ath_lower / 10),
              0 != r
                ? (e.ATHcurve = o[l].ath_curve)
                : Math.abs(e.ATHcurve - -1) > 0 ||
                  (e.ATHcurve = o[l].ath_curve),
              0 != r
                ? (e.interChRatio = o[l].interch)
                : Math.abs(e.interChRatio - -1) > 0 ||
                  (e.interChRatio = o[l].interch),
              a
            );
          }
          this.apply_preset = function (e, a, s) {
            switch (a) {
              case Lame.R3MIX:
                ((a = Lame.V3), (e.VBR = t.vbr_mtrh));
                break;
              case Lame.MEDIUM:
                ((a = Lame.V4), (e.VBR = t.vbr_rh));
                break;
              case Lame.MEDIUM_FAST:
                ((a = Lame.V4), (e.VBR = t.vbr_mtrh));
                break;
              case Lame.STANDARD:
                ((a = Lame.V2), (e.VBR = t.vbr_rh));
                break;
              case Lame.STANDARD_FAST:
                ((a = Lame.V2), (e.VBR = t.vbr_mtrh));
                break;
              case Lame.EXTREME:
                ((a = Lame.V0), (e.VBR = t.vbr_rh));
                break;
              case Lame.EXTREME_FAST:
                ((a = Lame.V0), (e.VBR = t.vbr_mtrh));
                break;
              case Lame.INSANE:
                return (
                  (a = 320),
                  (e.preset = a),
                  _(e, a, s),
                  (e.VBR = t.vbr_off),
                  a
                );
            }
            switch (((e.preset = a), a)) {
              case Lame.V9:
                return (l(e, 9, s), a);
              case Lame.V8:
                return (l(e, 8, s), a);
              case Lame.V7:
                return (l(e, 7, s), a);
              case Lame.V6:
                return (l(e, 6, s), a);
              case Lame.V5:
                return (l(e, 5, s), a);
              case Lame.V4:
                return (l(e, 4, s), a);
              case Lame.V3:
                return (l(e, 3, s), a);
              case Lame.V2:
                return (l(e, 2, s), a);
              case Lame.V1:
                return (l(e, 1, s), a);
              case Lame.V0:
                return (l(e, 0, s), a);
            }
            return 8 <= a && a <= 320 ? _(e, a, s) : ((e.preset = 0), a);
          };
        })
      );
    })(),
    i = Bn(),
    l = Ln(),
    o = Nn(),
    _ = In(),
    c = (function () {
      if (hn) return fn;
      hn = 1;
      var e = wn().assert;
      return (fn = function () {
        var t;
        ((this.setModules = function (e) {
          t = e;
        }),
          (this.ResvFrameBegin = function (a, s) {
            var r,
              i = a.internal_flags,
              l = i.l3_side,
              o = t.getframebits(a);
            s.bits = (o - 8 * i.sideinfo_len) / i.mode_gr;
            var _ = 2048 * i.mode_gr - 8;
            (a.brate > 320
              ? (r =
                  8 *
                  int((1e3 * a.brate) / (a.out_samplerate / 1152) / 8 + 0.5))
              : ((r = 11520),
                a.strict_ISO &&
                  (r = 8 * int(32e4 / (a.out_samplerate / 1152) / 8 + 0.5))),
              (i.ResvMax = r - o),
              i.ResvMax > _ && (i.ResvMax = _),
              (i.ResvMax < 0 || a.disable_reservoir) && (i.ResvMax = 0));
            var c = s.bits * i.mode_gr + Math.min(i.ResvSize, i.ResvMax);
            return (
              c > r && (c = r),
              e(0 == i.ResvMax % 8),
              e(i.ResvMax >= 0),
              (l.resvDrain_pre = 0),
              null != i.pinfo &&
                ((i.pinfo.mean_bits = s.bits / 2),
                (i.pinfo.resvsize = i.ResvSize)),
              c
            );
          }),
          (this.ResvMaxBits = function (e, t, a, s) {
            var r,
              i = e.internal_flags,
              l = i.ResvSize,
              o = i.ResvMax;
            (0 != s && (l += t),
              1 & i.substep_shaping && (o *= 0.9),
              (a.bits = t),
              10 * l > 9 * o
                ? ((r = l - (9 * o) / 10),
                  (a.bits += r),
                  (i.substep_shaping |= 128))
                : ((r = 0),
                  (i.substep_shaping &= 127),
                  e.disable_reservoir ||
                    1 & i.substep_shaping ||
                    (a.bits -= 0.1 * t)));
            var _ = l < (6 * i.ResvMax) / 10 ? l : (6 * i.ResvMax) / 10;
            return ((_ -= r) < 0 && (_ = 0), _);
          }),
          (this.ResvAdjust = function (e, t) {
            e.ResvSize -= t.part2_3_length + t.part2_length;
          }),
          (this.ResvFrameEnd = function (t, a) {
            var s,
              r = t.l3_side;
            t.ResvSize += a * t.mode_gr;
            var i = 0;
            ((r.resvDrain_post = 0),
              (r.resvDrain_pre = 0),
              0 != (s = t.ResvSize % 8) && (i += s),
              (s = t.ResvSize - i - t.ResvMax) > 0 &&
                (e(0 == s % 8), e(s >= 0), (i += s)));
            var l = Math.min(8 * r.main_data_begin, i) / 8;
            ((r.resvDrain_pre += 8 * l),
              (i -= 8 * l),
              (t.ResvSize -= 8 * l),
              (r.main_data_begin -= l),
              (r.resvDrain_post += i),
              (t.ResvSize -= i));
          }));
      });
    })(),
    u = Rn(),
    f = On();
  kn();
  var h = bn
      ? pn
      : ((bn = 1),
        (pn = function () {
          ((this.getLameVersion = function () {
            return "3.98.4";
          }),
            (this.getLameShortVersion = function () {
              return "3.98.4";
            }),
            (this.getLameVeryShortVersion = function () {
              return "LAME3.98r";
            }),
            (this.getPsyVersion = function () {
              return "0.93";
            }),
            (this.getLameUrl = function () {
              return "http://www.mp3dev.org/";
            }),
            (this.getLameOsBitness = function () {
              return "32bits";
            }));
        })),
    p = Vn();
  function b() {
    this.setModules = function (e, t) {};
  }
  function d() {
    this.setModules = function (e, t, a) {};
  }
  function m() {}
  function g() {
    this.setModules = function (e, t) {};
  }
  function v() {
    ((this.dataOffset = 0),
      (this.dataLen = 0),
      (this.channels = 0),
      (this.sampleRate = 0));
  }
  function w(e) {
    return (
      (e.charCodeAt(0) << 24) |
      (e.charCodeAt(1) << 16) |
      (e.charCodeAt(2) << 8) |
      e.charCodeAt(3)
    );
  }
  return (
    (v.RIFF = w("RIFF")),
    (v.WAVE = w("WAVE")),
    (v.fmt_ = w("fmt ")),
    (v.data = w("data")),
    (v.readHeader = function (e) {
      var t = new v(),
        a = e.getUint32(0, !1);
      if (
        v.RIFF == a &&
        (e.getUint32(4, !0),
        v.WAVE == e.getUint32(8, !1) && v.fmt_ == e.getUint32(12, !1))
      ) {
        var s = e.getUint32(16, !0),
          r = 20;
        switch (s) {
          case 16:
          case 18:
            ((t.channels = e.getUint16(r + 2, !0)),
              (t.sampleRate = e.getUint32(r + 4, !0)));
            break;
          default:
            throw "extended fmt chunk not implemented";
        }
        r += s;
        for (
          var data = v.data, i = 0;
          data != a &&
          ((a = e.getUint32(r, !1)), (i = e.getUint32(r + 4, !0)), data != a);
        )
          r += i + 8;
        return ((t.dataLen = i), (t.dataOffset = r + 8), t);
      }
    }),
    (vn.Mp3Encoder = function (e, v, w) {
      3 != arguments.length &&
        (console.error(
          "WARN: Mp3Encoder(channels, samplerate, kbps) not specified",
        ),
        (e = 1),
        (v = 44100),
        (w = 128));
      var y = new s(),
        k = new b(),
        S = new i(),
        R = new f(),
        x = new r(),
        A = new l(),
        M = new o(),
        T = new p(),
        B = new h(),
        E = new g(),
        P = new c(),
        L = new _(),
        I = new d(),
        O = new m();
      (y.setModules(S, R, x, A, M, T, B, E, O),
        R.setModules(S, O, B, T),
        E.setModules(R, B),
        x.setModules(y),
        M.setModules(R, P, A, L),
        A.setModules(L, P, y.enc.psy),
        P.setModules(R),
        L.setModules(A),
        T.setModules(y, R, B),
        k.setModules(I, O),
        I.setModules(B, E, x));
      var D = y.lame_init();
      ((D.num_channels = e),
        (D.in_samplerate = v),
        (D.brate = w),
        (D.mode = u.STEREO),
        (D.quality = 3),
        (D.bWriteVbrTag = !1),
        (D.disable_reservoir = !0),
        (D.write_id3tag_automatic = !1));
      var N = y.lame_init_params(D);
      a(0 == N);
      var V = 1152,
        H = 0 | (1.25 * V + 7200),
        C = t(H);
      ((this.encodeBuffer = function (s, r) {
        (1 == e && (r = s),
          a(s.length == r.length),
          s.length > V &&
            ((V = s.length), (C = t((H = 0 | (1.25 * V + 7200))))));
        var i = y.lame_encode_buffer(D, s, r, s.length, C, 0, H);
        return new Int8Array(C.subarray(0, i));
      }),
        (this.flush = function () {
          var e = y.lame_encode_flush(D, C, 0, H);
          return new Int8Array(C.subarray(0, e));
        }));
    }),
    (vn.WavHeader = v),
    vn
  );
})();
const Cn = r({ __proto__: null, default: s(Hn) }, [Hn]);
class zn {
  constructor(...args) {
    ((this.type = "Logical"),
      1 === args.length
        ? "Logical" in args[0]
          ? ((this.width = args[0].Logical.width),
            (this.height = args[0].Logical.height))
          : ((this.width = args[0].width), (this.height = args[0].height))
        : ((this.width = args[0]), (this.height = args[1])));
  }
  toPhysical(e) {
    return new Fn(this.width * e, this.height * e);
  }
  [g]() {
    return { width: this.width, height: this.height };
  }
  toJSON() {
    return this[g]();
  }
}
class Fn {
  constructor(...args) {
    ((this.type = "Physical"),
      1 === args.length
        ? "Physical" in args[0]
          ? ((this.width = args[0].Physical.width),
            (this.height = args[0].Physical.height))
          : ((this.width = args[0].width), (this.height = args[0].height))
        : ((this.width = args[0]), (this.height = args[1])));
  }
  toLogical(e) {
    return new zn(this.width / e, this.height / e);
  }
  [g]() {
    return { width: this.width, height: this.height };
  }
  toJSON() {
    return this[g]();
  }
}
class Xn {
  constructor(e) {
    this.size = e;
  }
  toLogical(e) {
    return this.size instanceof zn ? this.size : this.size.toLogical(e);
  }
  toPhysical(e) {
    return this.size instanceof Fn ? this.size : this.size.toPhysical(e);
  }
  [g]() {
    return {
      [`${this.size.type}`]: {
        width: this.size.width,
        height: this.size.height,
      },
    };
  }
  toJSON() {
    return this[g]();
  }
}
class qn {
  constructor(...args) {
    ((this.type = "Logical"),
      1 === args.length
        ? "Logical" in args[0]
          ? ((this.x = args[0].Logical.x), (this.y = args[0].Logical.y))
          : ((this.x = args[0].x), (this.y = args[0].y))
        : ((this.x = args[0]), (this.y = args[1])));
  }
  toPhysical(e) {
    return new Un(this.x * e, this.y * e);
  }
  [g]() {
    return { x: this.x, y: this.y };
  }
  toJSON() {
    return this[g]();
  }
}
class Un {
  constructor(...args) {
    ((this.type = "Physical"),
      1 === args.length
        ? "Physical" in args[0]
          ? ((this.x = args[0].Physical.x), (this.y = args[0].Physical.y))
          : ((this.x = args[0].x), (this.y = args[0].y))
        : ((this.x = args[0]), (this.y = args[1])));
  }
  toLogical(e) {
    return new qn(this.x / e, this.y / e);
  }
  [g]() {
    return { x: this.x, y: this.y };
  }
  toJSON() {
    return this[g]();
  }
}
class Yn {
  constructor(e) {
    this.position = e;
  }
  toLogical(e) {
    return this.position instanceof qn
      ? this.position
      : this.position.toLogical(e);
  }
  toPhysical(e) {
    return this.position instanceof Un
      ? this.position
      : this.position.toPhysical(e);
  }
  [g]() {
    return {
      [`${this.position.type}`]: { x: this.position.x, y: this.position.y },
    };
  }
  toJSON() {
    return this[g]();
  }
}
class jn extends y {
  constructor(e) {
    super(e);
  }
  static async new(e, width, height) {
    return invoke("plugin:image|new", {
      rgba: Gn(e),
      width: width,
      height: height,
    }).then((e) => new jn(e));
  }
  static async fromBytes(e) {
    return invoke("plugin:image|from_bytes", { bytes: Gn(e) }).then(
      (e) => new jn(e),
    );
  }
  static async fromPath(path) {
    return invoke("plugin:image|from_path", { path: path }).then(
      (e) => new jn(e),
    );
  }
  async rgba() {
    return invoke("plugin:image|rgba", { rid: this.rid }).then(
      (e) => new Uint8Array(e),
    );
  }
  async size() {
    return invoke("plugin:image|size", { rid: this.rid });
  }
}
function Gn(image) {
  return null == image
    ? null
    : "string" == typeof image
      ? image
      : image instanceof jn
        ? image.rid
        : image;
}
var Wn, $n, Zn, Kn;
((($n = Wn || (Wn = {}))[($n.Critical = 1)] = "Critical"),
  ($n[($n.Informational = 2)] = "Informational"));
class Qn {
  constructor(e) {
    ((this._preventDefault = !1), (this.event = e.event), (this.id = e.id));
  }
  preventDefault() {
    this._preventDefault = !0;
  }
  isPreventDefault() {
    return this._preventDefault;
  }
}
function Jn() {
  return new na(window.__TAURI_INTERNALS__.metadata.currentWindow.label, {
    skip: !0,
  });
}
async function ea() {
  return invoke("plugin:window|get_all_windows").then((e) =>
    e.map((e) => new na(e, { skip: !0 })),
  );
}
(((Kn = Zn || (Zn = {})).None = "none"),
  (Kn.Normal = "normal"),
  (Kn.Indeterminate = "indeterminate"),
  (Kn.Paused = "paused"),
  (Kn.Error = "error"));
const ta = ["tauri://created", "tauri://error"];
class na {
  constructor(e, t = {}) {
    var a;
    ((this.label = e),
      (this.listeners = Object.create(null)),
      (null == t ? void 0 : t.skip) ||
        invoke("plugin:window|create", {
          options: {
            ...t,
            parent:
              "string" == typeof t.parent
                ? t.parent
                : null === (a = t.parent) || void 0 === a
                  ? void 0
                  : a.label,
            label: e,
          },
        })
          .then(async () => this.emit("tauri://created"))
          .catch(async (e) => this.emit("tauri://error", e)));
  }
  static async getByLabel(e) {
    var t;
    return null !== (t = (await ea()).find((t) => t.label === e)) &&
      void 0 !== t
      ? t
      : null;
  }
  static getCurrent() {
    return Jn();
  }
  static async getAll() {
    return ea();
  }
  static async getFocusedWindow() {
    for (const e of await ea()) if (await e.isFocused()) return e;
    return null;
  }
  async listen(e, t) {
    return this._handleTauriEvent(e, t)
      ? () => {
          const a = this.listeners[e];
          a.splice(a.indexOf(t), 1);
        }
      : A(e, t, { target: { kind: "Window", label: this.label } });
  }
  async once(e, t) {
    return this._handleTauriEvent(e, t)
      ? () => {
          const a = this.listeners[e];
          a.splice(a.indexOf(t), 1);
        }
      : (async function (e, t, a) {
          return A(
            e,
            (a) => {
              (x(e, a.id), t(a));
            },
            a,
          );
        })(e, t, { target: { kind: "Window", label: this.label } });
  }
  async emit(e, payload) {
    if (!ta.includes(e))
      return (async function (e, payload) {
        await invoke("plugin:event|emit", { event: e, payload: payload });
      })(e, payload);
    for (const t of this.listeners[e] || [])
      t({ event: e, id: -1, payload: payload });
  }
  async emitTo(e, t, payload) {
    if (!ta.includes(t))
      return (async function (e, t, payload) {
        const a = "string" == typeof e ? { kind: "AnyLabel", label: e } : e;
        await invoke("plugin:event|emit_to", {
          target: a,
          event: t,
          payload: payload,
        });
      })(e, t, payload);
    for (const a of this.listeners[t] || [])
      a({ event: t, id: -1, payload: payload });
  }
  _handleTauriEvent(e, t) {
    return (
      !!ta.includes(e) &&
      (e in this.listeners
        ? this.listeners[e].push(t)
        : (this.listeners[e] = [t]),
      !0)
    );
  }
  async scaleFactor() {
    return invoke("plugin:window|scale_factor", { label: this.label });
  }
  async innerPosition() {
    return invoke("plugin:window|inner_position", { label: this.label }).then(
      (e) => new Un(e),
    );
  }
  async outerPosition() {
    return invoke("plugin:window|outer_position", { label: this.label }).then(
      (e) => new Un(e),
    );
  }
  async innerSize() {
    return invoke("plugin:window|inner_size", { label: this.label }).then(
      (e) => new Fn(e),
    );
  }
  async outerSize() {
    return invoke("plugin:window|outer_size", { label: this.label }).then(
      (e) => new Fn(e),
    );
  }
  async isFullscreen() {
    return invoke("plugin:window|is_fullscreen", { label: this.label });
  }
  async isMinimized() {
    return invoke("plugin:window|is_minimized", { label: this.label });
  }
  async isMaximized() {
    return invoke("plugin:window|is_maximized", { label: this.label });
  }
  async isFocused() {
    return invoke("plugin:window|is_focused", { label: this.label });
  }
  async isDecorated() {
    return invoke("plugin:window|is_decorated", { label: this.label });
  }
  async isResizable() {
    return invoke("plugin:window|is_resizable", { label: this.label });
  }
  async isMaximizable() {
    return invoke("plugin:window|is_maximizable", { label: this.label });
  }
  async isMinimizable() {
    return invoke("plugin:window|is_minimizable", { label: this.label });
  }
  async isClosable() {
    return invoke("plugin:window|is_closable", { label: this.label });
  }
  async isVisible() {
    return invoke("plugin:window|is_visible", { label: this.label });
  }
  async title() {
    return invoke("plugin:window|title", { label: this.label });
  }
  async theme() {
    return invoke("plugin:window|theme", { label: this.label });
  }
  async isAlwaysOnTop() {
    return invoke("plugin:window|is_always_on_top", { label: this.label });
  }
  async center() {
    return invoke("plugin:window|center", { label: this.label });
  }
  async requestUserAttention(e) {
    let t = null;
    return (
      e &&
        (t =
          e === Wn.Critical ? { type: "Critical" } : { type: "Informational" }),
      invoke("plugin:window|request_user_attention", {
        label: this.label,
        value: t,
      })
    );
  }
  async setResizable(e) {
    return invoke("plugin:window|set_resizable", {
      label: this.label,
      value: e,
    });
  }
  async setEnabled(enabled) {
    return invoke("plugin:window|set_enabled", {
      label: this.label,
      value: enabled,
    });
  }
  async isEnabled() {
    return invoke("plugin:window|is_enabled", { label: this.label });
  }
  async setMaximizable(e) {
    return invoke("plugin:window|set_maximizable", {
      label: this.label,
      value: e,
    });
  }
  async setMinimizable(e) {
    return invoke("plugin:window|set_minimizable", {
      label: this.label,
      value: e,
    });
  }
  async setClosable(e) {
    return invoke("plugin:window|set_closable", {
      label: this.label,
      value: e,
    });
  }
  async setTitle(title) {
    return invoke("plugin:window|set_title", {
      label: this.label,
      value: title,
    });
  }
  async maximize() {
    return invoke("plugin:window|maximize", { label: this.label });
  }
  async unmaximize() {
    return invoke("plugin:window|unmaximize", { label: this.label });
  }
  async toggleMaximize() {
    return invoke("plugin:window|toggle_maximize", { label: this.label });
  }
  async minimize() {
    return invoke("plugin:window|minimize", { label: this.label });
  }
  async unminimize() {
    return invoke("plugin:window|unminimize", { label: this.label });
  }
  async show() {
    return invoke("plugin:window|show", { label: this.label });
  }
  async hide() {
    return invoke("plugin:window|hide", { label: this.label });
  }
  async close() {
    return invoke("plugin:window|close", { label: this.label });
  }
  async destroy() {
    return invoke("plugin:window|destroy", { label: this.label });
  }
  async setDecorations(e) {
    return invoke("plugin:window|set_decorations", {
      label: this.label,
      value: e,
    });
  }
  async setShadow(e) {
    return invoke("plugin:window|set_shadow", { label: this.label, value: e });
  }
  async setEffects(e) {
    return invoke("plugin:window|set_effects", { label: this.label, value: e });
  }
  async clearEffects() {
    return invoke("plugin:window|set_effects", {
      label: this.label,
      value: null,
    });
  }
  async setAlwaysOnTop(e) {
    return invoke("plugin:window|set_always_on_top", {
      label: this.label,
      value: e,
    });
  }
  async setAlwaysOnBottom(e) {
    return invoke("plugin:window|set_always_on_bottom", {
      label: this.label,
      value: e,
    });
  }
  async setContentProtected(e) {
    return invoke("plugin:window|set_content_protected", {
      label: this.label,
      value: e,
    });
  }
  async setSize(e) {
    return invoke("plugin:window|set_size", {
      label: this.label,
      value: e instanceof Xn ? e : new Xn(e),
    });
  }
  async setMinSize(e) {
    return invoke("plugin:window|set_min_size", {
      label: this.label,
      value: e instanceof Xn ? e : e ? new Xn(e) : null,
    });
  }
  async setMaxSize(e) {
    return invoke("plugin:window|set_max_size", {
      label: this.label,
      value: e instanceof Xn ? e : e ? new Xn(e) : null,
    });
  }
  async setSizeConstraints(e) {
    function t(e) {
      return e ? { Logical: e } : null;
    }
    return invoke("plugin:window|set_size_constraints", {
      label: this.label,
      value: {
        minWidth: t(null == e ? void 0 : e.minWidth),
        minHeight: t(null == e ? void 0 : e.minHeight),
        maxWidth: t(null == e ? void 0 : e.maxWidth),
        maxHeight: t(null == e ? void 0 : e.maxHeight),
      },
    });
  }
  async setPosition(e) {
    return invoke("plugin:window|set_position", {
      label: this.label,
      value: e instanceof Yn ? e : new Yn(e),
    });
  }
  async setFullscreen(e) {
    return invoke("plugin:window|set_fullscreen", {
      label: this.label,
      value: e,
    });
  }
  async setSimpleFullscreen(e) {
    return invoke("plugin:window|set_simple_fullscreen", {
      label: this.label,
      value: e,
    });
  }
  async setFocus() {
    return invoke("plugin:window|set_focus", { label: this.label });
  }
  async setFocusable(e) {
    return invoke("plugin:window|set_focusable", {
      label: this.label,
      value: e,
    });
  }
  async setIcon(e) {
    return invoke("plugin:window|set_icon", {
      label: this.label,
      value: Gn(e),
    });
  }
  async setSkipTaskbar(e) {
    return invoke("plugin:window|set_skip_taskbar", {
      label: this.label,
      value: e,
    });
  }
  async setCursorGrab(e) {
    return invoke("plugin:window|set_cursor_grab", {
      label: this.label,
      value: e,
    });
  }
  async setCursorVisible(e) {
    return invoke("plugin:window|set_cursor_visible", {
      label: this.label,
      value: e,
    });
  }
  async setCursorIcon(e) {
    return invoke("plugin:window|set_cursor_icon", {
      label: this.label,
      value: e,
    });
  }
  async setBackgroundColor(e) {
    return invoke("plugin:window|set_background_color", { color: e });
  }
  async setCursorPosition(e) {
    return invoke("plugin:window|set_cursor_position", {
      label: this.label,
      value: e instanceof Yn ? e : new Yn(e),
    });
  }
  async setIgnoreCursorEvents(e) {
    return invoke("plugin:window|set_ignore_cursor_events", {
      label: this.label,
      value: e,
    });
  }
  async startDragging() {
    return invoke("plugin:window|start_dragging", { label: this.label });
  }
  async startResizeDragging(e) {
    return invoke("plugin:window|start_resize_dragging", {
      label: this.label,
      value: e,
    });
  }
  async setBadgeCount(e) {
    return invoke("plugin:window|set_badge_count", {
      label: this.label,
      value: e,
    });
  }
  async setBadgeLabel(e) {
    return invoke("plugin:window|set_badge_label", {
      label: this.label,
      value: e,
    });
  }
  async setOverlayIcon(e) {
    return invoke("plugin:window|set_overlay_icon", {
      label: this.label,
      value: e ? Gn(e) : void 0,
    });
  }
  async setProgressBar(e) {
    return invoke("plugin:window|set_progress_bar", {
      label: this.label,
      value: e,
    });
  }
  async setVisibleOnAllWorkspaces(e) {
    return invoke("plugin:window|set_visible_on_all_workspaces", {
      label: this.label,
      value: e,
    });
  }
  async setTitleBarStyle(e) {
    return invoke("plugin:window|set_title_bar_style", {
      label: this.label,
      value: e,
    });
  }
  async setTheme(e) {
    return invoke("plugin:window|set_theme", { label: this.label, value: e });
  }
  async onResized(e) {
    return this.listen(S.WINDOW_RESIZED, (t) => {
      ((t.payload = new Fn(t.payload)), e(t));
    });
  }
  async onMoved(e) {
    return this.listen(S.WINDOW_MOVED, (t) => {
      ((t.payload = new Un(t.payload)), e(t));
    });
  }
  async onCloseRequested(e) {
    return this.listen(S.WINDOW_CLOSE_REQUESTED, async (t) => {
      const a = new Qn(t);
      (await e(a), a.isPreventDefault() || (await this.destroy()));
    });
  }
  async onDragDropEvent(e) {
    const t = await this.listen(S.DRAG_ENTER, (t) => {
        e({
          ...t,
          payload: {
            type: "enter",
            paths: t.payload.paths,
            position: new Un(t.payload.position),
          },
        });
      }),
      a = await this.listen(S.DRAG_OVER, (t) => {
        e({
          ...t,
          payload: { type: "over", position: new Un(t.payload.position) },
        });
      }),
      s = await this.listen(S.DRAG_DROP, (t) => {
        e({
          ...t,
          payload: {
            type: "drop",
            paths: t.payload.paths,
            position: new Un(t.payload.position),
          },
        });
      }),
      r = await this.listen(S.DRAG_LEAVE, (t) => {
        e({ ...t, payload: { type: "leave" } });
      });
    return () => {
      (t(), s(), a(), r());
    };
  }
  async onFocusChanged(e) {
    const t = await this.listen(S.WINDOW_FOCUS, (t) => {
        e({ ...t, payload: !0 });
      }),
      a = await this.listen(S.WINDOW_BLUR, (t) => {
        e({ ...t, payload: !1 });
      });
    return () => {
      (t(), a());
    };
  }
  async onScaleChanged(e) {
    return this.listen(S.WINDOW_SCALE_FACTOR_CHANGED, e);
  }
  async onThemeChanged(e) {
    return this.listen(S.WINDOW_THEME_CHANGED, e);
  }
}
var aa, sa, ra, ia, la, oa, _a, ca;
(((sa = aa || (aa = {})).Disabled = "disabled"),
  (sa.Throttle = "throttle"),
  (sa.Suspend = "suspend"),
  ((ia = ra || (ra = {})).Default = "default"),
  (ia.FluentOverlay = "fluentOverlay"),
  ((oa = la || (la = {})).AppearanceBased = "appearanceBased"),
  (oa.Light = "light"),
  (oa.Dark = "dark"),
  (oa.MediumLight = "mediumLight"),
  (oa.UltraDark = "ultraDark"),
  (oa.Titlebar = "titlebar"),
  (oa.Selection = "selection"),
  (oa.Menu = "menu"),
  (oa.Popover = "popover"),
  (oa.Sidebar = "sidebar"),
  (oa.HeaderView = "headerView"),
  (oa.Sheet = "sheet"),
  (oa.WindowBackground = "windowBackground"),
  (oa.HudWindow = "hudWindow"),
  (oa.FullScreenUI = "fullScreenUI"),
  (oa.Tooltip = "tooltip"),
  (oa.ContentBackground = "contentBackground"),
  (oa.UnderWindowBackground = "underWindowBackground"),
  (oa.UnderPageBackground = "underPageBackground"),
  (oa.Mica = "mica"),
  (oa.Blur = "blur"),
  (oa.Acrylic = "acrylic"),
  (oa.Tabbed = "tabbed"),
  (oa.TabbedDark = "tabbedDark"),
  (oa.TabbedLight = "tabbedLight"),
  ((ca = _a || (_a = {})).FollowsWindowActiveState =
    "followsWindowActiveState"),
  (ca.Active = "active"),
  (ca.Inactive = "inactive"));
const ua = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      CloseRequestedEvent: Qn,
      get Effect() {
        return la;
      },
      get EffectState() {
        return _a;
      },
      LogicalPosition: qn,
      LogicalSize: zn,
      PhysicalPosition: Un,
      PhysicalSize: Fn,
      get ProgressBarStatus() {
        return Zn;
      },
      get UserAttentionType() {
        return Wn;
      },
      Window: na,
      getAllWindows: ea,
      getCurrentWindow: Jn,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
export {
  B,
  invoke as a,
  F as b,
  z as c,
  b as d,
  nt as e,
  Y as f,
  X as g,
  H as h,
  Cn as i,
  P as j,
  k,
  A as l,
  V as m,
  T as n,
  M as o,
  L as p,
  ua as q,
  C as r,
  writeTextFile as w,
};
