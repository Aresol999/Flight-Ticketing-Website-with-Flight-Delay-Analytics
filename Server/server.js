import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcrypt";
import axios from "axios";
import pg from "pg";
import { createClient } from "redis"; 

const __dirname = dirname(fileURLToPath(import.meta.url));
const saltRounds = 10; 

const API_URL = "https://api.aviationstack.com/v1/flights?access_key=6dffdce50a5e416fbef2e265be5c3275";


const redisClient = createClient({
  url: "redis://127.0.0.1:6379" 
});
redisClient.on("error", err => console.log("Redis Client Error", err));
await redisClient.connect();
console.log("Connected successfully to Redis Cache Engine");


const db = new pg.Pool({
  user: "postgres",
  host: "localhost",
  database: "Flight_Tickets",
  password: "123456",
  port: 5432,
  max: 20 
});


//Delete everything and start over again
//await db.query(`DROP TABLE IF EXISTS bookings CASCADE;`);
//await db.query(`DROP TABLE IF EXISTS users CASCADE;`);


await db.query(`
  CREATE TABLE IF NOT EXISTS users(
    username VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    passwd VARCHAR(60) NOT NULL
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
    seat CHAR(4) NOT NULL,
    CONSTRAINT unique_flight_seat UNIQUE (flight_Number, flight_Date, seat)
  );`
);

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());
app.use(express.static("static"));


app.use(session({
  secret: "flight_ticket_secret_key", 
  resave: false,                     
  saveUninitialized: false,          
  cookie: { maxAge: 24 * 60 * 60 * 1000 } 
}));


app.use((req, res, next) => {
  res.locals.loggedInUser = req.session.username || null; 
  next();
});


app.get("/", (req, res) => {
  res.render(__dirname + "/Public/home.ejs");
});


app.post("/submit", async (req, res) => {
  if (!req.session.username) { 
    return res.render(__dirname + "/Public/login.ejs", { message: true });
  }

  const dep = req.body.departure;
  const arr = req.body.arrival;
  const cacheKey = `flights:${dep}-${arr}`; 

  try {
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      console.log(`[Redis HIT] Instant lookup for route: ${cacheKey}`);
      return res.render(__dirname + "/Public/home.ejs", { data: JSON.parse(cachedData) });
    }

    console.log(`[Redis MISS] Querying Aviationstack API for route: ${cacheKey}...`);
    const api_result = await axios.get(API_URL + "&dep_iata=" + dep + "&arr_iata=" + arr);
    let api_data = api_result.data.data;

    // Filter out codeshared flights
    api_data = api_data.filter(flight => !flight.flight.codeshared); 

    await redisClient.set(cacheKey, JSON.stringify(api_data), {
      EX: 300 
    });

    res.render(__dirname + "/Public/home.ejs", { data: api_data });
  } catch (error) {
    console.log("Error in /submit route:", error.message);
    res.render(__dirname + "/Public/home.ejs", { error_mssg: error.message });
  }
});

app.post("/book", (req, res) => {
  let data = {
    departure: req.body.dep, 
    departure_time: req.body.dep_time, 
    arrival: req.body.arr, 
    arrival_time: req.body.arr_time, 
    airlines: req.body.airline, 
    flight_number: req.body.flightNumber
  };
  res.render(__dirname + "/Public/booking.ejs", data);
});

app.post("/saveBooking" , async (req,res)=>{
  if (!req.session.username) return res.redirect("/login");

  let { dep, dep_time, arr, arr_time, airline, flight_number, flight_date, seat } = req.body;
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "INSERT INTO bookings (username, airline, flight_Number, departure_Airport, departure_Time, arrival_Airport, arrival_Time, flight_Date, seat) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [req.session.username, airline, flight_number, dep, dep_time, arr, arr_time, flight_date, seat]
    );

    await client.query("COMMIT");
    res.render(__dirname + "/Public/success.ejs");

  } catch (error) {
    await client.query("ROLLBACK");
    console.log("[Transaction Aborted] Error code:", error.code);

    if (error.code === "23505") {
      res.status(409).send("Reservation Conflict: This seat has already been locked down by another passenger.");
    } else {
      res.status(500).send("Database transaction processing failure.");
    }
  } finally {
    client.release();
  }
});

app.get("/userBookings", async (req, res) => {
  if (!req.session.username) return res.redirect("/login"); 

  try {
    const queryText = `
      SELECT b.*, u.full_name 
      FROM users u 
      LEFT JOIN bookings b ON u.username = b.username 
      WHERE u.username = $1;
    `;
    const result = await db.query(queryText, [req.session.username]);
    
    const fullName = result.rows.length > 0 ? result.rows[0].full_name : "User";
    const bookingsData = (result.rows.length > 0 && result.rows[0].booking_pnr) ? result.rows : [];

    res.render(__dirname + "/Public/user.ejs", { data: bookingsData, name: fullName });
  } catch (err) {
    console.log(err.message);
    res.redirect("/");
  }
});

app.get("/login", (req, res) => {
  res.render(__dirname + "/Public/login.ejs");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.passwd);

      if (isPasswordValid) {
        req.session.username = username; 
        console.log("Login successful for user:", username);
        res.redirect("/");
      } else {
        res.render(__dirname + "/Public/login.ejs", { failed1: true });
      }
    } else {
      res.render(__dirname + "/Public/login.ejs", { failed1: true });
    }
  } catch (err) {
    console.log(err.message);
    res.render(__dirname + "/Public/login.ejs", { failed2: true });
  }
});

app.get("/register", (req, res) => {
  res.render(__dirname + "/Public/register.ejs");
});

app.post("/register", async (req, res) => {
  const { username, pax_name, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.query(
      "INSERT INTO users (username, full_name, passwd) VALUES ($1, $2, $3)", 
      [username, pax_name, hashedPassword]
    );
    
    console.log("New user registered securely:", username);
    req.session.username = username;
    res.redirect("/");
  } catch (err) {
    console.log(err.message);
    res.render(__dirname + "/Public/register.ejs", { failed: true });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log("Error destroying session:", err);
    res.redirect("/login");
  });
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});