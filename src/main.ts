import './experiment-menu.css'
const example=new URLSearchParams(location.search).get('example')
const selected=example==='watertouch'||example==='water'?'watertouch':example==='snow'?'snow':example==='papa'?'papa':example==='particle'?'particle':example==='rubber'?'rubber':example==='minecraft'?'minecraft':example==='invisible'?'invisible':example==='face-reaction'?'face-reaction':example==='character-scan'?'character-scan':'arcade'
if(example==='7'){
  document.title='콜라텍 · Example 07'
  void import('./colatec')
}else{
  document.body.classList.add('has-experiment-nav')
  document.body.dataset.experiment=selected
  const favicon=selected==='rubber'?'rubber.svg':selected==='watertouch'?'watertouch.svg':selected==='snow'?'snow.svg':selected==='papa'?'papa.svg':selected==='particle'?'particle.svg':'arcade.svg'
  document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href=`${import.meta.env.BASE_URL}${favicon}`
  const menu=document.createElement('nav');menu.className='experiment-menu';menu.setAttribute('aria-label','인터랙션 예제와 아카이브')
  menu.innerHTML=`<a href="./?example=character-scan" ${selected==='character-scan'?'aria-current="page"':''}>캐릭터 스캔</a><a href="./?example=face-reaction" ${selected==='face-reaction'?'aria-current="page"':''}>페이스 리액션</a><a href="./?example=invisible" ${selected==='invisible'?'aria-current="page"':''}>투명인간</a><a href="./?example=minecraft" ${selected==='minecraft'?'aria-current="page"':''}>MineCraft</a><a href="./?example=rubber" ${selected==='rubber'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M8 3C3 5 4 11 5 15s5 7 8 6 3-5 4-7 6-2 5-4-6 0-7-3-4-5-7-4Z"/><path d="M8 10h.01M13 10h.01M8 15q3 3 5 0"/></svg>고무 인간</a><a href="./?example=arcade" ${selected==='arcade'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4M7 7h10v6H7Z"/></svg>CRT Arcade</a><a href="./?example=particle" ${selected==='particle'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="1"/><circle cx="12" cy="4" r="1"/><circle cx="19" cy="6" r="1"/><circle cx="4" cy="13" r="1"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="14" r="1"/><circle cx="7" cy="20" r="1"/><circle cx="15" cy="20" r="1"/></svg>particle</a><a href="./?example=papa" ${selected==='papa'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/></svg>파파괴</a><a href="./?example=snow" ${selected==='snow'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3"/></svg>Snow</a><a href="./?example=watertouch" ${selected==='watertouch'?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/></svg>WaterTouch</a>`
  document.body.append(menu)
  requestAnimationFrame(()=>menu.querySelector<HTMLAnchorElement>('[aria-current="page"]')?.scrollIntoView({block:'nearest',inline:'center'}))
  if(selected==='character-scan'){document.title='캐릭터 스캔';void import('./character-scan/index.js')}
  else if(selected==='face-reaction'){document.title='페이스 리액션';void import('./face-reaction')}
  else if(selected==='invisible'){document.title='투명인간';void import('./invisible')}
  else if(selected==='minecraft'){document.title='MineCraft';void import('./minecraft')}
  else if(selected==='rubber'){document.title='고무 인간';void import('./rubber')}
  else if(selected==='watertouch'){document.title='WaterTouch · Archive';void import('./watertouch')}
  else if(selected==='snow'){document.title='Snow · Archive';void import('./snow')}
  else if(selected==='papa'){document.title='파파괴';void import('./papa')}
  else if(selected==='particle'){document.title='particle';void import('./particle')}
  else{document.title='CRT Arcade';void import('./arcade')}
}
export {}
