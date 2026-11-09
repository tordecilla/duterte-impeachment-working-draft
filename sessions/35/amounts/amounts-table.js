/* Filters and stable, keyboard-accessible sorting for the witness amounts table. */
(() => {
  'use strict';
  const table = document.querySelector('.amounts-table-page table');
  if (!table) return;
  const body = table.tBodies[0];
  const rows = Array.from(body.rows).map((node, index) => {
    const fields = Array.from(node.cells, cell => cell.textContent.trim());
    const currency = node.cells[4].querySelector('small').textContent.trim();
    const witness = node.cells[5].querySelector('.cell-content').firstChild.textContent.trim();
    const years = fields[2].match(/\b(?:19|20)\d{2}\b/g) || [];
    let date = Date.parse(fields[2]);
    if (!Number.isFinite(date)) date = years.length ? Number(years[0]) * 10000 : Infinity;
    else { const d = new Date(date); date = d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate(); }
    return { node, index, fields, currency, witness, years, date,
      amount: Number(node.cells[4].querySelector('.cell-content').firstChild.textContent.replace(/,/g, '')),
      search: fields.join(' ').toLocaleLowerCase() };
  });
  const form = document.querySelector('.amount-filters');
  const search = document.querySelector('#amount-search');
  const controls = [
    ['institution', row => row.fields[0].startsWith('BPI') ? 'BPI' : row.fields[0]], ['year', row => row.years],
    ['type', row => row.fields[3]], ['currency', row => row.currency],
    ['witness', row => row.witness]
  ].map(([name, get]) => {
    const select = document.querySelector('#filter-' + name);
    const values = [...new Set(rows.flatMap(get))].sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
    values.forEach(value => select.add(new Option(value, value)));
    return {select, get};
  });
  function filter() {
    const words = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    rows.forEach(row => {
      const match = words.every(word => row.search.includes(word)) && controls.every(({select,get}) => {
        const value=get(row); return !select.value || (Array.isArray(value) ? value.includes(select.value) : value===select.value);
      });
      row.node.hidden = !match;
      if (match) count++;
    });
    document.querySelector('#amount-count').textContent = `${count} of ${rows.length} amounts`;
    document.querySelector('#amount-empty').hidden = count > 0;
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => setTimeout(filter, 0));
  const headers = Array.from(table.tHead.rows[0].cells);
  headers.forEach((th, column) => th.querySelector('button').addEventListener('click', () => {
    const descending = th.getAttribute('aria-sort') === 'ascending';
    headers.forEach(header => header.setAttribute('aria-sort','none'));
    th.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
    document.querySelector('#mobile-sort-field').value=String(column);
    document.querySelector('#mobile-sort-order').value=descending ? 'descending' : 'ascending';
    const key = row => column === 4 ? row.amount : column === 2 ? row.date : row.fields[column];
    const sorted = rows.slice().sort((a,b) => {
      const x=key(a), y=key(b);
      const compare = typeof x === 'number' ? (x===y ? 0 : x<y ? -1 : 1) : x.localeCompare(y, undefined, {numeric:true, sensitivity:'base'});
      return (descending ? -compare : compare) || a.index-b.index;
    });
    sorted.forEach(row => body.append(row.node));
  }));
  function mobileSort() {
    const th=headers[Number(document.querySelector('#mobile-sort-field').value)];
    th.setAttribute('aria-sort',document.querySelector('#mobile-sort-order').value==='ascending' ? 'none' : 'ascending');
    th.querySelector('button').click();
  }
  document.querySelector('#mobile-sort-field').addEventListener('change',mobileSort);
  document.querySelector('#mobile-sort-order').addEventListener('change',mobileSort);
  const query=new URLSearchParams(location.search);
  controls.forEach(({select}) => {
    const name=select.id.replace('filter-','');
    const value=query.get(name);
    if (value && Array.from(select.options).some(option => option.value===value)) select.value=value;
  });
  if (query.has('search')) search.value=query.get('search');
  filter();
})();
