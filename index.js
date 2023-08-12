const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.ACCESS_SECRET) //secret key
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access email" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access verify" });
    }
    req.decoded = decoded;
    next();
  });
};

// const uri = "mongodb://localhost:27017";
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aozzirl.mongodb.net/?retryWrites=true&w=majority`;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aozzirl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {


  
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollections = client.db("CourseDb").collection("users");
    const classesCollections = client.db("CourseDb").collection("classes");
    const selectedClassesCollections = client.db("CourseDb").collection("selectedClasses");
    const paymentCollections = client.db("CourseDb").collection("payment");
    const enrolledCollection = client.db("CourseDb").collection("enrolled");

    app.get('/enrolled/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollections.find(query).sort({date: -1}).toArray();
      res.send(result);
  })



    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // get the selected classes by user
    app.get("/myselectedClasses/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const query = { selectedBy: email };

      const user = await selectedClassesCollections.find(query).toArray();
      res.send(user);
    });

    // selectedClasses add to db
    app.post("/selectedClasses", async (req, res) => {
      try {
        const selectedClass = req.body;

        // Insert the selected class into the selectedClassesCollection
        const result = await selectedClassesCollections.insertOne(
          selectedClass
        );

        res.sendStatus(200);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // DELETE selected class
    app.delete("/selectedClass/:id",  async (req, res) => {
      try {
        const selectedClassId = req.params.id;
        const query = { _id: new ObjectId(selectedClassId)  };

        // Delete the selected class
        await selectedClassesCollections.deleteOne(query);

        res.sendStatus(204); // Use 204 No Content status to indicate successful deletion
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get all classes that are approved only
    app.get("/approvedClasses", async (req, res) => {
      try {
        const approvedClasses = await classesCollections
          .find({ status: "approved" })
          .toArray();
        res.send(approvedClasses);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get all classes posted by all instructor

    app.get("/classes", async (req, res) => {
      const email = req.params.email;
      const user = await classesCollections.find().toArray();
      res.send(user);
    });

    // get classes by email
    app.get("/classes/:email",  async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const user = await classesCollections.find(query).toArray();
      res.send(user);
    });

    // approved class
    // Update the class item in the database with the "approved" status
    app.post("/classes/:classId/approve", verifyJwt, async (req, res) => {
      try {
        const classId = req.params.classId;
        await classesCollections.updateOne(
          { _id: new ObjectId(classId), status: "pending" },
          { $set: { status: "approved" } }
        );
        res.sendStatus(200);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // denyed class
    // Update the class item in the database with the "denyed" status
    app.post("/classes/:classId/deny",  async (req, res) => {
      try {
        const classId = req.params.classId;
        const feedback = req.body.feedback;
        await classesCollections.updateOne(
          { _id: new ObjectId(classId), status: "pending" },
          { $set: { status: "denied", feedback: feedback } }
        );
        res.sendStatus(200);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // add classes

    app.post("/classes", async (req, res) => {
      const newClass = req.body;

      const result = await classesCollections.insertOne(newClass);
      res.send(result);
    });

    // user added

    app.get("/users", verifyJwt, async (req, res) => {
      const result = await usersCollections.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };

        if (req.decoded.email !== email) {
          return res.send({ admin: false });
        }

        const user = await usersCollections.findOne(query);

        const result = { admin: user?.role === "admin" };
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });


    // get all popular instructor 
    app.get("/instructor",  async (req, res) => {
      const result = await usersCollections.find({role: 'instructor'}).toArray()
      res.send(result)
    })


    app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const user = await usersCollections.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollections.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollections.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollections.updateOne(filter, updatedDoc);
      res.send(result);
    });


    // payments api for updating seats and all 
    app.post('/create-payment-intent', verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
      });

      res.send({
          clientSecret: paymentIntent.client_secret
      })
  })

  app.patch('/totalStudent/:id', async (req, res) =>{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)};
    const enrollClass = await classesCollections.findOne(filter)
    const totalStudent ={
        $set:{
          totalStudents: parseInt(enrollClass.totalStudents) + 1
        }
    }
    const result = await classesCollections.updateOne(filter, totalStudent);
    res.send(result)
})

  app.post('/payments', verifyJwt, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollections.insertOne(payment);

      const query = { _id: new ObjectId(payment.selectedClass) };
      const deleteResult = await selectedClassesCollections.deleteOne(query);

      // Update the seat count for each selected class
      const filter = { _id: new ObjectId(payment.enrolledClass) };
      const options = {
          projection: {
              _id: 0,
              className: 1,
              classImage: 1,
              instructorEmail: 1,
              instructorName: 1,
              price: 1,
              seats: 1,
          },
      };

      const enrolled = await classesCollections.findOne(filter, options);
      enrolled.email = payment.email
      const enrolledResult = await enrolledCollection.insertOne(enrolled)

      const totalUpdateSeats = {
          $set: {
              seats: enrolled.seats - 1,
          },
      };
      const updateSeats = await classesCollections.updateOne(
          filter,
          totalUpdateSeats
      );

      res.send({ insertResult, deleteResult, updateSeats, enrolledResult });
  });


    // instructor class post
    // app.post('')

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("dance is start");
});

app.listen(port, () => {
  console.log(`boss is running on port ${port}`);
});
