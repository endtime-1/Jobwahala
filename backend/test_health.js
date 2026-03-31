fetch("https://jobwahala-production.up.railway.app/health").then(async r => console.log(await r.text())).catch(console.error);
