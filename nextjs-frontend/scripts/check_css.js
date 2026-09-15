const http = require('http');

http.get('http://localhost:3000/review2', (res) => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    // Find stylesheet link
    const match = html.match(/href="(\/_next\/static\/css\/[^"]+)"/);
    if (!match) {
      console.log('No CSS found');
      return;
    }
    const cssUrl = 'http://localhost:3000' + match[1];
    console.log('CSS URL:', cssUrl);
    http.get(cssUrl, (res2) => {
      let css = '';
      res2.on('data', c => css += c);
      res2.on('end', () => {
        console.log('CSS length:', css.length);
        const hasMxAuto = css.includes('margin-inline: auto') || css.includes('margin-left: auto');
        console.log('has mx-auto or margin auto:', hasMxAuto);
        const mxAutoMatch = css.match(/[^{}]*mx-auto[^{}]*\{[^}]*\}/g);
        console.log('mxAutoMatch:', mxAutoMatch);
        const maxwMatch = css.match(/[^{}]*max-w-[^{}]*\{[^}]*\}/g);
        console.log('maxwMatch:', maxwMatch?.slice(0, 10));
      });
    });
  });
});
