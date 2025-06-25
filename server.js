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
    origin: 'https://matthew-radio.netlify.app',
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
        trackList: ["Inspiration","Cheeky Tuesday","Sweeping Broomstick","Call to Fly","Slow Your Role","Soul of Galveston","Sunday Reflections","The Day is Long","Seventeen", "People Of The Eternal Sun","Another Banger"],
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
     {
    name: "Hue Jazz",
    trackList: ["Don't Say No","Let's Hang","Sista Jane_Jazz Quartet","Slow Your Role","Soul of Galveston","Sunday Reflections","The Day is Long","The Race","Soul of Whicita","Funky Travel Middle","This Casino","It's Nice and I like It"],
    trackNum: 0,
    trackObject: { // Track object specific to this radio station
        currentSegment: { duration: undefined, position: undefined, SRC: "" },
        track: { segmentDurations: [], numSegments: undefined, numCurrentSegment: undefined, author: "", title: "", duration: undefined, position: undefined, SRC: "" },
    },
}, {
    name: "Meet Mindseye",
    trackList: ["Mindseye - A Vibe Nostalgic","Mindseye - Atlantic","Mindseye - Atlantic","Mindseye - Echoes","Mindseye - Feel like Home","Mindseye - Intersteller","Mindseye - Leave the Atmosphere","Mindseye - Luminescent","Mindseye - Meliora","Mindseye - Orion","Mindseye - Stratosphere"],
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
  let currentTrackIndex = 0; // Use an index for track management

  function nextTrack(radio) {
    currentTrackIndex = (currentTrackIndex + 1) % radio.trackList.length; // Wrap around
    const trackTitle = radio.trackList[currentTrackIndex];

    console.log(`⏭️ | ${radio.name} - Playing next track (Track #${currentTrackIndex + 1}): ${trackTitle}`);

    radio.trackObject = {  // Reset the ENTIRE trackObject
      currentSegment: { duration: 0, position: 0, SRC: "" },
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

    playTrack(radio, trackTitle);
  }

  async function playTrack(radio, trackTitle) {
    console.log(`🎵 | ${radio.name} - Playing track: ${trackTitle}`);

    try {
      const trackData = await new Promise((resolve, reject) => { // Use Promise for getDatabaseFile
        getDatabaseFile("Tracks", trackTitle, (data) => resolve(data));
      });

      radio.trackObject.track.numSegments = trackData.numChunks;
      radio.trackObject.track.duration = trackData.duration;
      radio.trackObject.track.title = trackData.title;
      radio.trackObject.track.author = trackData.author;
      radio.trackObject.track.SRC = trackData.storageReferenceURL;
      radio.trackObject.track.segmentDurations = trackData.chunksDuration;

      await playSegments(radio); // Wait for all segments to play
      nextTrack(radio); // Go to the next track *after* playSegments completes
    } catch (error) {
      console.error(`🔥 | ERROR - Getting track data: ${error.message}`);
      nextTrack(radio); // Even on error, proceed to the next track
    }
  }

  async function playSegments(radio) {
    radio.trackObject.track.numCurrentSegment = 0;
    let currentTrackPosition = 0;

    for (let i = 1; i <= radio.trackObject.track.numSegments; i++) {
      try {
        radio.trackObject.currentSegment.duration = Math.trunc(
          radio.trackObject.track.segmentDurations[i - 1]
        );
        if (!radio.trackObject.currentSegment.duration) {
          console.warn(`⚠️ | WARN - Segment #${i} duration missing.`);
            // FIRST attempt, only works if this is the last chunk
            if(radio.trackObject.numCurrentSegment >= radio.trackObject.numSegments) {
                          radio.trackObject.currentSegment.duration = 1 + (radio.trackObject.track.duration - ( radio.trackObject.numCurrentSegment * (radio.trackObject.numSegments - 1)));
                console.log("RECIFING with last segment duration calculations (safe)")
            } else {
                // so we may not be at the last segment, lets use the one before us as a placeholder
                if (radio.trackObject.numCurrentSegment != 0) {
                radio.trackObject.currentSegment.duration = radio.trackObject.track.segmentDurations[radio.trackObject.numCurrentSegment - 1];
                    console.log("RECIFING using previous segment length")
                } else {
                    // there is nothing we can do
                              radio.trackObject.currentSegment.duration = 28;
                                        console.log("RECIFING FAILED. Forcing duration to be 28 seconds")

                }
            }
        }
        await playSegment(radio, radio.trackObject.currentSegment, currentTrackPosition);
        currentTrackPosition += radio.trackObject.currentSegment.duration;
      } catch (error) {
        console.error(`🔥 | ERROR - Playing segment #${i}: ${error.message}`);
        // Consider if you want to skip the segment or the entire track on error
      }
    }
  }

  async function playSegment(radio, segment, trackPosition) {
    // ... (same as before, but with the crucial position updates and logging)
    console.log(`🎵 | ${radio.name} - Playing segment #${radio.trackObject.track.numCurrentSegment}`);
      radio.trackObject.track.numCurrentSegment++;
      const segmentData = await getStorageFile(
        `${radio.trackObject.track.SRC}/Chunk_${radio.trackObject.track.numCurrentSegment}.mp3`
      );
      radio.trackObject.currentSegment.SRC = segmentData;
      radio.trackObject.currentSegment.position = 0; // Reset segment position HERE

      // Simulate playback and position tracking (REPLACE THIS WITH ACTUAL AUDIO PLAYBACK LOGIC)
      for (let position = 0; position < segment.duration; position++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate 1-second increments
        radio.trackObject.currentSegment.position = position + 1;
        radio.trackObject.track.position = trackPosition + position + 1; // Update total track position
        console.log(`${radio.name} - Track Position: ${radio.trackObject.track.position}, Segment Position: ${radio.trackObject.currentSegment.position}`);
      }
  }

  nextTrack(radioStation); // Start the first track
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
const chunkSize = 0.25 * 1024 * 1024; // 1/4 MB chunks
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
            trackChunkDurationArray.push(data);
            chunkMediaDurationArray.push(data);
             setDatabaseFile("Tracks", request.body.title, {
                storageReferenceURL: `Tracks/${request.body.title}`,
                title: request.body.title,
                author: request.body.author,
                duration: request.body.duration,
                chunksDuration: trackChunkDurationArray,
                numChunks: currentChunk - 1,
              });
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
