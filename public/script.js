const audioContext = undefined;


async function fetchDataFromServer(linkEnding, callback = () => {}) {
  fetch(`https://wildflower-radio.glitch.me${linkEnding}`).then((response) => {
    response
      .text()
      .then((data) => {
        callback(data);
        return data;
      })
      .catch((err) => {
        console.log(err);
      });
  });
}
async function getTrackInfomation(func = () => {}) {
  fetchDataFromServer("/getTrackInfomation", func);
}
async function getTrackPosition(func = () => {}) {
  fetchDataFromServer("/getTrackPosition", func);
}


// start ticking song progress meter
setInterval(function () {
  getTrackPosition((pos) => {
    document.getElementById("trackProgressMeter").value = pos;
  });
}, 3000);

var audioElement = document.getElementById("audio");
audioElement.onended = function () {
  getTrackInfomation((trackObject) => {
   trackObject = JSON.parse(trackObject);
    populateUI(trackObject);
    playSegment(trackObject);
  });
};
document.getElementById("tuneInButton").onclick = () => {
  getTrackInfomation((trackObject) => {
      trackObject = JSON.parse(trackObject);
    populateUI(trackObject);
    playSegment(trackObject);

  });
};
function populateUI(trackObject){
 document.getElementById("trackProgressMeter").value =
      trackObject.track.position;
    document.getElementById("trackProgressMeter").max =
      trackObject.track.duration;
  document.getElementById("trackName").textContent =
      trackObject.track.title;
  document.getElementById("trackAuthor").textContent =
      trackObject.track.author;
}
function playSegment(trackObject){
    audioElement.src = trackObject.currentSegment.SRC;
  console.log(audioElement.src);
  console.log(trackObject);
    audioElement.currentTime = trackObject.currentSegment.position;
      audioElement.play();

}
