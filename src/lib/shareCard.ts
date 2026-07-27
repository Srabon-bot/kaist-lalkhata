import { dict, type Lang } from "./i18n";
import { toBanglaDigits } from "./numerals";

export interface ShareCardData {
  shopName: string;
  dateLabel: string;
  lang: Lang;
  cashTaka: number;
  creditTaka: number;
  repaidTaka: number;
  topCustomers: { name: string; balanceTaka: number }[];
}

const COLORS = {
  redDeep: "#7A1512",
  red: "#B3261E",
  cream: "#FAF3E3",
  ink: "#26201A",
  amber: "#985200",
  green: "#2E7D4F",
};

function fmtTaka(n: number, lang: Lang): string {
  const withCommas = Math.round(n).toLocaleString("en-IN");
  return `৳${lang === "bn" ? toBanglaDigits(withCommas) : withCommas}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
}

/**
 * Renders a shareable "page from the book" as a PNG — a shop's summary and
 * outstanding-credit list, styled like the app itself. Grounded in the same
 * research as the rest of this app: informal shopkeepers usually have no
 * paper trail a lender would recognize, so a shareable, dated record of who
 * owes what is worth more than a screenshot of an app UI.
 */
export async function generateShareCardBlob(data: ShareCardData): Promise<Blob> {
  await Promise.all([
    document.fonts.load("700 40px 'Hind Siliguri'"),
    document.fonts.load("400 24px 'Hind Siliguri'"),
  ]).catch(() => {
    /* best-effort — draw with whatever font is available if this fails */
  });

  const width = 900;
  const height = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = COLORS.redDeep;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(250,243,227,0.08)";
  ctx.lineWidth = 3;
  for (let i = -height; i < width; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  const pad = 48;
  const cardX = pad;
  const cardY = pad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = COLORS.cream;
  ctx.fill();

  let y = cardY + 90;
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.red;
  ctx.font = "700 56px 'Hind Siliguri'";
  ctx.fillText(dict["welcome.title"][data.lang], width / 2, y);

  y += 50;
  ctx.font = "400 28px 'Hind Siliguri'";
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(data.shopName, width / 2, y);

  y += 38;
  ctx.font = "400 22px 'Hind Siliguri'";
  ctx.fillStyle = "rgba(38,32,26,0.6)";
  ctx.fillText(data.dateLabel, width / 2, y);

  y += 55;
  ctx.strokeStyle = "rgba(38,32,26,0.15)";
  ctx.beginPath();
  ctx.moveTo(cardX + 40, y);
  ctx.lineTo(cardX + cardW - 40, y);
  ctx.stroke();

  y += 60;
  const stats = [
    { label: dict["summary.cashSale"][data.lang], value: data.cashTaka, color: COLORS.green },
    { label: dict["summary.creditGiven"][data.lang], value: data.creditTaka, color: COLORS.amber },
    { label: dict["summary.creditRepaid"][data.lang], value: data.repaidTaka, color: COLORS.green },
  ];
  for (const s of stats) {
    ctx.textAlign = "left";
    ctx.font = "400 26px 'Hind Siliguri'";
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(s.label, cardX + 50, y);
    ctx.textAlign = "right";
    ctx.font = "700 30px 'Hind Siliguri'";
    ctx.fillStyle = s.color;
    ctx.fillText(fmtTaka(s.value, data.lang), cardX + cardW - 50, y);
    y += 52;
  }

  y += 24;
  ctx.strokeStyle = "rgba(38,32,26,0.15)";
  ctx.beginPath();
  ctx.moveTo(cardX + 40, y);
  ctx.lineTo(cardX + cardW - 40, y);
  ctx.stroke();
  y += 50;

  ctx.textAlign = "left";
  ctx.font = "700 26px 'Hind Siliguri'";
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(dict["summary.topBaki"][data.lang], cardX + 50, y);
  y += 46;

  if (data.topCustomers.length === 0) {
    ctx.font = "400 24px 'Hind Siliguri'";
    ctx.fillStyle = "rgba(38,32,26,0.6)";
    ctx.fillText(dict["summary.noBaki"][data.lang], cardX + 50, y);
    y += 40;
  } else {
    for (const c of data.topCustomers.slice(0, 5)) {
      ctx.textAlign = "left";
      ctx.font = "400 24px 'Hind Siliguri'";
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(c.name, cardX + 50, y);
      ctx.textAlign = "right";
      ctx.font = "700 24px 'Hind Siliguri'";
      ctx.fillStyle = COLORS.amber;
      ctx.fillText(fmtTaka(c.balanceTaka, data.lang), cardX + cardW - 50, y);
      y += 42;
    }
  }

  const footerY = cardY + cardH - 70;
  ctx.textAlign = "center";
  ctx.font = "400 20px 'Hind Siliguri'";
  ctx.fillStyle = "rgba(38,32,26,0.55)";
  wrapText(
    ctx,
    dict["summary.shareFooter"][data.lang],
    width / 2,
    footerY,
    cardW - 100,
    26,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))), "image/png");
  });
}

export interface DuesReceiptData {
  shopName: string;
  dateLabel: string;
  lang: Lang;
  customers: { name: string; balanceTaka: number }[];
}

/**
 * Renders a dedicated "outstanding dues" receipt — every customer who still
 * owes money, in full (not just the top 5 the weekly share card shows).
 * Meant to be generated right before the Haal Khata ritual's "start the new
 * year" step: nothing in this app actually wipes data, but a shopkeeper
 * starting a fresh year needs a durable, dated record of who owes what so
 * that money isn't quietly forgotten.
 */
export async function generateDuesReceiptBlob(data: DuesReceiptData): Promise<Blob> {
  await Promise.all([
    document.fonts.load("700 40px 'Hind Siliguri'"),
    document.fonts.load("400 24px 'Hind Siliguri'"),
  ]).catch(() => {
    /* best-effort — draw with whatever font is available if this fails */
  });

  const width = 900;
  const rowHeight = 46;
  const headerHeight = 330;
  const footerHeight = 150;
  const rowsHeight = Math.max(1, data.customers.length) * rowHeight;
  const height = headerHeight + rowsHeight + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = COLORS.redDeep;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(250,243,227,0.08)";
  ctx.lineWidth = 3;
  for (let i = -height; i < width; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  const pad = 48;
  const cardX = pad;
  const cardY = pad;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = COLORS.cream;
  ctx.fill();

  let y = cardY + 80;
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.red;
  ctx.font = "700 44px 'Hind Siliguri'";
  ctx.fillText(dict["ritual.receiptTitle"][data.lang], width / 2, y);

  y += 46;
  ctx.font = "400 28px 'Hind Siliguri'";
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(data.shopName, width / 2, y);

  y += 38;
  ctx.font = "400 22px 'Hind Siliguri'";
  ctx.fillStyle = "rgba(38,32,26,0.6)";
  ctx.fillText(data.dateLabel, width / 2, y);

  y += 50;
  ctx.strokeStyle = "rgba(38,32,26,0.15)";
  ctx.beginPath();
  ctx.moveTo(cardX + 40, y);
  ctx.lineTo(cardX + cardW - 40, y);
  ctx.stroke();
  y += 46;

  if (data.customers.length === 0) {
    ctx.textAlign = "center";
    ctx.font = "400 24px 'Hind Siliguri'";
    ctx.fillStyle = "rgba(38,32,26,0.6)";
    ctx.fillText(dict["ritual.noOutstanding"][data.lang], width / 2, y);
    y += rowHeight;
  } else {
    for (const c of data.customers) {
      ctx.textAlign = "left";
      ctx.font = "400 26px 'Hind Siliguri'";
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(c.name, cardX + 50, y);
      ctx.textAlign = "right";
      ctx.font = "700 26px 'Hind Siliguri'";
      ctx.fillStyle = COLORS.amber;
      ctx.fillText(fmtTaka(c.balanceTaka, data.lang), cardX + cardW - 50, y);
      y += rowHeight;
    }
  }

  y += 6;
  ctx.strokeStyle = "rgba(38,32,26,0.15)";
  ctx.beginPath();
  ctx.moveTo(cardX + 40, y);
  ctx.lineTo(cardX + cardW - 40, y);
  ctx.stroke();
  y += 46;

  const total = data.customers.reduce((sum, c) => sum + c.balanceTaka, 0);
  ctx.textAlign = "left";
  ctx.font = "700 28px 'Hind Siliguri'";
  ctx.fillStyle = COLORS.ink;
  ctx.fillText(dict["khata.totalOutstanding"][data.lang], cardX + 50, y);
  ctx.textAlign = "right";
  ctx.font = "700 30px 'Hind Siliguri'";
  ctx.fillStyle = COLORS.red;
  ctx.fillText(fmtTaka(total, data.lang), cardX + cardW - 50, y);

  const footerY = cardY + cardH - 60;
  ctx.textAlign = "center";
  ctx.font = "400 20px 'Hind Siliguri'";
  ctx.fillStyle = "rgba(38,32,26,0.55)";
  wrapText(ctx, dict["ritual.receiptFooter"][data.lang], width / 2, footerY, cardW - 100, 26);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))), "image/png");
  });
}

/** Native share sheet when available (mobile, with file support); otherwise a plain download — same fallback pattern as the existing CSV export. */
export async function shareOrDownloadCard(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch {
      // User cancelled or share failed — fall back to a plain download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
