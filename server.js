// DEPENDECIES
const fs = require("fs");
const https = require("https");
const mp3Duration = require("mp3-duration");
const firebase = require("firebase/app");
const path = require("path");
const dotenv = require('dotenv');
dotenv.config();
 
// IMPORTANT - Fastly
const fastify = require("fastify")({ logger: false });
fastify.register(require("@fastify/static"), {
    root: path.join(__dirname, "public"),
    prefix: "/",
});
fastify.register(require("@fastify/formbody"));
fastify.register(require("@fastify/view"), {
    engine: {
        handlebars: require("handlebars"),
    },
});

fastify.register(require('@fastify/cors'), {
    origin: 'https://matthew-radio.glitch.me',
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['X-Requested-With', 'Content-Type'],
    credentials: true
});

const getAppCheck = require("firebase-admin/app-check");

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
const {
    getStorage,
    uploadBytes,
    getDownloadURL,
} = require("firebase-admin/storage");

const serviceAccount = {
    type: "service_account",
    project_id: "matthew-internet-radio",
    private_key_id: process.env.SERVICE_ACCOUNT_PRIVATE_KEY_ID,
    private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\NEWLINE/g, '\n'),
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.SERVICE_ACCOUNT_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    universe_domain: "googleapis.com",
};

const app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET_NAME,
});

const storage = getStorage(app);

async function getStorageFile(file, callback = () => { }) {
    const fileRef = getStorage()
        .bucket(process.env.FIREBASE_STORAGE_BUCKET_NAME)
        .file(file);
    const downloadURL = await getDownloadURL(fileRef);
    callback(file);
    return await downloadURL;
}


async function deleteStorageFile(filePath, callback = () => { }) {
    return storage
        .bucket()
        .file(filePath)
        .delete()
        .then((data) => {
            callback(data);
        });
}

const db = getFirestore();

function getDatabaseFile(collection, fileName, func = () => { }) {
    db.collection(collection)
        .doc(fileName)
        .get()
        .then((doc) => {
            func(doc.data());
            return doc.data();
        });
}

function setDatabaseFile(collection, fileName, data) {
    console.log(`🗒️ | Setting /{collection}/{fileName} to: \n ${data}`)
    db.collection(collection).doc(fileName).set(data);
}

//============================================================= START OF ACTUAL CODE

var RadioManager = [
    {
        name: "Radio Wildflower",
        trackList: ["Seventeen", "People Of The Eternal Sun"],
        trackNum: 0,
        trackObject: {  // Track object specific to this radio station
            currentSegment: { duration: undefined, position: undefined, SRC: "" },
            track: { segmentDurations: [], numSegments: undefined, numCurrentSegment: undefined, author: "", title: "", duration: undefined, position: undefined, SRC: "" },
        },
    },
    {
      name: "Alarm Hub",
      trackList: ["Untitled Alarm","Untitled Alarm"],
      trackNum: 0,
      trackObject: { // Track object specific to this radio station
          currentSegment: { duration: undefined, position: undefined, SRC: "" },
          track: { segmentDurations: [], numSegments: undefined, numCurrentSegment: undefined, author: "", title: "", duration: undefined, position: undefined, SRC: "" },
      },
  },
  {
    name: "Legion Lofi",
    trackList: ["Wings of Dawn","Call to Fly","Into the Sky","Storm on the Horizon","Engage","Systems Critical","Alone at Altitude","Into the Inferno","Defensive Maneuvers","Burning Sky","Final Descent","The Quiet Below","Eagles and Metal"],
    trackNum: 0,
    trackObject: { // Track object specific to this radio station
        currentSegment: { duration: undefined, position: undefined, SRC: "" },
        track: { segmentDurations: [], numSegments: undefined, numCurrentSegment: undefined, author: "", title: "", duration: undefined, position: undefined, SRC: "" },
    },
},
];

function start() {
    RadioManager.forEach(radio => playRadioStation(radio)); // Play all stations simultaneously
}


function playRadioStation(radioStation) {
    function nextTrack(radio) {
        if (radio.trackNum >= radio.trackList.length) {
            radio.trackNum = 0;
        }

        radio.trackObject = {  // Reset track object
            currentSegment: { duration: 0, position: 0, SRC: "" },
            track: { segmentDurations: [], numSegments: 0, numCurrentSegment: 0, author: "", title: "", duration: 0, position: 0, SRC: "" },
        };

        console.log(`⏭️ | ${radio.name} - Playing next track (Track #${radio.trackNum})`);
        playTrack(radio, radio.trackList[radio.trackNum]);
        radio.trackNum++;
    }

    function playTrack(radio, trackTitle) {
        console.log(`🎵 | ${radio.name} - Playing track: ${trackTitle}`);
        radio.trackObject.track.numCurrentSegment = 0;
        radio.trackObject.track.position = 0;

        getDatabaseFile("Tracks", trackTitle, (data) => {
            radio.trackObject.track.numSegments = data.numChunks;
            radio.trackObject.track.duration = data.duration;
            radio.trackObject.track.title = data.title;
            radio.trackObject.track.author = data.author;
            radio.trackObject.track.SRC = data.storageReferenceURL;
            radio.trackObject.track.segmentDurations = data.chunksDuration;
            console.log(data);
            playSegments(radio);
        });

        async function playSegments(radio) {
            for (let i = 1; i < radio.trackObject.track.numSegments+1; i++) {
                try {
                    radio.trackObject.currentSegment.duration = Math.trunc(radio.trackObject.track.segmentDurations[i - 1]);
                    if (radio.trackObject.currentSegment.duration == null || undefined) {
                        console.warn(`⚠️ | WARN - Track segment #${i} doesn't have a set duration, using default duration`);
                        radio.trackObject.currentSegment.duration = 26; // PLACEHOLDER
                    }
                    await playSegment(radio, radio.trackObject.currentSegment);
                } catch (error) {
                    console.error(`🔥 | ERROR - Failed fetching segment #${i} : ${error.message}`);
                }
            }
        }

        async function playSegment(radio, segment) {
            console.log(`🎵 |  ${radio.name} - Playing segment #${radio.trackObject.track.numCurrentSegment} `);
            radio.trackObject.track.numCurrentSegment++;
            const segmentData = await getStorageFile(`${radio.trackObject.track.SRC}/Chunk_${radio.trackObject.track.numCurrentSegment}.mp3`);
            radio.trackObject.currentSegment.SRC = segmentData;

            for (let position = 0; position <= segment.duration; position++) {
              // dfrds
                radio.trackObject.track.position++;
                                radio.trackObject.currentSegment.position = position;
// NOTE REPLACE radio.trackObject.track.numCurrentSegment > radio.trackObject.track.numSegments WITH radio.trackObject.track.numCurrentSegment >= radio.trackObject.track.numSegments IF TROUBLE HAPPENS
                if (
                    radio.trackObject.track.numCurrentSegment > radio.trackObject.track.numSegments || radio.trackObject.track.position >=radio.trackObject.track.duration
                ) {
                    nextTrack(radio);
                    console.log(`Switching Tracks on ${radio.name}`);
                                                    radio.trackObject.currentSegment.position = 0;

                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
                                            radio.trackObject.currentSegment.position = 0;

        }
    }

    nextTrack(radioStation); // Start playing the first track for this station
}



// ... (Admin routes remain the same)

// Returns track information for *all* radio stations
fastify.get("/getAllTrackInformation", function (request, reply) {
    const allTrackInfo = {};
    RadioManager.forEach(radio => {
        allTrackInfo[radio.name] = radio.trackObject;
    });
    return allTrackInfo;
});

// Returns track position for *all* radio stations
fastify.get("/getAllTrackPositions", function (request, reply) {
    const allTrackPositions = {};
    RadioManager.forEach(radio => {
        allTrackPositions[radio.name] = radio.trackObject.track.position;
    });
    return allTrackPositions;
});


// Returns segment position for *all* radio stations
fastify.get("/getAllSegmentPositions", function (request, reply) {
    const allSegmentPositions = {};
    RadioManager.forEach(radio => {
        allSegmentPositions[radio.name] = radio.trackObject.currentSegment.position;
    });
    return allSegmentPositions;
});

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
    console.log("🔘 | Trying to upload Track Ref to Database");
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
  var chunkMediaDurationArray = [];
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
                chunkMediaDurationArray.push(data);
                console.log("uploading track data to IB database");
                //uploading track data to IB database
               // uploadTrackRefToDatabase(request, trackChunkDurationArray, numChunks);
              
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
            chunkMediaDurationArray.push(data);
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
              console.log("🚮 | Deleted source MP3 successfully")
              );
            
              uploadTrackRefToDatabase(request, chunkMediaDurationArray, chunkMediaDurationArray.length-1);
          }
        );
        console.log(`☑️ | Chunk #${currentChunk - 1} saved to: ${chunkFilename}`);
      }

      console.log("✅ | MP3 splitting complete!");
    });
  })
  .on("error", (error) => {
    console.error(`‼️ | Error splitting MP3: ${error.message}`);
    process.exit(1);
  });

return; // Return nothing
});
// Run the server and report out to the logs
fastify.listen(
    { port: process.env.PORT, host: "0.0.0.0" },
    function (err, address) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`🟢 | Server starting on ${address}`);
        start(); // Start playing all radio stations
    }
);
