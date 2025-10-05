// backend/server/server.js
const express = require('express');
const path = require('path');

const apiRoutes = require('../routes/routes'); 

const app = express();

app.use(express.json());

const frontendRoot = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendRoot));

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  const splash = path.join(frontendRoot, 'homepage', 'home.html');
  res.sendFile(splash, (err) => {
    if (err) {
      console.error('Error sending root splitsquats page:', err);
      res.status(500).send('Could not load page');
    }
  });
});

app.get('/pushups', (req, res) => {
  const pushupsPage = path.join(frontendRoot, 'pushups', 'pushups.html');
  res.sendFile(pushupsPage, (err) => {
    if (err) {
      console.error('Error sending pushups page:', err);
      res.status(500).send('Could not load pushups page');
    }
  });
});

app.get('/sideplank', (req, res) => {
  const pushupsPage = path.join(frontendRoot, 'sideplank', 'sideplank.html');
  res.sendFile(pushupsPage, (err) => {
    if (err) {
      console.error('Error sending pushups page:', err);
      res.status(500).send('Could not load sideplank page');
    }
  });
});

app.get('/splitsquats', (req, res) => {
  const pushupsPage = path.join(frontendRoot, 'splitsquats', 'splitsquats.html');
  res.sendFile(pushupsPage, (err) => {
    if (err) {
      console.error('Error sending pushups page:', err);
      res.status(500).send('Could not load splitsquats page');
    }
  });
});

app.get('/squats', (req, res) => {
  const pushupsPage = path.join(frontendRoot, 'squats', 'squats.html');
  res.sendFile(pushupsPage, (err) => {
    if (err) {
      console.error('Error sending pushups page:', err);
      res.status(500).send('Could not load squats page');
    }
  });
});

app.get('/flappyBirdGame', (req, res) => {
  const pushupsPage = path.join(frontendRoot, 'flappyBirdGame', 'flappy-face.html');
  res.sendFile(pushupsPage, (err) => {
    if (err) {
      console.error('Error sending pushups page:', err);
      res.status(500).send('Could not load pushups page');
    }
  });
});

app.get('/towergame', (req, res) => {
  const pushupsPage = path.join(frontendRoot, 'towergame', 'towergame.html');
  res.sendFile(pushupsPage, (err) => {
    if (err) {
      console.error('Error sending pushups page:', err);
      res.status(500).send('Could not load pushups page');
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log('Static frontend path:', frontendRoot);
  console.log('API endpoints:');
  console.log(`  POST http://localhost:${PORT}/api/infer`);
  console.log(`  GET  http://localhost:${PORT}/api/splitsquats`);
});
