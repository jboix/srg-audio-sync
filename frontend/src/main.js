import './style.css'

const startButton = document.getElementById('startButton');
const timestampDisplay = document.getElementById('timestamp');

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
                const response = await fetch('http://localhost:8080/recognize', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                // Assuming the response returns an object like { timestamp: "00:01:23" }
                if (data.timestamp) {
                    timestampDisplay.innerText = 'Timestamp: ' + data.timestamp;
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
