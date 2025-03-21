import './style.css'
import {default as Pillarbox} from "@srgssr/pillarbox-web";

let status = "off";
const player = Pillarbox('main-player', {controls: false, autoplay: true, muted: true});
const startButton = document.getElementsByClassName('start-btn')[0];

let syncInterval;
let mediaRecorder;
let stream;

function updateStatus(newStatus) {
  startButton.classList.remove('listen', 'loading', 'start', 'playing');
  status = newStatus
  switch (status) {
    case "off":
      startButton.setAttribute("aria-label", "Start listening...");
      startButton.classList.add('listen');
      break;
    case "loading":
      startButton.setAttribute("aria-label", "Listening, please wait...");
      startButton.classList.add('loading');
      break;
    case "ready":
      startButton.setAttribute("aria-label", "Playback ready. Press to start.");
      startButton.classList.add('start');
      break;
    case "playing":
      startButton.setAttribute("aria-label", "Playing audio...");
      startButton.classList.add('playing');
      break;
    default:
      startButton.setAttribute("aria-label", "Unknown state");
  }
}


function stopSyncDetection() {
  console.log("stop");
  clearInterval(syncInterval);
  syncInterval = undefined;

  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = undefined;
  }

  if (stream) {
    console.log("stop recording");
    stream.getAudioTracks().forEach(track => track.stop());
    stream = undefined;
  }
}

const startListening = async () => {
  updateStatus("loading");
  console.log("sync");

  // Request access to the microphone.
  if (syncInterval) {
    stopSyncDetection();
    updateStatus("off");
    return;
  }

  let captureStart;

  try {
    // Capture user audio
    stream = await navigator.mediaDevices.getUserMedia({audio: true});

    // Create a MediaRecorder to capture audio.
    mediaRecorder = new MediaRecorder(stream);

    // Start recording.
    mediaRecorder.start();

    console.log("Recording started");

    // Set up a handler for when audio data is available.
    mediaRecorder.ondataavailable = async (event) => {
      // event.data is a Blob containing a short snippet of audio.
      // Create a FormData object to send the audio to your server.
      const formData = new FormData();
      formData.append('audio', event.data);

      try {
        // Send the audio to your backend (replace '/recognize' with your endpoint).
        const response = await fetch('/api/recognize', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();
        const customFile = data?.metadata?.custom_files[0];
        if (!customFile) {
          console.log("Nothing matched");
          return;
        }

        console.log(customFile);
        stopSyncDetection();

        const timestamp = customFile.play_offset_ms;
        player.src({src: `/assets/${customFile.title}_AD.aac`});
        player.on('loadeddata', () => {
          const captureEnd = Date.now();
          player.currentTime((timestamp + (captureEnd - captureStart)) / 1000);
          updateStatus("ready");
        });
      } catch (error) {
        console.error('Error sending audio data:', error);
      }
    };

    // Optionally, stop recording after a given interval (e.g., every 5 seconds)
    // or let the media recorder handle the stream continuously.
    // For a continuous stream, you might want to call mediaRecorder.requestData() periodically.
    syncInterval = setInterval(() => {
      if (mediaRecorder.state === "recording") {
        captureStart = Date.now();
        mediaRecorder.requestData();
      }
    }, 5000); // Adjust the interval as needed.
  } catch (err) {
    console.error('Error accessing the microphone:', err);
  }
}

const unmmutePlayer = function () {
  updateStatus("playing");

  player.muted(false);
}

startButton.addEventListener('click', async () => {
  switch (status) {
    case "ready":
      unmmutePlayer()
      break;
    default:
      await startListening()
      break;
  }
});
