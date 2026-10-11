import { Fragment } from "react";

/** Inline markdown: **bold**, `code`, [text](url). */
function inline(text: string, key: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g);
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={k} className="font-semibold text-[#1d1f26]">{p.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(p)) return <code key={k} className="rounded bg-[#eef0f4] px-1 py-px font-mono text-[0.92em] text-[#3b3f4b]">{p.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(p);
    if (link && /^https?:\/\//.test(link[2]))
      return <a key={k} href={link[2]} target="_blank" rel="noreferrer" className="text-[#2156f3] underline underline-offset-2">{link[1]}</a>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

/** Tiny, dependency-free markdown renderer for agent messages (no raw HTML). */
export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={i} className="my-1.5 overflow-x-auto rounded-lg bg-[#16171d] px-3 py-2 font-mono text-[11.5px] leading-relaxed text-[#e8eaf0]">
          {code.join("\n")}
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(<div key={i} className="mt-1.5 font-semibold text-[#1d1f26]">{inline(heading[2], `h${i}`)}</div>);
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={i} className={`my-1 space-y-0.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `l${i}-${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    if (line.trim()) blocks.push(<p key={i} className="my-0.5">{inline(line, `p${i}`)}</p>);
    else if (blocks.length) blocks.push(<div key={i} className="h-1.5" />);
    i++;
  }
  return <div className="break-words">{blocks}</div>;
}
