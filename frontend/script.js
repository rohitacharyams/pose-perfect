// Define global variables
let poseDetector;
let videoElement;
let canvasElement;
let canvasCtx;
let poseLandmarks = [];
let exerciseGifKeypoints = [];

// Set up Mediapipe Pose
const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
});

pose.onResults(onPoseResults);

// Initialize webcam video
async function initializeCamera() {
    videoElement = document.getElementById('webcam');
    canvasElement = document.getElementById('output');
    canvasCtx = canvasElement.getContext('2d');

    const stream = await navigator.mediaDevices.getUserMedia({
        video: true
    });
    videoElement.srcObject = stream;
}

// Callback to handle pose results
function onPoseResults(results) {
    if (!results.poseLandmarks) {
        return;
    }

    // Draw user pose on canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

    // Draw pose landmarks
    for (const landmark of results.poseLandmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 5, 0, 2 * Math.PI);
        canvasCtx.fillStyle = "red";
        canvasCtx.fill();
    }

    poseLandmarks = results.poseLandmarks;
    provideRealTimeFeedback();
}

// Function to compare user pose to the exercise keypoints
function provideRealTimeFeedback() {
    if (poseLandmarks.length === 0 || exerciseGifKeypoints.length === 0) {
        return;
    }

    let feedback = '';

    // Basic comparison of left shoulder angles as an example
    const leftShoulderUser = poseLandmarks[11]; // Mediapipe landmark for left shoulder
    const leftShoulderGif = exerciseGifKeypoints[11];

    const dxUser = leftShoulderUser.x - poseLandmarks[13].x; // Left elbow
    const dyUser = leftShoulderUser.y - poseLandmarks[13].y;

    const dxGif = leftShoulderGif.x - exerciseGifKeypoints[13].x;
    const dyGif = leftShoulderGif.y - exerciseGifKeypoints[13].y;

    const angleUser = Math.atan2(dyUser, dxUser);
    const angleGif = Math.atan2(dyGif, dxGif);

    const angleDifference = Math.abs(angleUser - angleGif) * (180 / Math.PI);

    if (angleDifference > 10) {
        feedback = "Adjust your left shoulder angle!";
    } else {
        feedback = "Good form!";
    }

    document.getElementById("feedback").innerText = feedback;
}

// Fetch the exercise data from backend
async function fetchExerciseData(exerciseName) {
    const response = await fetch(`http://127.0.0.1:5000/api/exercises/name/${exerciseName}`);
    const exerciseData = await response.json();
    const gifUrl = exerciseData[0].gifUrl;
    const exerciseGif = document.getElementById('exercise-gif');
    exerciseGif.src = gifUrl;

    // Simulate fetching keypoints (to be replaced with actual GIF analysis)
    exerciseGifKeypoints = await extractGifKeypoints(gifUrl);
}

// Example function for extracting keypoints from a GIF (replace with real implementation)
async function extractGifKeypoints(gifUrl) {
    // Placeholder: Fetch keypoints from the GIF (requires additional processing)
    return Array(33).fill({ x: Math.random(), y: Math.random() }); // Simulated keypoints
}

// Start pose detection when page loads
window.onload = async () => {
    await initializeCamera();
    pose.send({ image: videoElement });

    // Set up exercise selection dropdown
    const dropdown = document.getElementById('exercise-dropdown');
    dropdown.addEventListener('change', async (e) => {
        const exerciseName = e.target.value;
        await fetchExerciseData(exerciseName);
    });

    // Populate dropdown with exercises (replace with dynamic fetch)
    dropdown.innerHTML = `<option value="squat">Squat</option>
                          <option value="pushup">Push-Up</option>`;
};
