
import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));



import axios from "axios";

const API_URL = "<YOUR API KEY HERE>";



import pg from "pg";
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Flight_Tickets",
  password: "<YOUR PASSWORD HERE>",
  port: 5432,
});
db.connect();

await db.query(`
  CREATE TABLE IF NOT EXISTS users(
    username VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    passwd VARCHAR(30) NOT NULL
  );`
);

await db.query(`
  CREATE TABLE IF NOT EXISTS bookings(
    booking_PNR SERIAL PRIMARY KEY,
    username VARCHAR(50) REFERENCES users(username) ON DELETE CASCADE, 
    airline VARCHAR(50) NOT NULL,
    flight_Number VARCHAR(50) NOT NULL,
    departure_Airport VARCHAR(50) NOT NULL,
    departure_Time CHAR(8),
    arrival_Airport VARCHAR(50) NOT NULL,
    arrival_Time CHAR(8),
    flight_Date DATE NOT NULL,
    seat CHAR(4) NOT NULL
  );`
);


//Delete all data and start over again
//await db.query("DELETE FROM users");


const app = express();
const port = 3000;



app.use(bodyParser.urlencoded({extended:true})); 
app.use(bodyParser.json());
app.use(express.static("static"));


let loggedInUser = null;

// Make loggedInUser available in all EJS files
app.use((req, res, next) => {
  res.locals.loggedInUser = loggedInUser;
  next();
});



app.get("/", (req, res) => {
  res.render(__dirname + "/Public/home.ejs");
});



app.post("/submit", async (req,res) => {
    if (!loggedInUser) {
      res.render(__dirname + "/Public/login.ejs",{message:true});
  } else {
    let dep = req.body.departure;
    let arr = req.body.arrival;
    try{
      const api_result = await axios.get(API_URL+"&dep_iata="+dep+"&arr_iata="+arr);
      let api_data = api_result.data.data;

      api_data = api_data.filter(flight => !flight.flight.codeshared);  //To prevent showing codeshared flights

      res.render(__dirname + "/Public/home.ejs", { data : api_data} );
    }catch (error){
      res.render(__dirname + "/Public/home.ejs", {error_mssg : error.message});
    }
  }
})



app.post("/book" , (req,res)=>{
    let dep = req.body.dep;
    let dep_time = req.body.dep_time;
    let arr = req.body.arr;
    let arr_time = req.body.arr_time;
    let airline = req.body.airline;
    let flightNumber = req.body.flightNumber;
    let data = {departure : dep , departure_time : dep_time , arrival : arr , arrival_time : arr_time , airlines : airline , flight_number : flightNumber};
    res.render(__dirname + "/Public/booking.ejs" , data);
})



app.post("/saveBooking" , async (req,res)=>{
    let dep = req.body.dep;
    let dep_time = req.body.dep_time;
    let arr = req.body.arr;
    let arr_time = req.body.arr_time;
    let airline = req.body.airline;
    let flight_number = req.body.flight_number;
    let flight_date = req.body.flight_date;
    let seat = req.body.seat;

  try{
    await db.query(
      "INSERT INTO bookings (username, airline, flight_Number, departure_Airport, departure_Time, arrival_Airport, arrival_Time, flight_Date, seat) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [loggedInUser,airline,flight_number,dep,dep_time,arr,arr_time,flight_date,seat]
    );

    res.render(__dirname+"/Public/success.ejs");
  } catch(error){
    console.log(error.message);
  }
})



app.get("/userBookings", async (req,res)=> {
  let result = await db.query(
    "SELECT * FROM bookings WHERE username = $1;",[loggedInUser]
  );
  let pax_name = await db.query(
    "SELECT full_name FROM users WHERE username = $1;",[loggedInUser]
  );
  res.render(__dirname+"/Public/user.ejs", {data : result.rows, name : pax_name.rows[0].full_name});
})



app.get("/login", (req, res) => {
  res.render(__dirname + "/Public/login.ejs");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query(
      "SELECT * FROM users WHERE username = $1 AND passwd = $2",
      [username, password]
    );

    if (result.rows.length > 0) {
      loggedInUser = username;
      console.log("Login successful for user:", username);
      res.redirect("/");
    } else {
      res.render(__dirname + "/Public/login.ejs", { failed1 : true });
    }
  } catch (err) {
    console.log(err.message);
    res.render(__dirname + "/Public/login.ejs", { failed2 : true });
  }
});



app.get("/register", (req, res) => {
  res.render(__dirname + "/Public/register.ejs");
});

app.post("/register", async (req, res) => {
  const { username, pax_name, password } = req.body;

  try {
    await db.query("INSERT INTO users VALUES ($1, $2, $3)", [
      username,
      pax_name,
      password,
    ]);
    console.log("New user registered:", username);
    loggedInUser = username;
    res.redirect("/");
  } catch (err) {
    console.log(err.message);
    res.render(__dirname + "/Public/register.ejs", { failed: true });
  }
});



app.get("/logout", (req, res) => {
  loggedInUser = null;
  res.redirect("/login");
});



app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

