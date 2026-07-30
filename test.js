const http = require('http');

http.get("http://localhost:7860/api/proxy?url=https%3A%2F%2Fvideo5.xhpingcdn.com%2Fkey%3DBoYQwuOXjju38KvOywU-qg%2Cend%3D1785409200%2Climit%3D3%2Fdata%3D103.85.126.132-dvp%2Freferer%3Dforce%2C.xhcdn.com%2C.xhamster2.com%2Fspeed%3D0%2F029%2F789%2F485%2F480p.h264.mp4&download=true&title=Got%20fucked%20by%20intrder", (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    res.on('data', (chunk) => {
        console.log('Got chunk of length:', chunk.length);
        process.exit(0);
    });
}).on('error', (e) => {
    console.error('Error:', e);
});
