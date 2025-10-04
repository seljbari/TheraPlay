const express = require('express');
const path = require('path');

const app = express();

app.use(
    express.static(
        path.join(
             __dirname , '..', '..', 'frontend'
        )
    )
)

app.get('/', (req, res) => {
  const filePath = path.join(__dirname, '..', '..', 'frontend', 'splitsquats', 'splitsquats.html');
  res.sendFile(filePath);
});


const port = process.env.PORT || 3000; 

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`)
    console.log(path.join(__dirname, '..', '..', 'frontend', 'splitsquats', 'splitsquatsmodel.js'));

})