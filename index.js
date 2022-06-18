const { Telegraf } = require('telegraf');
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

// DB CONNECTION
// --------------------------------------------------------------------
var connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});

module.exports = connection.connect(function(err) {
  if (err) {
    console.error('Error Connecting: ' + err.stack);
    return;
  }
});

function executeQuery(conn, q) {
  conn.query(q, function (error, results, fields) {
    if (error) throw error;
    console.log(results);
  });  
}
// ----------------------------------------------------------------------

// BOT LOGIC

const bot = new Telegraf(process.env.TOKEN)

bot.on('text', (ctx) => {
  ctx.reply('ፒስ ነሽ '+ctx.message.from.first_name);
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))