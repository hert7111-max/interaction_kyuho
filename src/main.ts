import './experiment-menu.css'
const example=new URLSearchParams(location.search).get('example')
const selected=example==='watertouch'||example==='water'?'watertouch':example==='snow'?'snow':example==='papa'?'papa':'particle'
if(example==='7'){
  document.title='콜라텍 · Example 07'
  void import('./colatec')
}else{
  document.body.classList.add('has-experiment-nav')
  document.body.dataset.experiment=selected
  document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href=selected==='watertouch'?'/watertouch.svg':selected==='snow'?'/snow.svg':selected==='papa'?'/papa.svg':'/particle.svg'
  const menu=document.createElement('nav');menu.className='experiment-menu';menu.setAttribute('aria-label','인터랙션 예제와 아카이브')
  menu.innerHTML=`<a href="./?example=particle" ${selected==='particle'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="1"/><circle cx="12" cy="4" r="1"/><circle cx="19" cy="6" r="1"/><circle cx="4" cy="13" r="1"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="14" r="1"/><circle cx="7" cy="20" r="1"/><circle cx="15" cy="20" r="1"/></svg>particle</a><a href="./?example=papa" ${selected==='papa'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/></svg>파파괴</a><a href="./?example=snow" ${selected==='snow'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3"/></svg>Snow</a><a href="./?example=watertouch" ${selected==='watertouch'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/></svg>WaterTouch</a>`
  document.body.append(menu)
  if(selected==='watertouch'){document.title='WaterTouch · Archive';void import('./watertouch')}
  else if(selected==='snow'){document.title='Snow · Archive';void import('./snow')}
  else if(selected==='papa'){document.title='파파괴';void import('./papa')}
  else{document.title='particle';void import('./particle')}
}
export {}
