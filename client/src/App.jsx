// src/App.jsx
import { useEffect, useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL;
const tg = window.Telegram?.WebApp;

function useLog() {
  const [events, setEvents] = useState([]);
  const add = useCallback((label, status, detail = null) => {
    setEvents((prev) => [
      {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString("ru-RU", { hour12: false }),
        label, status, detail,
      },
      ...prev,
    ]);
  }, []);
  return { events, add };
}

export default function App() {
  const [sdkReady, setSdkReady] = useState(false);
  const [userData, setUserData] = useState(null);
  const [themeData, setThemeData] = useState(null);
  const [loadingBtn, setLoadingBtn] = useState(null);
  const { events, add } = useLog();

  useEffect(() => {
    if (!tg) {
      add("SDK init", "error", "window.Telegram.WebApp не найден");
      return;
    }
    tg.ready();
    tg.expand();
    setSdkReady(true);

    const user = tg.initDataUnsafe?.user;
    setUserData(user || null);
    setThemeData({
      colorScheme: tg.colorScheme,
      themeParams: tg.themeParams,
      backgroundColor: tg.backgroundColor,
      headerColor: tg.headerColor,
    });

    tg.BackButton.onClick(() => {
      add("BackButton", "info", "Нажата кнопка Назад");
      tg.BackButton.hide();
    });
    tg.MainButton.setText("MainButton test").show().onClick(() => {
      add("MainButton", "ok", "MainButton нажата пользователем");
      tg.HapticFeedback.notificationOccurred("success");
    });
    add("SDK init", "ok", {
      platform: tg.platform,
      version: tg.version,
      colorScheme: tg.colorScheme,
      isExpanded: tg.isExpanded,
      viewportHeight: tg.viewportHeight,
    });
  }, []);

  const run = async (id, label, fn) => {
    setLoadingBtn(id);
    add(label, "pending", "выполняется...");
    try {
      const result = await fn();
      add(label, "ok", result);
    } catch (e) {
      add(label, "error", e.message);
    } finally {
      setLoadingBtn(null);
    }
  };

  const uiCommands = [
    {
      id: "haptic-light", label: "Haptic light", hint: "лёгкая вибрация",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        tg.HapticFeedback.impactOccurred("light");
        return { called: "HapticFeedback.impactOccurred", arg: "light", note: "нет return value — void" };
      },
    },
    {
      id: "haptic-heavy", label: "Haptic heavy", hint: "сильная вибрация",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        tg.HapticFeedback.impactOccurred("heavy");
        return { called: "HapticFeedback.impactOccurred", arg: "heavy", note: "нет return value — void" };
      },
    },
    {
      id: "haptic-success", label: "Haptic success", hint: "вибрация успеха",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        tg.HapticFeedback.notificationOccurred("success");
        return { called: "HapticFeedback.notificationOccurred", arg: "success", note: "нет return value — void" };
      },
    },
    {
      id: "haptic-error", label: "Haptic error", hint: "вибрация ошибки",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        tg.HapticFeedback.notificationOccurred("error");
        return { called: "HapticFeedback.notificationOccurred", arg: "error", note: "нет return value — void" };
      },
    },
    {
      id: "show-alert", label: "showAlert", hint: "нативный диалог",
      fn: () =>
        new Promise((res, rej) => {
          if (!tg) return rej(new Error("SDK недоступен"));
          // callback вызывается когда пользователь нажал OK
          tg.showAlert("Это нативный Alert от Telegram!", () => {
            res({ called: "showAlert", callback_fired: true, note: "callback без аргументов — просто факт закрытия" });
          });
        }),
    },
    {
      id: "show-confirm", label: "showConfirm", hint: "диалог OK / Отмена",
      fn: () =>
        new Promise((res, rej) => {
          if (!tg) return rej(new Error("SDK недоступен"));
          // callback получает boolean: true = OK, false = Отмена
          tg.showConfirm("Подтвердить?", (ok) => {
            res({ called: "showConfirm", callback_arg: ok, type: typeof ok });
          });
        }),
    },
    {
      id: "back-show", label: "BackButton show", hint: "кнопка Назад в шапке",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        tg.BackButton.show();
        // BackButton — объект, покажем его реальное состояние
        return {
          called: "BackButton.show",
          BackButton_state: {
            isVisible: tg.BackButton.isVisible,
          },
          note: "нет return value — void",
        };
      },
    },
    {
      id: "header-color", label: "setHeaderColor", hint: "меняет шапку на 2с",
      fn: () =>
        new Promise((res, rej) => {
          if (!tg) return rej(new Error("SDK недоступен"));
          // читаем реальные значения ДО изменения
          const before = {
            headerColor: tg.headerColor,                    // реальный цвет ДО
            themeParams_bg_color: tg.themeParams.bg_color,  // реальный из темы
            themeParams_header_bg_color: tg.themeParams.header_bg_color,
          };
          tg.setHeaderColor("#FF6B35");
          const after_set = {
            headerColor: tg.headerColor, // реальный цвет ПОСЛЕ setHeaderColor
          };
          setTimeout(() => {
            // возвращаем исходный — только реальное значение, без ||
            const restoreTo = tg.themeParams.bg_color;
            if (restoreTo) {
              tg.setHeaderColor(restoreTo);
            }
            res({
              called: "setHeaderColor",
              before,
              after_set,
              restored_to: restoreTo ?? null, // null если themeParams.bg_color не существует
              headerColor_after_restore: tg.headerColor,
            });
          }, 2000);
        }),
    },
    {
      id: "clipboard", label: "readTextFromClipboard", hint: "читает буфер обмена",
      fn: () =>
        new Promise((res, rej) => {
          if (!tg) return rej(new Error("SDK недоступен"));
          tg.readTextFromClipboard((text) => {
            // text — реальное значение: строка или null
            res({ called: "readTextFromClipboard", callback_arg: text, type: typeof text });
          });
        }),
    },
    {
      id: "main-button-state", label: "MainButton состояние", hint: "читает текущий стейт",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        // просто читаем реальное состояние без вызовов
        return {
          isVisible: tg.MainButton.isVisible,
          isActive: tg.MainButton.isActive,
          isProgressVisible: tg.MainButton.isProgressVisible,
          text: tg.MainButton.text,
          color: tg.MainButton.color,
          textColor: tg.MainButton.textColor,
        };
      },
    },
    {
      id: "viewport", label: "Viewport данные", hint: "размеры и состояние",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        return {
          viewportHeight: tg.viewportHeight,
          viewportStableHeight: tg.viewportStableHeight,
          isExpanded: tg.isExpanded,
          isVerticalSwipesEnabled: tg.isVerticalSwipesEnabled ?? null,
        };
      },
    },
    {
      id: "all-initdata", label: "initData сырая строка", hint: "полный initData",
      fn: () => {
        if (!tg) throw new Error("SDK недоступен");
        const raw = tg.initData;
        if (!raw) return { initData: null, note: "пусто — открыто не через Telegram или бот не передал" };
        // парсим без подстановок
        const parsed = Object.fromEntries(new URLSearchParams(raw));
        if (parsed.user) {
          try { parsed.user = JSON.parse(parsed.user); } catch { }
        }
        return { raw_length: raw.length, parsed };
      },
    },
  ];

  const serverCommands = [
    {
      id: "health", label: "GET /health", hint: "статус сервера",
      fn: async () => { const t0 = Date.now(); const r = await fetch(`${API_URL}/health`); if (!r.ok) throw new Error(`HTTP ${r.status}`); return { ...await r.json(), _ms: Date.now() - t0 }; },
    },
    {
      id: "ping", label: "POST /ping", hint: "валидация initData",
      fn: async () => { const t0 = Date.now(); const r = await fetch(`${API_URL}/ping`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: tg?.initData || "" }) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return { ...await r.json(), _ms: Date.now() - t0 }; },
    },
    {
      id: "user", label: "POST /user", hint: "данные юзера через сервер",
      fn: async () => { const t0 = Date.now(); const r = await fetch(`${API_URL}/user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: tg?.initData || "" }) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return { ...await r.json(), _ms: Date.now() - t0 }; },
    },
  ];

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.logo}>⬡</span>
          <span style={s.headerTitle}>TMA Debug</span>
        </div>
        <div style={s.headerRight}>
          <span style={{ ...s.pill, background: sdkReady ? "rgba(34,197,94,0.15)" : "", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
            {sdkReady ? "SDK ✓" : "SDK ✗"}
          </span>
          <span style={s.apiUrl}>{API_URL}</span>
        </div>
      </div>

      {/* User */}
      <Section label="Пользователь" sub="initDataUnsafe.user · клиент">
        {userData ? (
          <div style={s.userCard}>
            {userData.photo_url
              ? <img src={userData.photo_url} alt="avatar" style={s.avatar} />
              : <div style={s.avatarFallback}>{(userData.first_name?.[0] || "?").toUpperCase()}</div>
            }
            <div style={s.userInfo}>
              <div style={s.userName}>{userData.first_name} {userData.last_name || ""}</div>
              {userData.username && <div style={s.userMeta}>@{userData.username}</div>}
              <div style={s.userMeta}>ID: <span style={s.mono}>{userData.id}</span></div>
              {userData.language_code && <div style={s.userMeta}>Язык: {userData.language_code}</div>}
            </div>
          </div>
        ) : (
          <Notice>{sdkReady ? "user не передан — возможно бот не настроен" : "Открой через Telegram"}</Notice>
        )}
        <Collapse label="raw JSON" data={userData} />
      </Section>

      {/* Theme */}
      <Section label="Тема и платформа" sub="colorScheme · themeParams">
        <Collapse label="смотреть" data={themeData} defaultOpen />
      </Section>

      {/* UI commands */}
      <Section label="UI команды SDK" sub="работают только внутри Telegram">
        {uiCommands.map(({ id, label, hint, fn }) => (
          <CmdRow key={id} label={label} hint={hint}
            loading={loadingBtn === id} disabled={loadingBtn !== null}
            onClick={() => run(id, label, fn)} />
        ))}
      </Section>

      {/* Server */}
      <Section label="Серверные запросы" sub={API_URL}>
        {serverCommands.map(({ id, label, hint, fn }) => (
          <CmdRow key={id} label={label} hint={hint} accent
            loading={loadingBtn === id} disabled={loadingBtn !== null}
            onClick={() => run(id, label, fn)} />
        ))}
      </Section>

      {/* Log */}
      <Section label="Лог событий" sub={`${events.length} записей`}>
        {events.length === 0
          ? <Notice>Нажимай кнопки — здесь появятся результаты</Notice>
          : events.map((e) => <LogEntry key={e.id} event={e} />)
        }
      </Section>
    </div>
  );
}

/* ── Компоненты ──────────────────────────────────────────────── */

function Section({ label, sub, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHead}>
        <span style={s.sectionLabel}>{label}</span>
        <span style={s.sectionSub}>{sub}</span>
      </div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function CmdRow({ label, hint, loading, disabled, onClick, accent }) {
  return (
    <div style={s.cmdRow}>
      <div style={s.cmdMeta}>
        <span style={s.cmdLabel}>{label}</span>
        <span style={s.cmdHint}>{hint}</span>
      </div>
      <button onClick={onClick} disabled={disabled}
        style={{ ...s.runBtn, ...(accent ? s.runBtnAccent : {}), ...(disabled && !loading ? s.runBtnDisabled : {}) }}>
        {loading ? <Spinner /> : "▶"}
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <span style={s.spinnerWrap}>
      <span style={s.spinnerDot} />
    </span>
  );
}

function Collapse({ label, data, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!data) return null;
  return (
    <div style={s.collapse}>
      <button style={s.collapseBtn} onClick={() => setOpen(v => !v)}>
        <span style={{ ...s.collapseArrow, transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
        {label}
      </button>
      {open && <pre style={s.json}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

function Notice({ children }) {
  return <div style={s.notice}>{children}</div>;
}

function LogEntry({ event }) {
  const [open, setOpen] = useState(false);
  const colors = { ok: "#4ade80", error: "#f87171", pending: "#fbbf24", info: "#60a5fa" };
  const bgColors = { ok: "rgba(34,197,94,0.06)", error: "rgba(248,113,113,0.06)", pending: "rgba(251,191,36,0.06)", info: "rgba(96,165,250,0.06)" };
  return (
    <div style={{ ...s.logEntry, background: open ? bgColors[event.status] : "transparent" }}
      onClick={() => event.detail && setOpen(v => !v)}>
      <div style={s.logRow}>
        <span style={{ ...s.logDot, background: colors[event.status] }} />
        <span style={s.logTime}>{event.time}</span>
        <span style={s.logLabel}>{event.label}</span>
        <span style={{ ...s.logStatus, color: colors[event.status] }}>{event.status}</span>
        {event.detail && <span style={s.logToggle}>{open ? "▲" : "▼"}</span>}
      </div>
      {open && event.detail && (
        <pre style={s.logDetail}>
          {typeof event.detail === "object" ? JSON.stringify(event.detail, null, 2) : String(event.detail)}
        </pre>
      )}
    </div>
  );
}

/* ── Стили (тёмная тема) ─────────────────────────────────────── */
const C = {
  bg: "#0f0f13",
  surface: "#17171d",
  border: "#2a2a35",
  text: "#e8e8f0",
  muted: "#6b6b80",
  accent: "#7c6af7",
  accentHi: "#9d8fff",
};

const s = {
  page: {
    minHeight: "100vh",
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: "'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
    paddingBottom: "80px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: `1px solid ${C.border}`,
    backgroundColor: C.surface,
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
  logo: { fontSize: "20px", color: C.accentHi },
  headerTitle: { fontSize: "16px", fontWeight: 700, letterSpacing: "-0.3px" },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  pill: { fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px" },
  apiUrl: { fontSize: "10px", color: C.muted },

  section: {
    margin: "12px",
    backgroundColor: C.surface,
    borderRadius: "14px",
    border: `1px solid ${C.border}`,
    overflow: "hidden",
  },
  sectionHead: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    padding: "10px 14px",
    borderBottom: `1px solid ${C.border}`,
  },
  sectionLabel: { fontSize: "13px", fontWeight: 700, color: C.text },
  sectionSub: { fontSize: "11px", color: C.muted },
  sectionBody: {},

  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px",
  },
  avatar: { width: "54px", height: "54px", borderRadius: "50%", border: `2px solid ${C.border}` },
  avatarFallback: {
    width: "54px", height: "54px", borderRadius: "50%",
    backgroundColor: C.accent,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "22px", fontWeight: 700, color: "#fff", flexShrink: 0,
  },
  userInfo: { display: "flex", flexDirection: "column", gap: "3px" },
  userName: { fontSize: "17px", fontWeight: 600 },
  userMeta: { fontSize: "12px", color: C.muted },
  mono: { fontFamily: "monospace", color: C.accentHi },

  cmdRow: {
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: `1px solid ${C.border}`,
    gap: "12px",
  },
  cmdMeta: { flex: 1, minWidth: 0 },
  cmdLabel: { fontSize: "14px", fontWeight: 500, display: "block" },
  cmdHint: { fontSize: "11px", color: C.muted },
  runBtn: {
    width: "34px", height: "34px", flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.07)",
    border: `1px solid ${C.border}`,
    borderRadius: "8px",
    color: C.text,
    fontSize: "13px",
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  },
  runBtnAccent: {
    backgroundColor: C.accent,
    border: "none",
    color: "#fff",
  },
  runBtnDisabled: { opacity: 0.35, cursor: "not-allowed" },

  spinnerWrap: { display: "flex", alignItems: "center", justifyContent: "center" },
  spinnerDot: {
    width: "8px", height: "8px",
    borderRadius: "50%",
    backgroundColor: "currentColor",
    animation: "pulse 0.8s ease-in-out infinite",
  },

  collapse: { borderTop: `1px solid ${C.border}` },
  collapseBtn: {
    width: "100%",
    padding: "9px 14px",
    background: "none",
    border: "none",
    color: C.muted,
    fontSize: "12px",
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },
  collapseArrow: {
    fontSize: "9px",
    display: "inline-block",
    transition: "transform 0.2s",
    color: C.muted,
  },
  json: {
    fontSize: "11px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    padding: "10px 14px 14px",
    margin: 0,
    color: "#a0a0c0",
    lineHeight: 1.6,
  },

  notice: {
    padding: "14px",
    fontSize: "13px",
    color: C.muted,
    lineHeight: 1.5,
  },

  logEntry: {
    padding: "9px 14px",
    borderBottom: `1px solid ${C.border}`,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  logRow: { display: "flex", alignItems: "center", gap: "8px" },
  logDot: { width: "7px", height: "7px", borderRadius: "50%", flexShrink: 0 },
  logTime: { fontSize: "11px", color: C.muted, fontVariantNumeric: "tabular-nums", flexShrink: 0 },
  logLabel: { fontSize: "13px", fontWeight: 500, flex: 1 },
  logStatus: { fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" },
  logToggle: { fontSize: "9px", color: C.muted },
  logDetail: {
    marginTop: "8px",
    fontSize: "11px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: "8px",
    padding: "10px",
    color: "#a0a0c0",
    lineHeight: 1.6,
  },
};