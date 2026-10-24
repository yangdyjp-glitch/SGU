// Keep the small top rail and the native table scrollbar in sync. A single
// delegated handler also covers deferred sections and project drawers.
export function setupTableScrolling(root = document) {
  const observed = new Map();
  const sync = scroller => {
    if(!scroller)return;
    const rail = scroller.closest('.qualification-scroll-frame')?.querySelector('[data-qualification-scroll]');
    if (!rail) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    rail.disabled = max <= 1;
    rail.value = max > 0 ? Math.round(scroller.scrollLeft / max * 1000) : 0;
    rail.setAttribute('aria-valuetext', max <= 1 ? '所有项目已显示' : `已滚动 ${Math.round(Number(rail.value)/10)}%`);
  };
  const resize = typeof ResizeObserver==='undefined' ? null : new ResizeObserver(entries=>entries.forEach(({target})=>sync(target.closest('.qualification-scroll'))));
  const scan = () => {
    for (const [scroller,table] of observed) if (!scroller.isConnected) {resize?.unobserve(scroller);if(table)resize?.unobserve(table);observed.delete(scroller);}
    root.querySelectorAll('.qualification-scroll').forEach(scroller=>{
      if(!observed.has(scroller)){const table=scroller.querySelector('table');observed.set(scroller,table);resize?.observe(scroller);if(table)resize?.observe(table);}
      sync(scroller);
    });
  };
  const mutations = new MutationObserver(scan);
  mutations.observe(root.documentElement || root,{childList:true,subtree:true});
  root.addEventListener('input',event=>{
    if(!event.target.matches('[data-qualification-scroll]'))return;
    const scroller=event.target.closest('.qualification-scroll-frame').querySelector('.qualification-scroll');
    scroller.scrollLeft=(scroller.scrollWidth-scroller.clientWidth)*Number(event.target.value)/1000;
    sync(scroller);
  });
  root.addEventListener('scroll',event=>{if(event.target.matches?.('.qualification-scroll'))sync(event.target);},true);
  scan();
}
