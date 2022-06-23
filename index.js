const { Telegraf, Markup } = require('telegraf');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const getAtmDist = require('./helpers');
const express = require('express');
const path = require('path');
const fileUpload = require('express-fileupload');
const exphbs = require('express-handlebars');
dotenv.config();

const app = express();

app.engine('hbs', exphbs.engine({
  defaultLayout: 'main',
  extname: '.hbs'
}));

app.set('view engine', 'hbs');

var ATM_LIST = [];


// DB CONNECTION
// --------------------------------------------------------------------
var connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});

connection.connect(function(err) {
  if (err) {
    console.error('Error Connecting: ' + err.stack);
    return;
  }
});

connection.query('SELECT * FROM atmlocation', function (error, results, fields) {
  if (error) throw error;
  ATM_LIST = results;
  // BOT LOGIC
  const bot = new Telegraf(process.env.TOKEN)

  bot.command('start', (ctx) => {
    ctx.reply('Send us your location, so we know where you are...\nየት እንዳሉ ይላኩልን...', Markup.keyboard([[Markup.button.locationRequest("Send Location\ን ባታ ላክ", false)]]));
  })

  bot.on('location', (ctx) => {
    var ATM_DISTANCED = getAtmDist(ctx.message.location.latitude, ctx.message.location.longitude, ATM_LIST).sort((a, b) => a.dist - b.dist);
    for (var i = 0; i < ATM_DISTANCED.length && i < 5; i++){
      const ATM = ATM_DISTANCED[i];
      if (ATM.atm.PIC != NULL) {
        bot.telegram.sendPhoto(ctx.chat.id, __dirname + 'upload_images')
      }
      else {
        bot.telegram.sendMessage(ctx.chat.id, ATM.atm.LOCATION
        +'\n'+
        'Distance: '+ATM.dist/1000 + 'km'
        +'\n'+
        `https://maps.google.com/?q=${ATM.atm.LATITIUDE},${ATM.atm.LONGITUDE}`)
      }
    }
  })

  bot.launch()
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))  
});
  
  // ######################################################################################################################
  // ######################################################################################################################
  // ######################################################################################################################

  // default options
  app.use(fileUpload());

  app.post('/upload', function(req, res) {
    let sampleFile;
    let uploadPath;
    let tid = req.query.tid;

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    sampleFile = req.files.sampleFile;
    uploadPath = __dirname + '/upload_images/'+tid+'.jpg';

    // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(uploadPath, function(err) {
      if (err)
        return res.status(500).send(err);

      connection.query(`UPDATE atmlocation SET PIC="${tid+'.jpg'}" WHERE TERMINAL_ID = "${tid}"`, function (error) {
        if (error) throw error;
      })
      connection.query('SELECT * FROM atmlocation ORDER BY TERMINAL_ID ASC', function (error, results, fields) {
        if (error) throw error;
        ATM_LIST = results;
        res.render('main',{data:ATM_LIST});
      });
    });
  });

  app.get('/manage', (req, res) => {
    connection.query('SELECT * FROM atmlocation ORDER BY TERMINAL_ID ASC', function (error, results, fields) {
      if (error) throw error;
      ATM_LIST = results;
      res.render('main',{data:ATM_LIST});
    });
  })

  // If connected successfully to the DB, listen to request
  app.listen(process.env.PORT, () => {
    console.log("Listening on 5000!")
  })