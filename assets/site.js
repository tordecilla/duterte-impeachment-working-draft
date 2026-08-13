const repositoryFromPage = () => {
  const configured = document.documentElement.dataset.repository?.trim();
  if (configured) return configured.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  if (!location.hostname.endsWith('.github.io')) return '';
  const owner = location.hostname.split('.')[0];
  const firstPath = location.pathname.split('/').filter(Boolean)[0];
  return firstPath ? `${owner}/${firstPath}` : `${owner}/${owner}.github.io`;
};

const repository = repositoryFromPage();
const issueUrl = (title, body, labels) => repository
  ? `https://github.com/${repository}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(labels)}`
  : '';

document.querySelectorAll('[data-report-correction]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const body = [
      '## Transcript location',
      `- Session: ${link.dataset.sessionDate} (session ${link.dataset.session})`,
      `- Segment: ${link.dataset.segment}`,
      `- Time: ${link.dataset.time} (${link.dataset.seconds} seconds)`,
      `- Public page: ${location.href.split('#')[0]}#${link.dataset.segment}`,
      '',
      '## Current text',
      `> ${link.dataset.currentText}`,
      '',
      '## Proposed correction',
      '',
      '',
      '## Evidence or reason',
      'Please link the official video timestamp or another authoritative source.',
      '',
      '## Reporter disclosure',
      'If relevant, disclose any role or interest related to this correction.'
    ].join('\n');
    const url = issueUrl(`Transcript correction: ${link.dataset.segment}`, body, 'transcript correction');
    if (!url) {
      event.preventDefault();
      alert('Correction reporting activates automatically when this build is published on GitHub Pages.');
      return;
    }
    link.href = url;
  });
});

const sourceFrame = document.querySelector('#source-frame');
const sendVideo = (func, args = []) => sourceFrame?.contentWindow?.postMessage(
  JSON.stringify({ event: 'command', func, args }),
  'https://www.youtube-nocookie.com'
);
document.querySelectorAll('[data-public-seek]').forEach((control) => {
  control.addEventListener('click', (event) => {
    if (!sourceFrame) return;
    event.preventDefault();
    const seconds = Number(control.dataset.publicSeek || 0);
    sendVideo('seekTo', [seconds, true]);
    sendVideo('playVideo');
    setTimeout(() => { sendVideo('seekTo', [seconds, true]); sendVideo('playVideo'); }, 350);
    sourceFrame.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

const turns = [...document.querySelectorAll('.public-turn')];
const textSearch = document.querySelector('#public-text-search');
const speakerSearch = document.querySelector('#public-speaker-search');
const findPrevious = document.querySelector('#public-find-previous');
const findNext = document.querySelector('#public-find-next');
const findClear = document.querySelector('#public-find-clear');
const filterButtons = [...document.querySelectorAll('[data-public-filter]')];
const result = document.querySelector('#public-result');
const empty = document.querySelector('#public-empty');
let activeFilter = 'all';
let matches = [];
let matchIndex = -1;

const applyFilters = () => {
  let visible = 0;
  turns.forEach((turn) => {
    const filterMatch = activeFilter === 'all'
      || (activeFilter === 'unknown' && turn.dataset.bucket === 'unknown')
      || (activeFilter === 'mixed' && turn.dataset.bucket === 'mixed')
      || (activeFilter === 'reconstructed' && turn.dataset.reconstructed === 'true');
    turn.hidden = !filterMatch;
    if (filterMatch) visible += 1;
  });
  if (result) result.textContent = activeFilter === 'all' ? `All ${visible} turns remain in view` : `Showing ${visible} turn${visible === 1 ? '' : 's'}`;
  if (empty) empty.hidden = visible !== 0;
};

const clearHighlights = () => {
  document.querySelectorAll('mark.public-find-highlight').forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent || '')));
  document.querySelectorAll('.turn-record>p').forEach((copy) => copy.normalize());
};

const highlightCopy = (turn, needle) => {
  if (!needle) return;
  const copy = turn.querySelector('.turn-record>p');
  if (!copy) return;
  const source = copy.textContent || '';
  const lower = source.toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let found = lower.indexOf(needle);
  while (found !== -1) {
    fragment.append(document.createTextNode(source.slice(cursor, found)));
    const mark = document.createElement('mark');
    mark.className = 'public-find-highlight';
    mark.textContent = source.slice(found, found + needle.length);
    fragment.append(mark);
    cursor = found + needle.length;
    found = lower.indexOf(needle, cursor);
  }
  fragment.append(document.createTextNode(source.slice(cursor)));
  copy.replaceChildren(fragment);
};

const selectMatch = (index, shouldScroll = true) => {
  turns.forEach((turn) => turn.classList.remove('public-find-current'));
  if (!matches.length) { matchIndex = -1; return; }
  matchIndex = (index + matches.length) % matches.length;
  const turn = matches[matchIndex];
  turn.classList.add('public-find-current');
  if (shouldScroll) {
    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    history.replaceState(null, '', `#${turn.id}`);
  }
  if (result) result.textContent = `${matchIndex + 1} of ${matches.length} matches · all ${turns.length} turns remain in view`;
};

const updateFind = () => {
  const textNeedle = textSearch?.value.trim().toLocaleLowerCase() || '';
  const speakerNeedle = speakerSearch?.value.trim().toLocaleLowerCase() || '';
  clearHighlights();
  turns.forEach((turn) => turn.classList.remove('public-find-match', 'public-find-current', 'public-speaker-match'));
  matchIndex = -1;
  if (!textNeedle && !speakerNeedle) {
    matches = [];
    applyFilters();
    findPrevious?.setAttribute('disabled', '');
    findNext?.setAttribute('disabled', '');
    return;
  }
  activeFilter = 'all';
  filterButtons.forEach((button) => button.classList.toggle('active', button.dataset.publicFilter === 'all'));
  turns.forEach((turn) => { turn.hidden = false; });
  if (empty) empty.hidden = true;
  matches = turns.filter((turn) => {
    const messageMatch = !textNeedle || (turn.dataset.message || '').includes(textNeedle);
    const speakerMatch = !speakerNeedle || (turn.dataset.speaker || '').includes(speakerNeedle);
    return messageMatch && speakerMatch;
  });
  matches.forEach((turn) => {
    turn.classList.add('public-find-match');
    if (speakerNeedle) turn.classList.add('public-speaker-match');
    highlightCopy(turn, textNeedle);
  });
  findPrevious?.toggleAttribute('disabled', !matches.length);
  findNext?.toggleAttribute('disabled', !matches.length);
  if (result) result.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'} · all ${turns.length} turns remain in view`;
};

[textSearch, speakerSearch].forEach((input) => {
  input?.addEventListener('input', updateFind);
  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    selectMatch(matchIndex + (event.shiftKey ? -1 : 1));
  });
});
findPrevious?.addEventListener('click', () => selectMatch(matchIndex - 1));
findNext?.addEventListener('click', () => selectMatch(matchIndex + 1));
findClear?.addEventListener('click', () => {
  if (textSearch) textSearch.value = '';
  if (speakerSearch) speakerSearch.value = '';
  updateFind();
});
findPrevious?.setAttribute('disabled', '');
findNext?.setAttribute('disabled', '');
filterButtons.forEach((button) => button.addEventListener('click', () => {
  if (textSearch) textSearch.value = '';
  if (speakerSearch) speakerSearch.value = '';
  clearHighlights();
  turns.forEach((turn) => turn.classList.remove('public-find-match', 'public-find-current', 'public-speaker-match'));
  activeFilter = button.dataset.publicFilter;
  filterButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  applyFilters();
}));
