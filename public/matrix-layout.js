const px=value=>parseFloat(value)||0;
const inset=element=>{
  const style=getComputedStyle(element);
  return px(style.paddingLeft)+px(style.paddingRight)+px(style.borderLeftWidth)+px(style.borderRightWidth);
};
const width=element=>element.getBoundingClientRect().width;
const set=(element,name,value)=>{if(element.style.getPropertyValue(name)!==value)element.style.setProperty(name,value);};

// Size only the columns that need more room. Matching matrices in the same
// view share these minima, while CSS keeps their compact responsive baseline.
export function fitMatrixColumns(scrollers) {
  const owners=new Map();
  for(const scroller of scrollers){
    if(!scroller.clientWidth)continue;
    const table=scroller.querySelector('.qualification-matrix,.academic-score-table');
    if(!table)continue;
    const headers=[...table.querySelectorAll('thead [data-qualification-program],thead [data-academic-score-program]')];
    if(!headers.length)continue;
    const ids=headers.map(cell=>cell.dataset.qualificationProgram||cell.dataset.academicScoreProgram);
    const owner=table.closest('.project-detail,.school-detail,.admission-content')||scroller.parentElement;
    if(!owners.has(owner))owners.set(owner,new Map());
    const groups=owners.get(owner),key=JSON.stringify(ids);
    if(!groups.has(key))groups.set(key,{ids,widths:ids.map(()=>0),tables:[]});
    groups.get(key).tables.push({table,headers});
  }
  // Finish all geometry reads before writing widths to avoid repeated layout.
  for(const groups of owners.values())for(const group of groups.values()){
    const index=new Map(group.ids.map((id,i)=>[id,i]));
    for(const {table,headers} of group.tables){
      headers.forEach((header,i)=>{
        const parts=[...header.querySelectorAll('.program-label-part')];
        group.widths[i]=Math.max(group.widths[i],...parts.map(part=>width(part)+inset(header)+2));
      });
      for(const cell of table.querySelectorAll('td[data-score-program]')){
        const i=index.get(cell.dataset.scoreProgram),padding=inset(cell)+2;
        for(const value of cell.querySelectorAll('.academic-score-value')){
          const children=[...value.children],gap=px(getComputedStyle(value).columnGap);
          const needed=children.reduce((sum,child)=>sum+width(child),0)+gap*Math.max(0,children.length-1)+padding;
          group.widths[i]=Math.max(group.widths[i],needed);
        }
        for(const variant of cell.querySelectorAll('.academic-score-variant'))group.widths[i]=Math.max(group.widths[i],width(variant)+padding);
      }
    }
  }
  for(const groups of owners.values())for(const {widths,tables} of groups.values()){
    const minima=widths.map(Math.ceil),total='calc('+minima.map(w=>`max(var(--matrix-project-width), ${w}px)`).join(' + ')+')';
    for(const {table} of tables){
      const cols=table.querySelectorAll('.qualification-program-column,.academic-score-project-column');
      cols.forEach((col,i)=>set(col,'--matrix-content-width',minima[i]+'px'));
      set(table,'--matrix-projects-width',total);
    }
  }
}
