// Plain module (no 'use client') so the server-rendered anti-flash script in
// layout.tsx and the client-side ThemeContext can share the same literal
// without importing across the client boundary (which resolves to `undefined`
// when a server component statically inlines a value exported from a
// 'use client' file).
export const THEME_STORAGE_KEY = 'chaque-franc-theme';
