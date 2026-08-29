/**
 * Unofficial transcript export.
 *
 * Renders the transcript into an HTML replica of `public/Transcript.docx` and
 * hands it to the browser's print pipeline, where the user saves it as a PDF.
 *
 * Why an HTML replica rather than filling the .docx: converting a Word file to
 * PDF in the browser needs a licensed WASM SDK (Nutrient/Apryse), and the free
 * tier of the one alternative (Spire.Doc) truncates to 3 pages / 25 tables —
 * which this template's one-nested-table-per-semester layout blows past. Print
 * gives real vector text and correct multi-page reflow for free.
 *
 * `public/Transcript.docx` stays the design reference; every measurement below
 * is taken from it, converted from twips (1440 per inch):
 *
 *   page 12240x15840 (Letter), margins 720/720/360/720  -> 7.5in content width
 *   outer layout grid  2 cols x 5400                    -> 50% / 50%, no borders
 *   course table       5025 wide, cols 1560/1815/855/795
 *   cell padding       57.6 twips (course/GPA), 14.4 (grid cells)
 *   body text          Arial 11pt; title 15pt; labels bold
 *
 * Border model, replicated exactly (the "Total Credit" row lives *inside* the
 * course table but drops its left/right/bottom edges, so the solid rule above it
 * reads as the table's closing line and the total hangs below it):
 *
 *   header row   solid 1pt box top, dotted 0.5pt bottom
 *   data rows    no horizontal rules between them, solid 1pt sides
 *   total row    colspan, solid 1pt top only
 */

/** Column widths from the template's tblGrid, as a share of the course table. */
const COURSE_COL_PCT = [31.04, 36.12, 17.01, 15.82];

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Credits to one decimal place, so the portal's mixed formatting ("1", ".5",
 * "1.000") prints consistently as 1.0 / 0.5 / 1.0. Anything non-numeric is
 * passed through untouched rather than shown as NaN.
 */
function roundCredit(value) {
  const raw = String(value ?? '').trim();
  if (raw === '') return raw;
  const num = Number(raw);
  return Number.isFinite(num) ? num.toFixed(1) : raw;
}

/**
 * Pull the semester blocks out of the transcript payload. The API returns one
 * key per semester (`"2021-2022 School Year - Semester 1"`) alongside flat
 * summary keys (`rank`, `quartile`, `Weighted GPA*`), so entries are identified
 * structurally rather than by key.
 */
function collectSemesters(transcriptData) {
  return Object.entries(transcriptData || {})
    .filter(([, entry]) =>
      entry && typeof entry === 'object' && entry.year && entry.semester && Array.isArray(entry.data)
    )
    .map(([key, entry]) => ({ key, ...entry }))
    .sort((a, b) => {
      // `year` reads "2021-2022 School Year"; sort on the opening year, then
      // semester, so blocks run oldest-first like the printed transcript.
      const yearOf = (s) => parseInt(String(s.year).match(/\d{4}/)?.[0] ?? '0', 10);
      const termOf = (s) => parseInt(String(s.semester).match(/\d+/)?.[0] ?? '0', 10);
      return yearOf(a) - yearOf(b) || termOf(a) - termOf(b);
    });
}

/** One semester's cell in the two-column layout grid. */
function renderSemester(entry) {
  const rows = entry.data || [];
  // Row 0 is the portal's own header row; fall back to the template's labels if
  // a portal ever omits it.
  const headers = rows.length ? rows[0] : ['Course', 'Name', 'Grade', 'Credit'];
  const body = rows.slice(1);
  const colCount = headers.length;

  const widthFor = (i) =>
    colCount === COURSE_COL_PCT.length ? ` style="width:${COURSE_COL_PCT[i]}%"` : '';

  const meta = [
    ['Year: ', entry.year],
    ['Term: ', entry.semester],
    ['Grade: ', entry.grade],
    ['Building: ', entry.school],
  ]
    .map(([label, value]) => `<p class="meta"><b>${esc(label)}</b>${esc(value)}</p>`)
    .join('');

  const head = headers
    .map((h, i) => `<th${widthFor(i)}>${esc(h)}</th>`)
    .join('');

  // Located by header text rather than a fixed index, since the columns come
  // from the portal and only their labels are dependable.
  const isCreditCol = headers.map((h) => /credit/i.test(String(h)));

  const bodyRows = body
    .map((row) => {
      const cells = Array.from({ length: colCount }, (_, i) => {
        const value = isCreditCol[i] ? roundCredit(row[i]) : (row[i] ?? '');
        return `<td>${esc(value)}</td>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  // The total row only appears when the portal reported a credit figure, so a
  // semester without one closes on the last course row instead of an empty rule.
  const totalRow =
    entry.credits != null && String(entry.credits).trim() !== ''
      ? `<tr class="total"><td colspan="${colCount}"><b>Total Credit: </b>${esc(roundCredit(entry.credits))}</td></tr>`
      : '';

  return `<td class="block">
    ${meta}
    <table class="courses">
      <thead><tr>${head}</tr></thead>
      <tbody>${bodyRows}${totalRow}</tbody>
    </table>
  </td>`;
}

/** The cumulative GPA / rank / quartile table below the semester grid. */
function renderGpaTable(transcriptData) {
  const weighted = transcriptData['Weighted GPA*'];
  const unweighted = transcriptData['Unweighted GPA*'];
  if (!weighted && !unweighted) return '';

  // Rank and quartile are cumulative, and the template shows them on the
  // weighted row only; the unweighted row carries dashes.
  const row = (label, gpa, rank, quartile) =>
    `<tr><td>${esc(label)}</td><td>${esc(gpa || '-')}</td><td>${esc(rank || '-')}</td><td>${esc(quartile || '-')}</td></tr>`;

  return `<table class="gpa">
    <thead><tr><th>GPA Type</th><th>GPA</th><th>Rank</th><th>Quartile</th></tr></thead>
    <tbody>
      ${row('Weighted GPA', weighted, transcriptData.rank, transcriptData.quartile)}
      ${row('Unweighted GPA', unweighted, '-', '-')}
    </tbody>
  </table>`;
}

const STYLES = `
  @page { size: 8.5in 11in; margin: 0.5in 0.5in 0.25in 0.5in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.15;
    color: #000;
    background: #fff;
  }

  /* The whole document is one table so the browser repeats <thead> as a running
     page header and <tfoot> as a running footer on every printed page — the
     only mechanism supported across Chrome, Firefox and Safari. */
  table.page { width: 100%; border-collapse: collapse; }
  table.page > thead > tr > td,
  table.page > tbody > tr > td,
  table.page > tfoot > tr > td { padding: 0; border: 0; }

  .doc-title { text-align: center; font-size: 15pt; margin-bottom: 4pt; }
  table.ident { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.ident td { width: 50%; padding: 0.01in; border: 0; vertical-align: top; }
  table.ident td.right { text-align: right; }
  .ident p { margin: 0; }
  /* Separates the running header from the content. Lives inside <thead>, so it
     repeats on every printed page along with the identity block. A border, not
     a background, so it survives with "print backgrounds" turned off. */
  .header-divider { border-top: 1px solid #ccc; margin-top: 6pt; }
  .header-gap { height: 10pt; }
  .footer { text-align: right; padding-top: 6pt; }

  /* Invisible two-column layout grid holding the semester blocks. */
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.grid > tbody > tr { break-inside: avoid; page-break-inside: avoid; }
  td.block { width: 50%; padding: 0.01in 0.01in 14pt 0.01in; border: 0; vertical-align: top; }
  .meta { margin: 0; }

  /* Course + GPA tables share the template's border treatment. */
  table.courses, table.gpa {
    border-collapse: collapse;
    table-layout: fixed;
    margin-top: 4pt;
  }
  table.courses { width: 93.06%; }   /* 5025 of the 5400-twip grid cell */
  /* Measured against the full 10800-twip content box. The template's 5025-twip
     table split evenly (1256 twips per column), but "Unweighted GPA" wraps at
     that width, so the GPA Type column is doubled to 2512 twips and the table
     grown to absorb it — the other three keep their original 1256. The margin
     stands in for the empty spacer paragraph the template puts above it. */
  table.gpa { width: 58.16%; margin-top: 12pt; break-inside: avoid; page-break-inside: avoid; }
  table.gpa th:first-child, table.gpa td:first-child { width: 40%; }
  table.gpa th:not(:first-child), table.gpa td:not(:first-child) { width: 20%; }
  table.courses th, table.courses td,
  table.gpa th, table.gpa td {
    padding: 0.04in;
    text-align: left;
    font-weight: normal;
    vertical-align: top;
    word-wrap: break-word;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
  }
  table.courses thead th, table.gpa thead th {
    border-top: 1px solid #000;
    border-bottom: 1px dotted #000;
  }
  table.courses tbody td, table.gpa tbody td {
    border-top: none;
    border-bottom: none;
  }
  /* The GPA table has no total row, so its last row closes the box. */
  table.gpa tbody tr:last-child td { border-bottom: 1px solid #000; }
  /* Total Credit: inside the table, but only the rule above it is drawn. */
  table.courses tr.total td {
    border: none;
    border-top: 1px solid #000;
    text-align: right;
  }
`;

/** Assemble the full standalone print document. */
function buildDocument(transcriptData, user) {
  const semesters = collectSemesters(transcriptData);

  const grid = [];
  for (let i = 0; i < semesters.length; i += 2) {
    const left = renderSemester(semesters[i]);
    // Pad the trailing odd block so the row keeps its 50/50 column split.
    const right = semesters[i + 1]
      ? renderSemester(semesters[i + 1])
      : '<td class="block"></td>';
    grid.push(`<tr>${left}${right}</tr>`);
  }

  const title = `Unofficial Transcript${user?.name ? ` - ${user.name}` : ''}`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<table class="page">
  <thead>
    <tr><td>
      <div class="doc-title">Unofficial Overall Transcript</div>
      <table class="ident">
        <tr>
          <td class="ident">
            <p><b>District/Program: </b>${esc(user?.district)}</p>
            <p><b>Latest Institution: </b>${esc(user?.school)}</p>
          </td>
          <td class="ident right">
            <p><b>Student: </b>${esc(user?.name)}</p>
            <p><b>ID: </b>${esc(user?.username)}</p>
            ${user?.dob ? `<p><b>DOB: </b>${esc(user.dob)}</p>` : ''}
          </td>
        </tr>
      </table>
      <div class="header-divider"></div>
      <div class="header-gap"></div>
    </td></tr>
  </thead>
  <tfoot>
    <tr><td><div class="footer">Generated using <b>Gradiate</b></div></td></tr>
  </tfoot>
  <tbody>
    <tr><td>
      <table class="grid"><tbody>${grid.join('')}</tbody></table>
      ${renderGpaTable(transcriptData || {})}
    </td></tr>
  </tbody>
</table>
</body>
</html>`;
}

/**
 * Render the transcript and open the browser's print dialog, where the user
 * chooses "Save as PDF". Resolves once printing has been dismissed.
 */
export function exportUnofficialTranscript(transcriptData, user) {
  const html = buildDocument(transcriptData, user);

  const frame = document.createElement('iframe');
  // Kept in the layout (not display:none) because some engines skip printing
  // frames that were never laid out.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);

  return new Promise((resolve) => {
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      // Deferred so the print job keeps its document alive on Safari, which
      // tears down mid-print if the frame is removed synchronously.
      setTimeout(() => frame.remove(), 1000);
      resolve();
    };

    frame.onload = () => {
      const win = frame.contentWindow;
      try {
        win.addEventListener('afterprint', cleanup, { once: true });
        win.focus();
        win.print();
        // `afterprint` never fires in a few environments; fall back so the
        // frame can't leak and the caller's spinner always clears.
        setTimeout(cleanup, 60000);
      } catch (err) {
        cleanup();
        throw err;
      }
    };

    const doc = frame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
  });
}
