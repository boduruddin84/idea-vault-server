const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const dotenv = require("dotenv");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  next();
};

const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorize" });
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL("http://localhost:3000/api/auth/jwks"),
    );
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "http://localhost:3000", // Should match your JWT issuer, which is the BASE_URL
      audience: "http://localhost:3000", // Should match your JWT audience, which is the BASE_URL by default
    });
    req.user = payload;

    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "Unauthorize" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("idea-vault-server");
    const ideasCollection = db.collection("ideas");

    const newIdeasCollection = db.collection("newIdeas");

    app.get("/ideas", async (req, res) => {
      try {
        const { search } = req.query;

        let cursor;
        if (search) {
          cursor = ideasCollection.find({ title: search });
        } else {
          cursor = ideasCollection.find();
        }

        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching ideas", error });
      }
    });
    app.get("/trending", async (req, res) => {
      try {
        const cursor = ideasCollection.find().limit(6);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching ideas", error });
      }
    });
    app.get("/ideas/:ideaId", logger, verifyToken, async (req, res) => {
      try {
        const { ideaId } = req.params;
        const query = { _id: new ObjectId(ideaId) };
        const result = await ideasCollection.findOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching ideas", error });
      }
    });

    app.post("/newIdea", async (req, res) => {
      try {
        const ideaData = req.body;

        const result = await newIdeasCollection.insertOne(ideaData);

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to add idea",
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(8080, "0.0.0.0", () => {
  console.log(`Example app listening on port ${port}`);
});
