import './experiment-menu.css'
const example=new URLSearchParams(location.search).get('example')
const archive=example==='watertouch'||example==='water'
if(example==='7'){
  document.title='콜라텍 · Example 07'
  void import('./colatec')
}else{
  document.body.classList.add('has-experiment-nav')
  document.body.dataset.experiment=archive?'watertouch':'snow'
  document.querySelector<HTMLLinkElement>('link[rel=icon]')!.href=archive?'/watertouch.svg':'/snow.svg'
  const menu=document.createElement('nav');menu.className='experiment-menu';menu.setAttribute('aria-label','인터랙션 예제와 아카이브')
  menu.innerHTML=`<a href="./?example=snow" ${!archive?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-2-1-5m15 9-4 2 1 5"/></svg>Snow<small>08</small></a><a href="./?example=watertouch" ${archive?'aria-current="page"':''}><svg viewBox="0 0 24 24"><path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/></svg>WaterTouch<small>ARCHIVE</small></a>`
  document.body.append(menu)
  if(archive){document.title='WaterTouch · Archive';void import('./watertouch')}
  else{document.title='Snow · 손끝으로 부르는 겨울';void import('./snow')}
}
export {}
