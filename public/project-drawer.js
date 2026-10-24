import { programEntryGroup } from './program-presentation.js';

export function createProjectDrawer({ esc, icon, render, hasModal }) {
  let root, returnTo;
  function close({ restoreFocus=true }={}) {
    if (!root) return;
    root.remove(); root=null;
    document.querySelector('#app').inert = hasModal();
    document.body.style.overflow = hasModal() ? 'hidden' : '';
    if (restoreFocus && returnTo?.isConnected) returnTo.focus({preventScroll:true});
  }
  function open(program, title, trigger=document.activeElement) {
    close({restoreFocus:false}); returnTo=trigger;
    root=document.createElement('div'); root.className='project-drawer-backdrop';
    root.dataset.entryGroup=programEntryGroup(program);
    root.innerHTML=`<section class="project-drawer" role="dialog" aria-modal="true" aria-labelledby="project-drawer-title" tabindex="-1"><header class="project-drawer-head"><div><small>${esc(program.school)} · ${esc(program.year)} 入学</small><h2 id="project-drawer-title">${esc(title)}</h2></div><button type="button" class="icon-btn" data-close-project-drawer aria-label="关闭项目详情">${icon('close')}</button></header><div class="project-drawer-body">${render(program)}</div></section>`;
    document.querySelector('#modal-root').before(root);
    document.querySelector('#app').inert=true; document.body.style.overflow='hidden';
    // Scope section IDs without rewriting source text, data-info or evidence.
    root.querySelectorAll('[id^="detail-"]').forEach(element=>element.id='drawer-'+element.id);
    root.addEventListener('click',event=>{
      if (event.target===root || event.target.closest('[data-close-project-drawer]')) return close();
      const anchor=event.target.closest('.rule-nav a');
      if (anchor && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        root.querySelector('#drawer-detail-'+anchor.getAttribute('href').split('/')[2])?.scrollIntoView({block:'start'});
      }
    });
    root.querySelector('[data-close-project-drawer]').focus({preventScroll:true});
  }
  return { open, close, get element(){return root?.querySelector('.project-drawer');} };
}
