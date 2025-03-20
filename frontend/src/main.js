import './style.css'
import {default as Pillarbox} from "@srgssr/pillarbox-web";

const player = Pillarbox('main-player', {autoplay: true});
const startButton = document.getElementById('startButton');

startButton.addEventListener('click', async () => {
  // Request access to the microphone.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    // Create a MediaRecorder to capture audio.
    const mediaRecorder = new MediaRecorder(stream);

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
        const response = await fetch('http://localhost:8080/recognize', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        const timestamp = data?.metadata?.custom_files[0]?.play_offset_ms;
        if (timestamp) {
          player.src({src: '/assets/ad_demo.mp3'});
          player.on('loadeddata', () => {
            const end = Date.now();
            player.currentTime(timestamp + (end - start));
          });
        }
      } catch (error) {
        console.error('Error sending audio data:', error);
      }
    };

    // Optionally, stop recording after a given interval (e.g., every 5 seconds)
    // or let the media recorder handle the stream continuously.
    // For a continuous stream, you might want to call mediaRecorder.requestData() periodically.
    setInterval(() => {
      if (mediaRecorder.state === "recording") {
        mediaRecorder.requestData();
      }
    }, 5000); // Adjust the interval as needed.

  } catch (err) {
    console.error('Error accessing the microphone:', err);
  }
});
