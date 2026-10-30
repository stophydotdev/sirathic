export const csvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text.charAt(i + 1) === '"') cell += text.charAt(++i);
      else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") endRow();
    else if (char !== "\r") cell += char;
  }
  if (cell || row.length > 0) endRow();
  return rows;
};
