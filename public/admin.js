const firebaseConfig = {
  apiKey: "AIzaSyDb1QamdgLbPwmf5vT5_f76q65Qe9gvSjk",
  authDomain: "matthew-internet-radio.firebaseapp.com",
  projectId: "matthew-internet-radio",
  storageBucket: "matthew-internet-radio.appspot.com",
  messagingSenderId: "G-255690604474",
  appId: "1:255690604474:web:734de292b72a8a20b0a783",
  measurementId: "G-PNTKZ9HR35",
};
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-analytics.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

firebase.initializeApp(firebaseConfig);
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage = firebase.storage();
/*
Get's data from firebase
filename - the name of the file to get
userCode - the user's Id
func - a function that is ran inside of this function
*/
function getGlobalData(fileName, func = () => {}) {
  const storageRef = storage.ref(`/Global Sets`);
  storageRef
    .child(fileName)
    .getDownloadURL()
    .then((url) => {
      fetch(url)
        .then((response) => response.text())
        .then((data) => {
          func(data);
          return data;
        });
    })
    .catch((error) => {
      // A full list of error codes is available at https://firebase.google.com/docs/storage/web/handle-errors
      func(undefined);
      return undefined;
    });
}
function setGlobalData(fileName, data) {
  const storageRef = storage.ref(`/Global Sets`);
  storageRef
    .child(fileName)
    .put(data)
    .then((snapshot) => {
      console.log("Uploaded a raw string!");
    });
}
function getData(fileName, userCode, func = () => {}) {
  const storageRef = storage.ref(`/Users/${userCode}`);
  storageRef
    .child(fileName)
    .getDownloadURL()
    .then((url) => {
      fetch(url)
        .then((response) => response.text())
        .then((data) => {
          func(data);
          return data;
        });
    })
    .catch((error) => {
      // A full list of error codes is available at https://firebase.google.com/docs/storage/web/handle-errors
      func(undefined);
      return undefined;
    });
}
function setData(fileName, data, func = () => {}) {
  const storageRef = storage.ref(`/Tracks/`);
  storageRef
    .child(fileName)
    .put(data)
    .then((snapshot) => {
      func(snapshot);
      console.log("Uploaded a raw string!");
    });
}
document.body.onload = () => {
      populateCurrentTrack();

  setInterval(() => {
    populateCurrentTrack();
  }, 3000);
};
function populateCurrentTrack() {
  fetch("https://wildflower-radio.glitch.me/getTrackInfomation").then(
    (trackObject) => {
      trackObject.text().then((trackObject) => {
        trackObject = JSON.parse(trackObject);
        document.getElementById("trackProgressMeter").value =
          trackObject.track.position;
        document.getElementById("trackProgressMeter").max =
          trackObject.track.duration;
        document.getElementById("trackName").textContent =
          trackObject.track.title;
        /*{"currentSegment":{"duration":40,"position":0,"SRC":,
  "track":{"segmentDurations":[32.313,28.918,28.918,33.097,42.423,35.004,40.255],
  "numSegments":8,"numCurrentSegment":7,"author":"wsdefrgthnytgrfedwsd","title":"TESTTTTTTTTTRJDCFD",
  "duration":242,"position":245,"SRC":"Tracks/TESTTTTTTTTTRJDCFD"}}*/
        document.getElementById("trackAuthor").textContent =
          trackObject.track.author;

        document.getElementById("currentSegment").textContent =
          trackObject.track.numCurrentSegment;
        document.getElementById("trackNumSegments").textContent =
          trackObject.track.numSegments;
        document.getElementById("currentSegmentPosition").textContent =
          trackObject.currentSegment.position;
        document.getElementById("segmentDuration").textContent =
          trackObject.currentSegment.duration;
        document.getElementById("currentTrackPosition").textContent =
          trackObject.track.position;
        document.getElementById("trackDuration").textContent =
          trackObject.track.duration;
      });
    }
  );
}

document.getElementById("submit").onclick = () => {
  setData(
    "FreshlyUploadedMP3File",
    document.getElementById("trackFileInput").files[0],
    (data) => {
      document.getElementById("trackDurationExtractor").src = data.downloadURL;
      document
        .getElementById("trackDurationExtractor")
        .play()
        .then((e) => {
          var dataToSendToServer = {
            downloadURL: data.downloadURL,
            title: document.getElementById("trackTitleInput").value,
            author: document.getElementById("trackAuthorInput").value,
            duration: Math.trunc(
              document.getElementById("trackDurationExtractor").duration
            ),
          };
          document.getElementById("trackDurationExtractor").pause();
          // send the data to the server
          fetch("https://wildflower-radio.glitch.me/addTrack", {
            method: "POST",
            body: JSON.stringify(dataToSendToServer),
            headers: {
              "Content-type": "application/json; charset=UTF-8",
            },
          });
        });
    }
  );
};
