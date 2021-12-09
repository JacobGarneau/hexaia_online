const mongoose = require("mongoose");

if (process.argv.length < 3) {
  console.log(
    "Please provide the password as an argument: node mongo.js <password>"
  );
  process.exit(1);
}

let currencyCharges = [];
const CURRENCY_GAIN = 6;

const password = process.argv[2];
const url = `mongodb+srv://hexaia_admin:${password}@cluster0.6m0fk.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
mongoose.connect(url);
let db = mongoose.connection;

//bind to error event
//Bind connection to error event (to get notification of connection errors)
db.on("error", console.error.bind(console, "MongoDB connection error:"));

let Schema = mongoose.Schema;
let tilesetSchema = new Schema({
  tileType: String,
  path: String,
  x: Number,
  y: Number,
  z: Number,
  color: String,
});

let Tile = mongoose.model("Tile", tilesetSchema);

let express = require("express");
const portNumber = 5000;
let app = express(); //make an insatnce of express
let httpServer = require("http").createServer(app);
// create a server (using the Express framework object)
// declare io which mounts to our httpServer object (runs on top ... )
let io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:5000",
    credentials: true,
  },
});

// serving static files
let static = require("node-static"); // for serving static files (i.e. css,js,html...)

let clientIdIncrementing = 0;
let clientIds = [];

// custom route
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

// make server listen for incoming messages
httpServer.listen(portNumber, function () {
  console.log("listening on port:: " + portNumber);
});

io.on("connect", function (socket) {
  console.log("original id:: " + socket.id);

  socket.on("join", function (data) {
    clientIdIncrementing++;
    // send back the id
    socket.emit("joinedClientId", clientIdIncrementing);
    console.log("a new user with id " + clientIdIncrementing + " has entered");
    //keep track of the ids
    clientIds.push({ id: clientIdIncrementing, socketId: socket.id });
  });

  //TO SAVE DATA FROM CLIENT::
  socket.on("dataFromClient", function (data) {
    // console.log(data);

    const newTile = new Tile({
      tileType: data.tileType,
      path: data.path,
      x: data.x,
      y: data.y,
      z: data.z,
      color: data.color,
      owner: data.owner,
    });

    //save to db!
    newTile.save().then((result) => {
      console.log("new tile saved!");
      //  mongoose.connection.close()
    });
  });

  //TO UPDATE COLOR IN THE DATABASE::
  socket.on("updateColor", function (data) {
    console.log("start colorUpdate");

    let query = { x: data.x, y: data.y, z: data.z };
    let updateValue = { $set: { color: data.color } };

    db.collection("tiles").updateOne(query, updateValue, function (err) {
      if (err) throw err;
      console.log("color has been updated");
    });
  });

  //TO UPDATE TILE OWNER IN THE DATABASE::
  socket.on("claimTile", function (data) {
    console.log("start tileClaim");

    let query = { x: data.x, y: data.y, z: data.z };
    let updateValue = { $set: { owner: data.owner } };

    db.collection("tiles").updateOne(query, updateValue, function (err) {
      if (err) throw err;
      console.log("color has been updated");
    });
  });

  //TO UPDATE TILES FOR THE CLIENTS::
  socket.on("sendTileToServer", function (data) {
    io.sockets.emit("returnTileToClient", data);
    console.log(data.tileType);
    if (data.tileType === "mountain") {
      currencyCharges.push(CURRENCY_GAIN);
      socket.broadcast.emit("giveCurrency", currencyCharges.length);
      console.log(currencyCharges.length);
    }
  });

  socket.on("updateCurrency", function () {
    socket.emit("giveCurrency", currencyCharges.length);
  });

  //TO UPDATE COLORS FOR THE CLIENTS::
  socket.on("sendColorToServer", function (data) {
    io.sockets.emit("returnColorToClient", data);
  });

  //TO UPDATE TILE OWNERS FOR THE CLIENTS::
  socket.on("sendTileClaim", function (data) {
    io.sockets.emit("returnTileClaim", data);
  });

  //data is asked for ...
  socket.on("requestData", function (data) {
    //The objects are retrieved from the database with the find method
    //The parameter of the method is an object expressing search conditions.
    //Since the parameter is an empty object{}, we get all of the tiles stored in the tiles collection
    Tile.find({}).then((result) => {
      result.forEach((tile) => {
        console.log(tile);
      });
      //back to client
      socket.emit("new_data", result);
      //  mongoose.connection.close()
    });
  });

  //new for disconnect...
  socket.on("disconnect", function (data) {
    //could do other stuff here...
    console.log("client disconnected");
  });
}); //io

// serve anything from this dir ...
app.use(express.static(__dirname + "/public"));
// for the client...
app.use(express.static(__dirname + "/node_modules"));
