// DEPENDECIES
const fs = require("fs"); // for track uploading
const https = require("https"); // for track uploading
const mp3Duration = require("mp3-duration"); // for track uploading
const firebase = require("firebase/app"); // Firebase
const path = require("path");
const dotenv = require('dotenv');
dotenv.config();

// IMPORTANT - Fastly
const fastify = require("fastify")({ logger: false });
fastify.register(require("@fastify/static"), { // Setup our static files
  root: path.join(__dirname, "public"),
  prefix: "/",
});
fastify.register(require("@fastify/formbody")); // Formbody lets us parse incoming forms
fastify.register(require("@fastify/view"), { // View is a templating manager for fastify
  engine: {
    handlebars: require("handlebars"), // handlebars = .hbs
  },
});

// Configure CORS with desired options
fastify.register(require('@fastify/cors'), {
    origin: 'https://matthew-radio.glitch.me',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['X-Requested-With', 'Content-Type'],
  credentials: true // Allow cookies if needed
});

// important variables
const   getAppCheck  = require("firebase-admin/app-check");

const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
  Filter,
  ref,
} = require("firebase-admin/firestore");
// firebase storage
const {
  getStorage,
  uploadBytes,
  getDownloadURL,
} = require("firebase-admin/storage");
// Certifcations
    
const serviceAccount = {
  type: "service_account",
  project_id: "matthew-internet-radio",
  private_key_id: process.env.SERVICE_ACCOUNT_PRIVATE_KEY_ID,
  private_key:  process.env.SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\NEWLINE/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.SERVICE_ACCOUNT_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url:
process.env.CLIENT_X509_CERT_URL,
  universe_domain: "googleapis.com",
};
// Initialize Firebase
const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET_NAME,
});

const storage = getStorage(app);
async function getStorageFile(file, callback = () => {}) {
  const fileRef = getStorage()
    .bucket(process.env.FIREBASE_STORAGE_BUCKET_NAME)
    .file(file);
  const downloadURL = await getDownloadURL(fileRef);
  callback(file);
  return await downloadURL;
}

async function uploadStorageFile(
  fileName,
  filePath,
  file,
  callback = () => {}
) {
  return getStorage()
    .bucket()
    .upload(file, {
      destination: `${filePath}+${fileName}`,
      uploadType: "media",
      metadata: {
        contentType: "text",
      },
    })
    .then((data) => {
      let file = data[0];
      callback(data);
      return Promise.resolve(
        "https://firebasestorage.googleapis.com/v0/b/" +
          getStorage().bucket().name +
          "/o/" +
          encodeURIComponent(file.name)
      );
    });
}
async function deleteStorageFile(filePath, callback = () => {}) {
  return storage
    .bucket()
    .file(filePath)
    .delete()
    .then((data) => {
      callback(data);
    });
}

const db = getFirestore();

function getDatabaseFile(collection, fileName, func = () => {}) {
  db.collection(collection)
    .doc(fileName)
    .get()
    .then((doc) => {
      func(doc.data());
      return doc.data();
    });
}
function setDatabaseFile(collection, fileName, data) {
  db.collection(collection).doc(fileName).set(data);
}
//============================================================= START OF ACTUAL CODE
var trackObject = {
  currentSegment: {
    duration: undefined,
    position: undefined,
    SRC: "",
  },
  track: {
    segmentDurations: [],
    numSegments: undefined,
    numCurrentSegment: undefined,
    author: "",
    title: "",
    duration: undefined,
    position: undefined,
    SRC: "",
  },
};
var trackList = ["Seventeen", "Basquiat", "People Of The Eternal Sun"];
var trackNum = 0;
start();
function start() {
  nextTrack();
}
function nextTrack() {
  if (trackNum >= trackList.length) {
    trackNum = 0;
  }
   trackObject = {
  currentSegment: {
    duration: 0,
    position: 0,
    SRC: "",
  },
  track: {
    segmentDurations: [],
    numSegments: 0,
    numCurrentSegment: 0,
    author: "",
    title: "",
    duration: 0,
    position: 0,
    SRC: "",
  },
};
  playTrack(trackList[trackNum]);
  trackNum++;
}
function playTrack(trackTitle) {
      trackObject.track.numCurrentSegment = 0;
    trackObject.track.position = 0;
  // first, reterive the object from storage
  var trackInfo = getDatabaseFile("Tracks", trackTitle, (data) => {
    trackObject.track.numSegments = data.numChunks;
    trackObject.track.duration = data.duration;
    trackObject.track.title = data.title;
    trackObject.track.author = data.author;
    trackObject.track.SRC = data.storageReferenceURL;
    trackObject.track.segmentDurations = data.chunksDuration;
    console.log(data);
    playSegments();
  });
  ///////////////////////////////////////////// let i = 1, not zero
  async function playSegments() {
    // if problems arrize, remove the +1
    for (let i = 1; i < trackObject.track.numSegments+1; i++) {
      try {
        // Fetch segment data
       
        trackObject.currentSegment.duration = Math.trunc(
          trackObject.track.segmentDurations[i - 1]
        );
        if (trackObject.currentSegment.duration == null || undefined) {
          trackObject.currentSegment.duration == 26; // PLACEHOLDER
        }
       
        // Play the segment
        await playSegment(trackObject.currentSegment);
      } catch (error) {
        console.error(`Error! (fetching segment ${i}): ${error.message}`);
      }
    }
  }

  async function playSegment(segment) {
    trackObject.track.numCurrentSegment++;
     const segmentData = await getStorageFile(
          `${trackObject.track.SRC}/Chunk_${trackObject.track.numCurrentSegment}.mp3`
        );
        trackObject.currentSegment.SRC = segmentData;
    for (let position = 0; position <= segment.duration; position++) {
      trackObject.currentSegment.position = position;
      trackObject.track.position++;
      if (
        trackObject.track.numCurrentSegment ==
          trackObject.track.numSegments  &&
        position >= segment.duration
      ) {
        nextTrack();
        console.log("Switching Tracks");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    trackObject.currentSegment.position = 0;
  }
}

//=======================================================================================



/*
Admin only
Accesses a request from admin.hbs, downloads the mp3, splits it, and uploads it to Storage
*/
fastify.post("/getAdminInfo", function (request, reply) {
    if (request.body.authPassword !== "password") {
        return; // incorrect password
    }
    reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "POST");
    return {
        apiKey: "AIzaSyDb1QamdgLbPwmf5vT5_f76q65Qe9gvSjk",
        authDomain: "matthew-internet-radio.firebaseapp.com",
        projectId: "matthew-internet-radio",
        storageBucket: "matthew-internet-radio.appspot.com",
        messagingSenderId: "G-255690604474",
        appId: "1:255690604474:web:734de292b72a8a20b0a783",
        measurementId: "G-PNTKZ9HR35"
    };
})

fastify.post("/addTrack", function (request, reply) {
  
    if (request.body.authPassword !== "password") {
       // return; // incorrect password (disabled for the sake of debugging)
    }
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "POST");
    var trackChunkDurationArray = [];

  function uploadTrackRefToDatabase(
    request,
    trackChunkDurationArray,
    numChunks
  ) {
    setDatabaseFile("Tracks", request.body.title, {
      storageReferenceURL: `Tracks/${request.body.title}`,
        title: request.body.title,
      author: request.body.author,
      duration: request.body.duration,
      chunksDuration: trackChunkDurationArray,
      numChunks: numChunks,
    });
  }
  async function uploadMP3ToFirebase(
    filePath,
    destination,
    callback = () => {}
  ) {
    try {
      // Create a reference to the file in Firebase Storage
      const storageRef = getStorage().bucket();

      // Create a file object from the local path
      const file = fs.readFileSync(filePath);

      // Upload the file to Firebase Storage
      const uploadTask = storageRef
        .upload(filePath, {
          destination: destination, 
          uploadType: "media",
          metadata: {
            contentType: "audio/mpeg",
          },
        })
        .then((data) => {
          callback(data);
        });
    } catch (error) {
      console.error("Error uploading MP3:", error);
    }
  }
  const chunkSize = 1 * 1024 * 1024; // 1 MB chunks
  const outputDir = "chunks"; // The output directory

  if (!request.body.downloadURL) {
    console.error("Please provide a valid MP3 URL as an argument.");
    process.exit(1);
  }

  https
    .get(request.body.downloadURL, (response) => {
      if (response.statusCode !== 200) {
        console.error(`Error fetching MP3 from URL: ${response.statusCode}`);
        process.exit(1);
      }

      let currentChunk = 1;
      let chunkData = Buffer.alloc(0);

      response.on("data", (chunk) => {
        chunkData = Buffer.concat([chunkData, chunk]);
        while (chunkData.length >= chunkSize) {
          const chunkBuffer = chunkData.slice(0, chunkSize);
          chunkData = chunkData.slice(chunkSize);

          fs.mkdirSync(outputDir, { recursive: true }); // Create output directory if needed
          const chunkFilename = `chunks/chunk-${currentChunk++}.mp3`;
            console.log(`making file: chunks/chunk-${currentChunk + 1}.mp3`)
            fs.writeFileSync(chunkFilename, chunkBuffer);
            console.log(`writing file: chunks/chunk-${currentChunk + 1}.mp3`)
          uploadMP3ToFirebase(
            chunkFilename,
            `Tracks/${request.body.title}/Chunk_${currentChunk - 1}.mp3`,
            (data) => {
              // access the duration of the temporary file
              const duration = mp3Duration(chunkFilename).then((data) => {
                // console.log(data);
                  trackChunkDurationArray[trackChunkDurationArray.length] = data;
                  console.log("uploading track data to IB database");
                setDatabaseFile("Tracks", request.body.title, {
                  storageReferenceURL: `Tracks/${request.body.title}`,
                  title: request.body.title,
                  author: request.body.author,
                  duration: request.body.duration,
                  chunksDuration: trackChunkDurationArray,
                  numChunks: currentChunk - 1,
                });
                fs.unlinkSync(chunkFilename);
              });
            }
          );
          console.log(`Chunk ${currentChunk - 1} saved to: ${chunkFilename}`);
        }
      });

      response.on("end", () => {
        // Write remaining data if any
        if (chunkData.length > 0) {
          const chunkFilename = `chunks/chunk-${currentChunk++}.mp3`;
          const duration = mp3Duration(chunkFilename).then((data) => {
            trackChunkDurationArray[trackChunkDurationArray.length] = data;
          });
          fs.writeFileSync(chunkFilename, chunkData);
          uploadMP3ToFirebase(
            chunkFilename,
            `Tracks/${request.body.title}/Chunk_${currentChunk - 1}.mp3`,
            (data) => {
              fs.unlinkSync(chunkFilename);
              // Delete the inital mp3 file
              deleteStorageFile(
                "Tracks/FreshlyUploadedMP3File",
                console.log("file Deleted")
              );
            }
          );
          console.log(`Chunk ${currentChunk - 1} saved to: ${chunkFilename}`);
        }

        console.log("MP3 splitting complete!");
      });
    })
    .on("error", (error) => {
      console.error(`Error splitting MP3: ${error.message}`);
      process.exit(1);
    });

  return; // Return nothing
});

// Returns the entire trackObject
fastify.get("/getTrackInfomation", function (request, reply) {

  return trackObject;
});
// Returns only the position of the track
fastify.get("/getTrackPosition", function (request, reply) {
  return trackObject.track.position;
});
fastify.get("/getSegmentPosition", function (request, reply) {
  return trackObject.currentSegment.position;
});
// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
