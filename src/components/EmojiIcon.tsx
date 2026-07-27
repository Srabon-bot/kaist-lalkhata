interface EmojiIconProps {
  /** Filename under public/emoji/, e.g. "mic.png". */
  src: string;
  /** Rendered width/height in px — pass the pixel equivalent of whatever
   * text-* size class the emoji it replaces used, so it reads at the same
   * visual size. */
  size: number;
  className?: string;
}

/** A custom illustrated icon standing in for a plain-text emoji. Sized in
 * px (not a text-* class) since these are images, not glyphs that scale
 * with font-size. */
export function EmojiIcon({ src, size, className }: EmojiIconProps) {
  return (
    <img
      src={`/emoji/${src}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 select-none object-contain align-[-0.2em] ${className ?? ""}`}
    />
  );
}
