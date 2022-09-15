const { Telegraf, Markup } = require('telegraf');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const getAtmDist = require('./helpers');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const exphbs = require('express-handlebars');
const { request } = require('http');
const rateLimit = require('telegraf-ratelimit')

dotenv.config();

const app = express();

app.engine('hbs', exphbs.engine({
  defaultLayout: 'main',
  extname: '.hbs'
}));

app.set('view engine', 'hbs');
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static(__dirname + '/views/layouts'));
app.use(fileUpload());
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

// BOT COMMANDS AND LOGIC IS HERE
connection.query('SELECT * FROM atmlocation', function (error, results, fields) {
  if (error) throw error;
  ATM_LIST = results;

  const limitConfig = {
    window: 3000,
    limit: 3,
    onLimitExceeded: (ctx, next) => ctx.reply('Rate limit exceeded')
  }

  const bot = new Telegraf(process.env.TOKEN)
  bot.use(rateLimit(limitConfig)) // Apply rate limits

  bot.catch((err) =>{
    console.log("Caught: "+err);
  })

  bot.command('start', async (ctx) => {
    if (ctx.message.from.id == process.env.YOSEPH || ctx.message.from.id == process.env.TINSU) {
      ctx.reply('Send us your location, so we know where you are...\nእባክዎ ያሉበትን ቦታ ይላኩልን...', 
      Markup.keyboard([[Markup.button.locationRequest("Send Location\t ይሄን ይጫኑ", false)]]).oneTime().resize());
    }
  })

  // Setup security feature

  bot.command('D@SH_upload', async (ctx) => {
    if (ctx.message.from.id == process.env.YOSEPH || ctx.message.from.id == process.env.TINSU) {
      connection.query('SELECT PIC, FID, TERMINAL_ID FROM atmlocation', function (error, results) {
        if (error) throw error;

        results.forEach(async (ATM_PIC) => {
          if (ATM_PIC.PIC != null && ATM_PIC.FID == null){
            var file = fs.createReadStream(__dirname+'/upload_images/'+ATM_PIC.PIC);
            var msg = await bot.telegram.sendPhoto(ctx.chat.id, {source: file});
            var file_id = msg.photo[0].file_id;
            connection.query(`UPDATE atmlocation SET FID='${file_id}' WHERE TERMINAL_ID = '${ATM_PIC.TERMINAL_ID}'`, function (error) {if (error) throw error;});
          }
        })
      })
    }
  })

  bot.on('location', async (ctx) => {
    if (ctx.message.from.id == process.env.YOSEPH || ctx.message.from.id == process.env.TINSU) {
      var ATM_DISTANCED = getAtmDist(ctx.message.location.latitude, ctx.message.location.longitude, ATM_LIST).sort((a, b) => a.dist - b.dist);
      for (var i = 0; i < ATM_DISTANCED.length && i < 5; i++){
        const ATM = ATM_DISTANCED[i];
        if (ATM.atm.PIC != null && ATM.atm.FID != null) {
          await bot.telegram.sendPhoto(ctx.chat.id, ATM.atm.FID, {caption:'🏢\t'+ATM.atm.LOCATION.toUpperCase()
            +'\n'+
            '🚶🏾‍♂️\tDistance: '+ (ATM.dist/1000 < 1 ? ATM.dist + ' m' : ATM.dist/1000 + ' km')
            +'\n'+
            `🗺\thttps://maps.google.com/?q=${ATM.atm.LATITIUDE},${ATM.atm.LONGITUDE}`}, Markup.removeKeyboard())
        }
        else {
          await bot.telegram.sendMessage(ctx.chat.id, '🏢\t'+ATM.atm.LOCATION.toUpperCase()
          +'\n'+
          '🚶🏾‍♂️\tDistance: '+ (ATM.dist/1000 < 1 ? ATM.dist + ' m' : ATM.dist/1000 + ' km')
          +'\n'+
          `🗺\thttps://maps.google.com/?q=${ATM.atm.LATITIUDE},${ATM.atm.LONGITUDE}`,Markup.removeKeyboard())
        }
      }
    }
    })

    bot.launch()
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))  
});

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
      
      // Add pic to db
      connection.query(`UPDATE atmlocation SET PIC="${tid+'.jpg'}",FID=NULL WHERE TERMINAL_ID = "${tid}"`, function (error) {
        if (error) throw error;
      })

      res.redirect("/manage?success=1");
    });
  });

  app.post('/update', (req, res) => {
    var lat = req.body.lat;
    var lon = req.body.lon;
    let tid = req.query.tid;

    // Update Location
    connection.query(`UPDATE atmlocation SET LATITIUDE=${lat}, LONGITUDE=${lon} WHERE TERMINAL_ID = "${tid}"`, function (error) {
      if (error) throw error;
    })

    res.redirect("/manage?success=1");
  })

  app.post('/remove', (req, res) => {
    let tid = req.query.tid;

    fs.unlink(__dirname + "/upload_images/" + tid + ".jpg", (err) => {
      if (err) throw err;
      // Remove from DB
      connection.query(`DELETE FROM atmlocation WHERE TERMINAL_ID = "${tid}"`, function (error) {
        if (error) throw error;
      })
    });

    res.redirect("/manage?success=1");
  })

  app.get('/manage', (req, res) => {
    connection.query('SELECT * FROM atmlocation ORDER BY LOCATION ASC', function (error, results, fields) {
      if (error) throw error;
      ATM_LIST = results;
      res.render('main',{data:ATM_LIST, control:{host:process.env.HOST, success:'hidden'}});
    });
  })

  app.post('/search', (req, res) => {
    var search_q = req.body.query;
    connection.query(`SELECT * FROM atmlocation WHERE LOCATION LIKE "%${search_q}%" ORDER BY LOCATION ASC`, function (error, results, fields) {
      if (error) throw error;
      ATM_LIST = results;
      res.render('main',{data:ATM_LIST, control:{host:process.env.HOST, success:'hidden'}});
    });
  })

  app.post('/sql', (req, res) => {
    var sql_query = req.body.sql;
    connection.query(`${sql_query}`, function (error, results, fields) {
      if (error) {
        res.render('main',{err_mess:error.message, control:{host:process.env.HOST, success:'hidden'}});
      }
      ATM_LIST = results;
      res.render('main',{data:ATM_LIST, control:{host:process.env.HOST, success:'hidden'}});
    });
  })

  app.post('/add', (req, res) => {
    
    if (!req.files || Object.keys(req.files).length === 0) {
      // return res.status(400).send('No files were uploaded.');
      connection.query(`INSERT INTO atmlocation (TERMINAL_ID, LOCATION, LATITIUDE, LONGITUDE)
        VALUES ("${req.body.terminal}", "${req.body.loc}", ${req.body.lat}, ${req.body.long})`, function (error) {
        if (error) throw error;
        
        res.redirect("/manage?success=1"); })
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    theFile = req.files.ATM_PIC;
    uploadPath = __dirname + '/upload_images/'+req.body.terminal+'.jpg';

    // Use the mv() method to place the file somewhere on your server
    theFile.mv(uploadPath, function(err) {
      if (err)
        return res.status(500).send(err);
      
        connection.query(`INSERT INTO atmlocation (TERMINAL_ID, LOCATION, LATITIUDE, LONGITUDE, PIC)
        VALUES ("${req.body.terminal}", "${req.body.loc}", ${req.body.lat}, ${req.body.long}, "${req.body.terminal}.jpg")`, function (error) {
        if (error) throw error;
        
        res.redirect("/manage");
      })
    })
  })

  // If connected successfully to the DB, listen to request
  app.listen(process.env.PORT, () => {
    console.log("Listening on 5000!")
  })