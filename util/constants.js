const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.NODE_ENV === 'production' ? process.env.PORT : 5001;

const ee = require('@google/earthengine');

app.use(cors());
app.use(express.json()); 


// Authenticate with GEE
const privateKey = require('../privatekey.json');

const landCoverNames = {
  10: "Trees",
  20: "Shrubland",
  30: "Grassland",
  40: "Cropland",
  50: "Built-up",
  60: "Bare / Sparse vegetation",
  70: "Snow and ice",
  80: "Permanent water bodies",
  90: "Herbaceous wetland",
  95: "Mangroves",
  100: "Moss and lichen",
};

  
  module.exports = {
     ee, app, port, landCoverNames, privateKey
  };