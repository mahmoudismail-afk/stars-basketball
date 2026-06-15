const https = require('https');
https.get('https://stars-basketball.pages.dev/admin/', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const matches = data.match(/_next\/static\/chunks\/app\/admin\/page-[^\"]+\.js/g);
    if (!matches) return console.log('No admin chunk found');
    matches.forEach(chunk => {
      https.get('https://stars-basketball.pages.dev/' + chunk, (cr) => {
        let cdata = '';
        cr.on('data', c => cdata += c);
        cr.on('end', () => {
          console.log('Chunk:', chunk);
          console.log('Includes courts.find:', cdata.includes('courts.find'));
          console.log('Includes .replace:', cdata.includes('.replace("court-","Court ")'));
        });
      });
    });
  });
});
