import React, { useEffect } from 'react';
import { useRecoilState } from 'recoil';
import { poseLandmarksState, selectedExerciseState } from '../state/atoms';

const { Pose } = window;

const PoseDetector = () => {
  const [poseLandmarks, setPoseLandmarks] = useRecoilState(poseLandmarksState);
  const [selectedExercise] = useRecoilState(selectedExerciseState);

  useEffect(() => {
    const videoElement = document.getElementById('webcam');
    const canvasElement = document.getElementById('output');
    const canvasCtx = canvasElement.getContext('2d');

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

    pose.onResults((results) => {
      if (results.poseLandmarks) {
        setPoseLandmarks(results.poseLandmarks);
        drawPose(results.poseLandmarks, videoElement, canvasElement, canvasCtx);
      }
    });

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        pose.send({ image: videoElement });
      };
    });

  }, [setPoseLandmarks]);

  const drawPose = (landmarks, video, canvas, ctx) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Draw keypoints
    landmarks.forEach((landmark) => {
      ctx.beginPath();
      ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    });
  };

  return (
    <div>
      <h2>Real-time User Pose</h2>
      <video id="webcam" autoPlay playsInline></video>
      <canvas id="output" width="640" height="480"></canvas>
    </div>
  );
};

export default PoseDetector;
