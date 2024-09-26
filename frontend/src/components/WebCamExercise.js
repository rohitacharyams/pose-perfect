import React, { useState, useEffect, useRef } from 'react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import * as cam from '@mediapipe/camera_utils';
import * as drawingUtils from '@mediapipe/drawing_utils';
import DynamicTimeWarping from 'dynamic-time-warping';
import './WebcamExercise.css'; // Ensure you have the CSS file
import { GifReader } from 'omggif';


const WebcamExercise = () => {
  const videoRef = useRef(null);
  const mainCanvasRef = useRef(null); // Main canvas over the video

  const expectedPoseCanvasRef = useRef(null); // Canvas for expected pose in modal
  const userPoseCanvasRef = useRef(null); // Canvas for user's current pose in modal

  const [startPoseKeypoints, setStartPoseKeypoints] = useState([]);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [userKeypoints, setUserKeypoints] = useState([]);
  const [isExerciseStarted, setIsExerciseStarted] = useState(false);
  const [similarityScore, setSimilarityScore] = useState(0); // Similarity score
  const [showModal, setShowModal] = useState(false); // To control the pop-up
  const [gifStarted, setGifStarted] = useState(false);  // Add a flag to track if GIF has started
  const [counterScore, setCounterScore] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const lowScoreTimeoutRef = useRef(null);
  const [soundEffect, setSoundEffect] = useState(null);
  var gifStart = false;

  // Fetch start pose keypoints
  useEffect(() => {
    const fetchStartPose = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/start-pose');
        const data = await response.json();
        // Extract only [x, y] from [x, y, visibility]
        const keypointsXY = data.keypoints.map(kp => [kp[0], kp[1]]);
        setStartPoseKeypoints(keypointsXY);
        console.log('Start pose keypoints:', keypointsXY);
      } catch (error) {
        console.error('Error fetching start pose:', error);
      }
    };
    fetchStartPose();
  }, []);

  // Update expected pose canvas when modal is shown
  useEffect(() => {
    if (showModal && startPoseKeypoints.length > 0) {
      updateExpectedPoseCanvas();
    }
  }, [showModal, startPoseKeypoints]);

  const startCamera = () => {
    const videoElement = videoRef.current;
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    console.log('Starting camera...???????????');

    pose.onResults(onResults);

    const camera = new cam.Camera(videoElement, {
      onFrame: async () => {
        await pose.send({ image: videoElement });
      },
      width: 640,
      height: 960,
    });
    camera.start();
    setIsCameraOn(true);
  };

  const onResults = (results) => {
    // Main canvas (this is where the full video is rendered)
    const canvasElement = mainCanvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
    // Draw webcam feed on main canvas
    const videoElement = videoRef.current;
    if (videoElement) {
      canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }
  
    // If keypoints are detected, print them and draw them
    if (results.poseLandmarks) {
      const normalizedKeypoints = results.poseLandmarks.map(lm => [lm.x, lm.y]);
      // console.log('Detected Keypoints in the webcam:', normalizedKeypoints); // Print keypoints in console
  
      // Draw keypoints on the main canvas (for overlay on webcam feed)
      drawingUtils.drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 4,
      });
      drawingUtils.drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 2,
      });
  
      // Send the normalized keypoints to the backend
      setUserKeypoints(normalizedKeypoints);
      if(isExerciseStarted){
        sendKeypointsToBackend2(normalizedKeypoints, counterScore);
      }
      else 
      {
        sendKeypointsToBackend(normalizedKeypoints);
      }
  
      // Update the user pose canvas with the live webcam feed and keypoints
      updateUserPoseCanvas(normalizedKeypoints);
    }
  };

const sendKeypointsToBackend2 = async (userKeypoints, frameNumber) => {
    try {
        // Fetch the corresponding GIF keypoints from the backend
        const gifKeypointsResponse = await fetch(`http://localhost:5000/api/gif-keypoints/${frameNumber}`);
        const gifKeypoints = await gifKeypointsResponse.json();

        // Send user and GIF keypoints to the backend for comparison
        const response = await fetch('http://localhost:5000/api/compare-keypoints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userKeypoints,
                gifKeypoints
            }),
        });

        const data = await response.json();
        const similarity = data.similarityScore;
        setSimilarityScore(similarity);  // Update similarity score
    } catch (error) {
        console.error('Error sending keypoints to backend:', error);
    }
};


  
  const sendKeypointsToBackend = async (userKeypoints) => {
    try {
        const response = await fetch('http://localhost:5000/api/dtw-similarity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                startPoseKeypoints,          // Send start pose keypoints retrieved earlier
                normalizedUserKeypoints: userKeypoints,  // Send user keypoints detected via webcam
            }),
        });

        const data = await response.json();
        const similarity = data.similarityScore;
        setSimilarityScore(similarity);  // Update similarity score
    
        if(similarity >= 0.8 && !gifStart) {
          console.log('Starting the exercise brooohhhhjjdj'); // Set the flag to true to prevent further calls
          // gifStart = true;
          handleExerciseStart(); // Show the GIF when similarity score exceeds 0.8
        }
        
    } catch (error) {
        console.error('Error sending keypoints to backend:', error);
    }
};

useEffect(() => {
  if (gifStarted) {
    console.log("GIF started, value of gifStarted is true now");
  }
}, [gifStarted]);


  const updateExpectedPoseCanvas = () => {
    const canvasElement = expectedPoseCanvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Adjust these dimensions to zoom out
    const newWidth = canvasElement.width * 0.6; // scale down by 20%
    const newHeight = canvasElement.height * 0.6;

    // Load and draw the image first (from backend)
    const img = new Image();
    img.src = 'http://localhost:5000/api/frames/frame_0.png'; // Use backend URL to serve the image
    img.onload = () => {
        canvasCtx.drawImage(img, 0, 0, canvasElement.width, canvasElement.height); // Draw the image first

        if (startPoseKeypoints.length > 0) {
            // Scale the keypoints to canvas dimensions
            const scaledKeypoints = startPoseKeypoints.map(kp => ({
                x: kp[0] * newWidth,  // Scale the keypoints
                y: kp[1] * newHeight
            }));

            // Draw keypoints on top of the image
            scaledKeypoints.forEach((kp) => {
                canvasCtx.beginPath();
                canvasCtx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI); // Draw keypoint as a small circle
                canvasCtx.fillStyle = '#FF0000';  // Red color for the keypoints
                canvasCtx.fill();
                canvasCtx.closePath();
            });

            // Now, draw the connections between keypoints
            const POSE_CONNECTIONS = [
                [11, 12], [12, 14], [14, 16], [11, 13], [13, 15], // Arms
                [11, 23], [12, 24], [23, 24], // Shoulders to hips
                [23, 25], [25, 27], [27, 29], [29, 31], // Left leg
                [24, 26], [26, 28], [28, 30], [30, 32]  // Right leg
            ];

            POSE_CONNECTIONS.forEach(pair => {
                const [startIdx, endIdx] = pair;
                const start = scaledKeypoints[startIdx];
                const end = scaledKeypoints[endIdx];

                // Ensure the keypoints are valid before drawing
                if (start && end) {
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(start.x, start.y);
                    canvasCtx.lineTo(end.x, end.y);
                    canvasCtx.strokeStyle = '#00FF00';  // Green color for the connections
                    canvasCtx.lineWidth = 2;  // Adjust the thickness
                    canvasCtx.stroke();
                    canvasCtx.closePath();
                }
            });
        }
    };

    img.onerror = () => {
        console.error("Failed to load image.");
    };
};

    

  const updateUserPoseCanvas = (normalizedKeypoints) => {
    const canvasElement = userPoseCanvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the live webcam feed on the user canvas
    const videoElement = videoRef.current;
    if (videoElement) {
      canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    }

    if (normalizedKeypoints.length > 0) {
      // Scale keypoints to canvas dimensions
      const scaledKeypoints = normalizedKeypoints.map(kp => ({
        x: kp[0] * canvasElement.width,
        y: kp[1] * canvasElement.height,
      }));

      // Draw keypoints and connections on the user canvas
      drawingUtils.drawConnectors(canvasCtx, scaledKeypoints, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 4,
      });
      drawingUtils.drawLandmarks(canvasCtx, scaledKeypoints, {
        color: '#FF0000',
        lineWidth: 2,
      });

      // console.log('Drawing user pose with keypoints');
    }
  };



  useEffect(() => {
    if (!isExerciseStarted) return;
  
    if (similarityScore < 0.7) {
      soundEffect.play().catch(error => console.error('Sound play failed:', error));
    }
  
    if (similarityScore < 0.5) {
      window.alert('Warning! Your form is incorrect! Please correct your position.');
    } else {
      clearTimeout(lowScoreTimeoutRef.current);
      lowScoreTimeoutRef.current = null;
      setShowAlert(false);
    }
  }, [similarityScore, isExerciseStarted]);
  
  
  


  // Start exercise with a pop-up for the start position
  const startExercise = () => {
    setShowModal(true); // Show the pop-up with the start position
    setSimilarityScore(0); // Reset similarity score
    startCamera(); // Start camera immediately

    const sound = new Audio('/sounds/beep-warning-6387.mp3');
    setSoundEffect(sound);
    console.log('Exercise started, sound initialized!');
    console.log('Start the exercise!');
  };
  

  // Function to load the GIF into the expected pose canvas
  const updateExpectedPoseWithGIF = async () => {
    const canvasElement = expectedPoseCanvasRef.current;
    const canvasCtx = canvasElement.getContext('2d');
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  
    const response = await fetch('http://localhost:5000/api/gif/exercise.gif');
    const arrayBuffer = await response.arrayBuffer();
  
    const gifReader = new GifReader(new Uint8Array(arrayBuffer));
    const totalFrames = gifReader.numFrames();
    let frameIndex = 0;
  
    const renderFrame = () => {
      const imageData = canvasCtx.createImageData(gifReader.width, gifReader.height);
      gifReader.decodeAndBlitFrameRGBA(frameIndex, imageData.data);
      canvasCtx.putImageData(imageData, 0, 0);
  
      frameIndex = (frameIndex + 1) % totalFrames; // Loop through frames
      setTimeout(renderFrame, gifReader.frameInfo(frameIndex).delay * 10); // Adjust delay for frame rate
    };
  
    renderFrame(); // Start rendering
  };

  // Function to be called when similarity reaches 0.8 or above
  // Function to be called when similarity reaches 0.8 or above
  const handleExerciseStart = () => {
    console.log('The value of gifStarted is again in this time:', gifStarted);
    if (!gifStart) {  // Only start the GIF if it hasn't been started yet
        console.log('Starting full exercise with GIF!');
        // setGifStarted(true); // Set the flag to true to prevent further calls
        updateExpectedPoseWithGIF();
        setIsExerciseStarted(true);
        gifStart = true;
    }
  };

  // Modify the `checkStartPosition` function to show GIF once similarity is high enough
  const checkStartPosition = async (normalizedUserKeypoints) => {
    if (startPoseKeypoints.length === 0 || normalizedUserKeypoints.length === 0) {
      console.log('Keypoints not available');
      return;
    }

    // Send normalized keypoints to backend for DTW calculation
    try {
      const response = await fetch('http://localhost:5000/api/dtw-similarity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startPoseKeypoints,
          normalizedUserKeypoints
        }),
      });

      const data = await response.json();
      const similarity = data.similarityScore;
      setSimilarityScore(similarity); // Update similarity score

      console.log('Similarity score from the python script isssssss:', similarity);

      if (similarity >= 0.8) {
        console.log('Starting the fucking exercise brooooooooooooooooooooooo!');
        handleExerciseStart(); // Show the GIF when similarity score exceeds 0.8
      }
    } catch (error) {
      console.error('Error calculating similarity:', error);
    }
  };



  useEffect(() => {
    if (isExerciseStarted) {
      // Call the animateExercise function or start the comparison logic here
      checkStartPosition(userKeypoints);
      console.log('Exercise has started!');
      // Example: animateExercise();
    }
  }, [isExerciseStarted]);

  return (
    <div>
      <h3>Try the Exercise in Front of Your Webcam</h3>
      <button onClick={startCamera} disabled={isCameraOn}>
        Turn On Camera
      </button>
      <div style={{ position: 'relative', width: '640px', height: '480px', marginTop: '20px' }}>
        <video
          ref={videoRef}
          className='video-canvas'
          style={{ position: 'absolute', width: '640px', height: '480px' }}
          autoPlay
          muted
        ></video>
        <canvas
          ref={mainCanvasRef}
          className='video-canvas'
          width={640}
          height={960}
          style={{ position: 'absolute', width: '640px', height: '480px' }}
        ></canvas>
      </div>

      <button onClick={startExercise} disabled={isExerciseStarted} style={{ marginTop: '60px' }}>
        Start Exercise
      </button>

      {showAlert && (
  <div style={{
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000  // Higher zIndex to ensure it's on top
  }}>
    <div style={{
      backgroundColor: 'red',
      color: 'white',
      padding: '30px',
      border: '2px solid black',
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.5)'
    }}>
      <h2>Warning!</h2>
      <p>Your form is incorrect! Please correct your position.</p>
      <button onClick={() => setShowAlert(false)}>Dismiss</button>
    </div>
  </div>
)}


      {/* Modal for showing the starting pose and user's current pose */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Get into the starting position!</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: '1', marginRight: '10px' }}>
                <h4>Expected Pose</h4>
                <canvas
                  ref={expectedPoseCanvasRef}
                  width={320}
                  height={240}
                  style={{ border: '1px solid #000', width: '100%', height: 'auto' }}
                ></canvas>
              </div>
              <div style={{ flex: '1', marginLeft: '10px' }}>
                <h4>Your Current Pose</h4>
                <canvas
                  ref={userPoseCanvasRef}
                  width={320}
                  height={240}
                  style={{ border: '1px solid #000', width: '100%', height: 'auto' }}
                ></canvas>
              </div>
            </div>
            <p>Adjust your position to match the starting pose.</p>
            <p>Similarity Score: {similarityScore.toFixed(2)}</p>
            <p>(Once your similarity score exceeds 0.8, the exercise will begin automatically.)</p>
          </div>
        </div>
      )}




      {similarityScore > 0 && !showModal && (
        <h3>Similarity Score: {similarityScore.toFixed(2)}</h3>
      )}
    </div>
  );
};

export default WebcamExercise;
