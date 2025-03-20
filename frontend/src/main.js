import './style.css'
import {default as Pillarbox} from "@srgssr/pillarbox-web";

let status = "off";
const player = Pillarbox('main-player', {autoplay: true, muted: true});
const startButton = document.getElementsByClassName('start-btn')[0];

let syncInterval;
let mediaRecorder;
let stream;

function stopSyncDetection() {
  console.log("stop");
  clearInterval(syncInterval);
  syncInterval = undefined;

  if (mediaRecorder) {
    console.log("stop recording");
    mediaRecorder.stop();
    mediaRecorder = undefined;
  }

  if (stream) {
    stream.getAudioTracks().forEach(track => track.stop());
    stream = undefined;
  }
}

const startListening = async () => {
  startButton.classList.toggle('loading', true);
  startButton.classList.toggle('listen', false);
  console.log("sync");

  // Request access to the microphone.
  if (syncInterval) {
    stopSyncDetection();
    return;
  }

  try {
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
        const start = Date.now();
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
          const end = Date.now();
          player.currentTime((timestamp + (end - start)) / 1000);
          startButton.classList.toggle('loading', false);
          startButton.classList.toggle('start', true);
          status = "ready"
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
        mediaRecorder.requestData();
      }
    }, 5000); // Adjust the interval as needed.
  } catch (err) {
    console.error('Error accessing the microphone:', err);
  }
}

const unmmutePlayer = function () {
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
