const toggle = document.querySelector('#menu-toggle');
const navigation = document.querySelector('#navigation');
const header = document.querySelector('.site-header');
if (toggle && navigation && header) {
  const setOpen = open => {
    navigation.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('span').textContent = open ? 'Cerrar' : 'Menú';
  };
  // Without JavaScript the links remain visible at every viewport width.
  header.classList.add('navigation-ready');
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', event => { if(event.target.closest('a')) setOpen(false); });
  header.addEventListener('keydown', event => {
    if(event.key==='Escape' && toggle.getAttribute('aria-expanded')==='true') {
      setOpen(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 1200px)').addEventListener('change', () => setOpen(false));
  // Returning through the browser history must not restore an expanded menu.
  addEventListener('pageshow', () => setOpen(false));
}
