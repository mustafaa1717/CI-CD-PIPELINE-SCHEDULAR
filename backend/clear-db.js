const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/cicd-scheduler')
  .then(async () => {
    console.log('Clearing database...');
    await mongoose.connection.db.dropDatabase();
    console.log('Database cleared! You can now start fresh.');
    process.exit(0);
  })
  .catch(err => console.error(err));
