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

async function uploadStorageFile(fileName, filePath, file, callback = () => { }) {
    return getStorage()
        .bucket()
        .upload(file, {
            destination: `<span class="math-inline">\{filePath\}\+</span>{fileName}`,
            uploadType: "media",
            metadata: {
                contentType: "text",
            },
        })
        .then((data) => {
            let file = data[0];
            callback(data);
            console.log(`⬆️ | Uploading <span class="math-inline">\{filePath\}/</span>{fileName} to storage`)
            return Promise.resolve(
                "https://firebasestorage.googleapis.com/v0/b/" +
                getStorage().bucket().name +
                "/o/" +
                encodeURIComponent(file.name)
            );
        });
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
    console.log(`🗒️ | Setting <span class="math-inline">\{collection\}/</span>{fileName} to: \n ${data}`)
    db.collection(collection).doc(fileName).set(data);
}

//============================================================= START OF ACTUAL CODE

var RadioManager = [
    {
        name: "Radio Wildflower",
        trackList: ["Seventeen", "Basquiat", "People Of The Eternal Sun"],
        trackNum: 0,
        trackObject: {  // Track object specific to this radio station
            currentSegment: { duration: undefined, position: undefined, SRC: "" },
            track: { segmentDurations: [], numSegments: undefined, numCurrentSegment: undefined, author: "", title: "", duration: undefined, position: undefined, SRC: "" },
        },
    },
    {
        name: "Test Radio",
        trackList: ["Basquiat", "People Of The Eternal Sun", "Seventeen"],
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

        console.log(`⏭️ | Playing next track (Track #${radio.trackNum}) on ${radio.name}`);
        playTrack(radio, radio.trackList[radio.trackNum]);
        radio.trackNum++;
    }

    function playTrack(radio, trackTitle) {
        console.log(`🎵 | Playing track: ${trackTitle} on ${radio.name}`);
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
            for (let i = 1; i < radio.trackObject.track.numSegments + 1; i++) {
                try {
                    radio.trackObject.currentSegment.duration = Math.trunc(radio.trackObject.track.segmentDurations[i - 1]);
                    if (radio.trackObject.currentSegment.duration == null || undefined) {
                        console.warn(`⚠️ | Track segment #${i} doesn't have a set duration!!`);
                        radio.trackObject.currentSegment.duration = 26; // PLACEHOLDER
                    }
                    await playSegment(radio, radio.trackObject.currentSegment);
                } catch (error) {
                    console.error(`🔥 | Failed fetching segment ${i}! : ${error.message}`);
                }
            }
        }

        async function playSegment(radio, segment) {
            console.log(`🎵 |  Playing segment #${radio.trackObject.track.numCurrentSegment} on ${radio.name}`);
            radio.trackObject.track.numCurrentSegment++;
            const segmentData = await getStorageFile(`<span class="math-inline">\{radio\.trackObject\.track\.SRC\}/Chunk\_</span>{radio.trackObject.track.numCurrentSegment}.mp3`);
            radio.trackObject.currentSegment.SRC = segmentData;

            for (let position = 0; position <= segment.duration; position++) {
              // dfrds
                radio.trackObject.currentSegment.position = position;
                radio.trackObject.track.position++;
                if (
                    radio.trackObject.track.numCurrentSegment == radio.trackObject.track.numSegments &&
                    position >= segment.duration
                ) {
                    nextTrack(radio);
                    console.log(`Switching Tracks on ${radio.name}`);
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