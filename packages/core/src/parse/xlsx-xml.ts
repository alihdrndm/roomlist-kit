// Just enough XML reading for the few parts of an .xlsx file this project needs.
// Everything is a forward scan with indexOf: no regular expressions run over the
// (untrusted) document text, so there is no backtracking to exploit, and the work
// is proportional to the size of the part.

/** One start, end or empty-element tag. */
export type Tag = {
  /** Name without a namespace prefix: "row" for both <row> and <x:row>. */
  name: string;
  /** Name as written, needed to find the matching end tag. */
  rawName: string;
  /** The text between the name and the closing ">" (attributes). */
  attrs: string;
  closing: boolean;
  selfClosing: boolean;
  /** Index of "<". */
  start: number;
  /** Index just after ">". */
  end: number;
};

/** The next tag at or after `from`, skipping comments, processing instructions and declarations. */
export function nextTag(xml: string, from: number): Tag | undefined {
  let position = from;
  while (true) {
    const start = xml.indexOf("<", position);
    if (start === -1) return undefined;
    const next = xml.charCodeAt(start + 1);
    // "<!--", "<![CDATA[", "<!DOCTYPE" and "<?xml": not elements.
    if (next === 0x21 /* ! */) {
      const close = xml.startsWith("<!--", start)
        ? xml.indexOf("-->", start)
        : xml.indexOf(">", start);
      if (close === -1) return undefined;
      position = close + 1;
      continue;
    }
    if (next === 0x3f /* ? */) {
      const close = xml.indexOf("?>", start);
      if (close === -1) return undefined;
      position = close + 2;
      continue;
    }
    const close = xml.indexOf(">", start);
    if (close === -1) return undefined;
    const closing = next === 0x2f; /* / */
    const selfClosing = !closing && xml.charCodeAt(close - 1) === 0x2f;
    const bodyStart = start + (closing ? 2 : 1);
    const bodyEnd = selfClosing ? close - 1 : close;
    let nameEnd = bodyStart;
    while (nameEnd < bodyEnd && !isSpace(xml.charCodeAt(nameEnd))) nameEnd++;
    const rawName = xml.slice(bodyStart, nameEnd);
    const colon = rawName.indexOf(":");
    return {
      name: colon === -1 ? rawName : rawName.slice(colon + 1),
      rawName,
      attrs: xml.slice(nameEnd, bodyEnd),
      closing,
      selfClosing,
      start,
      end: close + 1,
    };
  }
}

/** The value of attribute `name` (exact, including any prefix such as "r:id"), decoded. */
export function attr(attrs: string, name: string): string | undefined {
  let position = 0;
  while (position < attrs.length) {
    while (position < attrs.length && isSpace(attrs.charCodeAt(position)))
      position++;
    const equals = attrs.indexOf("=", position);
    if (equals === -1) return undefined;
    const key = attrs.slice(position, equals).trim();
    let valueStart = equals + 1;
    while (valueStart < attrs.length && isSpace(attrs.charCodeAt(valueStart)))
      valueStart++;
    const quote = attrs[valueStart];
    if (quote !== '"' && quote !== "'") return undefined;
    const valueEnd = attrs.indexOf(quote, valueStart + 1);
    if (valueEnd === -1) return undefined;
    if (key === name)
      return decodeEntities(attrs.slice(valueStart + 1, valueEnd));
    position = valueEnd + 1;
  }
  return undefined;
}

/** The text directly after a start tag, up to the next tag, decoded. */
export function textAfter(xml: string, tag: Tag): string {
  if (tag.selfClosing) return "";
  const end = xml.indexOf("<", tag.end);
  return decodeEntities(xml.slice(tag.end, end === -1 ? xml.length : end));
}

const NAMED: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

/** Replaces &lt; &gt; &amp; &quot; &apos; and numeric references (&#10; &#x1F600;). */
export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  let result = "";
  let position = 0;
  while (true) {
    const amp = text.indexOf("&", position);
    if (amp === -1) return result + text.slice(position);
    const semi = text.indexOf(";", amp);
    // An "&" with no ";" within a short distance is left as it is.
    if (semi === -1 || semi - amp > 10) {
      result += text.slice(position, amp + 1);
      position = amp + 1;
      continue;
    }
    const entity = text.slice(amp + 1, semi);
    let replacement: string | undefined = NAMED[entity];
    if (replacement === undefined && entity.startsWith("#")) {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      if (Number.isInteger(code) && code >= 0 && code <= 0x10ffff)
        replacement = String.fromCodePoint(code);
    }
    if (replacement === undefined) {
      result += text.slice(position, semi + 1);
    } else {
      result += text.slice(position, amp) + replacement;
    }
    position = semi + 1;
  }
}

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}
