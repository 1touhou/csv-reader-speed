// Faster drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Returns exactly csv-reader 1.0.0's answer {columns, rows, errors} for every
// input {text, header}, but reads the text with indexOf-driven scans instead
// of one character at a time:
//
//   - a record whose line holds no quote and no stray CR is split in one go
//     (String.split, C++), which covers most records of a drawn file;
//   - other records are read field by field, each unquoted field found with
//     one regex scan for the next comma or LF plus a bounded stray-CR check
//     on its slice, each quoted field found with indexOf('"') jumps, doubling
//     quotes folded in as segments are collected;
//   - no per-field result objects: how a field ended and how many characters
//     an unquoted read kept travel in closure variables.
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to
// the next. Dependency-free ES module.
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;
  let ended = END; // how the last field read ended
  let added = 0; // characters the last unquoted read kept

  const FIELD_END = /[,\n]/g;
  const BAD_SPAN = /["\r]/;

  function pushErr(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  function countLF(s) {
    let k = 0;
    let i = -1;
    while ((i = s.indexOf('\n', i + 1)) !== -1) k++;
    return k;
  }

  // Reads unquoted characters onto `value`; sets `ended` and `added`; returns the field.
  function readUnquoted(value) {
    added = 0;
    let p = pos;
    for (;;) {
      FIELD_END.lastIndex = p;
      const m = FIELD_END.exec(text);
      let end;
      let kind;
      if (m === null) {
        end = n;
        kind = END;
      } else if (m[0] === ',') {
        end = m.index;
        kind = COMMA;
      } else {
        end = m.index;
        kind = LINE_BREAK;
      }
      if (kind === LINE_BREAK && end > p && text.charCodeAt(end - 1) === 13) end -= 1;
      if (end > p) {
        const seg = text.slice(p, end);
        const cr = seg.indexOf('\r');
        if (cr === -1) {
          value += seg;
          added += seg.length;
        } else {
          let from = 0;
          let at = cr;
          for (;;) {
            value += seg.slice(from, at);
            added += at - from;
            pushErr('stray_cr');
            from = at + 1;
            at = seg.indexOf('\r', from);
            if (at === -1) break;
          }
          value += seg.slice(from);
          added += seg.length - from;
        }
      }
      if (kind === COMMA) {
        pos = end + 1;
        ended = COMMA;
        return value;
      }
      if (kind === LINE_BREAK) {
        pos = end + 1;
        if (text.charCodeAt(end) === 13) pos = end + 2;
        line += 1;
        ended = LINE_BREAK;
        return value;
      }
      pos = n;
      ended = END;
      return value;
    }
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    let p = pos + 1;
    let segStart = p;
    let parts = null;
    let qLines = 0;
    for (;;) {
      const qq = text.indexOf('"', p);
      if (qq === -1) {
        pos = open + 1;
        line = openLine;
        pushErr('unterminated_quote');
        return readUnquoted('"');
      }
      let seg = text.slice(segStart, qq);
      if (seg.indexOf('\r') !== -1) seg = seg.replace(/\r\n?/g, '\n');
      qLines += countLF(seg);
      if (text.charCodeAt(qq + 1) === 34) {
        if (parts === null) parts = [];
        parts.push(seg, '"');
        p = qq + 2;
        segStart = p;
        continue;
      }
      line += qLines;
      let value;
      if (parts === null) value = seg;
      else {
        parts.push(seg);
        value = parts.join('');
      }
      pos = qq + 1;
      if (pos >= n) {
        ended = END;
        return value;
      }
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        ended = COMMA;
        return value;
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        ended = LINE_BREAK;
        return value;
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        ended = LINE_BREAK;
        return value;
      }
      const junk = readUnquoted(value);
      if (added > 0) pushErr('quote_junk');
      return junk;
    }
  }

  function finishRecord(fields, quoted) {
    if (fields.length === 1 && fields[0] === '' && !quoted) return;
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  while (true) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;

    const nl = text.indexOf('\n', pos);
    const recEnd0 = nl === -1 ? n : nl;
    let recEnd = recEnd0;
    if (nl !== -1 && recEnd > pos && text.charCodeAt(recEnd - 1) === 13) recEnd -= 1;
    const span = text.slice(pos, recEnd);
    if (!BAD_SPAN.test(span)) {
      const fields = span === '' ? [''] : span.split(',');
      pos = nl === -1 ? n : nl + 1;
      if (nl !== -1) line += 1;
      finishRecord(fields, false);
      continue;
    }

    const fields = [];
    let quoted = false;
    for (;;) {
      let value;
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        value = readQuoted();
      } else {
        quoted = false;
        value = readUnquoted('');
      }
      fields.push(value);
      if (ended !== COMMA) break;
    }
    finishRecord(fields, quoted);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
