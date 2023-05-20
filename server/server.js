`use strict`;

const express = require('express')
var bodyParser = require('body-parser')
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  max: 10, // limit each IP to 10 requests per minute
  windowMs: 1 * 60 * 1000, // 1 minute
  message: "Server is busy, please try again later."
});
var jsonParser = bodyParser.json()
var cors = require('cors')
const fs = require('fs');
const ytdl = require('ytdl-core');
const date = require('date-and-time');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const app = express()
// Get local IP address
const { networkInterfaces } = require('os');
const nets = networkInterfaces();
const results = Object.create(null); // Or just '{}', an empty object

const ip = "192.168.0.18";
const port = 3000;

console.log("Loading...")
const startup_time = new Date();

// Create database if it doesn't exist
let db = new sqlite3.Database('./database/u2b-dl.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the u2b-dl database.');
});
// Check if downloaded_videos table exists, if it doesn't create it
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='downloaded_videos'", (err, row) => {
  if (err) {
    console.error(err.message);
  }
  if (row == undefined) {
    db.run("CREATE TABLE downloaded_videos (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, saved_url TEXT NOT NULL, format TEXT NOT NULL, date TEXT NOT NULL, ip TEXT NOT NULL, ua TEXT NOT NULL)", (err) => {
      if (err) {
        console.error(err.message);
      }
    });
  }
});

// Every 5 minutes: delete all videos older than 15 minutes
cron.schedule('*/5 * * * *', () => {
  console.log("Cron Job: Deleting all videos older than 15 minutes... Every 5 minutes...")
  db.all("SELECT * FROM downloaded_videos", (err, rows) => {
    if (err) {
      console.error(err.message);
    }
    rows.forEach((row) => {
      let date_then = new Date(row.date);
      let date_now = new Date();
      let time_difference = date_now.getTime() - date_then.getTime();
      let minutes = Math.floor((time_difference/1000)/60);
      if (minutes > 15) {
        console.log("Deleting video " + row.saved_url + "...")
        db.run("DELETE FROM downloaded_videos WHERE saved_url = ?", [row.saved_url], (err) => {
          if (err) {
            console.error(err.message);
          }
          else {
            fs.unlink(__dirname + '/videos/video' + row.saved_url + '.mp4', (err) => {
            });
          }
        });
      }
    });
  });
});

// Middleware
app.use(cors())
app.use(limiter);

// static files
app.use(express.static(__dirname + '/../client/dist'))

// API Routes
app.get('/', (req, res) => {
  // static preact bundle
  res.sendFile(__dirname + '/../client/dist/index.html')
})

app.post('/download', jsonParser, (req, res) => {
    // get the url from the request body
    let url = req.body.url;
    let format = req.body.format;
    // get client information
    let user_ip = req.socket.remoteAddress
    let ua = req.headers['user-agent'];
    // generate a random unique id
    let uid = date.format(new Date(), 'YYYYMMDDHHmmssSSS' + "-u2b-dl");
    console.log("New Request @", date.format(new Date(), 'HH:mm:ss'));
    console.log("IP: " + user_ip);
    console.log("User Agent: " + ua);
    console.log("URL: " + url);
    console.log("Format: " + format);
    console.log("UID: " + uid);
    console.log("")

    // Check & convert youtu.be url
    // the first 17 characters of the url would be https://youtu.be/
    let url_first_17 = url.substring(0, 17);
    if (url_first_17 == "https://youtu.be/") {
      url = url.replace("https://youtu.be/", "https://www.youtube.com/watch?v=");
    }

    // Validate user input and return error if invalid
    if (url == null || url == "" || url == undefined || url.length < 1 || url.length > 100) {
      let response = {
        status: 'error',
        message: 'Invalid URL'
      }
      res.status(400).send(response);
      return;
    }
    else if (format == null || format == "" || format == undefined || format.length < 1 || format.length > 100) {
      let response = {
        status: 'error',
        message: 'Invalid media type'
      }
      res.status(400).send(response);
      return;
    }
    else if (!ytdl.validateURL(url)) {
      let response = {
        status: 'error',
        message: 'Invalid URL'
      }
      res.status(400).send(response);
      return;
    }

    // Check if the video has already been downloaded
    db.get("SELECT * FROM downloaded_videos WHERE url = ? AND format = ?", [url, format], (err, row) => {
      if (err) {
        console.error(err.message);
      }
      // If the video has already been downloaded, return the url
      if (row != undefined) {
        let response = {
          status: 'success',
          message: 'Already downloaded',
          url: `http://${ip}:${port}/watch` + row.saved_url + '.mp4'
        }
        res.status(200).send(response);
        console.log("Already downloaded.")
        return;
      }
      // If it hasn't been downloaded, add it to the database and proceed
      else if (row == undefined) {
        db.run("INSERT INTO downloaded_videos (url, saved_url, format, date, ip, ua) VALUES (?, ?, ?, ?, ?, ?)", [url, uid, format, date.format(new Date(), 'YYYY-MM-DD HH:mm:ss'), user_ip, ua], (err) => {
          if (err) {
            console.error(err.message);
          }
          else {
            console.log("Added to database.")
            // download the video to server videos folder
            ytdl(url, { filter: 'audioandvideo', quality: 'highestvideo' })
            .pipe(fs.createWriteStream(__dirname + '/videos/video' + uid + '.mp4'))
            .on('finish', () => {
              let response = {
                status: 'success',
                message: 'Downloaded',
                url: `http://${ip}:${port}/watch` + uid + '.mp4'
              }
              res.status(200).send(response);
              console.log("Completed a download.");
              return;
            }); 
          }
        });
      }
    });
})

app.get('/watch:id', (req, res) => {
    console.log(req.params.id + " has been viewed by a user.")
    res.sendFile(__dirname + '/videos/video' + req.params.id);
})

app.listen(port, () => {
  console.log(`u2b-dl API server 0.1.0`)
  console.log(`\nServer started @ ${date.format(startup_time, 'HH:mm:ss')}`)
  console.log(`http://${ip}:${port}`)
})