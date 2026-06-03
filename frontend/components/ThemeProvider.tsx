// Injeta CSS variables de branding a partir de NEXT_PUBLIC_* env vars.
// Valores omitidos mantêm o padrão definido em globals.css (:root).

export function ThemeProvider() {
  const p50  = process.env.NEXT_PUBLIC_COLOR_50  || "";
  const p100 = process.env.NEXT_PUBLIC_COLOR_100 || "";
  const p200 = process.env.NEXT_PUBLIC_COLOR_200 || "";
  const p300 = process.env.NEXT_PUBLIC_COLOR_300 || "";
  const p400 = process.env.NEXT_PUBLIC_COLOR_400 || "";
  const p500 = process.env.NEXT_PUBLIC_COLOR_500 || "";
  const p600 = process.env.NEXT_PUBLIC_COLOR_600 || "";
  const p700 = process.env.NEXT_PUBLIC_COLOR_700 || "";
  const p800 = process.env.NEXT_PUBLIC_COLOR_800 || "";
  const p900 = process.env.NEXT_PUBLIC_COLOR_900 || "";

  const overrides = [
    p50  && `--color-primary-50:${p50}`,
    p100 && `--color-primary-100:${p100}`,
    p200 && `--color-primary-200:${p200}`,
    p300 && `--color-primary-300:${p300}`,
    p400 && `--color-primary-400:${p400}`,
    p500 && `--color-primary-500:${p500}`,
    p600 && `--color-primary-600:${p600}`,
    p700 && `--color-primary-700:${p700}`,
    p800 && `--color-primary-800:${p800}`,
    p900 && `--color-primary-900:${p900}`,
  ].filter(Boolean).join(";");

  if (!overrides) return null;

  return (
    <style>{`:root{${overrides}}`}</style>
  );
}
