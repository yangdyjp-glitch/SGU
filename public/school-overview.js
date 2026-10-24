// A school keeps one DOM and one scroll position while its sections are opened.
export function mountSchoolOverview(root, overview, { openProject, onEntryChange, onError }) {
  let disposed = false;
  const timers = new Set(), pending = new Set();
  const find = key => root.querySelector('#detail-' + key);
  function load(key) {
    const element = find(key);
    if (disposed || !root.isConnected || !element?.dataset.schoolSection) return element;
    try {
      const html = overview.renderSection(key);
      if (html) { observer?.unobserve(element); element.outerHTML = html; }
    } catch (error) { onError(error); }
    return find(key);
  }
  function reveal(key) {
    const element = load(key);
    element?.scrollIntoView({ block:'start' });
  }
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const key = entry.target.dataset.schoolSection;
      if (pending.has(key)) continue;
      pending.add(key);
      const timer = setTimeout(() => { timers.delete(timer); pending.delete(key); load(key); }, 0);
      timers.add(timer);
    }
  }, { rootMargin:'120px 0px' });
  root.querySelectorAll('[data-school-section]:not([data-school-section="complete"])').forEach(element=>observer?.observe(element));
  function click(event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const entry=event.target.closest('[data-school-entry]');
    if (entry) { event.preventDefault(); if(entry.dataset.schoolEntry!==overview.entryGroup)onEntryChange(entry.dataset.schoolEntry); return; }
    const sectionLink = event.target.closest('[data-school-section-link],[data-load-school-section]');
    if (sectionLink) {
      event.preventDefault();
      reveal(sectionLink.dataset.schoolSectionLink || sectionLink.dataset.loadSchoolSection);
      return;
    }
    const anchor = event.target.closest('a[href^="#program/"]');
    if (anchor) {
      event.preventDefault();
      openProject(anchor.getAttribute('href').split('/')[1], anchor);
    }
  }
  function filter(event) {
    if (!event.target.matches('[data-school-project-search]')) return;
    const term = event.target.value.trim().toLowerCase();
    let count = 0;
    root.querySelectorAll('[data-school-project]').forEach(row => {
      row.hidden = !row.dataset.schoolProject.includes(term);
      if (!row.hidden) count++;
    });
    const group=overview.entryGroup==='transfer'?'编入项目':'申请项目';
    root.querySelector('[data-school-project-count]').textContent = term ? `找到 ${count} / ${overview.programs.length} 个项目 · 下方仍显示全部${group}` : `全部 ${overview.programs.length} 个${group}${overview.programs.length>8?' · 列表内可滚动查看':''}`;
    root.querySelector('.school-project-empty').classList.toggle('hidden', count > 0);
  }
  root.addEventListener('click', click);
  root.addEventListener('input', filter);
  function keydown(event) {
    if(!event.target.matches('[data-school-entry]') || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const group=['ArrowLeft','Home'].includes(event.key)?'application':'transfer';
    if(group!==overview.entryGroup)onEntryChange(group);
    else root.querySelector(`[data-school-entry="${group}"]`).focus();
  }
  root.addEventListener('keydown',keydown);
  return {
    reveal,
    dispose() { disposed=true; observer?.disconnect(); timers.forEach(clearTimeout); root.removeEventListener('click',click); root.removeEventListener('input',filter); root.removeEventListener('keydown',keydown); }
  };
}
