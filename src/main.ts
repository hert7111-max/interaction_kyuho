if (new URLSearchParams(location.search).get('example') === '7') {
  document.title = '콜라텍 · Example 07'
  void import('./colatec')
} else {
  void import('./watertouch')
}
export {}
