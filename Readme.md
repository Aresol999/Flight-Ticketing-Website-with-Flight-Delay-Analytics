# FLIGHT TICKETING WEBSITE WITH FLIGHT DELAY ANALYTICS

A full-stack, enterprise-ready web application that simulates a real-world airline ticket booking workflow. Built using Node.js, Express, EJS, and PostgreSQL, this project demonstrates production-grade engineering patterns including low-latency caching, secure cryptographic hashing, and atomic transaction handling under high concurrency.

---

## PROJECT OVERVIEW

This application models an end-to-end flight booking platform where users can securely authenticate, query live aerospace routing data, and complete seat reservations. Moving beyond standard mock-data applications, this system architecture leverages external REST APIs, implements localized caching layers to respect API rate limits, and uses strict relational data constraints to guarantee write-atomicity.

---

## ARCHITECTURAL HIGHLIGHTS & KEY FEATURES

* **Live Aviation Data Integration:** Integrates the third-party AviationStack REST API to pull real-time commercial airline schedules and routing matrices rather than relying on hardcoded stub data.
* **Upstream Data Filtering:** Automatically sanitizes upstream API responses by filtering out codeshared flights, delivering a clean, non-redundant inventory matrix to the client.
* **Low-Latency Caching Layer (Redis):** Implements Redis cache engines for route lookups (`flights:DEP-ARR`) with a 5-minute Sliding Window Expiration (`EX: 300`). This drastically reduces downstream API latency from seconds to single-digit milliseconds while shielding upstream servers from rate-limiting penalties.
* **Concurrency & High-Availability Safeguards:** Enforces database-level ACID atomicity via explicit unique relational constraints (`unique_flight_seat`). Simultaneously incoming booking requests for identical seats are handled safely, avoiding race conditions and returning a clean 409 Conflict state.
* **Cryptographic Security Foundations:** Avoids plain-text vulnerability by utilizing `bcrypt` for password salting and slow-hashing algorithms (10 salt rounds) during user provisioning and authorization stages.
* **Session-State Persistence:** Manages user session tokens statefully across application views via server-side session middleware paired with secure HTTP-only cookies.

---

## TECHNOLOGY STACK

* **Frontend Architecture:** EJS (Embedded JavaScript Templates), HTML5, CSS3 for server-side dynamic rendering.
* **Backend Architecture:** Node.js, Express.js (REST Routing Architecture).
* **Caching Engine:** Redis Cache Server.
* **Database Engine:** PostgreSQL (Relational Pooling System).
* **Tools & Protocols:** Axios HTTP Client, Bcrypt, PG Pool Manager, Body-Parser.

---

## INSTALLATION & RUN INSTRUCTIONS

### Prerequisites
* Node.js (v16+ recommended)
* PostgreSQL Server installed
* Redis Cache Server installed

### Steps to Run the Project

1. Clone the repository

2. Install Ecosystem Dependencies:

	npm install

3. Configure Environment Credentials:
	Open server.js and replace the entry placeholders with your specific AviationStack Access Key and local PostgreSQL credentials.

4. Initialize Database Instance:
	Spin up your local PostgreSQL shell and run:	

	CREATE DATABASE "Flight_Tickets";

5. Initialize Redis Cache Daemon:

	brew services start redis

6. Start the Server:
   
	cd Server
	node server.js

8. Access UI Layer:

	Launch a browser and open http://localhost:3000

--

## FUTURE DEVELOPMENT ROADMAP
* Using a message queue like Apache Kafka or Apache ActiveMQ to handle heavy user traffic.

* Cloud Native Orchestration: Containerize application blueprints with Docker and host on AWS/GCP infrastructures.

* Adding a self-built ML model for delay probability prediction.

--

## AUTHOR
Arnav Kadyan
