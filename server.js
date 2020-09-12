const express = require('express');
const connectDB = require('./config/db');
const app = express();
const fileUpload = require('express-fileupload');
const cors = require('cors');

//Init
connectDB();
const whiteList = ["http://localhost:3000"];
app.use(express.json());
app.use(fileUpload({createParentPath: true}));
app.use(express.static('public'));
app.use(cors());

//Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/groups', require('./routes/group'));

//Port listen
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));