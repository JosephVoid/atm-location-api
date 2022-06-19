const { Telegraf, Markup } = require('telegraf');
const mysql = require('mysql2');
const dotenv = require('dotenv');
const getAtmDist = require('./helpers');
dotenv.config();

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

connection.query('SELECT * FROM atms', function (error, results, fields) {
  if (error) throw error;
  ATM_LIST = results;
  
  // BOT LOGIC
  const bot = new Telegraf(process.env.TOKEN)

  bot.command('start', (ctx) => {
    ctx.reply('Send us you location, so we know where you are...');
  })

  bot.on('location', (ctx) => {
    var ATM_DISTANCED = getAtmDist(ctx.message.location.latitude, ctx.message.location.longitude, ATM_LIST).sort((a, b) => a.dist - b.dist);
    for (var i = 0; i < ATM_DISTANCED.length && i < 3; i++){
      const ATM = ATM_DISTANCED[i];
      bot.telegram.sendMessage(ctx.chat.id, ATM.atm.name
      +'\n'+
      'Distance: '+
      ATM.dist
      /1000 + 'km'
      +'\n'+ `\xF0\x9F\x8E\xB1` +
      `https://maps.google.com/?q=${ATM.atm.lat},${ATM.atm.lon}`)
    }
  })

  bot.launch()

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))  
});
