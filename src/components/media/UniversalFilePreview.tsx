import * as React from "react";

import { File, FileSpreadsheet, FileText } from "lucide-react";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Source =
  | { kind: "local"; file: File; url: string }
  | { kind: "remote"; name: string; mimeType?: string; url: string };

function extFromName(name: string) {
  const n = (name ?? "").trim();
  const dot = n.lastIndexOf(".");
  return dot >= 0 ? n.slice(dot).toLowerCase() : "";
}

function isTextLike(mimeType: string | undefined, ext: string) {
  const t = (mimeType ?? "").toLowerCase();
  return t.startsWith("text/") || ext === ".txt";
}

function isPdfLike(mimeType: string | undefined, ext: string) {
  const t = (mimeType ?? "").toLowerCase();
  return t === "application/pdf" || ext === ".pdf";
}

function isDocx(ext: string) {
  return ext === ".docx";
}

function isDoc(ext: string) {
  return ext === ".doc";
}

function isExcel(ext: string) {
  return ext === ".xls" || ext === ".xlsx";
}

async function readAsArrayBuffer(source: Source): Promise<ArrayBuffer> {
  if (source.kind === "local") return await source.file.arrayBuffer();
  const res = await fetch(source.url);
  if (!res.ok) throw new Error("Failed to fetch file");
  return await res.arrayBuffer();
}

async function readAsText(source: Source): Promise<string> {
  if (source.kind === "local") return await source.file.text();
  const res = await fetch(source.url);
  if (!res.ok) throw new Error("Failed to fetch file");
  return await res.text();
}

async function fetchAsObjectUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch file");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function FileThumbnail({
  name,
  mimeType,
  url,
  className,
}: {
  name: string;
  mimeType?: string;
  url?: string;
  className?: string;
}) {
  const ext = extFromName(name);
  const t = (mimeType ?? "").toLowerCase();
  const isImage = t.startsWith("image/");
  const isVideo = t.startsWith("video/");

  if (isImage && url) {
    return <img src={url} alt={name || "Media preview"} className={cn("h-full w-full object-cover", className)} loading="lazy" />;
  }

  if (isVideo && url) {
    return <video src={url} className={cn("h-full w-full object-cover", className)} controls preload="metadata" />;
  }

  const label = (ext || (t ? t.split("/").pop() : "file") || "file").replace(".", "").toUpperCase();
  const Icon = isExcel(ext) ? FileSpreadsheet : isTextLike(mimeType, ext) || isDocx(ext) ? FileText : File;

  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 p-4", className)}>
      <Icon className="h-10 w-10 text-muted-foreground" />
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function UniversalFilePreview({
  source,
  className,
  maxChars = 20000,
}: {
  source: Source;
  className?: string;
  maxChars?: number;
}) {
  const name = source.kind === "local" ? source.file.name : source.name;
  const mimeType = source.kind === "local" ? source.file.type : source.mimeType;
  const ext = extFromName(name);
  const t = (mimeType ?? "").toLowerCase();

  const [loading, setLoading] = React.useState(false);
  const [text, setText] = React.useState<string>("");
  const [html, setHtml] = React.useState<string>("");
  const [objectUrl, setObjectUrl] = React.useState<string>(source.kind === "local" ? source.url : "");
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setError("");
      setText("");
      setHtml("");

      // Keep local object URLs, but for remote PDFs we create a blob URL to avoid iframe/embed issues.
      if (source.kind === "remote" && isPdfLike(mimeType, ext)) {
        try {
          setLoading(true);
          const nextObjectUrl = await fetchAsObjectUrl(source.url);
          if (cancelled) return;
          setObjectUrl(nextObjectUrl);
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? "Failed to load preview");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (isTextLike(mimeType, ext)) {
        try {
          setLoading(true);
          const txt = await readAsText(source);
          if (cancelled) return;
          setText(txt.slice(0, maxChars));
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? "Failed to load preview");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (isDocx(ext)) {
        try {
          setLoading(true);
          const buf = await readAsArrayBuffer(source);
          const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
          if (cancelled) return;
          setHtml(value || "");
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? "Failed to render DOCX");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (isExcel(ext)) {
        try {
          setLoading(true);
          const buf = await readAsArrayBuffer(source);
          const wb = XLSX.read(buf, { type: "array" });
          const firstSheet = wb.SheetNames[0];
          const ws = wb.Sheets[firstSheet];
          const table = XLSX.utils.sheet_to_html(ws, { id: "sheet", editable: false });
          if (cancelled) return;
          setHtml(table || "");
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? "Failed to render spreadsheet");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // default: no extra loading
      setObjectUrl(source.kind === "local" ? source.url : source.url);
    };

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind === "local" ? source.file : source.url]);

  React.useEffect(() => {
    return () => {
      if (source.kind === "remote" && objectUrl && objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl, source.kind]);

  if (loading) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 p-4", className)}>
        <p className="text-sm text-muted-foreground">{error}</p>
        {source.kind === "remote" ? (
          <Button type="button" variant="outline" onClick={() => window.open(source.url, "_blank", "noopener,noreferrer")}>Open file</Button>
        ) : null}
      </div>
    );
  }

  if (t.startsWith("image/")) {
    return <img src={objectUrl} alt={name || "Preview"} className={cn("h-full w-full object-contain", className)} />;
  }

  if (t.startsWith("video/")) {
    return <video src={objectUrl} className={cn("h-full w-full", className)} controls />;
  }

  if (isPdfLike(mimeType, ext)) {
    return <embed src={objectUrl || (source.kind === "remote" ? source.url : source.url)} type="application/pdf" className={cn("h-full w-full", className)} />;
  }

  if (isTextLike(mimeType, ext)) {
    return (
      <div className={cn("h-full w-full overflow-auto p-4", className)}>
        <pre className="text-xs text-foreground whitespace-pre-wrap break-words">{text || "(empty file)"}</pre>
      </div>
    );
  }

  if (isDoc(ext)) {
    return (
      <div className={cn("flex h-full w-full flex-col items-center justify-center gap-3 p-4", className)}>
        <p className="text-sm text-muted-foreground">Preview untuk format .doc lama tidak didukung tanpa konversi.</p>
        <p className="text-sm text-muted-foreground">Silakan upload ulang sebagai .docx agar bisa dipreview.</p>
        {source.kind === "remote" ? (
          <Button type="button" variant="outline" onClick={() => window.open(source.url, "_blank", "noopener,noreferrer")}>Open file</Button>
        ) : null}
      </div>
    );
  }

  if (html) {
    return (
      <div className={cn("h-full w-full overflow-auto p-4", className)}>
        <div
          className="text-sm text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_p]:mb-2"
          // mammoth/xlsx generate HTML, no scripts
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 p-4", className)}>
      <FileThumbnail name={name} mimeType={mimeType} />
      {source.kind === "remote" ? (
        <Button type="button" variant="outline" onClick={() => window.open(source.url, "_blank", "noopener,noreferrer")}>Open file</Button>
      ) : null}
    </div>
  );
}
