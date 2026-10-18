/* PhyML Studio shared header for every workbench.
   Add to a project page with:  <script src="../../assets/js/shell.js" defer></script>
   It inserts a slim bar above the page with the studio mark, a link back to the collection and a link to About. */
(function () {
  var base = (document.currentScript && document.currentScript.src) ? new URL('../../', document.currentScript.src).href : '../../';
  var css = '' +
    '.phyml-shell{position:relative;z-index:50;display:flex;align-items:center;justify-content:space-between;gap:12px;height:44px;' +
    'padding:0 max(16px,env(safe-area-inset-right,0px)) 0 max(16px,env(safe-area-inset-left,0px));background:#0d1626;color:#e9eef5;' +
    'font:500 13.5px/1 "IBM Plex Sans","Segoe UI",system-ui,-apple-system,sans-serif;border-bottom:1px solid rgba(255,255,255,.08)}' +
    '.phyml-shell a{color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:9px;background:none;border:0;padding:0}' +
    '.phyml-shell a:hover{color:#fff}.phyml-shell a:focus-visible{outline:2px solid #5aa9e0;outline-offset:3px;border-radius:4px}' +
    '.phyml-shell b{font-weight:600;letter-spacing:.01em}.phyml-shell b i{font-style:normal;font-weight:300}' +
    '.phyml-shell .ps-nav{display:flex;gap:20px;color:#b9c6d8;background:none;border:0;padding:0;margin:0;position:static}' +
    '.phyml-shell svg{width:26px;height:26px;border-radius:6px;flex:none}';
  var mark = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#13213A"/>' +
    '<path d="M6 21C18 18 26 14 32 14S46 18 58 21" fill="none" stroke="#56739A" stroke-width="1.6"/><path d="M6 43C18 46 26 50 32 50S46 46 58 43" fill="none" stroke="#56739A" stroke-width="1.6"/>' +
    '<path d="M6 27C18 26 24 22 32 22S46 26 58 27" fill="none" stroke="#56739A" stroke-width="1.4"/><path d="M6 37C18 38 24 42 32 42S46 38 58 37" fill="none" stroke="#56739A" stroke-width="1.4"/>' +
    '<circle cx="32" cy="32" r="8.8" fill="#fff"/><circle cx="32" cy="32" r="3.2" fill="#4FA0D6"/></svg>';
  function mount() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var bar = document.createElement('div'); bar.className = 'phyml-shell';
    bar.innerHTML = '<a href="' + base + 'index.html#collection" aria-label="PhyML Studio collection">' + mark + '<b>PhyML <i>Studio</i></b></a>' +
      '<div class="ps-nav"><a href="' + base + 'index.html#collection">Collection</a><a href="' + base + 'index.html#about">About</a></div>';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
