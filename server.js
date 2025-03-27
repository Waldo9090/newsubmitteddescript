const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
// Define the domain for easier reference
const DOMAIN = 'www.aisummarizer-descript.com';

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route
app.get('/', (req, res) => {
  res.send(`HTTPS server running on ${DOMAIN}`);
});

// SSL certificate options
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

// Create HTTPS server
https.createServer(options, app).listen(PORT, () => {
  console.log(`HTTPS server running at https://${DOMAIN}/ on port ${PORT}`);
}); 