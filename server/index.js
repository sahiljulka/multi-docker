const keys = require("./keys");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const redis = require("redis");

const PORT = 5000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.listen(PORT, () => {
  console.log(`Listening on Port ${PORT}`);
});

const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("error", () => console.log("Lost PG Connection"));

pgClient
  .query("CREATE TABLE IF NOT EXISTS values (number INT)")
  .catch((err) => console.log(err));

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});

const redisPublisher = redisClient.duplicate();

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * from values");
  res.send(values.rows);
});

app.get("/values/current", (req, res) => {
  redisClient.hgetall("values", (err, values) => res.send(values));
});

app.post("/addValue", async (req, res) => {
  const index = req.body.index;
  if (index > 40) return res.status(422).send("Index too High");

  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);
  res.send({ working: true });
});
